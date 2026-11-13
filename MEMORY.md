# MEMORY.md — memoria del proyecto
> Documento vivo. **Máx. ~80 líneas.** Reglas al actualizar:
> - Resuelto → pasar a "Hecho" en una línea o borrarlo.
> - Viejo/obvio → eliminarlo (ya está en AGENTS.md).
> - Nunca pegar secretos ni contenido de `.env`.
> - Actualizar la fecha en "Estado" cada vez que se modifique.

## Estado (última actualización: 2026-11-13)
- **2026-11-13 — Badge del admin + compra E2E en prod**: el badge contaba solo `pendiente`; ahora Pedidos = `pendiente + reservada` y Despachos = `pendiente`, y el panel recarga pedidos al abrir. Checkout real hasta MercadoPago con preferencia `VP-83161` (`notification_url` y back_urls a prod); webhook reprocesado del pago aprobado `VP-76678` → pedido `reservada`, stock Playera 3→2, 2 emails entregados (cliente y admin); reintentar el webhook no duplica ni descuenta stock.
- **2026-10-24 — Envío por provincia (completo)**: migración `2026-10-24_envios_por_provincia.sql` (`envio_destinos` + `envio_config.margen_pct=15`). Backend cotiza por provincia con margen redondeado a $100 + fallback nacional. Frontend: cards/carrito/checkout con select de provincia y "Completá tu dirección para calcular el envío". Admin: Tarifas → "Por destino" (24 provincias, cálculo en tiempo real, protegido). Build limpio. Deploy automático vía `git push` a `main`.
- **2026-10-24 — "Retiro en el local" verificado en prod** (`VP-33614`): gratis, estado `reservada`, fuera de Despachos, emails OK. Fix admin (detección por etiqueta + fecha con `creado_en`).
- **2026-10-24 — Pesos/dimensiones + "Bici en caja" $70.000 provisorios** verificados en prod (8/8 productos, mixto cobra un solo envío).
- **2026-10-22 — Envíos Andreani manuales completo + deploy prod** (GitHub conectado). **E2E prod** `VP-61942` OK (dni/envío/cobrado, webhook, 2 emails). Auth + botón "Volver a la tienda". `.env` local apunta a backend local pero BD Neon es producción.

## Hecho
- **Admin (2026-11-13):** badge Pedidos = `pendiente + reservada`, badge Despachos = `pendiente` (solo envíos). `useEffect` recarga pedidos al montar el panel para que los números no queden viejos.
- **Compra E2E (2026-11-13):** flujo de checkout en prod → preferencia con `notification_url` a producción y back_urls al dominio nuevo; webhook crea pedido, descuenta stock y envía los 2 emails (Resend con dominio propio, `last_event: delivered`); reintento del mismo webhook es idempotente.
- **Envío por provincia (2026-10-24):** tablas `envio_destinos` + `envio_config` (margen 15%). `POST /api/envios/cotizar` con `provincia` opcional + fallback nacional. CRUD admin `GET/PUT /api/envios/destinos` protegido. Frontend: cards/carrito "Enviar a calcular con tu ubicación", checkout con select de provincias (espera dirección para cotizar). Admin: **Tarifas → Por destino**. `backend/migraciones/2026-10-24_envios_por_provincia.sql`.
- **Retiro en local (2026-10-24):** `envio.metodo = "retiro_local"` sin línea de envío, webhook crea pedido `reservada`, stock descontado, emails con dirección del local. Admin detecta retiro por etiqueta persistida + columna Fecha con `creado_en`.
- **Migración envíos Andreani (2026-10-19):** `productos` + peso/dimensiones; `tarifas_envio` + `envio_opcionales`; `pedidos` con `dni/envio_desglose/envio_cobrado/...`. `POST /envios/cotizar`, CRUD tarifas/opcionales protegidos, webhook guarda desglose, tracking/despachos, auth admin, SEO, etc. (`2026-10-19_envios_andreani.sql`).
- `/confirmacion` con estado vacío + botón **"Volver a la tienda"** (el carrito ya quedaba vacío por la recarga de página). Emails Resend: `Promise.allSettled` en el webhook y chequeo de `error` del SDK (antes fallaban en silencio).

## Pendientes
1. **Cargar precios por provincia** — Entrar a **Admin → Tarifas → Por destino** y cargar costos reales de Andreani por provincia (podés hacerlo gradual por zonas más vendidas). Margen actual 15% (editable).
2. WhatsApp real (`wa.me` placeholder) · sesión del admin no persiste al refrescar · tokens sin expiración · credenciales muertas en `src/datos.js` · imagen por panel sin probar e2e.
3. Futuro: Andreani "Colecta por domicilio" / "Andreani Envíos" con link de pago al cliente.

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
