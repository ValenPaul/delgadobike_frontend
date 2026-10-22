# AGENTS.md

> **INSTRUCCIÓN PRIORITARIA:** Antes de cualquier otra cosa, al inicio de cada tarea, leé este archivo `AGENTS.md` y el archivo `MEMORY.md` (memoria viva del proyecto) para tener el contexto completo. Si `MEMORY.md` fue modificado recientemente, usá su estado como fuente de verdad del proyecto.

## Visión general
Tienda online **Delgado Bike Online** (bicicletas, Argentina). Monorepo con dos proyectos:
- **Frontend** (raíz): React 18 + Vite 5, JavaScript puro (sin TypeScript), sin router ni librerías de UI.
- **Backend** (`backend/`): Express 4 + PostgreSQL (Neon) + MercadoPago + Cloudinary + Resend + Andreani.

Idioma de la interfaz y de los comentarios: **español rioplatense (voseo)**; moneda ARS con `.toLocaleString("es-AR")`.

## Comandos
| Tarea | Comando |
|---|---|
| Frontend dev (puerto 5173) | `npm run dev` |
| Build frontend (`dist/`) | `npm run build` |
| Preview del build | `npm run preview` |
| Backend dev (puerto 3001, nodemon) | `cd backend && npm run dev` |
| Backend producción | `cd backend && npm start` |

- No hay tests, linter ni formateador configurado. Después de tocar el frontend, verificar con `npm run build`.
- **`backend/` es un repositorio git independiente** de la raíz: los commits se hacen por separado.

## Estructura
```
/
├── index.html            # entry de Vite
├── vite.config.js        # puerto 5173, allowedHosts: "all"
├── src/
│   ├── main.jsx          # ReactDOM.createRoot + StrictMode (sin BrowserRouter)
│   ├── App.jsx           # estado global: productos, carrito, pedidos, vista
│   ├── index.css         # ÚNICA hoja de estilos (~950 líneas)
│   ├── datos.js          # categorías, colores por categoría y credenciales del admin
│   └── components/       # Navbar, Hero, Catalogo, Carrito, Checkout,
│                         # Confirmacion, Admin, Nosotros, Contacto
└── backend/
    ├── vercel.json       # deploy serverless (@vercel/node)
    └── src/
        ├── index.js      # Express: CORS, montaje de rutas, /api/health
        ├── db.js         # pg Pool → DATABASE_URL (Neon con SSL)
        ├── schema.sql    # tablas productos / pedidos / pedido_items
        ├── cloudinary.js # multer + CloudinaryStorage (max 800×600, quality auto)
        ├── email.js      # Resend: mail al cliente y notificación al admin
        └── routes/       # productos.js, pedidos.js, pagos.js, envios.js
```

## Variables de entorno
Frontend `.env` (raíz):
- `VITE_API_URL` — base del API; el código llama a `${VITE_API_URL}/productos`, o sea debe incluir `/api`. **Existe en el `.env` local y apunta al backend de PRODUCCIÓN** (`https://delgadobike-backend.vercel.app/api`), así que el dev local lee y escribe la BD de producción, no una local. Ojo al testear escrituras.

Backend `backend/.env`:
- `PORT` (3001), `DATABASE_URL` (Postgres Neon)
- `MP_ACCESS_TOKEN` (MercadoPago)
- `ANDREANI_API_KEY`, `ANDREANI_USUARIO`, `ANDREANI_CONTRATO` (hoy con valores fake)
- `FRONTEND_URL`, `BACKEND_URL` — **`BACKEND_URL` no está en el `.env` local** y se usa para `notification_url` del webhook
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_ADMIN`

⚠️ Los `.env` contienen credenciales reales: nunca imprimirlas, subirlas ni commitearlas (ya están en `.gitignore`).

## API (base `/api`)
- `GET /productos`, `GET /productos/:id`, `POST /productos`, `PUT /productos/:id`, `DELETE /productos/:id`
  - `POST`/`PUT` reciben `multipart/form-data` con campo `imagen` (opcional) → Cloudinary. Al reemplazar o borrar un producto se elimina también la imagen vieja.
- `GET /pedidos` (devuelve cada pedido con `items` anidados, orden `creado_en DESC`)
- `PUT /pedidos/:id/estado` — estados válidos: `pendiente | en camino | entregado | cancelado`
  - **No existe `POST /pedidos`.**
- `POST /pagos/crear-preferencia` — crea la preferencia de MercadoPago (items + envío, `metadata` con form/carrito/envio, `external_reference = pedidoId`, `back_urls` a `${FRONTEND_URL}/confirmacion|checkout`).
- `POST /pagos/webhook` — si el pago está `approved`: crea el pedido en una transacción (valida stock con `FOR UPDATE`, inserta `pedidos` + `pedido_items`, descuenta stock), evita duplicados por `external_reference` y envía los dos emails (el fallo de email no rompe el flujo).
- `POST /envios/cotizar` — cotiza por código postal contra la API de Andreani; si falla responde costo estimado 5500 (hoy siempre cae al fallback).
- `GET /health` → `{ ok: true }`

## Flujo de compra
1. `Catalogo` agrega al carrito que vive en memoria en `App.jsx` (sin `localStorage`); el stock se valida en la UI.
2. `Checkout` valida el formulario, "cotiza" el envío (**simulado en el cliente**: 4500 + random ≤1500) y hace `POST /pagos/crear-preferencia` → redirige con `window.location.href = init_point`.
3. MercadoPago avisa por webhook → **recién ahí** se crea el pedido y se descuenta stock.
4. La vuelta a `/confirmacion` muestra el último pedido (`GET /pedidos` → primer elemento).

## Convenciones
- **Sin react-router**: `App.jsx` maneja el estado `vista` (`inicio | checkout | confirmacion | admin | nosotros | contacto`) sincronizado con la URL vía `history.pushState`/`popstate`. Para sumar una vista: agregar caso en `getVistaDesdeURL`, entrada en el mapa `rutas` y render condicional.
- **Estado centralizado en `App.jsx`** (productos, pedidos, carrito, vista); los componentes son presentacionales y reciben props + callbacks (`onAgregarAlCarrito`, `onCambiarCantidad`, `onActualizarProductos`, `onActualizarEstadoPedido`, etc.).
- **CSS global único** `src/index.css`: clases kebab-case con patrón `componente-elemento`, bloques separados por comentarios `/* ===== SECCIÓN ===== */`, tema oscuro (`#0D0D0D`, acento `#0066FF`), dos breakpoints (`900px` y `480px`). Todo estilo nuevo va en ese archivo.
- Frontend: JS/JSX sin TS, `fetch` nativo, iconos con SVG inline o emojis, imágenes desde Cloudinary.
- Backend: **CommonJS** (`require`), un archivo por recurso en `routes/`, SQL parameterizado (`$1`) sobre el `pool` de `pg`, respuestas de error como `res.status(x).json({ error: "..." })`.
- Nombres de variables, comentarios, textos de UI y mensajes de error **en español**.

## Tareas típicas
- **Nuevo endpoint**: crear/editar `backend/src/routes/<recurso>.js` y registrarlo en `backend/src/index.js`.
- **Nuevo campo de producto**: actualizar `backend/src/schema.sql` + migrar la tabla en Neon a mano + `routes/productos.js` + formulario en `src/components/Admin.jsx`.
- **Nueva categoría**: sumarla en `src/datos.js` (`categorias` y `colores`) y en el filtro de `src/components/Catalogo.jsx`.
- **Nuevo componente**: crearlo en `src/components/`, renderizarlo desde `App.jsx` y sumar sus clases a `src/index.css`.

## Pendientes (testeo.txt)
- Verificar envío de emails de confirmación · tarjetas de prueba de MercadoPago OK · cuenta de Resend · ~~SEO de la página~~ (hecho 2026-10-15).

## Autenticación del admin
- Login: `POST /api/auth/login` con `{ usuario, password }` → devuelve `{ token }` (HMAC-SHA256 firmado con `AUTH_SECRET`).
- Credenciales viven en **`backend/.env`** (`ADMIN_USER`, `ADMIN_PASS`). `src/datos.js` todavía las exporta pero **ya nadie las importa**.
- Rutas protegidas (401 sin token): `POST/PUT/DELETE /api/productos` y `PUT /api/pedidos/:id/estado`.
- Públicas: `GET /api/productos`, `GET /api/pedidos`, `POST /api/pagos/*`, `POST /api/envios/cotizar`, `GET /api/health`.
- El frontend manda `Authorization: Bearer <token>` desde `App.jsx` (helper `authHeaders`), token guardado en `localStorage.adminToken`.

## Problemas conocidos (considerar antes de tocar código)
- `pedidoId` aleatorio (`VP-#####`) usado como clave primaria: puede colisionar.
- El envío real de Andreani no está conectado (API key fake + fallback 5500). Además `Checkout.jsx` cotiza en el cliente y **no llama** a `POST /api/envios/cotizar`, que sí existe.
- Tokens **sin expiración** (`verificarToken` ya soporta `exp`, falta setearlo en el login).
- La sesión del admin no persiste al refrescar: `logueado` es estado en memoria, aunque el token siga en `localStorage`.
- `pedidos.id` es `varchar(20)`; los pedidos se crean solo por webhook de MercadoPago (no existe `POST /api/pedidos`).
- Sin tests ni lint: las validaciones son manuales.

## Deploy
- Frontend: Vercel (`delgadobike-online.vercel.app`, `delgadobike-frontend-khaki.vercel.app`).
- Backend: Vercel serverless (`backend/vercel.json` → `@vercel/node` sobre `src/index.js`).
- CORS en `backend/src/index.js` permite `FRONTEND_URL`, `http://localhost:5173` y `https://delgadobike-online.vercel.app`.
