const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const pool = require("../db");
require("dotenv").config();
const { enviarConfirmacionCliente, enviarNotificacionAdmin } = require("../email");

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// POST /api/pagos/crear-preferencia
router.post("/crear-preferencia", async (req, res) => {
  const { carrito, form, envio, pedidoId } = req.body;

  try {
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [
          ...carrito.map((item) => ({
            id: String(item.id),
            title: item.nombre,
            quantity: Number(item.cantidad),
            unit_price: Number(item.precio),
            currency_id: "ARS",
          })),
          {
            id: "envio",
            title: "Envío Andreani",
            quantity: 1,
            unit_price: Number(envio.costo),
            currency_id: "ARS",
          },
        ],
        payer: {
          name: form.nombre,
          email: form.email,
        },
        // Guardamos todos los datos del pedido en metadata
        // para poder crearlo cuando MercadoPago confirme el pago
        metadata: {
          pedido_id: pedidoId,
          form: JSON.stringify(form),
          carrito: JSON.stringify(carrito),
          envio: JSON.stringify(envio),
        },
        external_reference: pedidoId,
        back_urls: {
          success: `${process.env.FRONTEND_URL}/confirmacion`,
          failure: `${process.env.FRONTEND_URL}/checkout`,
          pending: `${process.env.FRONTEND_URL}/confirmacion`,
        },
        auto_return: "approved",
        notification_url: `${process.env.BACKEND_URL}/api/pagos/webhook`,
        statement_descriptor: "VeloStore",
      },
    });

    res.json({ init_point: result.init_point, pedidoId });
  } catch (err) {
    console.error("Error MercadoPago:", err);
    res.status(500).json({ error: "Error al crear preferencia de pago" });
  }
});

// POST /api/pagos/webhook — MercadoPago avisa cuando se aprueba un pago
router.post("/webhook", async (req, res) => {
  const { type, data } = req.body;

  // Solo procesamos notificaciones de pagos
  if (type !== "payment") return res.sendStatus(200);

  try {
    const payment = new Payment(client);
    const pagoData = await payment.get({ id: data.id });

    // Solo crear pedido si el pago fue aprobado
    if (pagoData.status !== "approved") return res.sendStatus(200);

    // Recuperar datos del pedido desde metadata
    const { pedido_id, form, carrito, envio } = pagoData.metadata;
    const formData = JSON.parse(form);
    const carritoData = JSON.parse(carrito);
    const envioData = JSON.parse(envio);
    const total = carritoData.reduce((a, i) => a + i.precio * i.cantidad, 0) + envioData.costo;

    // Verificar que el pedido no exista ya (evitar duplicados)
    const { rows: existe } = await pool.query(
      "SELECT id FROM pedidos WHERE id = $1",
      [pedido_id]
    );
    if (existe.length > 0) return res.sendStatus(200);

    // Crear el pedido en la base de datos
    const client2 = await pool.connect();
    try {
      await client2.query("BEGIN");

      // Verificar stock
      for (const item of carritoData) {
        const { rows } = await client2.query(
          "SELECT stock FROM productos WHERE id = $1 FOR UPDATE",
          [item.id]
        );
        if (rows.length === 0) throw new Error(`Producto no encontrado`);
        if (rows[0].stock < item.cantidad) throw new Error(`Stock insuficiente para ${item.nombre}`);
      }

      // Insertar pedido
      await client2.query(
        `INSERT INTO pedidos
          (id, cliente, email, telefono, calle, numero, piso, localidad, provincia, codigo_postal, total, costo_envio, estado, mp_payment_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pendiente',$13)`,
        [
          pedido_id,
          formData.nombre, formData.email, formData.telefono,
          formData.calle, formData.numero, formData.piso,
          formData.localidad, formData.provincia, formData.codigoPostal,
          total, envioData.costo, data.id,
        ]
      );

      // Insertar items y descontar stock
      for (const item of carritoData) {
        await client2.query(
          `INSERT INTO pedido_items (pedido_id, producto_id, nombre, cantidad, precio_unit)
           VALUES ($1, $2, $3, $4, $5)`,
          [pedido_id, item.id, item.nombre, item.cantidad, item.precio]
        );
        await client2.query(
          "UPDATE productos SET stock = stock - $1 WHERE id = $2",
          [item.cantidad, item.id]
        );
      }

      await client2.query("COMMIT");
    } catch (err) {
      await client2.query("ROLLBACK");
      throw err;
    } finally {
      client2.release();
    }

    // Enviar emails de confirmación
    try {
      const { rows: pedidoCompleto } = await pool.query(
        `SELECT p.*, 
          json_agg(json_build_object(
            'nombre', pi.nombre,
            'cantidad', pi.cantidad,
            'precio_unit', pi.precio_unit
          )) as items
        FROM pedidos p
        JOIN pedido_items pi ON pi.pedido_id = p.id
        WHERE p.id = $1
        GROUP BY p.id`,
        [pedido_id]
      );
      if (pedidoCompleto.length > 0) {
        await Promise.all([
          enviarConfirmacionCliente(pedidoCompleto[0]),
          enviarNotificacionAdmin(pedidoCompleto[0]),
        ]);
      }
    } catch (emailErr) {
      // No rompemos el flujo si el email falla
      console.error("Error enviando emails:", emailErr);
    }

    res.sendStatus(200);

  } 
    catch (err) {
    console.error("Error webhook:", err);
    res.sendStatus(500);
  }
});

module.exports = router;