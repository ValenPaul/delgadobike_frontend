const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET /api/pedidos — listar todos
router.get("/", async (req, res) => {
  try {
    const { rows: pedidos } = await pool.query(
      "SELECT * FROM pedidos ORDER BY creado_en DESC"
    );
    // Traer items de cada pedido
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

// POST /api/pedidos — crear pedido nuevo
router.post("/", async (req, res) => {
  const { form, carrito, subtotal, envio, total } = req.body;
  const id = `VP-${Math.floor(Math.random() * 90000) + 10000}`;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verificar stock de cada producto antes de confirmar
    for (const item of carrito) {
      const { rows } = await client.query(
        "SELECT stock FROM productos WHERE id = $1 FOR UPDATE",
        [item.id]
      );
      if (rows.length === 0) throw new Error(`Producto ${item.nombre} no encontrado`);
      if (rows[0].stock < item.cantidad) {
        throw new Error(`Stock insuficiente para ${item.nombre}`);
      }
    }

    // Insertar pedido
    await client.query(
      `INSERT INTO pedidos
        (id, cliente, email, telefono, calle, numero, piso, localidad, provincia, codigo_postal, total, costo_envio, estado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pendiente')`,
      [
        id,
        form.nombre, form.email, form.telefono,
        form.calle, form.numero, form.piso,
        form.localidad, form.provincia, form.codigoPostal,
        total, envio.costo,
      ]
    );

    // Insertar items y descontar stock
    for (const item of carrito) {
      await client.query(
        `INSERT INTO pedido_items (pedido_id, producto_id, nombre, cantidad, precio_unit)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, item.id, item.nombre, item.cantidad, item.precio]
      );
      await client.query(
        "UPDATE productos SET stock = stock - $1 WHERE id = $2",
        [item.cantidad, item.id]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ ok: true, id });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
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