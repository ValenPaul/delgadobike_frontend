export default function Confirmacion({ pedido, onVolver }) {
  if (!pedido) return null;

  return (
    <div className="confirmacion">
      <div className="confirmacion-card">
        <div className="check-circle">✓</div>
        <h1>¡Pedido confirmado!</h1>
        <p className="confirmacion-num">Número de pedido: <strong>{pedido.numeroPedido}</strong></p>
        <p className="confirmacion-msg">
          Te enviamos la confirmación a <strong>{pedido.form.email}</strong>.
          Tu bicicleta llegará por <strong>Andreani</strong> en {pedido.envio.plazo}.
        </p>

        <div className="confirmacion-resumen">
          <h3>Resumen</h3>
          {pedido.carrito.map((item) => (
            <div key={item.id} className="conf-item">
              <span>{item.nombre} × {item.cantidad}</span>
              <span>${(item.precio * item.cantidad).toLocaleString("es-AR")}</span>
            </div>
          ))}
          <div className="conf-item conf-envio">
            <span>Envío Andreani</span>
            <span>${pedido.envio.costo.toLocaleString("es-AR")}</span>
          </div>
          <div className="conf-total">
            <span>Total pagado</span>
            <strong>${pedido.total.toLocaleString("es-AR")}</strong>
          </div>
        </div>

        <div className="entrega-info">
          <h3>Dirección de entrega</h3>
          <p>
            {pedido.form.calle} {pedido.form.numero}
            {pedido.form.piso ? `, ${pedido.form.piso}` : ""}<br/>
            {pedido.form.localidad}, {pedido.form.provincia} ({pedido.form.codigoPostal})
          </p>
        </div>

        <button className="volver-inicio-btn" onClick={onVolver}>Volver al inicio</button>
      </div>
    </div>
  );
}