-- ============================================================
-- Schema de Delgado Bike Online (Neon Postgres)
-- Versión definitiva tras la migración 2026-10-19 (envíos Andreani).
-- Las migraciones incrementales viven en backend/migraciones/.
-- ============================================================

-- Tabla de productos
CREATE TABLE IF NOT EXISTS productos (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(255) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  precio    INTEGER NOT NULL,
  descripcion TEXT NOT NULL,
  stock     INTEGER NOT NULL DEFAULT 0,
  imagen_url TEXT,
  -- Dimensiones del bulto para calcular el envío Andreani.
  -- DEFAULT 0 = "sin cargar": el backend aplica un peso de reserva
  -- mientras el admin no cargue los valores reales.
  peso_g    INTEGER NOT NULL DEFAULT 0,
  alto_cm   INTEGER NOT NULL DEFAULT 0,
  ancho_cm  INTEGER NOT NULL DEFAULT 0,
  largo_cm  INTEGER NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Tabla de pedidos
-- Nota: los datos de despacho (dni, envio_*, tracking) se agregaron en la
-- migración 2026-10-19; en la base viven al final de la tabla (ADD COLUMN).
-- NO existe columna de estado de envío aparte: un solo estado.
CREATE TABLE IF NOT EXISTS pedidos (
  id              VARCHAR(20) PRIMARY KEY,
  fecha           DATE DEFAULT CURRENT_DATE,
  cliente         VARCHAR(255) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  telefono        VARCHAR(50),
  calle           VARCHAR(255),
  numero          VARCHAR(20),
  piso            VARCHAR(50),
  localidad       VARCHAR(255),
  provincia       VARCHAR(255),
  codigo_postal   VARCHAR(20),
  total           INTEGER NOT NULL,
  costo_envio     INTEGER DEFAULT 0,
  -- 'pendiente' | 'en camino' | 'entregado' | 'cancelado'
  -- (pendiente = pago aprobado y listo para despacho; en camino = con tracking)
  estado          VARCHAR(50) DEFAULT 'pendiente',
  mp_payment_id   VARCHAR(255),
  creado_en       TIMESTAMP DEFAULT NOW(),

  -- ===== Kit de despacho / envíos Andreani (migración 2026-10-19) =====
  dni              VARCHAR(20),
  -- Desglose del envío cobrado: {base, seguro, express, total, etiqueta}
  envio_desglose   JSONB,
  envio_cobrado    INTEGER,       -- lo que pagó el cliente por el envío
  envio_costo_real INTEGER,       -- lo que pagamos a Andreani (lo carga el admin)
  envio_metodo     VARCHAR(20),   -- 'sucursal' | 'domicilio' | 'link_pago'
  tracking_numero  VARCHAR(50)
);

-- Tabla de items de cada pedido
CREATE TABLE IF NOT EXISTS pedido_items (
  id          SERIAL PRIMARY KEY,
  pedido_id   VARCHAR(20) REFERENCES pedidos(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id),
  nombre      VARCHAR(255) NOT NULL,
  cantidad    INTEGER NOT NULL,
  precio_unit INTEGER NOT NULL
);

-- ============================================================
-- Envíos Andreani (migración 2026-10-19)
-- Política: el cliente SIEMPRE paga el envío real (sin gratis, sin mínimos,
-- sin reglas por provincia). El costo sale de tarifas_envio (franjas de
-- peso, editables desde el admin) + dos opcionales de recargo fijo
-- (seguro / express) centralizados en envio_opcionales.
-- ============================================================

-- Tarifas por franja de peso (tarifas publicadas de sucursal Andreani,
-- vigentes octubre 2026, envíos nacionales). precio en ARS.
CREATE TABLE IF NOT EXISTS tarifas_envio (
  id                     SERIAL PRIMARY KEY,
  etiqueta               VARCHAR(100) NOT NULL,  -- ej: "Caja Andreani 5kg"
  peso_min_g             INTEGER NOT NULL,
  peso_max_g             INTEGER NOT NULL,
  precio                 INTEGER NOT NULL,
  requiere_caja_grande   BOOLEAN NOT NULL DEFAULT FALSE,
  activa                 BOOLEAN NOT NULL DEFAULT TRUE,
  orden                  INTEGER NOT NULL DEFAULT 0,
  creado_en              TIMESTAMP DEFAULT NOW()
);

-- Opcionales de recargo fijo: un solo registro (id = 1) para que el admin
-- los edite en un solo lugar y tarifas_envio quede pura.
CREATE TABLE IF NOT EXISTS envio_opcionales (
  id                SMALLINT PRIMARY KEY CHECK (id = 1),
  seguro_etiqueta   VARCHAR(100) NOT NULL DEFAULT 'Seguro por valor declarado',
  seguro_precio     INTEGER NOT NULL DEFAULT 17800,
  seguro_activo     BOOLEAN NOT NULL DEFAULT TRUE,
  express_etiqueta  VARCHAR(100) NOT NULL DEFAULT 'Envío express 12hs',
  express_precio    INTEGER NOT NULL DEFAULT 12500,
  express_activo    BOOLEAN NOT NULL DEFAULT TRUE
);

-- Productos de ejemplo para arrancar
INSERT INTO productos (nombre, categoria, precio, descripcion, stock) VALUES
  ('Trail Xpert 29',    'Montaña', 185000, 'Suspensión delantera 120mm, frenos hidráulicos Shimano, cuadro aluminio 6061.', 5),
  ('Urban Flow 700c',   'Urbana',   95000, 'Liviana, cómoda y estilosa. Ideal para moverse en ciudad con canastita trasera incluida.', 8),
  ('Road Carb 105',     'Ruta',    320000, 'Cuadro de carbono, grupo Shimano 105, peso total 8.2 kg.', 3),
  ('Kids Trek 24"',     'Niños',    65000, 'Perfecta para los peques de 8 a 12 años. Ruedas de entrenamiento incluidas.', 0),
  ('Gravel Adventure',  'Gravel',  240000, 'Para conquistar cualquier terreno. Neumáticos 700×40c, manubrio flared drop.', 4),
  ('City Comfort 26"',  'Urbana',   78000, 'Con portaequipaje, guardabarros y luces LED integradas. Lista para usar.', 7);

-- Semilla de tarifas de envío (idempotente: si ya existen no se duplica)
INSERT INTO tarifas_envio (id, etiqueta, peso_min_g, peso_max_g, precio, requiere_caja_grande, activa, orden) VALUES
  (1, 'Caja Andreani 2kg',              1,      2000,  31000, FALSE, TRUE, 1),
  (2, 'Caja Andreani 3kg',              2001,   3000,  33000, FALSE, TRUE, 2),
  (3, 'Caja Andreani 5kg',              3001,   5000,  36000, FALSE, TRUE, 3),
  (4, 'Caja Andreani 10kg',             5001,  10000,  40500, FALSE, TRUE, 4),
  (5, 'Caja Andreani 20kg',             10001, 20000,  56500, FALSE, TRUE, 5),
  -- ⚠️ PRECIO PLACEHOLDER: la franja de bici en caja se siembra con 56500
  -- (copia de la de 20kg) porque aún no tenemos el valor real de la tarifa.
  -- El admin lo edita desde el panel cuando se conozca el precio definitivo.
  (6, 'Bici en caja (ajustar precio real)', 20001, 1000000, 56500, TRUE, TRUE, 6)
ON CONFLICT (id) DO NOTHING;

-- Semilla del registro único de opcionales (id = 1)
INSERT INTO envio_opcionales (id, seguro_etiqueta, seguro_precio, seguro_activo, express_etiqueta, express_precio, express_activo)
VALUES (1, 'Seguro por valor declarado', 17800, TRUE, 'Envío express 12hs', 12500, TRUE)
ON CONFLICT (id) DO NOTHING;
