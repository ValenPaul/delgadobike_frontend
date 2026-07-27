//servidor principal Express

const express = require("express");
const cors = require("cors");
require("dotenv").config();

const productosRouter = require("./routes/productos");
const pedidosRouter   = require("./routes/pedidos");
const pagosRouter     = require("./routes/pagos");
const enviosRouter    = require("./routes/envios");

const app = express();

app.use(cors({
  origin: [
    process.env.FRONTEND_URL,
    "http://localhost:5173",
  ],
  credentials: true,
}));
app.use(express.json());

// Rutas
app.use("/api/productos", productosRouter);
app.use("/api/pedidos",   pedidosRouter);
app.use("/api/pagos",     pagosRouter);
app.use("/api/envios",    enviosRouter);

// Health check
app.get("/api/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));

module.exports = app;