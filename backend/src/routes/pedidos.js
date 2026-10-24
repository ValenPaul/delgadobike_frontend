const express = require("express");
const router = express.Router();
const pool = require("../db");
const { requerirAuth } = require("../auth");
const { enviarTrackingCliente } = require("../email");

// Métodos de envío válidos para tracking y costo real
const METODOS_ENVIO = ["sucursal", "domicilio", "link_pago"];

// GET /api/pedidos — listar todos, con los items anidados en una sola query
// (LEFT JOIN + json_agg; los pedidos sin items quedan con items: [])
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'pedido_id', pi.pedido_id,
              'producto_id', pi.producto_id,
              'nombre', pi.nombre,
              'cantidad', pi.cantidad,
              'precio_unit', pi.precio_unit
            ) ORDER BY pi.id
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'::json
        ) AS items
       FROM pedidos p
       LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
       GROUP BY p.id
       ORDER BY p.creado_en DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener pedidos" });
  }
});

// GET /api/pedidos/despachos (solo admin): pedidos con pago aprobado y listos
// para despachar (estado 'pendiente'), en el orden en que entraron.
// Incluye items anidados, contacto, dirección, desglose del envío y el peso
// total del pedido. Nota: peso_total_g suma cantidad × productos.peso_g tal
// cual (los productos sin peso cargado cuentan 0); el peso de reserva de la
// cotización solo aplica en POST /api/envios/cotizar.
router.get("/despachos", requerirAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', pi.id,
              'pedido_id', pi.pedido_id,
              'producto_id', pi.producto_id,
              'nombre', pi.nombre,
              'cantidad', pi.cantidad,
              'precio_unit', pi.precio_unit
            ) ORDER BY pi.id
          ) FILTER (WHERE pi.id IS NOT NULL),
          '[]'::json
        ) AS items,
        COALESCE(SUM(pi.cantidad * COALESCE(pr.peso_g, 0)), 0)::int AS peso_total_g
       FROM pedidos p
       LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
       LEFT JOIN productos pr ON pr.id = pi.producto_id
       WHERE p.estado = 'pendiente'
       GROUP BY p.id
       ORDER BY p.creado_en ASC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener despachos" });
  }
});

// POST /api/pedidos/:id/tracking (solo admin): carga el número de seguimiento
// de Andreani, pasa el pedido a 'en camino' y avisa al cliente por email.
// Si el email falla, la respuesta igual es 200 (el fallo nunca rompe el flujo).
router.post("/:id/tracking", requerirAuth, async (req, res) => {
  const { numero, metodo } = req.body || {};

  // Número de seguimiento: obligatorio, sin espacios de más, máx. 50 caracteres
  const numeroLimpio = typeof numero === "string" ? numero.trim() : "";
  if (!numeroLimpio || numeroLimpio.length > 50) {
    return res
      .status(400)
      .json({ error: "Número de seguimiento inválido (obligatorio, máx. 50 caracteres)" });
  }

  // Método de envío: opcional, pero si viene tiene que ser válido
  let metodoFinal = null;
  if (metodo !== undefined && metodo !== null && metodo !== "") {
    if (!METODOS_ENVIO.includes(metodo)) {
      return res.status(400).json({ error: "Método de envío inválido (sucursal | domicilio | link_pago)" });
    }
    metodoFinal = metodo;
  }

  try {
    const { rows } = await pool.query(
      `UPDATE pedidos
       SET tracking_numero = $1,
           envio_metodo = COALESCE($2, envio_metodo),
           estado = 'en camino'
       WHERE id = $3
       RETURNING *`,
      [numeroLimpio, metodoFinal, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Pedido no encontrado" });

    // Aviso al cliente por email; si falla, igual respondemos 200
    try {
      await enviarTrackingCliente(rows[0], numeroLimpio);
    } catch (emailErr) {
      console.error(
        `Error enviando email de tracking del pedido ${req.params.id}:`,
        emailErr.message || emailErr
      );
    }

    res.json(rows[0]);
  } catch (err) {
    console.error("Error guardando tracking:", err);
    res.status(500).json({ error: "Error al guardar el número de seguimiento" });
  }
});

// PUT /api/pedidos/:id/envio (solo admin): registra lo que nos costó
// realmente el envío a Andreani + el método usado (para medir margen).
router.put("/:id/envio", requerirAuth, async (req, res) => {
  const { costo_real, metodo } = req.body || {};

  const costo = Number(costo_real);
  if (!Number.isInteger(costo) || costo < 0) {
    return res.status(400).json({ error: "costo_real debe ser un entero mayor o igual a 0" });
  }

  // Método opcional: si viene, tiene que ser válido; si no viene, no se toca
  let metodoFinal = null;
  if (metodo !== undefined && metodo !== null && metodo !== "") {
    if (!METODOS_ENVIO.includes(metodo)) {
      return res.status(400).json({ error: "Método de envío inválido (sucursal | domicilio | link_pago)" });
    }
    metodoFinal = metodo;
  }

  try {
    const { rows } = await pool.query(
      `UPDATE pedidos
       SET envio_costo_real = $1,
           envio_metodo = COALESCE($2, envio_metodo)
       WHERE id = $3
       RETURNING *`,
      [costo, metodoFinal, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error("Error guardando envío:", err);
    res.status(500).json({ error: "Error al guardar el costo de envío" });
  }
});

// PUT /api/pedidos/:id/estado — cambiar estado desde el admin (solo admin)
router.put("/:id/estado", requerirAuth, async (req, res) => {
  const { estado } = req.body;
  // Estados válidos. "reservada" = pago aprobado con retiro en el local
  // (sin envío cobrado), esperando que el cliente pase a retirar.
  const estadosValidos = ["pendiente", "reservada", "en camino", "entregado", "cancelado"];
  if (!estadosValidos.includes(estado)) {
    return res.status(400).json({ error: "Estado inválido" });
  }
  try {
    const { rows } = await pool.query(
      "UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING *",
      [estado, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Pedido no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Error al actualizar estado" });
  }
});

module.exports = router;