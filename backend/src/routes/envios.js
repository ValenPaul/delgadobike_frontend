const express = require("express");
const router = express.Router();
require("dotenv").config();

// POST /api/envios/cotizar
// Llama a la API de Andreani para cotizar el envío por código postal
router.post("/cotizar", async (req, res) => {
  const { codigoPostal, peso = 15, volumen = 40000 } = req.body;

  if (!codigoPostal) {
    return res.status(400).json({ error: "Código postal requerido" });
  }

  try {
    const response = await fetch(
      "https://api.andreani.com/v2/tarifas",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-apikey": process.env.ANDREANI_API_KEY,
        },
        body: JSON.stringify({
          contrato: process.env.ANDREANI_CONTRATO,
          origen: { codigoPostal: "2000" }, // código postal de tu local/depósito
          destino: { codigoPostal },
          bultos: [{ kilos: peso, largoCm: 60, anchoCm: 40, altoCm: 30 }],
        }),
      }
    );

    if (!response.ok) {
      // Si la API de Andreani falla, devolvemos una tarifa estimada
      // para no bloquear la compra (esto se puede ajustar)
      console.error("Andreani API error:", response.status);
      return res.json({ costo: 5500, plazo: "3 a 5 días hábiles", estimado: true });
    }

    const data = await response.json();

    // La respuesta de Andreani varía según el contrato;
    // ajustá este mapeo según la respuesta real que recibas
    const costo = data?.tarifas?.[0]?.total || data?.total || 5500;
    const plazo = data?.plazo || "3 a 5 días hábiles";

    res.json({ costo, plazo });
  } catch (err) {
    console.error("Error cotizando Andreani:", err);
    // Fallback: no rompemos el checkout si Andreani no responde
    res.json({ costo: 5500, plazo: "3 a 5 días hábiles", estimado: true });
  }
});

module.exports = router;