# MEMORY.md — memoria del proyecto
> Documento vivo. **Máx. ~80 líneas.** Reglas al actualizar:
> - Resuelto → pasar a "Hecho" en una línea o borrarlo.
> - Viejo/obvio → eliminarlo (ya está en AGENTS.md).
> - Nunca pegar secretos ni contenido de `.env`.
> - Actualizar la fecha en "Estado" cada vez que se modifique.

## Estado (última actualización: 2026-10-24)
- **2026-10-24 — Pendientes 1 y 2 cerrados**: los 8 productos tienen peso/dimensiones reales (15 kg, caja 80×25×140 → lado 65,4 cm) y la franja "Bici en caja" quedó en **$70.000 provisorio** (costo real Andreani Crespo → Libertador SM). Verificado en prod: 8/8 productos y las cards del catálogo cotizan $70.000; mixto cobra un solo envío.
- **Ronda "Envíos Andreani manuales" completa (DB → backend → frontend) + DEPLOY A PRODUCCIÓN 2026-10-22**: los proyectos de Vercel están **conectados a GitHub** → `git push` a `main` deploya solo (backend `d3f83d8`, frontend `73d54bd`). Verificado por API en prod: campos nuevos en productos, cotizador real, auth 401, botón "Volver a la tienda" en el bundle.
- Nuevo modelo: **el cliente siempre paga el envío real** — tarifas por franja de peso editables desde el admin, opcionales (seguro $17.800, express $12.500), un solo envío por carrito. Sin API: el admin genera el envío en el portal de Andreani, pega el tracking y despacha desde el panel.
- **E2E real verificado 2026-10-22 (producción)**: compra `VP-61942` → `dni` + `envio_desglose` + `envio_cobrado` correctos, stock descontado, webhook #5 (5/5 OK) y **llegaron los 2 emails** (comprador + vendedor). Env vars del admin seteadas en Vercel y login 200 en prod.
- **El `.env` local apunta a `localhost:3001`** → dev local usa el backend local, pero **la BD de Neon es la de producción**: cuidado con escrituras de prueba (borrar después).
- MCPs: `playwright` (local) + `context7`, `vercel`, `neon`, `mercadopago` (remotos; MP con OAuth desde 2026-10-21, cuenta con las apps `delgadob` id 2048075409473562 y `TestApp-3a223d31`; para cambiar de cuenta: `opencode mcp logout mercadopago`). Agentes: `Coordinador` (primary) + `AgFrontend`, `AgBackend`, `AgDataBase`.
- Ronda anterior (2026-10-15): auth del admin, limpieza, SEO, fix de crash — verificación 19/19.

## Hecho
- **Migración envíos (2026-10-19):** `productos` + `peso_g/alto_cm/ancho_cm/largo_cm`; `tarifas_envio` (6 franjas sembradas: 2kg $31.000 · 3kg $33.000 · 5kg $36.000 · 10kg $40.500 · 20kg $56.500 · "Bici en caja" placeholder); `envio_opcionales` (1 registro); `pedidos` + `dni/envio_desglose/envio_cobrado/envio_costo_real/tracking_numero/envio_metodo`. `schema.sql` alineado + `backend/migraciones/2026-10-19_envios_andreani.sql`.
- `POST /api/envios/cotizar` (pública): franja por peso, caja grande por volumen, opcionales; `PESO_RESERVA_G = 15000` cuando `peso_g = 0`.
- CRUD `/api/envios/tarifas` + `PUT /envios/opcionales` protegidos (400 si se borra la última franja activa; `orden` autocalculado).
- Webhook MP guarda `dni` del form y `envio_desglose` + `envio_cobrado` desde `metadata.envio`.
- Tracking: `POST /pedidos/:id/tracking` (→ estado `en camino` + email Resend con `andreani.com/envio/<n>`), `PUT /pedidos/:id/envio` (costo real → margen), `GET /pedidos/despachos` (kit completo + `peso_total_g`).
- `POST/PUT /api/productos` persisten peso y dimensiones (validados ≥ 0).
- Frontend: "Envío $X" en cards del catálogo, línea de envío + total en carrito, checkout con checkboxes seguro/express (total dinámico), DNI y teléfono obligatorios; simulación `4500 + random` eliminada. `/confirmacion` muestra desglose real.
- Admin: pestañas **Tarifas de envío** (franjas + opcionales) y **Despachos** (copiar datos para el portal, tracking + método, costo real + margen, "Abrir Andreani") + campos de peso/dimensiones en productos.
- Auth real del admin (token HMAC, rutas de escritura protegidas); `GET /pedidos` optimizado; `pool.on("error")`; SEO; logo; `/confirmacion` con snapshot; `statement_descriptor = "DelgadoBike"`.
- `/confirmacion` con estado vacío + botón **"Volver a la tienda"** (el carrito ya quedaba vacío por la recarga de página). Emails Resend: `Promise.allSettled` en el webhook y chequeo de `error` del SDK (antes fallaban en silencio).

## Pendientes
1. ~~Peso/dimensiones de los 8 productos~~ → **resuelto 2026-10-24**: todos con 15 kg y caja 80×25×140.
2. ~~Precio de "Bici en caja"~~ → **$70.000 provisorio** (2026-10-24, costo real Andreani Crespo → Libertador SM). Ajustable desde Admin → Tarifas cuando haya cotizaciones de zonas lejanas; el label aún dice "(ajustar precio real)". Franjas 2–20 kg quedan sin uso (reservadas para futuros accesorios/repuestos).
3. ~~Token MP + `invalid_auto_return`~~ → **resuelto y desplegado 2026-10-22** (token válido; `auto_return` omitido con back_urls localhost; fix ya en prod).
4. ~~Pago real con el flujo nuevo~~ → **resuelto 2026-10-22**: `VP-61942` desde producción, con `dni`, `envio_desglose` y `envio_cobrado`. (Compra local no crea pedido: MP no entrega webhooks a `localhost` → probar en prod o con túnel.)
5. **Resend sigue en modo testing** (`GET /domains` → vacío): los 2 mails de la compra de prueba llegaron porque **ambas casillas son tuyas** (el comprador de prueba es el dueño de la cuenta Resend). Para que **clientes reales** reciban: verificar un dominio propio en Resend y cambiar `EMAIL_FROM` (Vercel + local). Bug corregido 10-22: los fallos de email se silenciaban.
6. ~~Deploy a Vercel~~ → **hecho 2026-10-22**: conectados a GitHub (`git push` a `main` deploya solo) + env vars `AUTH_SECRET`/`ADMIN_USER`/`ADMIN_PASS` seteadas (login 200 en prod).
7. WhatsApp real (`wa.me` placeholder) · sesión del admin no persiste al refrescar · tokens sin expiración · credenciales muertas en `src/datos.js` · imagen por panel sin probar e2e.
8. Futuro: Andreani "Colecta por domicilio" / "Andreani Envíos" con link de pago al cliente (investigado, no implementado).

## Aprendizajes / no reintentar
- **Andreani no da API** → no scrapear el portal ni depender de tracking externo: el seguimiento que falla jamás puede bloquear el flujo. Zipnova quedó descartado.
- El precio de envío sale **siempre** de `POST /api/envios/cotizar`: nunca hardcodear montos en el frontend.
- `tarifas_envio.id` se inserta con `MAX(id)+1` (la secuencia no avanza con seeds de id explícito).
- El pedido se crea solo por webhook → no implementar `POST /pedidos`.
- **MP no entrega webhooks a `localhost`** (ni siquiera figura como fallido en el historial): una compra local nunca crea pedido → probar en prod o con túnel (ngrok/cloudflared).
- **Vercel está conectado a GitHub**: `git push` a `main` deploya prod automáticamente (ambos proyectos). CLI local sin token; MCP vercel requiere re-login (`/mcps`).
- El SDK de Resend **no lanza excepciones**: devuelve `{ data, error }` → si no se revisa `error`, los emails fallan en silencio.

## Decisiones tomadas
- Sin react-router ni librerías UI: navegación por estado `vista` + `pushState`.
- CSS único en `src/index.css`; backend CommonJS con SQL parameterizado.
- **Un solo estado de pedido**: `pendiente` = pago aprobado listo para despacho, `en camino` = con tracking (no crear columnas de estado nuevas).
- Opcionales de envío en `envio_opcionales` (tabla de 1 fila), no repetidos por franja.
