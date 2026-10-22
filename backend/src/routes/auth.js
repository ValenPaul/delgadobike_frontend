const express = require("express");
const router = express.Router();
const { crearToken, compararEnTiempoConstante } = require("../auth");

// POST /api/auth/login — valida las credenciales del admin y devuelve un token
router.post("/login", (req, res) => {
  const { usuario, password } = req.body || {};

  const usuarioReal = process.env.ADMIN_USER;
  const passReal = process.env.ADMIN_PASS;

  // Sin credenciales configuradas en el .env no hay nada que validar
  if (!usuarioReal || !passReal) {
    console.error("Faltan ADMIN_USER / ADMIN_PASS en el archivo .env");
    return res.status(500).json({ error: "Error al iniciar sesión" });
  }

  // Se comparan las dos siempre (sin cortocircuitar con &&) para que el
  // tiempo de respuesta sea igual aunque el usuario o el password fallen.
  const usuarioOk = compararEnTiempoConstante(usuario || "", usuarioReal);
  const passOk = compararEnTiempoConstante(password || "", passReal);

  if (!usuarioOk || !passOk) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }

  try {
    const token = crearToken({ usuario: usuarioReal, rol: "admin" });
    return res.json({ token });
  } catch (err) {
    console.error("Error al crear el token:", err);
    return res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

module.exports = router;
