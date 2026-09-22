export default function Contacto() {
  return (
    <div className="pagina">

      {/* HEADER */}
      <section className="contacto-header">
        <div className="nosotros-hero-inner">
          <span className="nosotros-tag">● Estamos para ayudarte</span>
          <h1 className="nosotros-titulo">
            Contactanos
          </h1>
          <p className="nosotros-sub">
            Visitanos en nuestro local, escribinos por WhatsApp o mandanos un email.
            Respondemos a la brevedad.
          </p>
        </div>
      </section>

      {/* CONTACTO GRID */}
      <section className="contacto-section">
        <div className="nosotros-inner">
          <div className="contacto-grid">

            {/* INFO */}
            <div className="contacto-info">

              <div className="contacto-bloque">
                <div className="contacto-icono">📍</div>
                <div>
                  <h3>Dirección</h3>
                  <p>3 de Febrero 1223<br />Crespo, Entre Ríos</p>
                </div>
              </div>

              <div className="contacto-bloque">
                <div className="contacto-icono">🕐</div>
                <div>
                  <h3>Horarios de atención</h3>
                  <p>Lunes a Viernes<br />8:00 a 12:00 hs · 16:00 a 20:00 hs</p>
                </div>
              </div>

              <div className="contacto-bloque">
                <div className="contacto-icono">💬</div>
                <div>
                  <h3>WhatsApp</h3>
                  
                  <a  href="https://wa.me/5493XXXXXXXXX"
                    target="_blank"
                    rel="noreferrer"
                    className="contacto-link"
                  >
                    +54 9 3XXX XXX XXX
                  </a>
                </div>
              </div>

              <div className="contacto-bloque">
                <div className="contacto-icono">📧</div>
                <div>
                  <h3>Email</h3>
                  <a href="mailto:contacto@delgadobike.com.ar" className="contacto-link">
                    contacto@delgadobike.com.ar
                  </a>
                </div>
              </div>

              <div className="contacto-bloque">
                <div className="contacto-icono">📸</div>
                <div>
                  <h3>Instagram</h3>
                  
                  <a  href="https://instagram.com/delgadobike"
                    target="_blank"
                    rel="noreferrer"
                    className="contacto-link"
                  >
                    @delgadobike
                  </a>
                </div>
              </div>

            </div>

            {/* MAPA */}
            <div className="contacto-mapa">
              <iframe
                title="Ubicación Delgado Bike"
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3456.789!2d-60.0213!3d-32.0213!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95b4249eff773061%3A0x9be7623f2e2815bc!2s3%20de%20Febrero%201223%2C%20E3116%20Crespo%2C%20Entre%20R%C3%ADos!5e0!3m2!1ses!2sar!4v1234567890"
                width="100%"
                height="100%"
                style={{ border: 0, borderRadius: 16 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>

          </div>
        </div>
      </section>

    </div>
  );
}