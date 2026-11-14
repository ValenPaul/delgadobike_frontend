// Colores y categorías compartidos entre componentes
export const categorias = ["Montaña", "Urbana", "Ruta", "Niños", "Gravel"];

export const colores = {
  Montaña: "#2D7D46",
  Urbana: "#1A6FA8",
  Ruta: "#FF4D00",
  Niños: "#9B59B6",
  Gravel: "#8B5E3C",
};

export const ADMIN_USER = "admin";
export const ADMIN_PASS = "velo2025";

// WhatsApp del negocio en formato internacional (sin +, sin espacios).
// Se usa en Hero, Contacto, el checkout (Encomienda DelgadoBike) y la
// confirmación. El mismo número está en backend/src/email.js para los mails.
export const WHATSAPP_NUMERO = "5493434717485";