const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requerirAuth } = require("../auth");

// Color hex aceptado: #RGB o #RRGGBB (con o sin mayúsculas).
const REGEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Mismo default que la columna `categorias.color`.
const COLOR_POR_DEFECTO = "#0066FF";

// ------------------------------------------------------------
// Validación compartida de POST y PUT.
// Devuelve { campos: { nombre?, color? } } o { error } (para responder 400).
// - `nombre` llega solo si vino en el body: se trimmea, no puede quedar
//   vacío ni superar los 100 caracteres (largo de la columna).
// - `color` debe ser hex #RRGGBB o #RGB. En POST, si no viene se usa el
//   default de la columna (#0066FF); en PUT, si no viene se conserva el actual.
// ------------------------------------------------------------
function validarCampos(body, { requerirNombre }) {
  const campos = {};

  if (body.nombre === undefined || body.nombre === null) {
    if (requerirNombre) return { error: "Falta el nombre de la categoría" };
  } else {
    const nombre = String(body.nombre).trim();
    if (!nombre) return { error: "El nombre de la categoría no puede estar vacío" };
    if (nombre.length > 100) {
      return { error: "El nombre de la categoría no puede superar los 100 caracteres" };
    }
    campos.nombre = nombre;
  }

  if (body.color === undefined || body.color === null) {
    if (requerirNombre) campos.color = COLOR_POR_DEFECTO;
  } else {
    const color = String(body.color).trim();
    if (!REGEX_COLOR.test(color)) {
      return { error: "El color debe ser un código hex válido, por ejemplo #0066FF" };
    }
    campos.color = color;
  }

  return { campos };
}

// Convierte el :id de la URL en un entero positivo (o null si es basura).
function parsearId(crudo) {
  const id = Number(crudo);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// ¿Existe ya otra categoría con ese nombre (ignorando mayúsculas/espacios)?
async function nombreDuplicado(cliente, nombre, idExcluir) {
  const { rows } = await cliente.query(
    `SELECT id FROM categorias
     WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))
       AND ($2::INT IS NULL OR id <> $2)`,
    [nombre, idExcluir ?? null]
  );
  return rows.length > 0;
}

// Cuenta los productos que apuntan a la categoría por nombre (comparación
// normalizada, igual que el JOIN del GET). Es el número que se muestra en la
// UI y el que bloquea el borrado.
async function contarProductosDe(cliente, nombre) {
  const { rows } = await cliente.query(
    `SELECT COUNT(*)::INTEGER AS total
     FROM productos
     WHERE LOWER(TRIM(categoria)) = LOWER(TRIM($1))`,
    [nombre]
  );
  return rows[0].total;
}

// ------------------------------------------------------------
// GET /api/categorias — público.
// Devuelve [{ id, nombre, color, productos }] ordenado por nombre ASC.
// `productos` es el conteo de productos en esa categoría (LEFT JOIN: las
// categorías vacías también se listan con productos en 0).
// ------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.id, c.nombre, c.color, COUNT(p.id)::INTEGER AS productos
       FROM categorias c
       LEFT JOIN productos p
         ON LOWER(TRIM(p.categoria)) = LOWER(TRIM(c.nombre))
       GROUP BY c.id, c.nombre, c.color
       ORDER BY c.nombre ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener categorías" });
  }
});

// POST /api/categorias — crear (solo admin).
// Body: { nombre, color }. Responde 201 con la categoría creada (conteo 0)
// o 409 si ya existe otra con ese nombre (comparando LOWER(TRIM(nombre))).
router.post("/", requerirAuth, async (req, res) => {
  const validacion = validarCampos(req.body || {}, { requerirNombre: true });
  if (validacion.error) return res.status(400).json({ error: validacion.error });
  const { nombre, color } = validacion.campos;

  try {
    if (await nombreDuplicado(pool, nombre, null)) {
      return res.status(409).json({ error: "Ya existe una categoría con ese nombre" });
    }

    // INSERT sin id a mano: SERIAL + RETURNING (la secuencia avanza sola).
    const { rows } = await pool.query(
      "INSERT INTO categorias (nombre, color) VALUES ($1, $2) RETURNING id, nombre, color",
      [nombre, color]
    );

    res.status(201).json({ ...rows[0], productos: 0 });
  } catch (err) {
    // 23505 = UNIQUE violado (carrera entre dos POST simultáneos).
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ya existe una categoría con ese nombre" });
    }
    console.error(err);
    res.status(500).json({ error: "Error al crear la categoría" });
  }
});

// PUT /api/categorias/:id — editar (solo admin).
// Body: { nombre?, color? } (al menos uno). Al renombrar, en UNA sola
// transacción se actualiza también `productos.categoria` de los productos
// que tenían el nombre viejo, así no quedan huérfanos y siguen apareciendo
// en el filtro del frontend.
router.put("/:id", requerirAuth, async (req, res) => {
  const id = parsearId(req.params.id);
  if (!id) return res.status(404).json({ error: "Categoría no encontrada" });

  const validacion = validarCampos(req.body || {}, { requerirNombre: false });
  if (validacion.error) return res.status(400).json({ error: validacion.error });
  const campos = validacion.campos;

  if (campos.nombre === undefined && campos.color === undefined) {
    return res.status(400).json({ error: "Faltan campos para actualizar" });
  }

  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    const { rows: actuales } = await cliente.query(
      "SELECT id, nombre, color FROM categorias WHERE id = $1",
      [id]
    );
    if (actuales.length === 0) {
      await cliente.query("ROLLBACK");
      return res.status(404).json({ error: "Categoría no encontrada" });
    }

    const actual = actuales[0];
    const nombreViejo = actual.nombre;
    const nombreNuevo = campos.nombre !== undefined ? campos.nombre : actual.nombre;
    const colorNuevo = campos.color !== undefined ? campos.color : actual.color;

    if (campos.nombre !== undefined && nombreNuevo !== nombreViejo) {
      if (await nombreDuplicado(cliente, nombreNuevo, actual.id)) {
        await cliente.query("ROLLBACK");
        return res.status(409).json({ error: "Ya existe una categoría con ese nombre" });
      }
    }

    await cliente.query(
      "UPDATE categorias SET nombre = $1, color = $2 WHERE id = $3",
      [nombreNuevo, colorNuevo, actual.id]
    );

    // Renombrar sin orfanizar: los productos que apuntaban al nombre viejo
    // (comparado normalizado) pasan a apuntar al nuevo, todo en la misma
    // transacción. Si algo falla, se revierte todo (ROLLBACK en el catch).
    if (nombreNuevo !== nombreViejo) {
      await cliente.query(
        "UPDATE productos SET categoria = $1 WHERE LOWER(TRIM(categoria)) = LOWER(TRIM($2))",
        [nombreNuevo, nombreViejo]
      );
    }

    const productos = await contarProductosDe(cliente, nombreNuevo);
    await cliente.query("COMMIT");

    res.json({ id: actual.id, nombre: nombreNuevo, color: colorNuevo, productos });
  } catch (err) {
    await cliente.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") {
      return res.status(409).json({ error: "Ya existe una categoría con ese nombre" });
    }
    console.error(err);
    res.status(500).json({ error: "Error al actualizar la categoría" });
  } finally {
    cliente.release();
  }
});

// DELETE /api/categorias/:id — eliminar (solo admin).
// Si la categoría tiene productos asociados NO se borra: 400 con el conteo
// real, para que el admin los mueva o reasigne primero.
router.delete("/:id", requerirAuth, async (req, res) => {
  const id = parsearId(req.params.id);
  if (!id) return res.status(404).json({ error: "Categoría no encontrada" });

  try {
    const { rows } = await pool.query(
      "SELECT nombre FROM categorias WHERE id = $1",
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Categoría no encontrada" });

    const total = await contarProductosDe(pool, rows[0].nombre);
    if (total > 0) {
      return res.status(400).json({
        error: `No se puede eliminar: hay ${total} productos en esa categoría. Movelos o reasignalos antes.`,
      });
    }

    const { rowCount } = await pool.query("DELETE FROM categorias WHERE id = $1", [id]);
    if (rowCount === 0) return res.status(404).json({ error: "Categoría no encontrada" });

    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al eliminar la categoría" });
  }
});

module.exports = router;
