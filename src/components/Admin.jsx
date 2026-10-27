import { useState, useEffect } from "react";
import { categorias, colores } from "../datos";

const API = import.meta.env.VITE_API_URL;

// Cabecera de autenticación (mismo criterio que App.jsx): las secciones
// nuevas del panel (tarifas y despachos) hacen sus propios fetch y necesitan
// mandar el token guardado en localStorage.
const authHeaders = () => {
  const token = localStorage.getItem("adminToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Si el backend responde 401, el token ya no sirve: lo borramos y
// recargamos para volver al login.
const manejarErrorAuth = async (res) => {
  if (res.status === 401) {
    localStorage.removeItem("adminToken");
    alert("Tu sesión expiró o el token no es válido. Volvé a ingresar en el panel.");
    window.location.reload();
    return true;
  }
  return false;
};

// Formatea gramos como kilos legibles (1500 → "1,5 kg").
const formatoKg = (gramos) => {
  const kg = Number(gramos) / 1000;
  return `${kg.toLocaleString("es-AR", { maximumFractionDigits: 2 })} kg`;
};

// ─── LOGIN ───────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  // La validación de credenciales ocurre en el backend (POST /auth/login).
  // Si sale bien guardamos el token en localStorage para las escrituras.
  const handleLogin = async () => {
    if (cargando) return;
    setError("");
    setCargando(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: user, password: pass }),
      });

      if (res.status === 401) {
        setError("Usuario o contraseña incorrectos.");
        return;
      }
      if (!res.ok) throw new Error(`Error ${res.status}`);

      const data = await res.json();
      if (!data.token) throw new Error("Respuesta sin token");

      localStorage.setItem("adminToken", data.token);
      onLogin();
    } catch (err) {
      console.error("Error de login:", err);
      setError("No se pudo conectar con el servidor. Intentá de nuevo.");
    } finally {
      setCargando(false);
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
        <button className="admin-login-btn" onClick={handleLogin} disabled={cargando}>
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
      </div>
    </div>
  );
}

// ─── MODAL PRODUCTO ──────────────────────────────────────────────────────────
// Campos de envío (peso y dimensiones del bulto) que alimentan las
// cotizaciones de POST /envios/cotizar. Vacío = sin cargar (peso de reserva).
const CAMPOS_ENVIO_PRODUCTO = ["peso_g", "alto_cm", "ancho_cm", "largo_cm"];

function ModalProducto({ producto, onGuardar, onCerrar }) {
  const esNuevo = !producto;
  const defaults = {
    nombre: "", categoria: "Montaña", precio: "", descripcion: "", stock: "",
    peso_g: "", alto_cm: "", ancho_cm: "", largo_cm: "",
  };
  const [form, setForm] = useState(
    producto
      ? {
          ...defaults, ...producto,
          peso_g: producto.peso_g ?? "",
          alto_cm: producto.alto_cm ?? "",
          ancho_cm: producto.ancho_cm ?? "",
          largo_cm: producto.largo_cm ?? "",
        }
      : defaults
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
    CAMPOS_ENVIO_PRODUCTO.forEach((campo) => {
      const v = String(form[campo] ?? "").trim();
      if (v !== "" && !/^\d+$/.test(v)) errs[campo] = "Número entero ≥ 0";
    });
    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGuardar = () => {
    if (!validar()) return;
    const datos = { ...form, precio: Number(form.precio), stock: Number(form.stock) };
    // Los campos de envío vacíos no se mandan: en PUT el backend conserva
    // el valor actual y en POST queda el DEFAULT (0 = sin cargar).
    CAMPOS_ENVIO_PRODUCTO.forEach((campo) => {
      const v = String(datos[campo] ?? "").trim();
      if (v === "") delete datos[campo];
      else datos[campo] = Number(v);
    });
    onGuardar(datos, imagen);  // pasamos el archivo de imagen por separado
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

          <div className="modal-envio">
            <h3>Envío Andreani</h3>
            <p className="modal-envio-hint">
              Peso y dimensiones del bulto. Si los dejás en 0 se aplica un peso de reserva (15 kg).
            </p>
            <div className="modal-row">
              <div className="admin-field">
                <label>Peso (g)</label>
                <input name="peso_g" type="number" value={form.peso_g} onChange={handleChange} placeholder="15000" min="0" />
                {errores.peso_g && <span className="admin-error">{errores.peso_g}</span>}
              </div>
              <div className="admin-field">
                <label>Alto (cm)</label>
                <input name="alto_cm" type="number" value={form.alto_cm} onChange={handleChange} placeholder="0" min="0" />
                {errores.alto_cm && <span className="admin-error">{errores.alto_cm}</span>}
              </div>
              <div className="admin-field">
                <label>Ancho (cm)</label>
                <input name="ancho_cm" type="number" value={form.ancho_cm} onChange={handleChange} placeholder="0" min="0" />
                {errores.ancho_cm && <span className="admin-error">{errores.ancho_cm}</span>}
              </div>
              <div className="admin-field">
                <label>Largo (cm)</label>
                <input name="largo_cm" type="number" value={form.largo_cm} onChange={handleChange} placeholder="0" min="0" />
                {errores.largo_cm && <span className="admin-error">{errores.largo_cm}</span>}
              </div>
            </div>
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
// "reservada" = pago aprobado con retiro en el local (esperando que el
// cliente lo pase a buscar). El backend la acepta en PUT /pedidos/:id/estado.
const ESTADOS = ["pendiente", "reservada", "en camino", "entregado", "cancelado"];
const coloresEstado = {
  pendiente: { bg: "#FFF3CD", color: "#856404" },
  reservada: { bg: "#E8F0FE", color: "#1A4FA0" },
  "en camino": { bg: "#D1ECF1", color: "#0C5460" },
  entregado: { bg: "#D4EDDA", color: "#155724" },
  cancelado: { bg: "#F8D7DA", color: "#721C24" },
};

// Un pedido es de retiro en el local si el desglose de envío dice "Retiro en
// local" (o si nació reservado). Sirve para mostrar "Retiro en local" en vez
// de una dirección que viene vacía.
// OJO: se detecta por `etiqueta` y NO por `metodo`: el backend solo persiste
// { base, seguro, express, total, etiqueta } en el JSONB (ver
// backend/src/routes/pagos.js → envioDesglose), así que `metodo` nunca llega
// a la BD y esa condición nunca matchearía. `etiqueta` sí se guarda y es lo
// que ya usa email.js. La condición de estado queda como red de seguridad
// para pedidos viejos sin desglose.
const esRetiroLocal = (p) =>
  (p.envio_desglose && p.envio_desglose.etiqueta === "Retiro en local") ||
  p.estado === "reservada";

function SeccionPedidos({ pedidos, onActualizarEstado }) {
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const filtrados = filtroEstado === "todos"
    ? pedidos
    : pedidos.filter(p => p.estado === filtroEstado);

  const totales = {
    todos: pedidos.length,
    pendiente: pedidos.filter(p => p.estado === "pendiente").length,
    reservada: pedidos.filter(p => p.estado === "reservada").length,
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
          { key: "reservada", label: "Reservados", icon: "🏬" },
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
                {/* GET /pedidos devuelve las filas crudas de la tabla: la
                    columna de fecha se llama creado_en, no fecha. */}
                <td>{new Date(p.creado_en).toLocaleDateString("es-AR")}</td>
                <td>
                  <div>{p.cliente}</div>
                  <div className="tabla-producto-desc">
                    {esRetiroLocal(p) ? "Retiro en local" : p.localidad}
                  </div>
                </td>
                <td>
                  {p.items.map((item, i) => (
                    <div key={i} className="tabla-producto-desc">{item.nombre} ×{item.cantidad}</div>
                  ))}
                </td>
                <td className="tabla-precio">${p.total.toLocaleString("es-AR")}</td>
                <td>
                  {p.estado === "reservada" ? (
                    <span className="badge-estado badge-reservada">🏬 Reservada — retira en local</span>
                  ) : (
                    <span className="badge-estado" style={{ background: coloresEstado[p.estado]?.bg, color: coloresEstado[p.estado]?.color }}>
                      {p.estado}
                    </span>
                  )}
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

// ─── SECCIÓN TARIFAS DE ENVÍO ────────────────────────────────────────────────
// Lista fija de las 24 provincias argentinas
const PROVINCIAS_ARGENTINAS = [
  "Buenos Aires",
  "Ciudad Autónoma de Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

function SeccionTarifas() {
  const [subTabTarifas, setSubTabTarifas] = useState("franjas");
  const [franjas, setFranjas] = useState([]);
  const [opcionales, setOpcionales] = useState(null);
  const [formOpcionales, setFormOpcionales] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [modalFranja, setModalFranja] = useState(undefined); // undefined = cerrado
  const [confirmandoBorrar, setConfirmandoBorrar] = useState(null);

  // Estado para "Por destino"
  const [destinosData, setDestinosData] = useState({ margen_pct: 0, franjas: [], destinos: [] });
  const [franjaDestinoSeleccionada, setFranjaDestinoSeleccionada] = useState(null);
  const [filasDestinos, setFilasDestinos] = useState([]); // { provincia, franja_id, costo, activo, precioConMargen }
  const [cargandoDestinos, setCargandoDestinos] = useState(false);
  const [errorDestinos, setErrorDestinos] = useState("");
  const [guardandoDestinos, setGuardandoDestinos] = useState(false);

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${API}/envios/tarifas`, { headers: authHeaders() });
      if (await manejarErrorAuth(res)) return;
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      const lista = data.franjas || [];
      const ops = data.opcionales || null;
      setFranjas(lista);
      setOpcionales(ops);
      if (ops) {
        setFormOpcionales({
          seguro_etiqueta: ops.seguro_etiqueta || "",
          seguro_precio: ops.seguro_precio ?? 0,
          seguro_activo: Boolean(ops.seguro_activo),
          express_etiqueta: ops.express_etiqueta || "",
          express_precio: ops.express_precio ?? 0,
          express_activo: Boolean(ops.express_activo),
        });
      }
      setError("");
    } catch (err) {
      console.error("Error cargando tarifas:", err);
      setError("No se pudieron cargar las tarifas de envío.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  // Cargar destinos por franja
  const cargarDestinos = async () => {
    setCargandoDestinos(true);
    setErrorDestinos("");
    try {
      const res = await fetch(`${API}/envios/destinos`, { headers: authHeaders() });
      if (await manejarErrorAuth(res)) return;
      if (!res.ok) {
        const dataErr = await res.json().catch(() => ({}));
        setErrorDestinos(dataErr.error || `Error ${res.status} al cargar destinos`);
        return;
      }
      const data = await res.json();
      setDestinosData(data);
      // Seleccionar franja por defecto
      const franjasDest = data.franjas || [];
      let franjaId = franjaDestinoSeleccionada;
      if (!franjaId && franjasDest.length > 0) {
        // Preferir "Bici en caja" si existe
        const biciCaja = franjasDest.find(f => f.etiqueta && f.etiqueta.toLowerCase().includes("bici"));
        franjaId = biciCaja ? biciCaja.id : franjasDest[0].id;
        setFranjaDestinoSeleccionada(franjaId);
      }
      // Construir filas para las 24 provincias
      construirFilasDestinos(data.destinos || [], franjaId || (franjasDest[0]?.id), data.margen_pct || 0);
    } catch (err) {
      console.error("Error cargando destinos:", err);
      setErrorDestinos("No se pudieron cargar los destinos por franja.");
    } finally {
      setCargandoDestinos(false);
    }
  };

  const construirFilasDestinos = (destinosLista, franjaId, margenPct) => {
    const filas = PROVINCIAS_ARGENTINAS.map((provincia) => {
      const existente = destinosLista.find(d => d.provincia === provincia && d.franja_id === franjaId);
      const costo = existente ? Number(existente.costo || 0) : 0;
      const activo = existente ? Boolean(existente.activo) : false;
      const costoNum = Number(costo) || 0;
      const precioConMargen = costoNum > 0
        ? Math.ceil(costoNum * (1 + Number(margenPct || 0) / 100) / 100) * 100
        : 0;
      return {
        provincia,
        franja_id: franjaId,
        costo: costoNum,
        activo: Boolean(activo),
        precioConMargen,
      };
    });
    setFilasDestinos(filas);
  };

  // Recalcular precios con margen cuando cambia margen o franja
  useEffect(() => {
    if (subTabTarifas !== "destinos") return;
    if (!destinosData.destinos) return;
    if (franjaDestinoSeleccionada) {
      construirFilasDestinos(destinosData.destinos, franjaDestinoSeleccionada, destinosData.margen_pct || 0);
    }
  }, [franjaDestinoSeleccionada, destinosData.margen_pct, subTabTarifas]);

  const guardarDestinos = async () => {
    setGuardandoDestinos(true);
    setErrorDestinos("");
    try {
      const destinosBody = filasDestinos.map(f => ({
        franja_id: Number(f.franja_id),
        provincia: f.provincia,
        costo: Math.max(0, Number(f.costo) || 0),
        activo: Boolean(f.activo),
      }));
      const res = await fetch(`${API}/envios/destinos`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          margen_pct: Math.max(0, Math.min(100, Number(destinosData.margen_pct) || 0)),
          destinos: destinosBody,
        }),
      });
      if (await manejarErrorAuth(res)) return;
      if (!res.ok) {
        const dataErr = await res.json().catch(() => ({}));
        setErrorDestinos(dataErr.error || `Error ${res.status} al guardar destinos`);
        return;
      }
      alert("Precios por destino guardados correctamente.");
      await cargarDestinos();
    } catch (err) {
      console.error("Error guardando destinos:", err);
      setErrorDestinos("No se pudieron guardar los destinos.");
    } finally {
      setGuardandoDestinos(false);
    }
  };

  const guardarFranja = async (datos, id) => {
    // El backend inserta `orden` explícito y la columna es NOT NULL: si el
    // form no trae orden, mandamos max(orden)+1 (workaround del bug 500 de
    // POST /envios/tarifas sin orden; reportado, no lo arreglamos del lado
    // del backend).
    const datosFinales =
      datos.orden === undefined || datos.orden === null || datos.orden === ""
        ? { ...datos, orden: franjas.length ? Math.max(...franjas.map((f) => Number(f.orden) || 0)) + 1 : 1 }
        : datos;
    try {
      const res = await fetch(
        id ? `${API}/envios/tarifas/${id}` : `${API}/envios/tarifas`,
        {
          method: id ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(datosFinales),
        }
      );
      if (await manejarErrorAuth(res)) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || `Error ${res.status} al guardar la tarifa`);
        return;
      }
      setModalFranja(undefined);
      await cargar();
    } catch (err) {
      console.error("Error guardando tarifa:", err);
      alert("No se pudo guardar la tarifa. Intentá de nuevo.");
    }
  };

  const eliminarFranja = async (id) => {
    try {
      const res = await fetch(`${API}/envios/tarifas/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (await manejarErrorAuth(res)) return;
      setConfirmandoBorrar(null);
      if (!res.ok) {
        // Ej: 400 "No se puede eliminar la última franja activa"
        const data = await res.json().catch(() => ({}));
        alert(data.error || `Error ${res.status} al eliminar la tarifa`);
        return;
      }
      await cargar();
    } catch (err) {
      console.error("Error eliminando tarifa:", err);
      alert("No se pudo eliminar la tarifa. Intentá de nuevo.");
    }
  };

  const guardarOpcionales = async () => {
    if (!formOpcionales) return;
    if (!formOpcionales.seguro_etiqueta.trim() || !formOpcionales.express_etiqueta.trim()) {
      alert("Las etiquetas del seguro y del express no pueden quedar vacías.");
      return;
    }
    if (
      !Number.isInteger(Number(formOpcionales.seguro_precio)) || Number(formOpcionales.seguro_precio) < 0 ||
      !Number.isInteger(Number(formOpcionales.express_precio)) || Number(formOpcionales.express_precio) < 0
    ) {
      alert("Los precios de los opcionales deben ser números enteros mayores o iguales a 0.");
      return;
    }
    try {
      const res = await fetch(`${API}/envios/opcionales`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          seguro_etiqueta: formOpcionales.seguro_etiqueta.trim(),
          seguro_precio: Number(formOpcionales.seguro_precio),
          seguro_activo: Boolean(formOpcionales.seguro_activo),
          express_etiqueta: formOpcionales.express_etiqueta.trim(),
          express_precio: Number(formOpcionales.express_precio),
          express_activo: Boolean(formOpcionales.express_activo),
        }),
      });
      if (await manejarErrorAuth(res)) return;
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || `Error ${res.status} al guardar los opcionales`);
        return;
      }
      await cargar();
    } catch (err) {
      console.error("Error guardando opcionales:", err);
      alert("No se pudieron guardar los opcionales. Intentá de nuevo.");
    }
  };

  const setOpcional = (campo, valor) =>
    setFormOpcionales((prev) => ({ ...prev, [campo]: valor }));

  return (
    <div className="admin-seccion">
      <div className="admin-seccion-header">
        <div>
          <h2>Tarifas de envío</h2>
          <p>Franjas de peso de Andreani, opcionales y precios por destino</p>
        </div>
        {subTabTarifas === "franjas" && (
          <button className="btn-primario" onClick={() => setModalFranja({})}>
            + Agregar franja
          </button>
        )}
      </div>

      <div className="admin-subtabs">
        <button
          className={`admin-subtab ${subTabTarifas === "franjas" ? "activo" : ""}`}
          onClick={() => setSubTabTarifas("franjas")}
        >
          Franjas y opcionales
        </button>
        <button
          className={`admin-subtab ${subTabTarifas === "destinos" ? "activo" : ""}`}
          onClick={() => {
            setSubTabTarifas("destinos");
            if ((destinosData.franjas || []).length === 0 && !cargandoDestinos) {
              cargarDestinos();
            }
          }}
        >
          Por destino
        </button>
      </div>

      {subTabTarifas === "franjas" && (
        <>
          {cargando && <div className="tabla-vacia">Cargando tarifas...</div>}
          {error && <div className="tabla-vacia admin-error">{error}</div>}

          {!cargando && !error && (
            <>
              <div className="admin-tabla-wrapper">
                <table className="admin-tabla">
                  <thead>
                    <tr>
                      <th>Franja</th>
                      <th>Rango de peso</th>
                      <th>Precio</th>
                      <th>Caja grande</th>
                      <th>Activa</th>
                      <th>Orden</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {franjas.map((f) => (
                      <tr key={f.id}>
                        <td><div className="tabla-producto-nombre">{f.etiqueta}</div></td>
                        <td>{formatoKg(f.peso_min_g)} – {formatoKg(f.peso_max_g)}</td>
                        <td className="tabla-precio">${Number(f.precio).toLocaleString("es-AR")}</td>
                        <td>{f.requiere_caja_grande ? "Sí" : "No"}</td>
                        <td>
                          {f.activa
                            ? <span className="badge-estado disponible">Activa</span>
                            : <span className="badge-estado sin-stock">Inactiva</span>
                          }
                        </td>
                        <td>{f.orden}</td>
                        <td>
                          <div className="tabla-acciones">
                            <button className="btn-editar" onClick={() => setModalFranja({ ...f })}>
                              ✏️ Editar
                            </button>
                            <button className="btn-eliminar" onClick={() => setConfirmandoBorrar(f.id)}>
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Opcionales: registro único (seguro y express) */}
              {formOpcionales && (
                <div className="tarifas-opcionales">
                  <div className="opcional-card">
                    <h3>🛡️ Seguro por valor declarado</h3>
                    <div className="admin-field">
                      <label>Etiqueta</label>
                      <input
                        value={formOpcionales.seguro_etiqueta}
                        onChange={(e) => setOpcional("seguro_etiqueta", e.target.value)}
                      />
                    </div>
                    <div className="modal-row">
                      <div className="admin-field">
                        <label>Precio (ARS)</label>
                        <input
                          type="number" min="0"
                          value={formOpcionales.seguro_precio}
                          onChange={(e) => setOpcional("seguro_precio", e.target.value)}
                        />
                      </div>
                      <label className="opcional-activo">
                        <input
                          type="checkbox"
                          checked={formOpcionales.seguro_activo}
                          onChange={(e) => setOpcional("seguro_activo", e.target.checked)}
                        />
                        Activo
                      </label>
                    </div>
                  </div>

                  <div className="opcional-card">
                    <h3>⚡ Envío express</h3>
                    <div className="admin-field">
                      <label>Etiqueta</label>
                      <input
                        value={formOpcionales.express_etiqueta}
                        onChange={(e) => setOpcional("express_etiqueta", e.target.value)}
                      />
                    </div>
                    <div className="modal-row">
                      <div className="admin-field">
                        <label>Precio (ARS)</label>
                        <input
                          type="number" min="0"
                          value={formOpcionales.express_precio}
                          onChange={(e) => setOpcional("express_precio", e.target.value)}
                        />
                      </div>
                      <label className="opcional-activo">
                        <input
                          type="checkbox"
                          checked={formOpcionales.express_activo}
                          onChange={(e) => setOpcional("express_activo", e.target.checked)}
                        />
                        Activo
                      </label>
                    </div>
                  </div>

                  <div className="opcional-guardar">
                    <button className="btn-primario" onClick={guardarOpcionales}>
                      Guardar opcionales
                    </button>
                    {opcionales && (
                      <p className="opcional-hint">
                        Si desactivás un opcional, el checkout deja de mostrarlo como checkbox.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {subTabTarifas === "destinos" && (
        <div className="tarifas-destinos">
          <div className="destinos-header">
            <div className="destinos-controls">
              <div className="admin-field">
                <label>Margen global (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={destinosData.margen_pct ?? 0}
                  onChange={(e) => setDestinosData(prev => ({ ...prev, margen_pct: e.target.value }))}
                />
              </div>
              <div className="admin-field">
                <label>Franja</label>
                <select
                  value={franjaDestinoSeleccionada || ""}
                  onChange={(e) => setFranjaDestinoSeleccionada(Number(e.target.value))}
                >
                  {(destinosData.franjas || []).map((f) => (
                    <option key={f.id} value={f.id}>{f.etiqueta}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="destinos-actions">
              <button
                className="btn-secundario"
                onClick={cargarDestinos}
                disabled={cargandoDestinos || guardandoDestinos}
              >
                {cargandoDestinos ? "Cargando..." : "Recargar"}
              </button>
              <button
                className="btn-primario"
                onClick={guardarDestinos}
                disabled={guardandoDestinos || cargandoDestinos}
              >
                {guardandoDestinos ? "Guardando..." : "Guardar precios por destino"}
              </button>
            </div>
          </div>

          {errorDestinos && <div className="tabla-vacia admin-error">{errorDestinos}</div>}
          {cargandoDestinos && <div className="tabla-vacia">Cargando destinos...</div>}

          {!cargandoDestinos && !errorDestinos && (
            <div className="admin-tabla-wrapper">
              <table className="admin-tabla">
                <thead>
                  <tr>
                    <th>Provincia</th>
                    <th>Costo Andreani ($)</th>
                    <th>Precio con margen ($)</th>
                    <th>Activo</th>
                  </tr>
                </thead>
                <tbody>
                  {filasDestinos.map((fila, idx) => (
                    <tr key={fila.provincia}>
                      <td><div className="tabla-producto-nombre">{fila.provincia}</div></td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="destino-input"
                          value={fila.costo}
                          onChange={(e) => {
                            const nuevoCosto = e.target.value === "" ? "" : Number(e.target.value);
                            setFilasDestinos(prev => {
                              const copia = [...prev];
                              const costoNum = Number(nuevoCosto) || 0;
                              const margenPct = Number(destinosData.margen_pct) || 0;
                              const precioConMargen = costoNum > 0
                                ? Math.ceil(costoNum * (1 + margenPct / 100) / 100) * 100
                                : 0;
                              copia[idx] = { ...copia[idx], costo: nuevoCosto === "" ? "" : costoNum, precioConMargen };
                              return copia;
                            });
                          }}
                        />
                      </td>
                      <td className="tabla-precio">${Number(fila.precioConMargen || 0).toLocaleString("es-AR")}</td>
                      <td>
                        <label className="opcional-activo">
                          <input
                            type="checkbox"
                            checked={Boolean(fila.activo)}
                            onChange={(e) => {
                              setFilasDestinos(prev => {
                                const copia = [...prev];
                                copia[idx] = { ...copia[idx], activo: e.target.checked };
                                return copia;
                              });
                            }}
                          />
                          Activo
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modalFranja !== undefined && (
        <ModalFranja
          franja={modalFranja.id ? modalFranja : null}
          onGuardar={(datos) => guardarFranja(datos, modalFranja.id)}
          onCerrar={() => setModalFranja(undefined)}
        />
      )}

      {confirmandoBorrar !== null && (
        <div className="modal-overlay" onClick={() => setConfirmandoBorrar(null)}>
          <div className="modal-confirmar" onClick={e => e.stopPropagation()}>
            <h3>¿Eliminar franja?</h3>
            <p>Esta acción no se puede deshacer. Si es la última franja activa, el backend no va a dejar borrarla.</p>
            <div className="modal-footer">
              <button className="btn-secundario" onClick={() => setConfirmandoBorrar(null)}>Cancelar</button>
              <button className="btn-eliminar-confirm" onClick={() => eliminarFranja(confirmandoBorrar)}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Modal de creación/edición de una franja de tarifa.
function ModalFranja({ franja, onGuardar, onCerrar }) {
  const [form, setForm] = useState(
    franja
      ? {
          etiqueta: franja.etiqueta || "",
          peso_min_g: franja.peso_min_g,
          peso_max_g: franja.peso_max_g,
          precio: franja.precio,
          orden: franja.orden,
          requiere_caja_grande: Boolean(franja.requiere_caja_grande),
          activa: Boolean(franja.activa),
        }
      : {
          etiqueta: "", peso_min_g: "", peso_max_g: "", precio: "", orden: "",
          requiere_caja_grande: false, activa: true,
        }
  );
  const [errores, setErrores] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    if (errores[name]) setErrores((prev) => ({ ...prev, [name]: "" }));
  };

  const validar = () => {
    const errs = {};
    if (!form.etiqueta.trim()) errs.etiqueta = "La etiqueta es requerida";
    const pesoMin = Number(form.peso_min_g);
    const pesoMax = Number(form.peso_max_g);
    const precio = Number(form.precio);
    if (form.peso_min_g === "" || !Number.isInteger(pesoMin) || pesoMin < 1) {
      errs.peso_min_g = "Entero ≥ 1 (gramos)";
    }
    if (form.peso_max_g === "" || !Number.isInteger(pesoMax) || pesoMax < pesoMin) {
      errs.peso_max_g = "Entero ≥ peso mínimo (gramos)";
    }
    if (form.precio === "" || !Number.isInteger(precio) || precio < 0) {
      errs.precio = "Entero ≥ 0";
    }
    if (form.orden !== "" && !Number.isInteger(Number(form.orden))) {
      errs.orden = "Número entero";
    }
    setErrores(errs);
    return Object.keys(errs).length === 0;
  };

  const handleGuardar = () => {
    if (!validar()) return;
    onGuardar({
      etiqueta: form.etiqueta.trim(),
      peso_min_g: Number(form.peso_min_g),
      peso_max_g: Number(form.peso_max_g),
      precio: Number(form.precio),
      orden: form.orden === "" ? undefined : Number(form.orden),
      requiere_caja_grande: Boolean(form.requiere_caja_grande),
      activa: Boolean(form.activa),
    });
  };

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{franja ? "Editar franja" : "Agregar franja"}</h2>
          <button className="modal-cerrar" onClick={onCerrar}>✕</button>
        </div>
        <div className="modal-body">
          <div className="admin-field">
            <label>Etiqueta</label>
            <input name="etiqueta" value={form.etiqueta} onChange={handleChange} placeholder="Ej: Caja Andreani 5kg" />
            {errores.etiqueta && <span className="admin-error">{errores.etiqueta}</span>}
          </div>
          <div className="modal-row">
            <div className="admin-field">
              <label>Peso mínimo (g)</label>
              <input name="peso_min_g" type="number" min="1" value={form.peso_min_g} onChange={handleChange} placeholder="1" />
              {errores.peso_min_g && <span className="admin-error">{errores.peso_min_g}</span>}
            </div>
            <div className="admin-field">
              <label>Peso máximo (g)</label>
              <input name="peso_max_g" type="number" min="1" value={form.peso_max_g} onChange={handleChange} placeholder="2000" />
              {errores.peso_max_g && <span className="admin-error">{errores.peso_max_g}</span>}
            </div>
          </div>
          <div className="modal-row">
            <div className="admin-field">
              <label>Precio (ARS)</label>
              <input name="precio" type="number" min="0" value={form.precio} onChange={handleChange} placeholder="31000" />
              {errores.precio && <span className="admin-error">{errores.precio}</span>}
            </div>
            <div className="admin-field">
              <label>Orden</label>
              <input name="orden" type="number" value={form.orden} onChange={handleChange} placeholder="1" />
              {errores.orden && <span className="admin-error">{errores.orden}</span>}
            </div>
          </div>
          <div className="modal-row modal-checks">
            <label className="opcional-activo">
              <input
                type="checkbox"
                name="requiere_caja_grande"
                checked={form.requiere_caja_grande}
                onChange={handleChange}
              />
              Requiere caja grande
            </label>
            <label className="opcional-activo">
              <input
                type="checkbox"
                name="activa"
                checked={form.activa}
                onChange={handleChange}
              />
              Activa
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secundario" onClick={onCerrar}>Cancelar</button>
          <button className="btn-primario" onClick={handleGuardar}>
            {franja ? "Guardar cambios" : "Agregar franja"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SECCIÓN DESPACHOS ───────────────────────────────────────────────────────
const METODOS_ENVIO = [
  { valor: "sucursal", etiqueta: "Retiro en sucursal" },
  { valor: "domicilio", etiqueta: "Entrega a domicilio" },
  { valor: "link_pago", etiqueta: "Link de pago de Andreani" },
];

function SeccionDespachos({ onPedidosCambiados }) {
  const [despachos, setDespachos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = async () => {
    setCargando(true);
    try {
      const res = await fetch(`${API}/pedidos/despachos`, { headers: authHeaders() });
      if (await manejarErrorAuth(res)) return;
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setDespachos(await res.json());
      setError("");
    } catch (err) {
      console.error("Error cargando despachos:", err);
      setError("No se pudieron cargar los despachos.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  // Sacar el pedido de la lista local (pasó a "en camino") y refrescar
  // la sección Pedidos del panel.
  const quitarDespacho = (id) => {
    setDespachos((prev) => prev.filter((p) => p.id !== id));
    onPedidosCambiados();
  };

  const actualizarDespacho = (pedidoActualizado) => {
    setDespachos((prev) =>
      prev.map((p) => (p.id === pedidoActualizado.id ? { ...p, ...pedidoActualizado } : p))
    );
    onPedidosCambiados();
  };

  return (
    <div className="admin-seccion">
      <div className="admin-seccion-header">
        <div>
          <h2>Despachos</h2>
          <p>Pedidos con pago aprobado, listos para generar el envío Andreani</p>
        </div>
        <a
          className="btn-secundario"
          href="https://www.andreani.com"
          target="_blank"
          rel="noreferrer"
        >
          Abrir Andreani ↗
        </a>
      </div>

      {cargando && <div className="tabla-vacia">Cargando despachos...</div>}
      {error && <div className="tabla-vacia admin-error">{error}</div>}

      {!cargando && !error && despachos.length === 0 && (
        <div className="tabla-vacia">No hay pedidos pendientes de despacho. 🎉</div>
      )}

      {!cargando && !error && despachos.length > 0 && (
        <div className="despachos-lista">
          {despachos.map((p) => (
            <TarjetaDespacho
              key={p.id}
              pedido={p}
              onDespachado={quitarDespacho}
              onActualizado={actualizarDespacho}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Tarjeta de un pedido a despachar: kit copiable, tracking y costo real.
function TarjetaDespacho({ pedido: p, onDespachado, onActualizado }) {
  const [tracking, setTracking] = useState(p.tracking_numero || "");
  const [metodo, setMetodo] = useState(p.envio_metodo || "sucursal");
  const [costoReal, setCostoReal] = useState(p.envio_costo_real ?? "");
  const [copiado, setCopiado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const dirCompleta = [
    `${p.calle || ""} ${p.numero || ""}`.trim(),
    p.piso ? `Piso ${p.piso}` : null,
    p.codigo_postal ? `CP ${p.codigo_postal}` : null,
    p.localidad,
    p.provincia,
  ].filter(Boolean).join(", ");

  // Contenido y peso para el kit de despacho del portal de Andreani
  const contenido = (p.items || []).map((i) => `${i.nombre} x${i.cantidad}`).join(" · ");
  const pesoGramos = Number(p.peso_total_g) || 0;

  // Texto copiable con el kit completo en el orden que pide Andreani:
  // nombre · DNI · teléfono · calle altura · piso · CP · localidad ·
  // provincia · contenido · peso.
  const armarKit = () => [
    p.cliente,
    `DNI ${p.dni || "s/c"}`,
    `Tel ${p.telefono || "s/c"}`,
    `${p.calle || ""} ${p.numero || ""}`.trim(),
    `Piso ${p.piso || "s/n"}`,
    `CP ${p.codigo_postal || "s/c"}`,
    p.localidad || "s/c",
    p.provincia || "s/c",
    `Contenido: ${contenido || "s/c"}`,
    `Peso: ${formatoKg(pesoGramos)}`,
  ].join(" · ");

  const copiarDatos = async () => {
    const texto = armarKit();
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (err) {
      // Fallback para navegadores/entornos sin clipboard API
      try {
        const ta = document.createElement("textarea");
        ta.value = texto;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("execCommand devolvió false");
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      } catch (err2) {
        console.error("Error copiando datos:", err2);
        alert("No pudimos copiar automáticamente. Copiá el texto a mano:\n\n" + texto);
      }
    }
  };

  const guardarTracking = async () => {
    if (!tracking.trim()) {
      setMensaje("Ingresá el número de tracking antes de despachar.");
      return;
    }
    setGuardando(true);
    setMensaje("");
    try {
      const res = await fetch(`${API}/pedidos/${p.id}/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ numero: tracking.trim(), metodo }),
      });
      if (res.status === 401) { await manejarErrorAuth(res); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMensaje(data.error || `Error ${res.status} al guardar el tracking`);
        return;
      }
      // El pedido pasa a "en camino": sale de esta lista
      onDespachado(p.id);
    } catch (err) {
      console.error("Error guardando tracking:", err);
      setMensaje("No se pudo guardar el tracking. Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  const guardarCostoReal = async () => {
    const costo = Number(costoReal);
    if (costoReal === "" || !Number.isInteger(costo) || costo < 0) {
      setMensaje("El costo real debe ser un número entero en pesos, mayor o igual a 0.");
      return;
    }
    setGuardando(true);
    setMensaje("");
    try {
      const res = await fetch(`${API}/pedidos/${p.id}/envio`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ costo_real: costo, metodo }),
      });
      if (res.status === 401) { await manejarErrorAuth(res); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMensaje(data.error || `Error ${res.status} al guardar el costo de envío`);
        return;
      }
      const pedidoActualizado = await res.json();
      onActualizado(pedidoActualizado);
      setMensaje("Costo de envío guardado ✓");
    } catch (err) {
      console.error("Error guardando costo real:", err);
      setMensaje("No se pudo guardar el costo de envío. Intentá de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  // Margen = lo que cobramos por envío − lo que pagamos a Andreani
  const margen =
    p.envio_cobrado !== null && p.envio_cobrado !== undefined && p.envio_costo_real !== null && p.envio_costo_real !== undefined
      ? Number(p.envio_cobrado) - Number(p.envio_costo_real)
      : null;

  return (
    <div className="despacho-card">
      <div className="despacho-header">
        <div>
          <span className="despacho-id">{p.id}</span>
          <span className="despacho-fecha">{new Date(p.creado_en).toLocaleString("es-AR")}</span>
        </div>
        <span className="badge-estado pendiente-badge">⏳ pendiente</span>
      </div>

      <div className="despacho-grid">
        <div className="despacho-bloque">
          <h4>Cliente</h4>
          <p><strong>{p.cliente}</strong></p>
          <p>DNI: {p.dni || "—"}</p>
          <p>Tel: {p.telefono || "—"}</p>
          <p>{p.email}</p>
        </div>
        <div className="despacho-bloque">
          <h4>Dirección de entrega</h4>
          <p>{dirCompleta}</p>
        </div>
        <div className="despacho-bloque">
          <h4>Contenido</h4>
          <ul className="despacho-items">
            {(p.items || []).map((item, i) => (
              <li key={i}>{item.nombre} ×{item.cantidad}</li>
            ))}
          </ul>
          <p className="despacho-peso">Peso total: <strong>{formatoKg(pesoGramos)}</strong> ({pesoGramos} g)</p>
        </div>
        <div className="despacho-bloque">
          <h4>Envío</h4>
          {p.envio_desglose ? (
            <>
              <p>{p.envio_desglose.etiqueta}</p>
              <p>Cobrado al cliente: <strong>${Number(p.envio_cobrado ?? p.envio_desglose.total).toLocaleString("es-AR")}</strong></p>
            </>
          ) : (
            <p>Cobrado al cliente: <strong>{p.envio_cobrado != null ? `$${Number(p.envio_cobrado).toLocaleString("es-AR")}` : "—"}</strong></p>
          )}
          <p>
            Método: {metodo}
            {p.tracking_numero ? ` · Tracking: ${p.tracking_numero}` : ""}
          </p>
          {p.envio_costo_real != null && (
            <p>Costo real (Andreani): <strong>${Number(p.envio_costo_real).toLocaleString("es-AR")}</strong></p>
          )}
          {margen !== null && (
            <p>
              Margen de envío:{" "}
              <strong className={margen >= 0 ? "despacho-margen-positivo" : "despacho-margen-negativo"}>
                {margen >= 0 ? "+" : ""}${margen.toLocaleString("es-AR")}
              </strong>
            </p>
          )}
        </div>
      </div>

      {mensaje && <p className="despacho-mensaje">{mensaje}</p>}

      <div className="despacho-acciones">
        <button className={`btn-copiar ${copiado ? "copiado" : ""}`} onClick={copiarDatos}>
          {copiado ? "Copiado ✓" : "📋 Copiar datos"}
        </button>

        <div className="admin-field">
          <label>N° de tracking</label>
          <input
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="Ej: E2E-TEST-123"
          />
        </div>

        <div className="admin-field">
          <label>Método de envío</label>
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)}>
            {METODOS_ENVIO.map((m) => (
              <option key={m.valor} value={m.valor}>{m.etiqueta}</option>
            ))}
          </select>
        </div>

        <button className="btn-primario" onClick={guardarTracking} disabled={guardando}>
          {guardando ? "Guardando..." : "Guardar y despachar"}
        </button>

        <div className="admin-field">
          <label>Costo real (ARS)</label>
          <input
            type="number"
            min="0"
            value={costoReal}
            onChange={(e) => setCostoReal(e.target.value)}
            placeholder="Ej: 28000"
          />
        </div>

        <button className="btn-secundario" onClick={guardarCostoReal} disabled={guardando}>
          Guardar costo
        </button>

        <a
          className="btn-secundario despacho-andreani"
          href="https://www.andreani.com"
          target="_blank"
          rel="noreferrer"
        >
          Abrir Andreani ↗
        </a>
      </div>
    </div>
  );
}

// ─── ADMIN PRINCIPAL ─────────────────────────────────────────────────────────
export default function Admin({ productos, pedidos, onActualizarProductos, onActualizarEstadoPedido, onRecargarPedidos, onSalir }) {
  const [logueado, setLogueado] = useState(false);
  const [tab, setTab] = useState("productos");

  if (!logueado) return <Login onLogin={() => setLogueado(true)} />;

  const totalVentas = pedidos
    .filter(p => p.estado !== "cancelado")
    .reduce((a, p) => a + p.total, 0);

  const sinStock = productos.filter(p => p.stock === 0).length;
  const stockBajo = productos.filter(p => p.stock > 0 && p.stock <= 3).length;
  const pendientes = pedidos.filter(p => p.estado === "pendiente").length;

  return (
    <div className="admin-wrapper">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <img
            src="https://res.cloudinary.com/jgnijxf6/image/upload/v1785876818/logo-sin-fondo-delgadobike-1_msck1e.png"
            alt="Delgado Bike Online"
          />
          <div className="admin-brand-sub">Panel admin</div>
        </div>

        <nav className="admin-nav">
          <button className={`admin-nav-item ${tab === "productos" ? "activo" : ""}`} onClick={() => setTab("productos")}>
            <span>🛒</span> Productos
          </button>
          <button className={`admin-nav-item ${tab === "pedidos" ? "activo" : ""}`} onClick={() => setTab("pedidos")}>
            <span>📦</span> Pedidos
            {pendientes > 0 && (
              <span className="nav-badge">{pendientes}</span>
            )}
          </button>
          <button className={`admin-nav-item ${tab === "despachos" ? "activo" : ""}`} onClick={() => setTab("despachos")}>
            <span>📬</span> Despachos
            {pendientes > 0 && (
              <span className="nav-badge">{pendientes}</span>
            )}
          </button>
          <button className={`admin-nav-item ${tab === "envios" ? "activo" : ""}`} onClick={() => setTab("envios")}>
            <span>🚚</span> Tarifas de envío
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
        {tab === "despachos" && (
          <SeccionDespachos onPedidosCambiados={onRecargarPedidos} />
        )}
        {tab === "envios" && <SeccionTarifas />}
      </main>
    </div>
  );
}
