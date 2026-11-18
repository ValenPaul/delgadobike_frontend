// Footer del sitio: se muestra en todas las vistas públicas (no en el admin).
// Las columnas usan las callbacks de navegación igual que el Navbar.
export default function Footer({ onInicio, onNosotros, onContacto }) {
  const irACatalogo = () => {
    // El catálogo vive en la home (#catalogo): si no estamos en la home,
    // navegamos primero y después scrolleamos a la sección.
    const scrollAlCatalogo = () => {
      const destino = document.getElementById("catalogo");
      if (destino) destino.scrollIntoView({ behavior: "smooth" });
    };
    if (window.location.pathname !== "/") {
      onInicio();
      // Esperamos un tick a que la home renderice el catálogo.
      setTimeout(scrollAlCatalogo, 60);
    } else {
      scrollAlCatalogo();
    }
  };

  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-col">
          <img
            className="footer-logo"
            src="https://res.cloudinary.com/qojnuqqz/image/upload/v1794568285/delgadobike/logo-sin-fondo-delgadobike-1_msck1e.png"
            alt="DelgadoBike — tienda de bicicletas en Crespo, Entre Ríos"
          />
          <p className="footer-desc">
            Tienda de bicicletas en Crespo, Entre Ríos. Más de 30 años vendiendo
            bicicletas, accesorios y servicio técnico. Envíos a todo el país por
            Andreani.
          </p>
        </div>

        <div className="footer-links">
          <h4>Contacto</h4>
          <p className="footer-direccion">
            3 de Febrero 1223, Crespo, Entre Ríos (CP 3116)
          </p>
          <a
            href="https://wa.me/5493434717485"
            target="_blank"
            rel="noreferrer"
          >
            Escribinos por WhatsApp
          </a>
          <a href="mailto:contacto@delgadobike.com.ar">
            contacto@delgadobike.com.ar
          </a>
        </div>

        <div className="footer-links">
          <h4>Navegación</h4>
          <button type="button" onClick={onInicio}>Inicio</button>
          <button type="button" onClick={irACatalogo}>Catálogo</button>
          <button type="button" onClick={onNosotros}>Nosotros</button>
          <button type="button" onClick={onContacto}>Contacto</button>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© 2026 DelgadoBike — Delgado Bike Online. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
