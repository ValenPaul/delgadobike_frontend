const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /api/pedidos — listar todos
router.get("/", async (req, res) => {
  try {
    const { rows: pedidos } = await pool.query(
      "SELECT * FROM pedidos ORDER BY creado_en DESC"
    );
    const pedidosConItems = await Promise.all(
      pedidos.map(async (p) => {
        const { rows: items } = await pool.query(
          "SELECT * FROM pedido_items WHERE pedido_id = $1",
          [p.id]
        );
        return { ...p, items };
      })
    );
    res.json(pedidosConItems);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener pedidos" });
  }
});

// PUT /api/pedidos/:id/estado — cambiar estado desde el admin
router.put("/:id/estado", async (req, res) => {
  const { estado } = req.body;
  const estadosValidos = ["pendiente", "en camino", "entregado", "cancelado"];
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