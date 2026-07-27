export default function Navbar({ cantidadItems, onAbrirCarrito, onInicio, onAdmin }) {
  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <button className="logo" onClick={onInicio}>
          <span className="logo-icon">🚴</span>
          <span className="logo-text">DelgadoBike</span>
        </button>
        <div className="nav-links">
          <button className="nav-link" onClick={onInicio}>Catálogo</button>
          <button className="nav-link" onClick={onInicio}>Nosotros</button>
          <button className="nav-link" onClick={onInicio}>Contacto</button>
        </div>
        <div className="navbar-acciones">
          
          <button className="carrito-btn" onClick={onAbrirCarrito}>
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            {cantidadItems > 0 && (
              <span className="carrito-badge">{cantidadItems}</span>
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
