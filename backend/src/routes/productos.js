const express = require("express");
const router = express.Router();
const pool = require("../db");
const { cloudinary, upload } = require("../cloudinary");
const { requerirAuth } = require("../auth");

// Columnas nuevas de envío (peso en gramos y dimensiones en centímetros).
const CAMPOS_DIMENSION = ["peso_g", "alto_cm", "ancho_cm", "largo_cm"];

// Lee las dimensiones del body (llegan como strings desde multipart/form-data)
// y las convierte a enteros con Math.round(Number(x)).
// - Si un campo no viene (o viene vacío), se usa el valor por defecto:
//     en POST pasamos {} → queda 0; en PUT pasamos la fila actual → se conserva.
// - Si el valor no es numérico o es negativo, se devuelve { error } en español.
function leerDimensiones(body, valoresActuales) {
  const valores = {};

  for (const campo of CAMPOS_DIMENSION) {
    const crudo = body[campo];

    if (crudo === undefined || crudo === null || crudo === "") {
      // No vino el campo: conservar el valor actual (o 0 si no hay)
      valores[campo] = valoresActuales[campo] ?? 0;
      continue;
    }

    const numero = Number(crudo);
    if (!Number.isFinite(numero) || numero < 0) {
      return {
        error: `El campo ${campo} debe ser un número entero mayor o igual a 0`,
      };
    }

    valores[campo] = Math.round(numero);
  }

  return { valores };
}

// GET /api/productos — listar todos
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM productos ORDER BY id ASC"
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener productos" });
  }
});

// GET /api/productos/:id — obtener uno
router.get("/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM productos WHERE id = $1",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al obtener producto" });
  }
});

// POST /api/productos — crear con imagen opcional (solo admin)
router.post("/", requerirAuth, upload.single("imagen"), async (req, res) => {
  const { nombre, categoria, precio, descripcion, stock } = req.body;

  if (!nombre || !categoria || !precio || !descripcion || stock === undefined) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  // Dimensiones nuevas: si no vienen, quedan en 0 (columna NOT NULL DEFAULT 0)
  const dimensiones = leerDimensiones(req.body, {});
  if (dimensiones.error) {
    return res.status(400).json({ error: dimensiones.error });
  }
  const { peso_g, alto_cm, ancho_cm, largo_cm } = dimensiones.valores;

  const imagen_url = req.file ? req.file.path : null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO productos (nombre, categoria, precio, descripcion, stock, imagen_url,
                              peso_g, alto_cm, ancho_cm, largo_cm)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [nombre, categoria, precio, descripcion, stock, imagen_url,
       peso_g, alto_cm, ancho_cm, largo_cm]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al crear producto" });
  }
});

// PUT /api/productos/:id — editar con imagen opcional (solo admin)
router.put("/:id", requerirAuth, upload.single("imagen"), async (req, res) => {
  const { nombre, categoria, precio, descripcion, stock } = req.body;

  try {
    // Traemos la fila actual: la imagen (por si hay que borrar la de
    // Cloudinary) y las dimensiones (para conservar las que no se manden).
    const { rows: actuales } = await pool.query(
      "SELECT imagen_url, peso_g, alto_cm, ancho_cm, largo_cm FROM productos WHERE id = $1",
      [req.params.id]
    );
    if (actuales.length === 0) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }
    const filaActual = actuales[0];

    // Primero validamos las dimensiones: si hay error, cortamos antes de
    // tocar la imagen de Cloudinary (así no se borra por un 400).
    // Campos que no vienen en el body → se conserva el valor actual de la fila.
    const dimensiones = leerDimensiones(req.body, filaActual);
    if (dimensiones.error) {
      return res.status(400).json({ error: dimensiones.error });
    }
    const { peso_g, alto_cm, ancho_cm, largo_cm } = dimensiones.valores;

    // Si viene imagen nueva, eliminar la anterior de Cloudinary
    if (req.file && filaActual.imagen_url) {
      // Extraer public_id de la URL de Cloudinary y eliminar
      const url = filaActual.imagen_url;
      const publicId = url
        .split("/upload/")[1]        // toma todo lo que viene después de /upload/
        .replace(/^v\d+\//, "")     // elimina la versión (v1234567890/)
        .replace(/\.[^/.]+$/, "");  // elimina la extensión (.jpg, .png, etc.)
      await cloudinary.uploader.destroy(publicId).catch(() => {});
    }

    const imagen_url = req.file ? req.file.path : undefined;

    const { rows } = await pool.query(
      `UPDATE productos
       SET nombre=$1, categoria=$2, precio=$3, descripcion=$4, stock=$5,
           peso_g=$6, alto_cm=$7, ancho_cm=$8, largo_cm=$9
       ${imagen_url !== undefined ? ", imagen_url=$10" : ""}
       WHERE id=${imagen_url !== undefined ? "$11" : "$10"} RETURNING *`,
      imagen_url !== undefined
        ? [nombre, categoria, precio, descripcion, stock,
           peso_g, alto_cm, ancho_cm, largo_cm, imagen_url, req.params.id]
        : [nombre, categoria, precio, descripcion, stock,
           peso_g, alto_cm, ancho_cm, largo_cm, req.params.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: "Producto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

// DELETE /api/productos/:id — eliminar producto e imagen (solo admin)
router.delete("/:id", requerirAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT imagen_url FROM productos WHERE id = $1",
      [req.params.id]
    );

    if (rows[0]?.imagen_url) {
      const url = rows[0].imagen_url;
      const publicId = url
        .split("/upload/")[1]
        .replace(/^v\d+\//, "")
        .replace(/\.[^/.]+$/, "");
      await cloudinary.uploader.destroy(publicId);
    }

    const { rowCount } = await pool.query(
      "DELETE FROM productos WHERE id = $1",
      [req.params.id]
    );
    if (rowCount === 0) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error al eliminar:", err);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});

module.exports = router;