const pool = require("./db");

// ============================================================
// Encomienda DelgadoBike (envío propio) — helpers compartidos.
//
// La tienda ofrece esta opción solo a compradores de localidades cercanas a
// Crespo (a menos de 80 km). La lista vive en `envio_zonas_propias` y la
// administra el dueño desde el panel. El envío no se cobra en MercadoPago:
// se coordina y se cobra por WhatsApp.
//
// Se compara por localidad normalizada (sin acentos, minúsculas) o por CP
// (solo dígitos, exacto). La provincia también se normaliza, así "Entre Ríos"
// y "entre rios" matchean la misma fila.
// ============================================================

const ETIQUETA_ENVIO_PROPIO = "Encomienda DelgadoBike";

// Normaliza texto para comparar de forma robusta:
// quita acentos (NFD + diacríticos), pasa a minúsculas, colapsa espacios.
function normalizarTexto(texto) {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Deja solo dígitos (el CP argentino tiene 4 u 8 según CPA, pero aceptamos
// hasta 8 por las dudas) y devuelve "" si no hay nada.
function normalizarCP(texto) {
  return String(texto ?? "").replace(/\D/g, "").slice(0, 8);
}

// ¿El destino entra en la zona de envío propio?
// Devuelve SIEMPRE { disponible, etiqueta } (+ `zona` cuando matchea).
// Si la tabla todavía no existe (migración pendiente) o hay un error de DB,
// devuelve disponible: false para no romper la cotización del checkout.
async function zonaPropiaDisponible({ provincia, localidad, codigoPostal } = {}) {
  const respuesta = (disponible, extra = {}) => ({
    disponible,
    etiqueta: ETIQUETA_ENVIO_PROPIO,
    ...extra,
  });

  const prov = normalizarTexto(provincia);
  const loc = normalizarTexto(localidad);
  const cp = normalizarCP(codigoPostal);

  if (!prov || (!loc && !cp)) return respuesta(false);

  try {
    const { rows } = await pool.query(
      `SELECT localidad, localidad_norm, codigo_postal
         FROM envio_zonas_propias
        WHERE activo = TRUE AND provincia = $1`,
      [prov]
    );

    const match = rows.find(
      (z) =>
        (loc && z.localidad_norm === loc) ||
        (cp && normalizarCP(z.codigo_postal) === cp)
    );

    return match ? respuesta(true, { zona: match.localidad }) : respuesta(false);
  } catch (err) {
    console.warn(
      "No se pudo verificar la zona de envío propio:",
      err.message || err
    );
    return respuesta(false);
  }
}

module.exports = {
  ETIQUETA_ENVIO_PROPIO,
  normalizarTexto,
  normalizarCP,
  zonaPropiaDisponible,
};
