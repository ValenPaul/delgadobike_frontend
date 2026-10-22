import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_URL;

export default function Carrito({ abierto, onCerrar, items, onCambiarCantidad, onCheckout }) {
  const total = items.reduce((a, i) => a + i.precio * i.cantidad, 0);

  // Última cotización del envío para TODO el carrito (POST /envios/cotizar)
  const [envio, setEnvio] = useState(null);

  // Firma del carrito (ids + cantidades): cotizamos solo cuando cambia,
  // así los re-renders del drawer no disparan llamadas nuevas.
  const firma = items.map((i) => `${i.id}:${i.cantidad}`).join(",");
  const ultimaFirma = useRef("");

  useEffect(() => {
    if (items.length === 0) {
      setEnvio(null);
      ultimaFirma.current = "";
      return;
    }
    if (ultimaFirma.current === firma) return;
    ultimaFirma.current = firma;

    let cancelado = false;
    (async () => {
      try {
        const res = await fetch(`${API}/envios/cotizar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((i) => ({ producto_id: i.id, cantidad: i.cantidad })),
          }),
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        if (!cancelado) setEnvio(data);
      } catch (err) {
        // Si falla la cotización no rompemos el carrito: el total se muestra
        // sin envío y el checkout vuelve a cotizar antes de pagar.
        console.error("Error cotizando envío del carrito:", err);
        if (!cancelado) setEnvio(null);
      }
    })();

    return () => { cancelado = true; };
  }, [firma, items]);

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
              <div className="carrito-linea-envio">
                <span>
                  Envío <span className="carrito-envio-franja">{envio ? envio.etiqueta : "a calcular"}</span>
                </span>
                <span className="carrito-envio-monto">
                  {envio ? `$${envio.total.toLocaleString("es-AR")}` : "—"}
                </span>
              </div>
              <div className="carrito-total">
                <span>Total con envío</span>
                <strong>${(total + (envio ? envio.total : 0)).toLocaleString("es-AR")}</strong>
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
