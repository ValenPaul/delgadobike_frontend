export default function Hero() {
  return (
    <>
      <section className="hero">
        {/* Bicicleta de fondo */}
        <img
          src="https://res.cloudinary.com/jgnijxf6/image/upload/v1785878705/bicicleta-delgadobikeonline-sinfondo_zzbbok.png"
          alt="Bicicleta Delgado Bike"
          className="hero-bike-bg"
        />

        {/* Overlay para que el texto se lea bien */}
        <div className="hero-overlay" />

        <div className="hero-inner">
          <div className="hero-content">
            <h1 className="hero-title">
              LA BICI QUE<br />
              BUSCÁS ESTÁ EN<br />
              <span className="hero-accent">DELGADO BIKE.</span>
            </h1>
            <p className="hero-sub">
              Bicicletas para todos los terrenos.<br />
              Calidad, servicio y pasión por las dos ruedas.
            </p>
            <div className="hero-btns">
              <a href="#catalogo" className="hero-cta">VER BICICLETAS</a>
              
              <a  href="https://wa.me/5493XXXXXXXXX"
                target="_blank"
                rel="noreferrer"
                className="hero-cta-secondary"
              >
                CONSULTAR WHATSAPP ✉
              </a>
            </div>
          </div>
        </div>

        {/* Barra de servicios */}
        <div className="hero-servicios">
          <div className="hero-servicios-inner">
            <div className="hero-servicio">
              <span className="hero-servicio-icon">🚚</span>
              <div>
                <div className="hero-servicio-titulo">ENVIOS A TODO EL PAIS</div>
                <div className="hero-servicio-sub">Envio seguro.</div>
              </div>
            </div>
            <div className="hero-servicio">
              <span className="hero-servicio-icon">🛡️</span>
              <div>
                <div className="hero-servicio-titulo">MEJORES MARCAS</div>
                <div className="hero-servicio-sub">Calidad garantizada.</div>
              </div>
            </div>
            <div className="hero-servicio">
              <span className="hero-servicio-icon">✅</span>
              <div>
                <div className="hero-servicio-titulo">SERVICIO GARANTIZADO</div>
                <div className="hero-servicio-sub">Respaldo en cada compra.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      
    </>
  );
}