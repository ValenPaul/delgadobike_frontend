# MEMORY.md — memoria del proyecto
> Documento vivo. **Máx. ~80 líneas.** Reglas al actualizar:
> - Resuelto → pasar a "Hecho" en una línea o borrarlo.
> - Viejo/obvio → eliminarlo (ya está en AGENTS.md).
> - Nunca pegar secretos ni contenido de `.env`.
> - Actualizar la fecha en "Estado" cada vez que se modifique.

## Estado (última actualización: 2026-11-14)
- **2026-11-14 — Encomienda DelgadoBike (envío propio) implementada y deployada**: tabla `envio_zonas_propias` (migración `2026-11-14_envio_zonas_propias.sql`, seed de 30 localidades ≤80 km de Crespo) + `backend/src/zonasPropias.js` (normaliza localidad/CP/provincia). `POST /api/envios/cotizar` devuelve `envio_propio`; el checkout muestra una tercera tarjeta **solo** si el destino está habilitado. El envío **no se cobra en MercadoPago** (se paga solo el producto) y se coordina por WhatsApp `5493434717485`. `crear-preferencia` valida la zona server-side (400 si no corresponde) y el webhook persiste `metodo` en `envio_desglose`; el pedido nace `pendiente`. Admin: **Tarifas → Envío propio** (CRUD), etiqueta en Pedidos y tarjeta en Despachos con "Marcar entregado" + WhatsApp del cliente. Emails con bloque de encomienda y CTA. Verificado en prod: cotización zona/no zona, preferencia sin línea de envío, UI completa. **Falta** una compra real de $1 para ver el pedido creado por webhook.
- **2026-11-13 — Badge del admin + compra E2E en prod**: Pedidos = `pendiente + reservada`, Despachos = `pendiente`, panel recarga pedidos al abrir. Compra real `VP-76678` vía webhook reprocesado: pedido `reservada`, stock Playera 3→2, 2 emails entregados; reintentar el webhook no duplica ni descuenta stock.
- **2026-10-24 — Envío por provincia (completo)**: `envio_destinos` + `envio_config.margen_pct=15`; cotiza con margen redondeado a $100 + fallback nacional. Frontend con select de provincia; Admin → Tarifas → "Por destino" (24 provincias, protegido). Deploy automático vía `git push` a `main`.
- **2026-10-24 — "Retiro en el local" verificado en prod** (`VP-33614`): gratis, estado `reservada`, fuera de Despachos, emails OK.
- **2026-10-24 — Pesos/dimensiones + "Bici en caja" $70.000 provisorios** verificados en prod (8/8 productos, mixto cobra un solo envío).

## Hecho
- **Encomienda DelgadoBike (2026-11-14):** match por localidad normalizada (sin acentos/minúsculas) **o** CP exacto, exigiendo provincia; `GET/POST/PUT/DELETE /api/envios/zonas` con auth; validación de zona también al crear la preferencia; `metodo` persistido en el JSONB; panel de zonas con activar/desactivar/eliminar; badge y acciones propias en Despachos; Hero/Contacto con el WhatsApp real.
- **Admin (2026-11-13):** badge Pedidos = `pendiente + reservada`, badge Despachos = `pendiente`. `useEffect` recarga pedidos al montar el panel.
- **Envío por provincia (2026-10-24):** tablas `envio_destinos` + `envio_config` (margen 15%). `POST /api/envios/cotizar` con `provincia` opcional + fallback. Frontend: cards/carrito "Enviar a calcular con tu ubicación". Admin: **Tarifas → Por destino**.
- **Retiro en local (2026-10-24):** `envio.metodo = "retiro_local"` sin línea de envío, webhook crea pedido `reservada`, stock descontado, emails con dirección del local.
- **Migración envíos Andreani (2026-10-19):** `productos` + peso/dimensiones; `tarifas_envio` + `envio_opcionales`; `pedidos` con `dni/envio_desglose/envio_cobrado/...`; tracking/despachos, auth admin, SEO.
- `/confirmacion` con estado vacío + botón **"Volver a la tienda"**. Emails Resend: `Promise.allSettled` y chequeo de `error` del SDK (antes fallaban en silencio). Logo del mail en la carpeta nueva de Cloudinary.

## Pendientes
1. **Probar el webhook de Encomienda DelgadoBike**: compra real de $1 (Playera) desde Paraná eligiendo la encomienda; verificar pedido `pendiente`, `envio_desglose.metodo = "delgadobike"` y los 2 emails.
2. **Cargar precios por provincia** — Admin → Tarifas → Por destino (costos reales de Andreani; margen 15% editable).
3. **Completar localidades de la zona** — Admin → Tarifas → Envío propio (el seed cubre ~30; el cliente suma las que falten).
4. **Seguridad/ops**: revocar la API key `transfer` de Neon (quedó expuesta en el traspaso); rotar `ADMIN_USER`/`ADMIN_PASS` (visibles en logs de Playwright); borrar imágenes de ejemplo de Cloudinary.
5. Sesión del admin no persiste al refrescar · tokens sin expiración · credenciales muertas en `src/datos.js`.
6. Futuro: Andreani "Colecta por domicilio" / "Andreani Envíos" con link de pago al cliente.

## Aprendizajes / no reintentar
- **Andreani no da API** → no scrapear el portal ni depender de tracking externo: el seguimiento que falla jamás puede bloquear el flujo. Zipnova quedó descartado.
- El precio de envío sale **siempre** de `POST /api/envios/cotizar`: nunca hardcodear montos en el frontend.
- `tarifas_envio.id` se inserta con `MAX(id)+1` (la secuencia no avanza con seeds de id explícito).
- El pedido se crea solo por webhook → no implementar `POST /pedidos`.
- **MP no entrega webhooks a `localhost`** (ni siquiera figura como fallido en el historial): probar en prod o con túnel (ngrok/cloudflared).
- **Vercel está conectado a GitHub**: `git push` a `main` deploya prod automáticamente (ambos proyectos). CLI local sin token.
- El SDK de Resend **no lanza excepciones**: devuelve `{ data, error }` → si no se revisa `error`, los emails fallan en silencio.
- Los métodos de envío sin costo (`retiro_local`, `delgadobike`) se validan **en el servidor**: nunca confiar solo en el `metodo` que manda el cliente.

## Decisiones tomadas
- Sin react-router ni librerías UI: navegación por estado `vista` + `pushState`.
- CSS único en `src/index.css`; backend CommonJS con SQL parameterizado.
- **Un solo estado de pedido**: `pendiente` = pago aprobado listo para despacho, `en camino` = con tracking (no crear columnas de estado nuevas).
- Opcionales de envío en `envio_opcionales` (tabla de 1 fila), no repetidos por franja.
- **Encomienda DelgadoBike**: el comprador paga solo los productos por MP y el envío se arregla por WhatsApp (Opción A); las zonas se administran por lista, sin mapas ni cálculo geométrico.
