import { useState } from "react";

const COSTO_ENVIO = 4500;

async function cotizarAndreani(codigoPostal) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const variacion = Math.floor(Math.random() * 1500);
      resolve({ costo: COSTO_ENVIO + variacion, plazo: "3 a 5 días hábiles" });
    }, 800);
  });
}

export default function Checkout({ carrito, onConfirmar, onVolver }) {
  const subtotal = carrito.reduce((a, i) => a + i.precio * i.cantidad, 0);

  const [form, setForm] = useState({
    nombre: "", email: "", telefono: "",
    calle: "", numero: "", piso: "",
    localidad: "", provincia: "", codigoPostal: "",
  });
  const [envio, setEnvio] = useState(null);
  const [cotizando, setCotizando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [errores, setErrores] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errores[name]) setErrores((prev) => ({ ...prev, [name]: "" }));
  };

  const cotizar = async () => {
    if (!form.codigoPostal || form.codigoPostal.length < 4) {
      setErrores((prev) => ({ ...prev, codigoPostal: "Ingresá un código postal válido" }));
      return;
    }
    setCotizando(true);
    setEnvio(null);
    const resultado = await cotizarAndreani(form.codigoPostal);
    setEnvio(resultado);
    setCotizando(false);
  };

  const validar = () => {
    const campos = ["nombre", "email", "telefono", "calle", "numero", "localidad", "provincia", "codigoPostal"];
    const nuevosErrores = {};
    campos.forEach((campo) => {
      if (!form[campo]) nuevosErrores[campo] = "Campo requerido";
    });
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) {
      nuevosErrores.email = "Email inválido";
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handlePagar = async () => {
    if (!validar()) return;
    if (!envio) {
      alert("Cotizá el envío antes de continuar.");
      return;
    }
    setProcesando(true);

    try {
      // Generar ID del pedido
      const pedidoId = `VP-${Math.floor(Math.random() * 90000) + 10000}`;

      // 1. Crear el pedido en la base de datos
      const resPedido = await fetch(`${import.meta.env.VITE_API_URL}/pedidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pedidoId,
          form,
          carrito,
          subtotal,
          envio,
          total: subtotal + envio.costo,
        }),
      });

      if (!resPedido.ok) {
        const err = await resPedido.json();
        throw new Error(err.error || "Error al crear el pedido");
      }

      // 2. Crear preferencia de pago en MercadoPago
      const resPago = await fetch(`${import.meta.env.VITE_API_URL}/pagos/crear-preferencia`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrito, form, envio, pedidoId }),
      });

      if (!resPago.ok) throw new Error("Error al conectar con MercadoPago");

      const { init_point } = await resPago.json();

      // 3. Redirigir a MercadoPago
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
              <Field label="Teléfono" name="telefono" value={form.telefono} onChange={handleChange} error={errores.telefono} />
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
              <div className="cp-row">
                <Field
                  label="Código postal"
                  name="codigoPostal"
                  value={form.codigoPostal}
                  onChange={handleChange}
                  error={errores.codigoPostal}
                  style={{ maxWidth: 160 }}
                />
                <button className="cotizar-btn" onClick={cotizar} disabled={cotizando}>
                  {cotizando ? "Cotizando..." : "Cotizar envío con Andreani"}
                </button>
              </div>

              {envio && (
                <div className="envio-resultado">
                  <span className="andreani-logo">📦 Andreani</span>
                  <span>Costo de envío: <strong>${envio.costo.toLocaleString("es-AR")}</strong></span>
                  <span className="plazo">Plazo estimado: {envio.plazo}</span>
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
              <span>Envío (Andreani)</span>
              <span>{envio ? `$${envio.costo.toLocaleString("es-AR")}` : "—"}</span>
            </div>
            <div className="resumen-total">
              <span>Total</span>
              <strong>${(subtotal + (envio?.costo || 0)).toLocaleString("es-AR")}</strong>
            </div>

            <button className="pagar-btn" onClick={handlePagar} disabled={procesando}>
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