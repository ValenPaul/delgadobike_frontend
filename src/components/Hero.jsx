export default function Hero() {
  return (
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
        <a href="#catalogo" className="hero-cta">Ver catálogo</a>
      </div>
      <div className="hero-visual">
        <div className="hero-circle" />
        <svg className="hero-bike" viewBox="0 0 400 260" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="100" cy="180" r="70" stroke="#FF4D00" strokeWidth="10"/>
          <circle cx="300" cy="180" r="70" stroke="#FF4D00" strokeWidth="10"/>
          <circle cx="100" cy="180" r="10" fill="#FF4D00"/>
          <circle cx="300" cy="180" r="10" fill="#FF4D00"/>
          <line x1="100" y1="180" x2="180" y2="90" stroke="#111" strokeWidth="8" strokeLinecap="round"/>
          <line x1="180" y1="90" x2="300" y2="180" stroke="#111" strokeWidth="8" strokeLinecap="round"/>
          <line x1="180" y1="90" x2="100" y2="180" stroke="#111" strokeWidth="8" strokeLinecap="round"/>
          <line x1="180" y1="90" x2="240" y2="80" stroke="#111" strokeWidth="8" strokeLinecap="round"/>
          <line x1="240" y1="80" x2="300" y2="180" stroke="#111" strokeWidth="8" strokeLinecap="round"/>
          <line x1="160" y1="90" x2="200" y2="90" stroke="#111" strokeWidth="10" strokeLinecap="round"/>
          <circle cx="180" cy="90" r="10" fill="#FF4D00"/>
          <line x1="235" y1="75" x2="255" y2="55" stroke="#111" strokeWidth="8" strokeLinecap="round"/>
          <line x1="245" y1="55" x2="270" y2="58" stroke="#111" strokeWidth="8" strokeLinecap="round"/>
          <line x1="245" y1="55" x2="220" y2="58" stroke="#111" strokeWidth="8" strokeLinecap="round"/>
        </svg>
      </div>
    </section>
  );
}