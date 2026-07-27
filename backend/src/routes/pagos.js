const express = require("express");
const router = express.Router();
const { MercadoPagoConfig, Preference } = require("mercadopago");
require("dotenv").config();

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
        external_reference: pedidoId,
        back_urls: {
          success: `${process.env.FRONTEND_URL}/confirmacion`,
          failure: `${process.env.FRONTEND_URL}/checkout`,
          pending: `${process.env.FRONTEND_URL}/confirmacion`,
        },
        auto_return: "approved",
        statement_descriptor: "DelgadoBike",
      },
    });

    res.json({ init_point: result.init_point });
  } catch (err) {
    console.error("Error MercadoPago:", err);
    res.status(500).json({ error: "Error al crear preferencia de pago" });
  }
});

module.exports = router;