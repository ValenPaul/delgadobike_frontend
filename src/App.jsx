import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Catalogo from "./components/Catalogo";
import Carrito from "./components/Carrito";
import Checkout from "./components/Checkout";
import Confirmacion from "./components/Confirmacion";
import Admin from "./components/Admin";

import Nosotros from "./components/Nosotros";
import Contacto from "./components/Contacto";

const API = import.meta.env.VITE_API_URL;

export default function App() {
  const [carrito, setCarrito] = useState([]);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [pedidoConfirmado, setPedidoConfirmado] = useState(null);
  const [productos, setProductos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [cargando, setCargando] = useState(true);

  // ── Navegación con historial del browser ──────────────────────────────────
  const getVistaDesdeURL = () => {
    const path = window.location.pathname;
    if (path === "/admin") return "admin";
    if (path === "/checkout") return "checkout";
    if (path === "/confirmacion") return "confirmacion";
    if (path === "/nosotros") return "nosotros";
    if (path === "/contacto") return "contacto";
    return "inicio";
  };

  const [vista, setVista] = useState(getVistaDesdeURL);

  const navegarA = (nuevaVista) => {
    const rutas = {
      inicio: "/",
      checkout: "/checkout",
      confirmacion: "/confirmacion",
      admin: "/admin",
      nosotros: "/nosotros",
      contacto: "/contacto",
    };
    window.history.pushState({}, "", rutas[nuevaVista] || "/");
    setVista(nuevaVista);
  };

  // Escuchar la flecha "atrás" del browser
  useEffect(() => {
    const handlePopState = () => {
      setVista(getVistaDesdeURL());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);


  // Manejar regreso desde MercadoPago
  // Checkout guarda un snapshot del pedido en sessionStorage antes de
  // redirigir; acá lo leemos en vez de pedirle el último pedido al backend
  // (eso podía mostrar pedidos ajenos y armaba el form incompleto).
  useEffect(() => {
    if (window.location.pathname !== "/confirmacion") return;
    try {
      const crudo = sessionStorage.getItem("pedidoConfirmado");
      if (!crudo) return;
      const snap = JSON.parse(crudo);
      if (!snap || !snap.form || !snap.carrito || !snap.envio) return;

      const subtotal = snap.carrito.reduce((a, i) => a + i.precio * i.cantidad, 0);
      setPedidoConfirmado({
        numeroPedido: snap.pedidoId,
        form: snap.form,
        carrito: snap.carrito,
        envio: snap.envio,
        // "retiro_local" cuando el cliente eligió retirar en el local
        // (también viene dentro de envio.metodo; acá lo duplicamos explícito)
        metodo: snap.metodo || (snap.envio && snap.envio.metodo) || "domicilio",
        total: typeof snap.total === "number" ? snap.total : subtotal + (snap.envio.costo || 0),
      });
    } catch (err) {
      console.error("Error leyendo snapshot de confirmación:", err);
    }
  }, []);


  // ── Cargar datos del backend ───────────────────────────────────────────────
  useEffect(() => {
    const cargarDatos = async () => {
      try {
        const [resProductos, resPedidos] = await Promise.all([
          fetch(`${API}/productos`),
          fetch(`${API}/pedidos`),
        ]);
        setProductos(await resProductos.json());
        setPedidos(await resPedidos.json());
      } catch (err) {
        console.error("Error cargando datos:", err);
      } finally {
        setCargando(false);
      }
    };
    cargarDatos();
  }, []);

  // ── Lógica del carrito ─────────────────────────────────────────────────────
  const agregarAlCarrito = (producto) => {
    const productoActual = productos.find(p => p.id === producto.id);
    if (!productoActual || productoActual.stock === 0) return;

    setCarrito((prev) => {
      const existe = prev.find((i) => i.id === producto.id);
      if (existe) {
        if (existe.cantidad >= productoActual.stock) return prev;
        return prev.map((i) =>
          i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [...prev, { ...producto, cantidad: 1 }];
    });
    setCarritoAbierto(true);
  };

  const cambiarCantidad = (id, delta) => {
    const productoActual = productos.find(p => p.id === id);
    setCarrito((prev) =>
      prev
        .map((i) => {
          if (i.id !== id) return i;
          const nuevaCantidad = i.cantidad + delta;
          if (productoActual && nuevaCantidad > productoActual.stock) return i;
          return { ...i, cantidad: nuevaCantidad };
        })
        .filter((i) => i.cantidad > 0)
    );
  };

  // ── Funciones del admin ────────────────────────────────────────────────────
  // Cabecera de autenticación para las 4 escrituras del panel admin.
  const authHeaders = () => {
    const token = localStorage.getItem("adminToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Si el backend responde 401, el token guardado ya no sirve.
  const manejar401 = (res) => {
    if (res.status === 401) {
      localStorage.removeItem("adminToken");
      alert("Tu sesión expiró o el token no es válido. Volvé a ingresar en el panel.");
      return true;
    }
    return false;
  };

  const actualizarProductos = async (accion, datos, imagen) => {
    try {
      const body = new FormData();
      Object.entries(datos).forEach(([key, value]) => {
        if (value !== undefined && value !== null) body.append(key, value);
      });
      if (imagen) body.append("imagen", imagen);

      let res;
      if (accion === "crear") {
        res = await fetch(`${API}/productos`, { method: "POST", headers: authHeaders(), body });
      } else if (accion === "editar") {
        res = await fetch(`${API}/productos/${datos.id}`, { method: "PUT", headers: authHeaders(), body });
      } else if (accion === "eliminar") {
        res = await fetch(`${API}/productos/${datos.id}`, { method: "DELETE", headers: authHeaders() });
      }
      if (res && manejar401(res)) return;

      const resLista = await fetch(`${API}/productos`);
      setProductos(await resLista.json());
    } catch (err) {
      console.error("Error actualizando producto:", err);
    }
  };

  // Recargar la lista de pedidos (lo usa el admin tras despachar o cargar
  // tracking/costo de envío, para que la sección Pedidos quede al día).
  const recargarPedidos = async () => {
    try {
      const resLista = await fetch(`${API}/pedidos`);
      setPedidos(await resLista.json());
    } catch (err) {
      console.error("Error recargando pedidos:", err);
    }
  };

  const actualizarEstadoPedido = async (id, estado) => {
    try {
      const res = await fetch(`${API}/pedidos/${id}/estado`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ estado }),
      });
      if (manejar401(res)) return;
      const resLista = await fetch(`${API}/pedidos`);
      setPedidos(await resLista.json());
    } catch (err) {
      console.error("Error actualizando estado:", err);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (cargando) {
    return (
      <div className="loading-screen">
        <span className="loading-icon">🚴</span>
        <p>Cargando tienda...</p>
      </div>
    );
  }

  if (vista === "admin") {
    return (
      <Admin
        productos={productos}
        pedidos={pedidos}
        onActualizarProductos={actualizarProductos}
        onActualizarEstadoPedido={actualizarEstadoPedido}
        onRecargarPedidos={recargarPedidos}
        onSalir={() => navegarA("inicio")}
      />
    );
  }

  return (
    <div className="app">
      <Navbar
        cantidadItems={carrito.reduce((a, i) => a + i.cantidad, 0)}
        onAbrirCarrito={() => setCarritoAbierto(true)}
        onInicio={() => navegarA("inicio")}
        onNosotros={() => navegarA("nosotros")}
        onContacto={() => navegarA("contacto")}
      />

      {vista === "inicio" && (
        <>
          <Hero />
          <Catalogo productos={productos} onAgregarAlCarrito={agregarAlCarrito} />
        </>
      )}

      {vista === "checkout" && (
        <Checkout
          carrito={carrito}
          onVolver={() => navegarA("inicio")}
        />
      )}

      {vista === "confirmacion" && (
        <Confirmacion
          pedido={pedidoConfirmado}
          onVolver={() => navegarA("inicio")}
        />
      )}

      {vista === "nosotros" && <Nosotros />}
      {vista === "contacto" && <Contacto />}

      <Carrito
        abierto={carritoAbierto}
        onCerrar={() => setCarritoAbierto(false)}
        items={carrito}
        onCambiarCantidad={cambiarCantidad}
        onCheckout={() => {
          setCarritoAbierto(false);
          navegarA("checkout");
        }}
      />
    </div>
  );
}