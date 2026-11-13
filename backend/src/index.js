//servidor principal Express

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const authRouter      = require("./routes/auth");
const productosRouter = require("./routes/productos");
const pedidosRouter   = require("./routes/pedidos");
const pagosRouter     = require("./routes/pagos");
const enviosRouter    = require("./routes/envios");

const app = express();

// Orígenes permitidos por CORS.
// FRONTEND_URL acepta varios dominios separados por coma, así no hay que
// tocar código cada vez que se suma un frontend (dominio nuevo del cliente,
// previews, etc.). Se normalizan sin barra final para comparar prolijo.
const origenesPermitidos = [
  ...(process.env.FRONTEND_URL || "").split(","),
  "http://localhost:5173",
  "http://localhost:4173",
  "https://delgadobike-online.vercel.app",
  "https://delgadobike-frontend.vercel.app",
  "https://delgadobike-frontend-khaki.vercel.app",
]
  .map((origen) => (origen || "").trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(cors({
  origin(origen, callback) {
    // Sin cabecera Origin (curl, Postman, server-to-server) se permite.
    if (!origen) return callback(null, true);

    const limpio = origen.replace(/\/+$/, "");

    // Origen explícitamente habilitado.
    if (origenesPermitidos.includes(limpio)) return callback(null, true);

    // Previews de Vercel (*.vercel.app): se permiten para no bloquear los
    // deploys de prueba. La autenticación va por Bearer token (no cookies),
    // así que esto no habilita escrituras sin credenciales.
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(limpio)) return callback(null, true);

    // Cualquier otro origen queda bloqueado (sin cabeceras CORS).
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json());

// Rutas (auth primero: no depende de ninguna otra)
app.use("/api/auth",      authRouter);
app.use("/api/productos", productosRouter);
app.use("/api/pedidos",   pedidosRouter);
app.use("/api/pagos",     pagosRouter);
app.use("/api/envios",    enviosRouter);

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));

module.exports = app;