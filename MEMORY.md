# MEMORY.md — memoria del proyecto
> Documento vivo. **Máx. ~80 líneas.** Reglas al actualizar:
> - Resuelto → pasar a "Hecho" en una línea o borrarlo.
> - Viejo/obvio → eliminarlo (ya está en AGENTS.md).
> - Nunca pegar secretos ni contenido de `.env`.
> - Actualizar la fecha en "Estado" cada vez que se modifique.

## Estado (última actualización: 2026-10-22)
- **Ronda "Envíos Andreani manuales" completa (DB → backend → frontend). Verificación E2E OK + `npm run build` limpio.**
- Nuevo modelo: **el cliente siempre paga el envío real** — tarifas por franja de peso editables desde el admin, opcionales (seguro $17.800, express $12.500), un solo envío por carrito. Sin API: el admin genera el envío en el portal de Andreani, pega el tracking y despacha desde el panel.
- Frontend y backend desplegados en Vercel; **los cambios de esta ronda viven solo en local** (falta deploy). Pagos MP OK (tarjetas de prueba).
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

## Pendientes
1. **Cargar peso/dimensiones reales de los 8 productos** (hoy 0 → peso de reserva → todos cotizan $56.500).
2. **Precio real de la franja "Bici en caja"** (placeholder $56.500; se edita desde Admin → Tarifas).
3. ~~`MP_ACCESS_TOKEN` inválido + bug local `invalid_auto_return`~~ → **resuelto 2026-10-22**: token renovado y válido (200 en `/users/me`, MLA) y **fix aplicado en `pagos.js`** (`auto_return` no se envía si `FRONTEND_URL` es localhost; MP lo rechazaba con back_urls locales). Verificado: local 200 con `init_point` sin `auto_return`; prod simulada 200 con `auto_return: "approved"`. **Falta deploy del backend a Vercel** para que el fix viva en prod (aunque en prod ya funcionaba). Pendiente de probar el pago E2E completo.
4. **Pago real de MP con el desglose de envío nuevo sin probar** (el E2E no pudo generar pagos reales; el shape se validó leyendo el webhook). Recién poder probarlo una vez renovado el token.
5. **Resend en modo testing** → solo recibe el dueño de la cuenta; verificar envío real de mails (tracking incluido).
6. **Deploy a Vercel**: setear en el backend `AUTH_SECRET`, `ADMIN_USER`, `ADMIN_PASS`, `BACKEND_URL` y redeploy de frontend + backend.
7. WhatsApp real (`wa.me` placeholder) · sesión del admin no persiste al refrescar · tokens sin expiración · credenciales muertas en `src/datos.js` · imagen por panel sin probar e2e.
8. Futuro: Andreani "Colecta por domicilio" / "Andreani Envíos" con link de pago al cliente (investigado, no implementado).

## Aprendizajes / no reintentar
- **Andreani no da API** → no scrapear el portal ni depender de tracking externo: el seguimiento que falla jamás puede bloquear el flujo. Zipnova quedó descartado.
- El precio de envío sale **siempre** de `POST /api/envios/cotizar`: nunca hardcodear montos en el frontend.
- `tarifas_envio.id` se inserta con `MAX(id)+1` (la secuencia no avanza con seeds de id explícito).
- El pedido se crea solo por webhook → no implementar `POST /pedidos`.

## Decisiones tomadas
- Sin react-router ni librerías UI: navegación por estado `vista` + `pushState`.
- CSS único en `src/index.css`; backend CommonJS con SQL parameterizado.
- **Un solo estado de pedido**: `pendiente` = pago aprobado listo para despacho, `en camino` = con tracking (no crear columnas de estado nuevas).
- Opcionales de envío en `envio_opcionales` (tabla de 1 fila), no repetidos por franja.
