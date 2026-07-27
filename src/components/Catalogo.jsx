import { useState } from "react";
import { colores } from "../datos";

const categorias = ["Todas", "Montaña", "Urbana", "Ruta", "Niños", "Gravel"];

export default function Catalogo({ productos, onAgregarAlCarrito }) {
  const [filtro, setFiltro] = useState("Todas");
  const [agregados, setAgregados] = useState({});

  const filtrados = filtro === "Todas" ? productos : productos.filter((p) => p.categoria === filtro);

  const handleAgregar = (producto) => {
    if (producto.stock === 0) return;
    onAgregarAlCarrito(producto);
    setAgregados((prev) => ({ ...prev, [producto.id]: true }));
    setTimeout(() => setAgregados((prev) => ({ ...prev, [producto.id]: false })), 1500);
  };

  return (
    <section className="catalogo" id="catalogo">
      <div className="catalogo-header">
        <h2 className="catalogo-titulo">Nuestras bicicletas</h2>
        <div className="filtros">
          {categorias.map((cat) => (
            <button
              key={cat}
              className={`filtro-btn ${filtro === cat ? "activo" : ""}`}
              onClick={() => setFiltro(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="productos-grid">
        {filtrados.map((producto) => (
          <div key={producto.id} className={`producto-card ${producto.stock === 0 ? "card-sin-stock" : ""}`}>

            <div className="producto-img" style={{ background: `${colores[producto.categoria]}15` }}>
              {producto.imagen_url
                ? <img src={producto.imagen_url} alt={producto.nombre} className="producto-foto" />
                : (
                  <svg viewBox="0 0 180 130" fill="none" xmlns="http://www.w3.org/2000/svg" className="producto-svg">
                    <circle cx="45" cy="88" r="32" stroke={producto.stock === 0 ? "#ccc" : colores[producto.categoria]} strokeWidth="6"/>
                    <circle cx="135" cy="88" r="32" stroke={producto.stock === 0 ? "#ccc" : colores[producto.categoria]} strokeWidth="6"/>
                    <circle cx="45" cy="88" r="5" fill={producto.stock === 0 ? "#ccc" : colores[producto.categoria]}/>
                    <circle cx="135" cy="88" r="5" fill={producto.stock === 0 ? "#ccc" : colores[producto.categoria]}/>
                    <line x1="45" y1="88" x2="82" y2="44" stroke="#222" strokeWidth="5" strokeLinecap="round"/>
                    <line x1="82" y1="44" x2="135" y2="88" stroke="#222" strokeWidth="5" strokeLinecap="round"/>
                    <line x1="82" y1="44" x2="45" y2="88" stroke="#222" strokeWidth="5" strokeLinecap="round"/>
                    <line x1="82" y1="44" x2="112" y2="38" stroke="#222" strokeWidth="5" strokeLinecap="round"/>
                    <line x1="112" y1="38" x2="135" y2="88" stroke="#222" strokeWidth="5" strokeLinecap="round"/>
                    <line x1="72" y1="44" x2="92" y2="44" stroke="#222" strokeWidth="6" strokeLinecap="round"/>
                    <circle cx="82" cy="44" r="5" fill={producto.stock === 0 ? "#ccc" : colores[producto.categoria]}/>
                    <line x1="109" y1="35" x2="116" y2="22" stroke="#222" strokeWidth="5" strokeLinecap="round"/>
                    <line x1="113" y1="22" x2="125" y2="24" stroke="#222" strokeWidth="5" strokeLinecap="round"/>
                    <line x1="113" y1="22" x2="101" y2="24" stroke="#222" strokeWidth="5" strokeLinecap="round"/>
                  </svg>
                )
              }
              <span className="producto-cat" style={{ background: producto.stock === 0 ? "#aaa" : colores[producto.categoria] }}>
                {producto.categoria}
              </span>
              {producto.stock === 0 && <div className="sin-stock-overlay">Sin stock</div>}
            </div>

            
            <div className="producto-info">
              <h3 className="producto-nombre">{producto.nombre}</h3>
              <p className="producto-desc">{producto.descripcion}</p>
              <div className="producto-footer">
                <span className="producto-precio">
                  ${producto.precio.toLocaleString("es-AR")}
                </span>
                <button
                  className={`agregar-btn ${agregados[producto.id] ? "agregado" : ""} ${producto.stock === 0 ? "sin-stock-btn" : ""}`}
                  onClick={() => handleAgregar(producto)}
                  disabled={producto.stock === 0}
                >
                  {producto.stock === 0 ? "Sin stock" : agregados[producto.id] ? "✓ Agregado" : "Agregar"}
                </button>
              </div>
              {producto.stock > 0 && producto.stock <= 3 && (
                <p className="stock-aviso">⚡ Solo {producto.stock} en stock</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
