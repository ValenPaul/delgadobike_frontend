export default function Nosotros() {
  return (
    <div className="pagina">

      {/* HERO NOSOTROS */}
      <section className="nosotros-hero">
        <div className="nosotros-hero-inner">
          <span className="nosotros-tag">● Desde 1994</span>
          <h1 className="nosotros-titulo">
            Más de 30 años<br />
            <span className="nosotros-accent">sobre dos ruedas.</span>
          </h1>
          <p className="nosotros-sub">
            Somos una bicicletería familiar ubicada en Crespo, Entre Ríos.
            Nacimos con la pasión por las bicicletas y hoy seguimos ofreciendo
            la mejor atención, los mejores productos y el servicio técnico más completo de la zona.
          </p>
        </div>
      </section>

      {/* VALORES */}
      <section className="nosotros-valores">
        <div className="nosotros-inner">
          <div className="seccion-label">Nuestros valores</div>
          <h2 className="seccion-titulo">Lo que nos define</h2>

          <div className="valores-grid">
            <div className="valor-card">
              <div className="valor-icon">🏆</div>
              <h3>Calidad</h3>
              <p>Trabajamos solo con las mejores marcas del mercado. Cada bicicleta que vendemos pasa por nuestro control de calidad antes de llegar a tus manos.</p>
            </div>
            <div className="valor-card">
              <div className="valor-icon">🤝</div>
              <h3>Confianza</h3>
              <p>Más de 30 años de trayectoria nos avalan. Nuestros clientes vuelven porque saben que siempre van a encontrar honestidad y transparencia.</p>
            </div>
            <div className="valor-card">
              <div className="valor-icon">🔧</div>
              <h3>Servicio</h3>
              <p>Nuestro taller especializado está disponible para cualquier reparación, armado o service. Trabajamos con rapidez y precisión.</p>
            </div>
            <div className="valor-card">
              <div className="valor-icon">❤️</div>
              <h3>Pasión</h3>
              <p>Las bicicletas no son solo un negocio para nosotros. Son nuestra forma de vida. Esa pasión se refleja en cada asesoramiento y cada venta.</p>
            </div>
          </div>
        </div>
      </section>

      {/* HISTORIA */}
      <section className="nosotros-historia">
        <div className="nosotros-inner historia-layout">
          <div className="historia-texto">
            <div className="seccion-label">Nuestra historia</div>
            <h2 className="seccion-titulo">Cómo empezó todo</h2>
            <p>Delgado Bike nació hace más de 30 años en Crespo, Entre Ríos, con una simple idea: ofrecer bicicletas de calidad con atención personalizada.</p>
            <p>Con el paso del tiempo fuimos creciendo, incorporando nuevas marcas, ampliando nuestro taller y sumando accesorios y repuestos para todo tipo de ciclista.</p>
            <p>Hoy somos un referente del rubro en la región, combinando la calidez del negocio familiar con la tecnología de una tienda online que llega a todo el país.</p>
          </div>
          <div className="historia-stats">
            <div className="stat">
              <span className="stat-num">30+</span>
              <span className="stat-label">Años de experiencia</span>
            </div>
            <div className="stat">
              <span className="stat-num">100%</span>
              <span className="stat-label">Atención personalizada</span>
            </div>
            <div className="stat">
              <span className="stat-num">🇦🇷</span>
              <span className="stat-label">Envíos a todo el país</span>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}