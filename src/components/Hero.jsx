export default function Hero() {
  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <span className="hero-tag">Nueva colección 2025</span>
          <h1 className="hero-title">
            Andá más lejos.<br />
            <span className="hero-accent">Sentí cada kilómetro.</span>
          </h1>
          <p className="hero-sub">
            Bicicletas de ruta, montaña y urbanas. Envíos a todo el país con Andreani.
          </p>
          <a href="#catalogo" className="hero-cta">Ver catálogo →</a>
        </div>
        <div className="hero-visual">
          <img
            src="https://res.cloudinary.com/jgnijxf6/image/upload/v1785879802/bici_logo_gml6oi.png"
            alt="Delgado Bike Online"
            className="hero-logo-img"
          />
        </div>
      </section>

      {/* Barra de beneficios */}
      <div className="beneficios-bar">
        <div className="beneficio">
          <span className="beneficio-icon">🚚</span>
          <div>
            <div className="beneficio-titulo">Envíos a todo el país</div>
            <div className="beneficio-sub">Con Andreani, rápido y seguro.</div>
          </div>
        </div>
        <div className="beneficio-divider" />
        <div className="beneficio">
          <span className="beneficio-icon">🛡️</span>
          <div>
            <div className="beneficio-titulo">Garantía oficial</div>
            <div className="beneficio-sub">Respaldo y calidad asegurada.</div>
          </div>
        </div>
        <div className="beneficio-divider" />
        <div className="beneficio">
          <span className="beneficio-icon">💳</span>
          <div>
            <div className="beneficio-titulo">Hasta 12 cuotas</div>
            <div className="beneficio-sub">Sin interés con tarjetas seleccionadas.</div>
          </div>
        </div>
      </div>
    </>
  );
}