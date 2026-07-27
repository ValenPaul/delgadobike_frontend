export default function Carrito({ abierto, onCerrar, items, onCambiarCantidad, onCheckout }) {
  const total = items.reduce((a, i) => a + i.precio * i.cantidad, 0);

  return (
    <>
      {abierto && <div className="overlay" onClick={onCerrar} />}
      <aside className={`carrito-drawer ${abierto ? "abierto" : ""}`}>
        <div className="carrito-header">
          <h2>Tu carrito</h2>
          <button className="cerrar-btn" onClick={onCerrar} aria-label="Cerrar carrito">✕</button>
        </div>

        {items.length === 0 ? (
          <div className="carrito-vacio">
            <svg width="64" height="64" fill="none" stroke="#ccc" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            <p>Tu carrito está vacío</p>
          </div>
        ) : (
          <>
            <ul className="carrito-items">
              {items.map((item) => (
                <li key={item.id} className="carrito-item">
                  <div className="item-info">
                    <span className="item-nombre">{item.nombre}</span>
                    <span className="item-precio">${(item.precio * item.cantidad).toLocaleString("es-AR")}</span>
                  </div>
                  <div className="item-controles">
                    <button onClick={() => onCambiarCantidad(item.id, -1)}>−</button>
                    <span>{item.cantidad}</span>
                    <button onClick={() => onCambiarCantidad(item.id, 1)}>+</button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="carrito-footer">
              <div className="carrito-total">
                <span>Total</span>
                <strong>${total.toLocaleString("es-AR")}</strong>
              </div>
              <button className="checkout-btn" onClick={onCheckout}>
                Continuar con la compra →
              </button>
            </div>
          </>
        )}
      </aside>
    </>
  );
}