export default function Confirmacion({ pedido, onVolver }) {
  // Sin snapshot de compra (llegaron directos a /confirmacion o el pago no se
  // completó): mostramos un estado vacío con el botón de vuelta a la tienda
  // en vez de una pantalla en blanco.
  if (!pedido) {
    return (
      <div className="confirmacion">
        <div className="confirmacion-card">
          <div className="check-circle confirmacion-icono-vacio">🛒</div>
          <h1>Todavía no hay ningún pedido acá</h1>
          <p className="confirmacion-vacio-msg">
            Si acabás de pagar en MercadoPago, puede tardar unos segundos en
            aparecer la confirmación. Mientras tanto, seguí recorriendo la tienda.
          </p>
          <button className="volver-inicio-btn" onClick={onVolver}>Volver a la tienda</button>
        </div>
      </div>
    );
  }

  const envio = pedido.envio || {};
  // El checkout nuevo manda el desglose completo ({ base, seguro, express,
  // total, etiqueta }); el flujo viejo manda solo { costo } y mostramos
  // la línea genérica como fallback.
  const tieneDesglose =
    typeof envio.etiqueta === "string" && envio.etiqueta.trim() !== "" &&
    Number.isFinite(Number(envio.total));
  // Retiro en el local: el desglose trae metodo === "retiro_local" (contrato
  // del backend) y el pedido nace reservado en vez de ir por Andreani.
  const esRetiroLocal = envio.metodo === "retiro_local" || pedido.metodo === "retiro_local";

  return (
    <div className="confirmacion">
      <div className="confirmacion-card">
        <div className="check-circle">✓</div>
        <h1>{esRetiroLocal ? "¡Pedido reservado!" : "¡Pedido confirmado!"}</h1>
        <p className="confirmacion-num">Número de pedido: <strong>{pedido.numeroPedido}</strong></p>
        <p className="confirmacion-msg">
          Te enviamos la confirmación a <strong>{pedido.form.email}</strong>.
          {esRetiroLocal ? (
            <>Tu pedido queda reservado en el local hasta que lo pases a buscar.</>
          ) : (
            <> Tu bicicleta viaja por <strong>Andreani</strong>
              {tieneDesglose ? <> — {envio.etiqueta}</> : ""}.
            </>
          )}
        </p>

        <div className="confirmacion-resumen">
          <h3>Resumen</h3>
          {pedido.carrito.map((item) => (
            <div key={item.id} className="conf-item">
              <span>{item.nombre} × {item.cantidad}</span>
              <span>${(item.precio * item.cantidad).toLocaleString("es-AR")}</span>
            </div>
          ))}
          {esRetiroLocal ? (
            <div className="conf-item conf-envio">
              <span>🏬 Retiro en el local</span>
              <span>Gratis</span>
            </div>
          ) : tieneDesglose ? (
            <>
              <div className="conf-item">
                <span>Envío · {envio.etiqueta}</span>
                <span>${Number(envio.base).toLocaleString("es-AR")}</span>
              </div>
              {Number(envio.seguro) > 0 && (
                <div className="conf-item">
                  <span>Seguro por valor declarado</span>
                  <span>${Number(envio.seguro).toLocaleString("es-AR")}</span>
                </div>
              )}
              {Number(envio.express) > 0 && (
                <div className="conf-item">
                  <span>Envío express 12hs</span>
                  <span>${Number(envio.express).toLocaleString("es-AR")}</span>
                </div>
              )}
              <div className="conf-item conf-envio">
                <span>Envío (total)</span>
                <span>${Number(envio.total).toLocaleString("es-AR")}</span>
              </div>
            </>
          ) : (
            <div className="conf-item conf-envio">
              <span>Envío Andreani</span>
              <span>${(envio.costo || 0).toLocaleString("es-AR")}</span>
            </div>
          )}
          <div className="conf-total">
            <span>Total pagado</span>
            <strong>${pedido.total.toLocaleString("es-AR")}</strong>
          </div>
        </div>

        {pedido.tracking_numero && (
          <div className="conf-tracking">
            <h3>Seguimiento Andreani</h3>
            <p>
              Número de tracking:{" "}
              <a
                href={`https://andreani.com/envio/${pedido.tracking_numero}`}
                target="_blank"
                rel="noreferrer"
              >
                {pedido.tracking_numero}
              </a>
            </p>
          </div>
        )}

        {esRetiroLocal ? (
          <div className="conf-retiro">
            <h3>🏬 Retiro en el local</h3>
            <p>
              <strong>3 de Febrero 1223, Crespo, Entre Ríos</strong>
            </p>
            <p>
              Te avisamos cuando esté listo para retirar. Traé tu número de pedido.
            </p>
            {pedido.form.dni && (
              <p className="conf-dni">DNI: {pedido.form.dni}</p>
            )}
          </div>
        ) : (
          <div className="entrega-info">
            <h3>Dirección de entrega</h3>
            <p>
              {pedido.form.calle} {pedido.form.numero}
              {pedido.form.piso ? `, ${pedido.form.piso}` : ""}<br/>
              {pedido.form.localidad}, {pedido.form.provincia} ({pedido.form.codigoPostal})
            </p>
            {pedido.form.dni && (
              <p className="conf-dni">DNI: {pedido.form.dni}</p>
            )}
          </div>
        )}

        <button className="volver-inicio-btn" onClick={onVolver}>Volver a la tienda</button>
      </div>
    </div>
  );
}
