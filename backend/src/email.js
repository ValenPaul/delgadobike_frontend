const { Resend } = require("resend");
require("dotenv").config();

const resend = new Resend(process.env.RESEND_API_KEY);

const LOGO_URL = "https://res.cloudinary.com/jgnijxf6/image/upload/v1785875376/logo-sin-fondo-delgadobike_zugg2u.png";

// ── Email al cliente ────────────────────────────────────────────────────────
async function enviarConfirmacionCliente(pedido) {
  const { id, cliente, email, items, total, costo_envio, localidad, provincia } = pedido;

  const itemsHTML = items.map(item => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333;">
        ${item.nombre}
      </td>
      <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333; text-align: center;">
        ${item.cantidad}
      </td>
      <td style="padding: 10px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; color: #333; text-align: right;">
        $${(item.precio_unit * item.cantidad).toLocaleString("es-AR")}
      </td>
    </tr>
  `).join("");

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:0; background:#F7F7F5; font-family: 'Segoe UI', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F5; padding: 40px 20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">

            <!-- HEADER -->
            <tr><td style="background:#111; border-radius:16px 16px 0 0; padding: 32px; text-align:center;">
              <img src="${LOGO_URL}" alt="Delgado Bike Online" style="height:60px; width:auto;" />
            </td></tr>

            <!-- CUERPO -->
            <tr><td style="background:#fff; padding: 40px 40px 24px;">
              <h1 style="margin:0 0 8px; font-size:24px; font-weight:800; color:#111;">
                ¡Gracias por tu compra, ${cliente.split(" ")[0]}! 🎉
              </h1>
              <p style="margin:0 0 24px; font-size:15px; color:#555; line-height:1.6;">
                Recibimos tu pedido y ya estamos preparándolo. Te avisamos cuando esté en camino.
              </p>

              <!-- NÚMERO DE PEDIDO -->
              <div style="background:#F0F5FF; border-left: 4px solid #0066FF; border-radius:8px; padding:16px 20px; margin-bottom:28px;">
                <p style="margin:0; font-size:13px; color:#0066FF; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Número de pedido</p>
                <p style="margin:4px 0 0; font-size:22px; font-weight:800; color:#111;">${id}</p>
              </div>

              <!-- PRODUCTOS -->
              <h2 style="margin:0 0 16px; font-size:16px; font-weight:700; color:#111;">Detalle del pedido</h2>
              <table width="100%" cellpadding="0" cellspacing="0">
                <thead>
                  <tr>
                    <th style="font-size:12px; color:#888; font-weight:600; text-align:left; padding-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Producto</th>
                    <th style="font-size:12px; color:#888; font-weight:600; text-align:center; padding-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Cant.</th>
                    <th style="font-size:12px; color:#888; font-weight:600; text-align:right; padding-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>${itemsHTML}</tbody>
              </table>

              <!-- TOTALES -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                <tr>
                  <td style="font-size:14px; color:#555; padding:6px 0;">Subtotal</td>
                  <td style="font-size:14px; color:#555; text-align:right;">$${(total - costo_envio).toLocaleString("es-AR")}</td>
                </tr>
                <tr>
                  <td style="font-size:14px; color:#555; padding:6px 0;">Envío Andreani</td>
                  <td style="font-size:14px; color:#555; text-align:right;">$${costo_envio.toLocaleString("es-AR")}</td>
                </tr>
                <tr>
                  <td style="font-size:16px; font-weight:800; color:#111; padding:12px 0 0; border-top:2px solid #111;">Total pagado</td>
                  <td style="font-size:16px; font-weight:800; color:#0066FF; text-align:right; padding-top:12px; border-top:2px solid #111;">$${total.toLocaleString("es-AR")}</td>
                </tr>
              </table>
            </td></tr>

            <!-- DIRECCIÓN -->
            <tr><td style="background:#fff; padding: 0 40px 40px;">
              <div style="background:#F7F7F5; border-radius:12px; padding:20px;">
                <p style="margin:0 0 8px; font-size:13px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:0.5px;">Dirección de entrega</p>
                <p style="margin:0; font-size:14px; color:#333; line-height:1.6;">
                  ${localidad}, ${provincia}
                </p>
                <p style="margin:8px 0 0; font-size:13px; color:#888;">
                  🚚 Envío por Andreani — llegará en 3 a 5 días hábiles
                </p>
              </div>
            </td></tr>

            <!-- FOOTER -->
            <tr><td style="background:#111; border-radius:0 0 16px 16px; padding:28px 40px; text-align:center;">
              <p style="margin:0 0 8px; font-size:13px; color:#888;">
                ¿Tenés alguna consulta? Escribinos por WhatsApp o respondé este email.
              </p>
              <p style="margin:0; font-size:12px; color:#555;">
                © Delgado Bike Online. Todos los derechos reservados.
              </p>
            </td></tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: `✅ Pedido confirmado #${id} — Delgado Bike Online`,
    html,
  });
}

// ── Email al admin ──────────────────────────────────────────────────────────
async function enviarNotificacionAdmin(pedido) {
  const { id, cliente, email, items, total, localidad, provincia } = pedido;

  const itemsTexto = items.map(i => `• ${i.nombre} x${i.cantidad}`).join("<br/>");

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <body style="margin:0; padding:0; background:#F7F7F5; font-family: 'Segoe UI', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F7F5; padding:40px 20px;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%;">

            <tr><td style="background:#0066FF; border-radius:16px 16px 0 0; padding:28px 40px;">
              <h1 style="margin:0; font-size:20px; font-weight:800; color:#fff;">
                🛒 Nuevo pedido recibido
              </h1>
            </td></tr>

            <tr><td style="background:#fff; border-radius:0 0 16px 16px; padding:32px 40px;">
              <p style="margin:0 0 20px; font-size:15px; color:#333;">
                Entrá al <a href="${process.env.FRONTEND_URL}/admin" style="color:#0066FF; font-weight:600;">panel de administración</a> para ver el detalle completo.
              </p>

              <div style="background:#F7F7F5; border-radius:12px; padding:20px; margin-bottom:16px;">
                <p style="margin:0 0 4px; font-size:13px; color:#888; font-weight:600; text-transform:uppercase;">Pedido</p>
                <p style="margin:0; font-size:20px; font-weight:800; color:#111;">${id}</p>
              </div>

              <div style="display:grid; gap:12px;">
                <div style="background:#F7F7F5; border-radius:12px; padding:16px 20px;">
                  <p style="margin:0 0 4px; font-size:12px; color:#888; font-weight:600; text-transform:uppercase;">Cliente</p>
                  <p style="margin:0; font-size:15px; color:#111; font-weight:600;">${cliente}</p>
                  <p style="margin:2px 0 0; font-size:13px; color:#555;">${email}</p>
                </div>
                <div style="background:#F7F7F5; border-radius:12px; padding:16px 20px;">
                  <p style="margin:0 0 8px; font-size:12px; color:#888; font-weight:600; text-transform:uppercase;">Productos</p>
                  <p style="margin:0; font-size:14px; color:#333; line-height:1.8;">${itemsTexto}</p>
                </div>
                <div style="background:#F7F7F5; border-radius:12px; padding:16px 20px;">
                  <p style="margin:0 0 4px; font-size:12px; color:#888; font-weight:600; text-transform:uppercase;">Destino</p>
                  <p style="margin:0; font-size:14px; color:#333;">${localidad}, ${provincia}</p>
                </div>
                <div style="background:#EEF5FF; border-radius:12px; padding:16px 20px; border:1px solid #0066FF30;">
                  <p style="margin:0 0 4px; font-size:12px; color:#0066FF; font-weight:600; text-transform:uppercase;">Total</p>
                  <p style="margin:0; font-size:22px; font-weight:800; color:#0066FF;">$${total.toLocaleString("es-AR")}</p>
                </div>
              </div>
            </td></tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;

  await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_ADMIN,
    subject: `🛒 Nuevo pedido #${id} — $${total.toLocaleString("es-AR")}`,
    html,
  });
}

module.exports = { enviarConfirmacionCliente, enviarNotificacionAdmin };