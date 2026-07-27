import { useState } from "react";
import { categorias, colores, ADMIN_USER, ADMIN_PASS } from "../datos";

// ─── LOGIN ───────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      onLogin();
    } else {
      setError("Usuario o contraseña incorrectos.");
    }
  };

  return (
    <div className="admin-login">
      <div className="admin-login-card">
        <div className="admin-login-icon">🔐</div>
        <h1>Panel de administración</h1>
        <p>DelgadoBike</p>
        <div className="admin-field">
          <label>Usuario</label>
          <input value={user} onChange={e => setUser(e.target.value)} placeholder="admin" />
        </div>
        <div className="admin-field">
          <label>Contraseña</label>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)}
            placeholder="••••••••" onKeyDown={e => e.key === "Enter" && handleLogin()} />
        </div>
        {error && <p className="admin-login-error">{error}</p>}
        <button className="admin-login-btn" onClick={handleLogin}>Ingresar</button>
      </div>
    </div>
  );
}

// ─── MODAL PRODUCTO ──────────────────────────────────────────────────────────
function ModalProducto({ producto, onGuardar, onCerrar }) {
  const esNuevo = !producto;
  const [form, setForm] = useState(
    producto || { nombre: "", categoria: "Montaña", precio: "", descripcion: "", stock: "" }
  );
  const [imagen, setImagen] = useState(null);
  const [preview, setPreview] = useState(producto?.imagen_url || null);
  const [errores, setErrores] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (errores[name]) setErrores(prev => ({ ...prev, [name]: "" }));
  };

  const handleImagen = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImagen(file);
    setPreview(URL.createObjectURL(file));
  };

  const validar = () => {
    const errs = {};
    if (!form.nombre) errs.nombre = "Requerido";
    if (!form.precio || isNaN(form.precio) || Number(form.precio) <= 0) errs.precio = "Precio inválido";
    if (!form.descripcion) errs.descripcion = "Requerido";
    if (form.stock === "" || isNaN(form.stock) || Number(form.stock) < 0) errs.stock = "Stock inválido";
    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGuardar = () => {
    if (!validar()) return;
    onGuardar(
      { ...form, precio: Number(form.precio), stock: Number(form.stock) },
      imagen  // pasamos el archivo de imagen por separado
    );
  };

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{esNuevo ? "Agregar bicicleta" : "Editar bicicleta"}</h2>
          <button className="modal-cerrar" onClick={onCerrar}>✕</button>
        </div>

        <div className="modal-body">
          {/* Preview de imagen */}
          <div className="imagen-upload">
            <div className="imagen-preview">
              {preview
                ? <img src={preview} alt="Preview" />
                : <span className="imagen-placeholder">📷 Sin imagen</span>
              }
            </div>
            <label className="imagen-btn">
              {preview ? "Cambiar imagen" : "Subir imagen"}
              <input
                type="file"
                accept="image/*"
                onChange={handleImagen}
                style={{ display: "none" }}
              />
            </label>
            <p className="imagen-hint">JPG, PNG o WEBP. Máx 5MB.</p>
          </div>

          <div className="admin-field">
            <label>Nombre del producto</label>
            <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Ej: Trail Xpert 29" />
            {errores.nombre && <span className="admin-error">{errores.nombre}</span>}
          </div>

          <div className="modal-row">
            <div className="admin-field">
              <label>Categoría</label>
              <select name="categoria" value={form.categoria} onChange={handleChange}>
                {categorias.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="admin-field">
              <label>Precio (ARS)</label>
              <input name="precio" type="number" value={form.precio} onChange={handleChange} placeholder="185000" />
              {errores.precio && <span className="admin-error">{errores.precio}</span>}
            </div>
            <div className="admin-field" style={{ maxWidth: 100 }}>
              <label>Stock</label>
              <input name="stock" type="number" value={form.stock} onChange={handleChange} placeholder="0" min="0" />
              {errores.stock && <span className="admin-error">{errores.stock}</span>}
            </div>
          </div>

          <div className="admin-field">
            <label>Descripción</label>
            <textarea name="descripcion" value={form.descripcion} onChange={handleChange}
              rows={3} placeholder="Descripción del producto..." />
            {errores.descripcion && <span className="admin-error">{errores.descripcion}</span>}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primario" onClick={handleGuardar}>
            {esNuevo ? "Agregar producto" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SECCIÓN PRODUCTOS ───────────────────────────────────────────────────────
function SeccionProductos({ productos, onActualizar }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [productoEditar, setProductoEditar] = useState(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);

  const handleGuardar = (datos, imagen) => {
    if (productoEditar) {
      onActualizar("editar", { ...productoEditar, ...datos }, imagen);
    } else {
      onActualizar("crear", datos, imagen);
    }
    setModalAbierto(false);
    setProductoEditar(null);
  };

  const handleEliminar = (id) => {
    onActualizar("eliminar", { id });
    setConfirmarEliminar(null);
  };

  const handleStock = (id, delta) => {
    const producto = productos.find(p => p.id === id);
    if (!producto) return;
    const nuevoStock = Math.max(0, producto.stock + delta);
    onActualizar("editar", { ...producto, stock: nuevoStock });
  };

  return (
    <div className="admin-seccion">
      <div className="admin-seccion-header">
        <div>
          <h2>Productos</h2>
          <p>{productos.length} bicicletas en el catálogo</p>
        </div>
        <button className="btn-primario" onClick={() => { setProductoEditar(null); setModalAbierto(true); }}>
          + Agregar bicicleta
        </button>
      </div>

      <div className="admin-tabla-wrapper">
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {productos.map(p => (
              <tr key={p.id} className={p.stock === 0 ? "fila-sin-stock" : ""}>
                <td>
                  <div className="tabla-producto-nombre">{p.nombre}</div>
                  <div className="tabla-producto-desc">{p.descripcion.substring(0, 50)}...</div>
                </td>
                <td>
                  <span className="badge-categoria" style={{ background: colores[p.categoria] + "20", color: colores[p.categoria] }}>
                    {p.categoria}
                  </span>
                </td>
                <td className="tabla-precio">${p.precio.toLocaleString("es-AR")}</td>
                <td>
                  <div className="stock-control">
                    <button className="stock-btn" onClick={() => handleStock(p.id, -1)}>−</button>
                    <span className={`stock-num ${p.stock === 0 ? "stock-cero" : p.stock <= 3 ? "stock-bajo" : ""}`}>
                      {p.stock}
                    </span>
                    <button className="stock-btn" onClick={() => handleStock(p.id, 1)}>+</button>
                  </div>
                </td>
                <td>
                  {p.stock === 0
                    ? <span className="badge-estado sin-stock">Sin stock</span>
                    : p.stock <= 3
                    ? <span className="badge-estado stock-bajo-badge">Stock bajo</span>
                    : <span className="badge-estado disponible">Disponible</span>
                  }
                </td>
                <td>
                  <div className="tabla-acciones">
                    <button className="btn-editar" onClick={() => { setProductoEditar(p); setModalAbierto(true); }}>
                      ✏️ Editar
                    </button>
                    <button className="btn-eliminar" onClick={() => setConfirmarEliminar(p.id)}>
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalAbierto && (
        <ModalProducto
          producto={productoEditar}
          onGuardar={handleGuardar}
          onCerrar={() => { setModalAbierto(false); setProductoEditar(null); }}
        />
      )}

      {confirmarEliminar && (
        <div className="modal-overlay" onClick={() => setConfirmarEliminar(null)}>
          <div className="modal-confirmar" onClick={e => e.stopPropagation()}>
            <h3>¿Eliminar producto?</h3>
            <p>Esta acción no se puede deshacer.</p>
            <div className="modal-footer">
              <button className="btn-secundario" onClick={() => setConfirmarEliminar(null)}>Cancelar</button>
              <button className="btn-eliminar-confirm" onClick={() => handleEliminar(confirmarEliminar)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SECCIÓN PEDIDOS ─────────────────────────────────────────────────────────
const ESTADOS = ["pendiente", "en camino", "entregado", "cancelado"];
const coloresEstado = {
  pendiente: { bg: "#FFF3CD", color: "#856404" },
  "en camino": { bg: "#D1ECF1", color: "#0C5460" },
  entregado: { bg: "#D4EDDA", color: "#155724" },
  cancelado: { bg: "#F8D7DA", color: "#721C24" },
};

function SeccionPedidos({ pedidos, onActualizarEstado }) {
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [pedidoDetalle, setPedidoDetalle] = useState(null);

  const filtrados = filtroEstado === "todos"
    ? pedidos
    : pedidos.filter(p => p.estado === filtroEstado);

  

  const totales = {
    todos: pedidos.length,
    pendiente: pedidos.filter(p => p.estado === "pendiente").length,
    "en camino": pedidos.filter(p => p.estado === "en camino").length,
    entregado: pedidos.filter(p => p.estado === "entregado").length,
    cancelado: pedidos.filter(p => p.estado === "cancelado").length,
  };

  return (
    <div className="admin-seccion">
      <div className="admin-seccion-header">
        <div>
          <h2>Pedidos</h2>
          <p>{pedidos.length} pedidos en total</p>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="pedidos-resumen">
        {[
          { key: "todos", label: "Todos", icon: "📦" },
          { key: "pendiente", label: "Pendientes", icon: "⏳" },
          { key: "en camino", label: "En camino", icon: "🚚" },
          { key: "entregado", label: "Entregados", icon: "✅" },
          { key: "cancelado", label: "Cancelados", icon: "❌" },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            className={`resumen-card ${filtroEstado === key ? "activo" : ""}`}
            onClick={() => setFiltroEstado(key)}
          >
            <span className="resumen-icon">{icon}</span>
            <span className="resumen-num">{totales[key]}</span>
            <span className="resumen-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="admin-tabla-wrapper">
        <table className="admin-tabla">
          <thead>
            <tr>
              <th>N° Pedido</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Productos</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(p => (
              <tr key={p.id}>
                <td><strong>{p.id}</strong></td>
                <td>{new Date(p.fecha).toLocaleDateString("es-AR")}</td>
                <td>
                  <div>{p.cliente}</div>
                  <div className="tabla-producto-desc">{p.localidad}</div>
                </td>
                <td>
                  {p.items.map((item, i) => (
                    <div key={i} className="tabla-producto-desc">{item.nombre} ×{item.cantidad}</div>
                  ))}
                </td>
                <td className="tabla-precio">${p.total.toLocaleString("es-AR")}</td>
                <td>
                  <span className="badge-estado" style={{ background: coloresEstado[p.estado].bg, color: coloresEstado[p.estado].color }}>
                    {p.estado}
                  </span>
                </td>
                <td>
                  <div className="tabla-acciones">
                    <select
                      className="estado-select"
                      value={p.estado}
                      onChange={e => onActualizarEstado(p.id, e.target.value)}
                    >
                      {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtrados.length === 0 && (
        <div className="tabla-vacia">No hay pedidos con ese estado.</div>
      )}
    </div>
  );
}

// ─── ADMIN PRINCIPAL ─────────────────────────────────────────────────────────
export default function Admin({ productos, pedidos, onActualizarProductos, onActualizarEstadoPedido, onSalir }) {
  const [logueado, setLogueado] = useState(false);
  const [tab, setTab] = useState("productos");

  if (!logueado) return <Login onLogin={() => setLogueado(true)} />;

  const totalVentas = pedidos
    .filter(p => p.estado !== "cancelado")
    .reduce((a, p) => a + p.total, 0);

  const sinStock = productos.filter(p => p.stock === 0).length;
  const stockBajo = productos.filter(p => p.stock > 0 && p.stock <= 3).length;

  return (
    <div className="admin-wrapper">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>🚴</span>
          <div>
            <div className="admin-brand-name">DelgadoBike</div>
            <div className="admin-brand-sub">Panel admin</div>
          </div>
        </div>

        <nav className="admin-nav">
          <button className={`admin-nav-item ${tab === "productos" ? "activo" : ""}`} onClick={() => setTab("productos")}>
            <span>🛒</span> Productos
          </button>
          <button className={`admin-nav-item ${tab === "pedidos" ? "activo" : ""}`} onClick={() => setTab("pedidos")}>
            <span>📦</span> Pedidos
            {pedidos.filter(p => p.estado === "pendiente").length > 0 && (
              <span className="nav-badge">{pedidos.filter(p => p.estado === "pendiente").length}</span>
            )}
          </button>
        </nav>

        <button className="admin-salir" onClick={() => {
            window.history.pushState({}, "", "/");
            onSalir();
          }}>← Volver a la tienda
        </button>
      </aside>

      <main className="admin-main">
        <div className="admin-metricas">
          <div className="metrica-card">
            <span className="metrica-icon">🛍️</span>
            <div>
              <div className="metrica-num">{productos.length}</div>
              <div className="metrica-label">Productos</div>
            </div>
          </div>
          <div className="metrica-card">
            <span className="metrica-icon">📦</span>
            <div>
              <div className="metrica-num">{pedidos.length}</div>
              <div className="metrica-label">Pedidos totales</div>
            </div>
          </div>
          <div className="metrica-card">
            <span className="metrica-icon">💰</span>
            <div>
              <div className="metrica-num">${totalVentas.toLocaleString("es-AR")}</div>
              <div className="metrica-label">Ventas totales</div>
            </div>
          </div>
          {sinStock > 0 && (
            <div className="metrica-card metrica-alerta">
              <span className="metrica-icon">⚠️</span>
              <div>
                <div className="metrica-num">{sinStock}</div>
                <div className="metrica-label">Sin stock</div>
              </div>
            </div>
          )}
          {stockBajo > 0 && (
            <div className="metrica-card metrica-warning">
              <span className="metrica-icon">📉</span>
              <div>
                <div className="metrica-num">{stockBajo}</div>
                <div className="metrica-label">Stock bajo</div>
              </div>
            </div>
          )}
        </div>

        {tab === "productos" && (
          <SeccionProductos
            productos={productos}
            onActualizar={onActualizarProductos}
          />
        )}
        {tab === "pedidos" && (
          <SeccionPedidos
            pedidos={pedidos}
            onActualizarEstado={onActualizarEstadoPedido}
          />
        )}
      </main>
    </div>
  );
}
