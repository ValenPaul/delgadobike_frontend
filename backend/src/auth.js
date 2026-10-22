// Autenticación del admin: tokens firmados con HMAC-SHA256 usando el módulo
// crypto nativo de Node (sin dependencias externas).
// Formato del token: <base64url(payloadJSON)>.<base64url(firma)>

const crypto = require("crypto");

// El secreto se lee en el momento (no al cargar el módulo) para garantizar
// que dotenv ya haya cargado el .env antes de usarlo.
function obtenerSecreto() {
  return process.env.AUTH_SECRET || "";
}

// Firma el cuerpo del token con HMAC-SHA256 y devuelve la firma en base64url.
function firmar(cuerpo) {
  return crypto
    .createHmac("sha256", obtenerSecreto())
    .update(cuerpo, "utf8")
    .digest("base64url");
}

// Compara dos cadenas en tiempo constante (evita timing attacks).
// Antes de comparar, hasheamos ambas con SHA-256: así los buffers siempre
// miden 32 bytes, timingSafeEqual no tira error con longitudes distintas
// y tampoco se filtra el largo original de la cadena.
function compararEnTiempoConstante(a, b) {
  const hashA = crypto.createHash("sha256").update(String(a), "utf8").digest();
  const hashB = crypto.createHash("sha256").update(String(b), "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

// Devuelve un token firmado para el payload indicado.
function crearToken(payload) {
  if (!obtenerSecreto()) {
    throw new Error("Falta AUTH_SECRET en el archivo .env");
  }
  const cuerpo = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${cuerpo}.${firmar(cuerpo)}`;
}

// Verifica un token y devuelve su payload, o null si es inválido.
function verificarToken(token) {
  if (typeof token !== "string" || !obtenerSecreto()) return null;

  const partes = token.split(".");
  if (partes.length !== 2) return null;

  const [cuerpo, firma] = partes;
  if (!cuerpo || !firma) return null;

  // La firma se calcula sobre el cuerpo tal como llega (sin decodificar).
  if (!compararEnTiempoConstante(firma, firmar(cuerpo))) return null;

  try {
    const payload = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object") return null;
    // Si el payload llega a traer vencimiento (exp, en segundos), lo respetamos.
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

// Middleware: exige un token válido en la cabecera "Authorization: Bearer <token>".
function requerirAuth(req, res, next) {
  const cabecera = req.headers.authorization || "";
  const partes = cabecera.split(" ");

  if (partes.length !== 2 || partes[0] !== "Bearer" || !partes[1]) {
    return res.status(401).json({ error: "Falta el token de autenticación" });
  }

  const payload = verificarToken(partes[1]);
  if (!payload) {
    return res.status(401).json({ error: "Token inválido o expirado" });
  }

  req.admin = payload;
  return next();
}

module.exports = { crearToken, verificarToken, requerirAuth, compararEnTiempoConstante };
