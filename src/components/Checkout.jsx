import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL;

// El envío se cotiza SIEMPRE contra el backend (POST /envios/cotizar),
// que aplica las franjas de tarifas_envio + los opcionales elegidos.
// No hay ninguna simulación ni costo hardcodeado en el cliente.
export default function Checkout({ carrito, onVolver }) {
  const subtotal = carrito.reduce((a, i) => a + i.precio * i.cantidad, 0);

  const [form, setForm] = useState({
    nombre: "", email: "", telefono: "", dni: "",
    calle: "", numero: "", piso: "",
    localidad: "", provincia: "", codigoPostal: "",
  });
  const [envio, setEnvio] = useState(null); // última cotización de la API
  const [cotizando, setCotizando] = useState(true);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [conSeguro, setConSeguro] = useState(false);
  const [conExpress, setConExpress] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [errores, setErrores] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errores[name]) setErrores((prev) => ({ ...prev, [name]: "" }));
  };

  // Cotizamos al montar y cada vez que cambian los opcionales elegidos.
  // La API devuelve etiqueta, base, seguro, express y total (nada hardcodeado).
  useEffect(() => {
    if (carrito.length === 0) {
      setEnvio(null);
      setCotizando(false);
      return;
    }

    let cancelado = false;
    setCotizando(true);
    (async () => {
      try {
        const res = await fetch(`${API}/envios/cotizar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: carrito.map((i) => ({ producto_id: i.id, cantidad: i.cantidad })),
            seguro: conSeguro,
            express: conExpress,
          }),
        });
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = await res.json();
        if (cancelado) return;
        setEnvio(data);
        setErrorEnvio("");
        // Si el backend no aplicó un opcional (quedó inactivo en la tabla),
        // desmarcamos el checkbox para no prometer un total mentiroso.
        setConSeguro((prev) => prev && Boolean(data.seguro && data.seguro.aplicado));
        setConExpress((prev) => prev && Boolean(data.express && data.express.aplicado));
      } catch (err) {
        console.error("Error cotizando envío:", err);
        if (cancelado) return;
        setEnvio(null);
        setErrorEnvio("No pudimos calcular el envío. Revisá la conexión e intentá de nuevo.");
      } finally {
        if (!cancelado) setCotizando(false);
      }
    })();

    return () => { cancelado = true; };
  }, [carrito, conSeguro, conExpress]);

  const validar = () => {
    const campos = [
      "nombre", "email", "telefono", "dni",
      "calle", "numero", "localidad", "provincia", "codigoPostal",
    ];
    const nuevosErrores = {};
    campos.forEach((campo) => {
      if (!form[campo]) nuevosErrores[campo] = "Campo requerido";
    });
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) {
      nuevosErrores.email = "Email inválido";
    }
    if (form.dni && !/^\d{7,8}$/.test(form.dni)) {
      nuevosErrores.dni = "El DNI debe tener 7 u 8 números, sin puntos";
    }
    if (form.telefono && form.telefono.replace(/\D/g, "").length < 6) {
      nuevosErrores.telefono = "Ingresá un teléfono válido";
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handlePagar = async () => {
    if (!validar()) return;
    if (!envio) {
      alert("No pudimos calcular el envío todavía. Esperá unos segundos e intentá de nuevo.");
      return;
    }
    setProcesando(true);

    try {
      const pedidoId = `VP-${Math.floor(Math.random() * 90000) + 10000}`;

      // Desglose completo del envío: `costo` es lo que cobra MercadoPago
      // (item "Envío Andreani") y lo que el webhook persiste en costo_envio;
      // base/seguro/express/total/etiqueta alimentan envio_desglose/envio_cobrado.
      const envioDesglose = {
        costo: envio.total,
        base: envio.base,
        seguro: envio.seguro && envio.seguro.aplicado ? envio.seguro.precio : 0,
        express: envio.express && envio.express.aplicado ? envio.express.precio : 0,
        total: envio.total,
        etiqueta: envio.etiqueta,
      };

      // Solo crear preferencia en MercadoPago.
      // El pedido se crea cuando MercadoPago confirma el pago via webhook.
      const resPago = await fetch(`${API}/pagos/crear-preferencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrito, form, envio: envioDesglose, pedidoId }),
      });

      if (!resPago.ok) throw new Error("Error al conectar con MercadoPago");

      const { init_point } = await resPago.json();

      // Guardamos un snapshot del pedido en sessionStorage: al volver de
      // MercadoPago, /confirmacion lo lee en vez de buscar el último pedido
      // en el backend (evita undefined en la dirección y pedidos ajenos).
      sessionStorage.setItem(
        "pedidoConfirmado",
        JSON.stringify({
          pedidoId,
          form,
          carrito,
          envio: envioDesglose,
          total: subtotal + envioDesglose.total,
        })
      );

      // Redirigir a MercadoPago
      window.location.href = init_point;

    } catch (err) {
      console.error(err);
      alert(err.message || "Hubo un error. Intentá de nuevo.");
      setProcesando(false);
    }
  };

  return (
    <div className="checkout">
      <div className="checkout-inner">
        <button className="volver-btn" onClick={onVolver}>← Volver al catálogo</button>
        <h1 className="checkout-titulo">Finalizar compra</h1>

        <div className="checkout-layout">
          <div className="checkout-form">
            <section className="form-section">
              <h2>Datos personales</h2>
              <div className="form-row">
                <Field label="Nombre completo" name="nombre" value={form.nombre} onChange={handleChange} error={errores.nombre} />
                <Field label="Email" name="email" type="email" value={form.email} onChange={handleChange} error={errores.email} />
              </div>
              <div className="form-row">
                <Field label="DNI" name="dni" value={form.dni} onChange={handleChange} error={errores.dni}
                  placeholder="Sin puntos" style={{ maxWidth: 160 }} />
                <Field label="Teléfono" name="telefono" value={form.telefono} onChange={handleChange} error={errores.telefono} />
              </div>
            </section>

            <section className="form-section">
              <h2>Dirección de entrega</h2>
              <div className="form-row">
                <Field label="Calle" name="calle" value={form.calle} onChange={handleChange} error={errores.calle} />
                <Field label="Número" name="numero" value={form.numero} onChange={handleChange} error={errores.numero} style={{ maxWidth: 120 }} />
                <Field label="Piso / Depto" name="piso" value={form.piso} onChange={handleChange} placeholder="Opcional" />
              </div>
              <div className="form-row">
                <Field label="Localidad" name="localidad" value={form.localidad} onChange={handleChange} error={errores.localidad} />
                <Field label="Provincia" name="provincia" value={form.provincia} onChange={handleChange} error={errores.provincia} />
              </div>
              <div className="form-row">
                <Field label="Código postal" name="codigoPostal" value={form.codigoPostal} onChange={handleChange}
                  error={errores.codigoPostal} style={{ maxWidth: 160 }} />
              </div>
            </section>

            <section className="form-section">
              <h2>Envío Andreani</h2>
              {errorEnvio && <p className="envio-error">{errorEnvio}</p>}
              {cotizando && <p className="envio-cargando">Cotizando envío...</p>}

              {envio && (
                <div className="envio-resultado">
                  <span className="andreani-logo">📦 Andreani</span>
                  <span>
                    {envio.etiqueta} — <strong>${envio.total.toLocaleString("es-AR")}</strong>
                  </span>
                  {(envio.seguro && envio.seguro.aplicado) || (envio.express && envio.express.aplicado) ? (
                    <span className="plazo">
                      Incluye{envio.seguro && envio.seguro.aplicado ? ` ${envio.seguro.etiqueta}` : ""}
                      {envio.seguro && envio.seguro.aplicado && envio.express && envio.express.aplicado ? " y " : ""}
                      {envio.express && envio.express.aplicado ? envio.express.etiqueta : ""}
                    </span>
                  ) : null}
                </div>
              )}

              {envio && (
                <div className="envio-opcionales">
                  {envio.seguro && envio.seguro.activo && (
                    <label className={`envio-opcional ${conSeguro ? "marcado" : ""}`}>
                      <input
                        type="checkbox"
                        checked={conSeguro}
                        onChange={(e) => setConSeguro(e.target.checked)}
                      />
                      <span className="envio-opcional-info">
                        <span className="envio-opcional-nombre">{envio.seguro.etiqueta}</span>
                        <span className="envio-opcional-precio">+${envio.seguro.precio.toLocaleString("es-AR")}</span>
                      </span>
                      {conSeguro && <span className="envio-opcional-check">✓</span>}
                    </label>
                  )}
                  {envio.express && envio.express.activo && (
                    <label className={`envio-opcional ${conExpress ? "marcado" : ""}`}>
                      <input
                        type="checkbox"
                        checked={conExpress}
                        onChange={(e) => setConExpress(e.target.checked)}
                      />
                      <span className="envio-opcional-info">
                        <span className="envio-opcional-nombre">{envio.express.etiqueta}</span>
                        <span className="envio-opcional-precio">+${envio.express.precio.toLocaleString("es-AR")}</span>
                      </span>
                      {conExpress && <span className="envio-opcional-check">✓</span>}
                    </label>
                  )}
                </div>
              )}
            </section>

            <section className="form-section">
              <h2>Medio de pago</h2>
              <div className="mp-panel">
                <div className="mp-logo">
                  <span className="mp-badge">MercadoPago</span>
                </div>
                <p className="mp-info">
                  Al hacer clic en "Pagar" serás redirigido a MercadoPago para completar tu compra de forma segura.
                  Podés pagar con tarjeta de crédito, débito, transferencia o saldo de MercadoPago.
                </p>
              </div>
            </section>
          </div>

          <aside className="checkout-resumen">
            <h2>Resumen del pedido</h2>
            <ul className="resumen-items">
              {carrito.map((item) => (
                <li key={item.id} className="resumen-item">
                  <span>{item.nombre} × {item.cantidad}</span>
                  <span>${(item.precio * item.cantidad).toLocaleString("es-AR")}</span>
                </li>
              ))}
            </ul>
            <div className="resumen-linea">
              <span>Subtotal</span>
              <span>${subtotal.toLocaleString("es-AR")}</span>
            </div>
            <div className="resumen-linea">
              <span>Envío{envio ? ` · ${envio.etiqueta}` : ""}</span>
              <span>{envio ? `$${envio.total.toLocaleString("es-AR")}` : "A calcular"}</span>
            </div>
            {envio && envio.seguro && envio.seguro.aplicado && (
              <div className="resumen-linea resumen-linea-menor">
                <span>+ {envio.seguro.etiqueta}</span>
                <span>${envio.seguro.precio.toLocaleString("es-AR")}</span>
              </div>
            )}
            {envio && envio.express && envio.express.aplicado && (
              <div className="resumen-linea resumen-linea-menor">
                <span>+ {envio.express.etiqueta}</span>
                <span>${envio.express.precio.toLocaleString("es-AR")}</span>
              </div>
            )}
            <div className="resumen-total">
              <span>Total</span>
              <strong>${(subtotal + (envio ? envio.total : 0)).toLocaleString("es-AR")}</strong>
            </div>

            <button className="pagar-btn" onClick={handlePagar} disabled={procesando || cotizando || !envio}>
              {procesando ? "Procesando..." : "Pagar con MercadoPago"}
            </button>
            <p className="pagar-seguro">🔒 Pago 100% seguro</p>
          </aside>
        </div>
      </div>
    </div>
  );
}

function Field({ label, name, type = "text", value, onChange, error, placeholder, style }) {
  return (
    <div className="field" style={style}>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder || ""}
        className={error ? "error" : ""}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
