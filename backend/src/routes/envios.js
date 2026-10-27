const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requerirAuth } = require("../auth");

// ============================================================
// Envíos Andreani — cotización + CRUD de tarifas y destinos por provincia.
//
// Política de negocio (definitiva): el cliente SIEMPRE paga el envío real.
// Sin envío gratis, sin mínimos. El costo base sale de las franjas de
// `tarifas_envio` (según peso/volumen del carrito) más los opcionales
// (seguro / express) de `envio_opcionales` que el cliente elija pagar.
//
// Desde la migración 2026-10-24 la cotización puede ser POR PROVINCIA:
// - `envio_destinos` guarda, por franja y provincia, el costo que nos cobra
//   Andreani (dato del admin, solo visible con auth).
// - El precio de venta se calcula con el margen global de
//   `envio_config.margen_pct`: ceil(costo * (1 + margen/100) / 100) * 100
//   (redondeo hacia arriba en múltiplos de $100).
// - Sin fila activa para la provincia del cliente → fallback al precio
//   nacional de `tarifas_envio` (comportamiento anterior, cero regresión).
// - La columna `provincia` se guarda NORMALIZADA (sin acentos, minúsculas,
//   espacios simples): "Córdoba", "CÓRDOBA" y "  cordoba " son la misma fila.
//
// Andreani NO se usa por API en este flujo: los envíos se despachan a mano
// (kit de despacho del admin). Este archivo solo cotiza contra la tabla
// local y administra las tarifas.
// ============================================================

// Peso de reserva (en gramos) por unidad, aplicado cuando el producto tiene
// peso_g = 0 ("sin cargar"). 15 kg es conservador a propósito: mientras el
// admin no cargue los pesos reales preferimos cobrar un poco de más antes
// que cobrar de menos y tener que comerse la diferencia.
const PESO_RESERVA_G = 15000;

// Lado del bulto (cm) a partir del cual la cotización cae en la franja de
// "Bici en caja" (requiere_caja_grande). Equivale a un volumen de 216.000 cm³.
const LADO_EQUIVALENTE_CAJA_GRANDE = 60;

// ------------------------------------------------------------
// Normaliza una provincia para poder compararla de forma robusta:
// quita los acentos (NFD + colgar los diacríticos), pasá a minúsculas,
// colapsa los espacios de más y recorta los extremos.
// Así "Córdoba", "CORDOBA" y "  cordoba " matchean la misma fila de
// `envio_destinos`, sin depender de cómo la tipeó el cliente o el admin.
// Sin dependencias externas.
// ------------------------------------------------------------
function normalizarProvincia(texto) {
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ------------------------------------------------------------
// POST /api/envios/cotizar — PÚBLICA (la llama el checkout antes de pagar)
// Body: { items: [{ producto_id, cantidad }], seguro?: bool, express?: bool,
//         provincia?: string }
// `provincia` es opcional: si viene, se intenta usar el precio por provincia
// de `envio_destinos` (costo Andreani + margen global); si no hay fila activa
// se cae al precio nacional de la franja (igual que antes).
// ------------------------------------------------------------
router.post("/cotizar", async (req, res) => {
  const { items, seguro, express, provincia } = req.body || {};

  // Validación básica: se necesita al menos un item para cotizar
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Se requiere al menos un item para cotizar el envío" });
  }

  // Cada item debe traer un producto_id entero positivo y cantidad entera >= 1
  for (const item of items) {
    const productoId = Number(item && item.producto_id);
    const cantidad = Number(item && item.cantidad);
    if (!Number.isInteger(productoId) || productoId <= 0) {
      return res.status(400).json({ error: "Items inválidos: cada item necesita un producto_id entero" });
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      return res.status(400).json({ error: "Items inválidos: cada item necesita una cantidad mayor a 0" });
    }
  }

  try {
    // Traemos peso y dimensiones de los productos del carrito
    const productoIds = items.map((i) => Number(i.producto_id));
    const { rows: productos } = await pool.query(
      "SELECT id, nombre, peso_g, alto_cm, ancho_cm, largo_cm FROM productos WHERE id = ANY($1)",
      [productoIds]
    );
    const porId = new Map(productos.map((p) => [p.id, p]));

    for (const item of items) {
      if (!porId.has(Number(item.producto_id))) {
        return res.status(400).json({ error: `Producto no encontrado: ${item.producto_id}` });
      }
    }

    // Peso total (con peso de reserva para los productos sin cargar) y
    // volumen total (solo de los que tengan medidas cargadas).
    let pesoTotal = 0;
    let volumenTotal = 0;
    for (const item of items) {
      const prod = porId.get(Number(item.producto_id));
      const cantidad = Number(item.cantidad);
      const pesoUnitario = prod.peso_g > 0 ? prod.peso_g : PESO_RESERVA_G;
      pesoTotal += pesoUnitario * cantidad;

      if (prod.alto_cm > 0 && prod.ancho_cm > 0 && prod.largo_cm > 0) {
        volumenTotal += prod.alto_cm * prod.ancho_cm * prod.largo_cm * cantidad;
      }
    }

    // "Lado" de un cubo con el mismo volumen que el carrito total.
    // Sirve para detectar bultos grandes aunque el peso esté sin cargar.
    const ladoEquivalente = Math.cbrt(volumenTotal);

    // Franjas activas, en el orden que definió el admin
    const { rows: franjas } = await pool.query(
      "SELECT * FROM tarifas_envio WHERE activa = TRUE ORDER BY orden ASC, id ASC"
    );
    if (franjas.length === 0) {
      return res.status(500).json({ error: "No hay franjas de envío activas configuradas" });
    }

    // Selección de franja:
    // 1) Si el bulto supera el lado equivalente → franja de caja grande
    //    (si no hubiera ninguna activa, caemos al match por peso).
    // 2) Si no → franja cuyo rango de peso contiene el peso total.
    // 3) Si el peso no entra en ninguna franja (más de la última) → la de
    //    mayor peso_max_g activa.
    let franja = null;
    if (ladoEquivalente > LADO_EQUIVALENTE_CAJA_GRANDE) {
      franja = franjas.find((f) => f.requiere_caja_grande) || null;
    }
    if (!franja) {
      franja =
        franjas.find((f) => pesoTotal >= f.peso_min_g && pesoTotal <= f.peso_max_g) || null;
    }
    if (!franja) {
      franja = franjas.reduce(
        (max, f) => (f.peso_max_g > max.peso_max_g ? f : max),
        franjas[0]
      );
    }

    // Opcionales (registro único id = 1)
    const { rows: opcionalesRows } = await pool.query(
      "SELECT * FROM envio_opcionales WHERE id = 1"
    );
    const op = opcionalesRows[0] || null;

    const seguroActivo = Boolean(op && op.seguro_activo);
    const expressActivo = Boolean(op && op.express_activo);
    // Nunca cobramos algo desactivado en la tabla, aunque el request lo pida.
    const seguroAplicado = Boolean(seguro) && seguroActivo;
    const expressAplicado = Boolean(express) && expressActivo;

    // ----- Precio por provincia (migración 2026-10-24) -----
    // Si el cliente mandó provincia, buscamos el costo de Andreani para esa
    // (franja, provincia) en `envio_destinos`. Si hay fila ACTIVA, el precio
    // de venta = ceil(costo * (1 + margen/100) / 100) * 100 (redondeo hacia
    // arriba en múltiplos de $100). Si no hay fila o está inactiva → fallback
    // al precio nacional de la franja (comportamiento viejo, cero regresión).
    let base = Number(franja.precio);
    let destinoPrecioProvincia = false;
    let provinciaNormalizada = null;

    if (typeof provincia === "string" && provincia.trim() !== "") {
      provinciaNormalizada = normalizarProvincia(provincia);

      const { rows: destinos } = await pool.query(
        "SELECT costo, activo FROM envio_destinos WHERE franja_id = $1 AND provincia = $2",
        [franja.id, provinciaNormalizada]
      );
      const destino = destinos[0];

      if (destino && destino.activo && Number(destino.costo) >= 0) {
        const { rows: configRows } = await pool.query(
          "SELECT margen_pct FROM envio_config WHERE id = 1"
        );
        const margenPct = configRows[0] ? Number(configRows[0].margen_pct) : 0;
        base = Math.ceil((Number(destino.costo) * (1 + margenPct / 100)) / 100) * 100;
        destinoPrecioProvincia = true;
      }
    }

    const precioSeguro = op ? Number(op.seguro_precio) : 0;
    const precioExpress = op ? Number(op.express_precio) : 0;
    const total =
      base + (seguroAplicado ? precioSeguro : 0) + (expressAplicado ? precioExpress : 0);

    res.json({
      etiqueta: franja.etiqueta,
      peso_g: pesoTotal,
      base,
      seguro: {
        etiqueta: op ? op.seguro_etiqueta : "",
        precio: precioSeguro,
        activo: seguroActivo,
        aplicado: seguroAplicado,
      },
      express: {
        etiqueta: op ? op.express_etiqueta : "",
        precio: precioExpress,
        activo: expressActivo,
        aplicado: expressAplicado,
      },
      total,
      // Info extra (no rompe a consumidores viejos): qué provincia se usó y
      // si el precio salió de `envio_destinos` (true) o del nacional (false).
      destino: {
        provincia: provinciaNormalizada,
        precio_destino: destinoPrecioProvincia,
      },
    });
  } catch (err) {
    console.error("Error cotizando envío:", err);
    res.status(500).json({ error: "Error al cotizar el envío" });
  }
});

// ------------------------------------------------------------
// Validación compartida de una franja (POST y PUT de tarifas).
// Devuelve { error } si algo está mal, o los valores ya saneados.
// ------------------------------------------------------------
function validarFranja(body) {
  const b = body || {};
  const etiqueta = typeof b.etiqueta === "string" ? b.etiqueta.trim() : "";
  const pesoMin = Number(b.peso_min_g);
  const pesoMax = Number(b.peso_max_g);
  const precio = Number(b.precio);
  const requiereCajaGrande = Boolean(b.requiere_caja_grande);
  const activa = b.activa === undefined ? true : Boolean(b.activa);

  // orden es opcional: si no viene, lo calcula el servidor (MAX(orden)+1)
  // para que la franja nueva quede última. Si viene, tiene que ser un entero
  // >= 0 (ver validación de abajo).
  let orden = null;
  if (b.orden !== undefined && b.orden !== null && b.orden !== "") {
    orden = Number(b.orden);
  }

  if (!etiqueta) return { error: "La etiqueta es requerida" };
  if (!Number.isInteger(pesoMin) || pesoMin < 1) {
    return { error: "peso_min_g debe ser un entero mayor o igual a 1" };
  }
  if (!Number.isInteger(pesoMax) || pesoMax < pesoMin) {
    return { error: "peso_max_g debe ser un entero mayor o igual a peso_min_g" };
  }
  if (!Number.isInteger(precio) || precio < 0) {
    return { error: "precio debe ser un entero mayor o igual a 0" };
  }
  if (orden !== null && (!Number.isInteger(orden) || orden < 0)) {
    return { error: "orden debe ser un número entero mayor o igual a 0" };
  }

  return { etiqueta, pesoMin, pesoMax, precio, requiereCajaGrande, activa, orden };
}

// ------------------------------------------------------------
// GET /api/envios/tarifas — listado para el panel (solo admin)
// ------------------------------------------------------------
router.get("/tarifas", requerirAuth, async (req, res) => {
  try {
    const { rows: franjas } = await pool.query(
      "SELECT * FROM tarifas_envio ORDER BY orden ASC, id ASC"
    );
    const { rows: opcionalesRows } = await pool.query(
      "SELECT * FROM envio_opcionales WHERE id = 1"
    );
    res.json({ franjas, opcionales: opcionalesRows[0] || null });
  } catch (err) {
    console.error("Error obteniendo tarifas:", err);
    res.status(500).json({ error: "Error al obtener las tarifas de envío" });
  }
});

// ------------------------------------------------------------
// POST /api/envios/tarifas — crear franja (solo admin)
// ------------------------------------------------------------
router.post("/tarifas", requerirAuth, async (req, res) => {
  const v = validarFranja(req.body);
  if (v.error) return res.status(400).json({ error: v.error });

  try {
    // El id se calcula a mano porque la secuencia de `tarifas_envio` quedó
    // desincronizada en la migración (la semilla insertó ids 1..6 sin avanzar
    // nextval, así que nextval chocaría con la franja existente); cuando
    // AgDataBase sincronice la secuencia (setval) esto sigue siendo válido.
    //
    // El `orden` viene del body ($7); si el body no lo trae llega NULL y el
    // COALESCE usa MAX(orden)+1, con lo que la franja nueva queda última y
    // no se viola el NOT NULL de la columna (antes se pasaba null explícito
    // y el DEFAULT 0 de la columna no llegaba a aplicarse).
    const { rows } = await pool.query(
      `INSERT INTO tarifas_envio (id, etiqueta, peso_min_g, peso_max_g, precio, requiere_caja_grande, activa, orden)
       VALUES (
         (SELECT COALESCE(MAX(id), 0) + 1 FROM tarifas_envio),
         $1, $2, $3, $4, $5, $6,
         COALESCE($7::int, (SELECT COALESCE(MAX(orden), 0) + 1 FROM tarifas_envio))
       )
       RETURNING *`,
      [v.etiqueta, v.pesoMin, v.pesoMax, v.precio, v.requiereCajaGrande, v.activa, v.orden]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("Error creando tarifa:", err);
    res.status(500).json({ error: "Error al crear la tarifa" });
  }
});

// ------------------------------------------------------------
// PUT /api/envios/tarifas/:id — editar franja (solo admin)
// ------------------------------------------------------------
router.put("/tarifas/:id", requerirAuth, async (req, res) => {
  const v = validarFranja(req.body);
  if (v.error) return res.status(400).json({ error: v.error });

  try {
    // Si el body no trae `orden`, no se toca el actual (COALESCE): si no,
    // el UPDATE chocaría igual contra el NOT NULL de la columna.
    const { rows } = await pool.query(
      `UPDATE tarifas_envio
       SET etiqueta = $1, peso_min_g = $2, peso_max_g = $3, precio = $4,
           requiere_caja_grande = $5, activa = $6, orden = COALESCE($7::int, orden)
       WHERE id = $8
       RETURNING *`,
      [v.etiqueta, v.pesoMin, v.pesoMax, v.precio, v.requiereCajaGrande, v.activa, v.orden, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Tarifa no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Error actualizando tarifa:", err);
    res.status(500).json({ error: "Error al actualizar la tarifa" });
  }
});

// ------------------------------------------------------------
// DELETE /api/envios/tarifas/:id — eliminar franja (solo admin).
// Guardia: no se puede borrar la última franja ACTIVA, porque sin franjas
// activas la cotización del checkout se rompería para todos.
// ------------------------------------------------------------
router.delete("/tarifas/:id", requerirAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, activa FROM tarifas_envio WHERE id = $1",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Tarifa no encontrada" });

    if (rows[0].activa) {
      const { rows: conteo } = await pool.query(
        "SELECT COUNT(*)::int AS n FROM tarifas_envio WHERE activa = TRUE"
      );
      if (conteo[0].n <= 1) {
        return res.status(400).json({ error: "No se puede eliminar la última franja activa" });
      }
    }

    await pool.query("DELETE FROM tarifas_envio WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error eliminando tarifa:", err);
    res.status(500).json({ error: "Error al eliminar la tarifa" });
  }
});

// ------------------------------------------------------------
// PUT /api/envios/opcionales — editar el registro único id = 1 (solo admin).
// Acepta campos parciales: lo que no viene se mantiene.
// ------------------------------------------------------------
router.put("/opcionales", requerirAuth, async (req, res) => {
  const b = req.body || {};

  try {
    const { rows } = await pool.query("SELECT * FROM envio_opcionales WHERE id = 1");
    if (rows.length === 0) {
      return res.status(404).json({ error: "No existe el registro de opcionales" });
    }
    const actual = rows[0];

    const seguroEtiqueta =
      b.seguro_etiqueta !== undefined
        ? String(b.seguro_etiqueta).trim()
        : actual.seguro_etiqueta;
    const expressEtiqueta =
      b.express_etiqueta !== undefined
        ? String(b.express_etiqueta).trim()
        : actual.express_etiqueta;
    const seguroPrecio =
      b.seguro_precio !== undefined ? Number(b.seguro_precio) : actual.seguro_precio;
    const expressPrecio =
      b.express_precio !== undefined ? Number(b.express_precio) : actual.express_precio;
    const seguroActivo =
      b.seguro_activo !== undefined ? Boolean(b.seguro_activo) : actual.seguro_activo;
    const expressActivo =
      b.express_activo !== undefined ? Boolean(b.express_activo) : actual.express_activo;

    if (!seguroEtiqueta) return res.status(400).json({ error: "La etiqueta del seguro no puede quedar vacía" });
    if (!expressEtiqueta) return res.status(400).json({ error: "La etiqueta del express no puede quedar vacía" });
    if (!Number.isInteger(seguroPrecio) || seguroPrecio < 0) {
      return res.status(400).json({ error: "seguro_precio debe ser un entero mayor o igual a 0" });
    }
    if (!Number.isInteger(expressPrecio) || expressPrecio < 0) {
      return res.status(400).json({ error: "express_precio debe ser un entero mayor o igual a 0" });
    }

    const { rows: actualizadas } = await pool.query(
      `UPDATE envio_opcionales
       SET seguro_etiqueta = $1, seguro_precio = $2, seguro_activo = $3,
           express_etiqueta = $4, express_precio = $5, express_activo = $6
       WHERE id = 1
       RETURNING *`,
      [seguroEtiqueta, seguroPrecio, seguroActivo, expressEtiqueta, expressPrecio, expressActivo]
    );
    res.json(actualizadas[0]);
  } catch (err) {
    console.error("Error actualizando opcionales:", err);
    res.status(500).json({ error: "Error al actualizar los opcionales de envío" });
  }
});

// ------------------------------------------------------------
// GET /api/envios/destinos — estado para el panel (solo admin).
// NUNCA público: los costos de Andreani no deben salir sin token.
// Devuelve el margen global, las franjas (para que el admin sepa a cuáles
// les puede cargar destinos) y los destinos cargados.
// `provincia` viene normalizada (sin acentos, minúsculas); el frontend la
// muestra con capitalización propia o armado el nombre que quiera.
// ------------------------------------------------------------
router.get("/destinos", requerirAuth, async (req, res) => {
  try {
    const { rows: configRows } = await pool.query(
      "SELECT margen_pct FROM envio_config WHERE id = 1"
    );
    const { rows: franjas } = await pool.query(
      "SELECT id, etiqueta, requiere_caja_grande, activa FROM tarifas_envio ORDER BY orden ASC, id ASC"
    );
    const { rows: destinos } = await pool.query(
      "SELECT franja_id, provincia, costo, activo FROM envio_destinos ORDER BY franja_id ASC, provincia ASC"
    );

    res.json({
      margen_pct: configRows[0] ? Number(configRows[0].margen_pct) : 0,
      franjas,
      destinos,
    });
  } catch (err) {
    console.error("Error obteniendo destinos de envío:", err);
    res.status(500).json({ error: "Error al obtener los destinos de envío" });
  }
});

// ------------------------------------------------------------
// PUT /api/envios/destinos — guardar destinos y/o margen (solo admin).
// Body: {
//   margen_pct?: number,            // entero 0..100 (opcional: si no viene, no se toca)
//   destinos: [                     // upsert por fila; las filas que no
//     {                             // vienen en la lista NO se borran
//       franja_id: number,          // debe existir en tarifas_envio
//       provincia: string,          // se guarda normalizada (sin acentos, minúsculas)
//       costo: number | null,       // entero >= 0 = costo Andreani; null = ELIMINAR la fila
//       activo: boolean             // si la fila no se usa como precio de venta
//     }
//   ]
// }
// `destinos` puede venir vacío o ausente si solo se quiere cambiar el margen.
// La provincia se upsertea por PK (franja_id, provincia): "Córdoba" y
// "cordoba" son la misma fila. Para borrar una fila se manda costo: null
// (además de poder desactivarla con activo: false, que es el soft-delete).
// ------------------------------------------------------------
router.put("/destinos", requerirAuth, async (req, res) => {
  const b = req.body || {};

  // ----- Validación del margen (opcional) -----
  let margenPct = null;
  if (b.margen_pct !== undefined && b.margen_pct !== null) {
    margenPct = Number(b.margen_pct);
    if (!Number.isInteger(margenPct) || margenPct < 0 || margenPct > 100) {
      return res.status(400).json({ error: "margen_pct debe ser un entero entre 0 y 100" });
    }
  }

  // ----- Validación de los destinos -----
  if (b.destinos !== undefined && !Array.isArray(b.destinos)) {
    return res.status(400).json({ error: "destinos debe ser un array" });
  }
  const destinos = Array.isArray(b.destinos) ? b.destinos : [];

  const validados = [];
  for (const d of destinos) {
    const franjaId = Number(d && d.franja_id);
    if (!Number.isInteger(franjaId) || franjaId <= 0) {
      return res.status(400).json({ error: "Cada destino necesita un franja_id entero positivo" });
    }
    if (typeof (d && d.provincia) !== "string" || d.provincia.trim() === "") {
      return res.status(400).json({ error: "Cada destino necesita una provincia (texto no vacío)" });
    }
    const provincia = normalizarProvincia(d.provincia);

    // costo: null = eliminar la fila; si viene número, entero >= 0.
    const esBorrado = d.costo === null;
    const costo = esBorrado ? null : Number(d.costo);
    if (!esBorrado && (!Number.isInteger(costo) || costo < 0)) {
      return res.status(400).json({
        error: `costo debe ser un entero >= 0 o null para eliminar (provincia: ${provincia})`,
      });
    }

    // activo por defecto true; solo se acepta booleano explícito o ausente.
    const activo = d.activo === undefined ? true : Boolean(d.activo);

    validados.push({ franjaId, provincia, costo, activo });
  }

  // Que todas las franjas referenciadas existan (evita claves fantasma).
  const franjasIds = [...new Set(validados.map((d) => d.franjaId))];
  if (franjasIds.length > 0) {
    try {
      const { rows } = await pool.query(
        "SELECT id FROM tarifas_envio WHERE id = ANY($1)",
        [franjasIds]
      );
      const existentes = new Set(rows.map((r) => r.id));
      const faltante = franjasIds.find((id) => !existentes.has(id));
      if (faltante !== undefined) {
        return res.status(400).json({ error: `franja_id inexistente: ${faltante}` });
      }
    } catch (err) {
      console.error("Error validando franjas de destinos:", err);
      return res.status(500).json({ error: "Error al validar las franjas" });
    }
  }

  // ----- Escritura en transacción (margen + destinos juntos) -----
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    if (margenPct !== null) {
      await cliente.query(
        `INSERT INTO envio_config (id, margen_pct) VALUES (1, $1)
         ON CONFLICT (id) DO UPDATE SET margen_pct = $1`,
        [margenPct]
      );
    }

    for (const d of validados) {
      if (d.costo === null) {
        await cliente.query(
          "DELETE FROM envio_destinos WHERE franja_id = $1 AND provincia = $2",
          [d.franjaId, d.provincia]
        );
      } else {
        await cliente.query(
          `INSERT INTO envio_destinos (franja_id, provincia, costo, activo)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (franja_id, provincia)
           DO UPDATE SET costo = $3, activo = $4`,
          [d.franjaId, d.provincia, d.costo, d.activo]
        );
      }
    }

    await cliente.query("COMMIT");
  } catch (err) {
    await cliente.query("ROLLBACK");
    console.error("Error guardando destinos de envío:", err);
    cliente.release();
    return res.status(500).json({ error: "Error al guardar los destinos de envío" });
  }
  cliente.release();

  // Respondemos con el estado actualizado (mismo shape que el GET).
  try {
    const { rows: configRows } = await pool.query(
      "SELECT margen_pct FROM envio_config WHERE id = 1"
    );
    const { rows: franjas } = await pool.query(
      "SELECT id, etiqueta, requiere_caja_grande, activa FROM tarifas_envio ORDER BY orden ASC, id ASC"
    );
    const { rows: destinos } = await pool.query(
      "SELECT franja_id, provincia, costo, activo FROM envio_destinos ORDER BY franja_id ASC, provincia ASC"
    );
    res.json({
      margen_pct: configRows[0] ? Number(configRows[0].margen_pct) : 0,
      franjas,
      destinos,
    });
  } catch (err) {
    console.error("Error leyendo estado de destinos tras guardar:", err);
    res.status(500).json({ error: "Destinos guardados, pero no se pudo leer el estado" });
  }
});

module.exports = router;
