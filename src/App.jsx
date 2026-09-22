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
  useEffect(() => {
    if (window.location.pathname === "/confirmacion") {
      // Traer el último pedido para mostrar en la pantalla de confirmación
      const cargarUltimoPedido = async () => {
        try {
          const res = await fetch(`${API}/pedidos`);
          const pedidos = await res.json();
          if (pedidos.length > 0) {
            const ultimo = pedidos[0]; // el más reciente
            setPedidoConfirmado({
              numeroPedido: ultimo.id,
              form: { 
                nombre: ultimo.cliente, 
                email: ultimo.email,
                localidad: ultimo.localidad,
                provincia: ultimo.provincia,
              },
              carrito: ultimo.items.map(i => ({ 
                nombre: i.nombre, 
                cantidad: i.cantidad, 
                precio: i.precio_unit 
              })),
              envio: { costo: ultimo.costo_envio, plazo: "3 a 5 días hábiles" },
              total: ultimo.total,
            });
          }
        } catch (err) {
          console.error(err);
        }
      };
      cargarUltimoPedido();
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

  const confirmarPedido = async (datos) => {
    try {
      await fetch(`${API}/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });

      const [resProductos, resPedidos] = await Promise.all([
        fetch(`${API}/productos`),
        fetch(`${API}/pedidos`),
      ]);
      setProductos(await resProductos.json());
      setPedidos(await resPedidos.json());

      setPedidoConfirmado(datos);
      setCarrito([]);
      navegarA("confirmacion");
    } catch (err) {
      console.error("Error confirmando pedido:", err);
      alert("Hubo un error al procesar el pedido. Intentá de nuevo.");
    }
  };

  // ── Funciones del admin ────────────────────────────────────────────────────
  const actualizarProductos = async (accion, datos, imagen) => {
    try {
      const body = new FormData();
      Object.entries(datos).forEach(([key, value]) => {
        if (value !== undefined && value !== null) body.append(key, value);
      });
      if (imagen) body.append("imagen", imagen);

      if (accion === "crear") {
        await fetch(`${API}/productos`, { method: "POST", body });
      } else if (accion === "editar") {
        await fetch(`${API}/productos/${datos.id}`, { method: "PUT", body });
      } else if (accion === "eliminar") {
        await fetch(`${API}/productos/${datos.id}`, { method: "DELETE" });
      }

      const res = await fetch(`${API}/productos`);
      setProductos(await res.json());
    } catch (err) {
      console.error("Error actualizando producto:", err);
    }
  };

  const actualizarEstadoPedido = async (id, estado) => {
    try {
      await fetch(`${API}/pedidos/${id}/estado`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      const res = await fetch(`${API}/pedidos`);
      setPedidos(await res.json());
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
          onConfirmar={confirmarPedido}
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