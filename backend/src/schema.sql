-- Tabla de productos
CREATE TABLE IF NOT EXISTS productos (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(255) NOT NULL,
  categoria VARCHAR(100) NOT NULL,
  precio    INTEGER NOT NULL,
  descripcion TEXT NOT NULL,
  stock     INTEGER NOT NULL DEFAULT 0,
  creado_en TIMESTAMP DEFAULT NOW()
);

-- Tabla de pedidos
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
  estado          VARCHAR(50) DEFAULT 'pendiente',
  mp_payment_id   VARCHAR(255),
  creado_en       TIMESTAMP DEFAULT NOW()
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

-- Productos de ejemplo para arrancar
INSERT INTO productos (nombre, categoria, precio, descripcion, stock) VALUES
  ('Trail Xpert 29',    'Montaña', 185000, 'Suspensión delantera 120mm, frenos hidráulicos Shimano, cuadro aluminio 6061.', 5),
  ('Urban Flow 700c',   'Urbana',   95000, 'Liviana, cómoda y estilosa. Ideal para moverse en ciudad con canastita trasera incluida.', 8),
  ('Road Carb 105',     'Ruta',    320000, 'Cuadro de carbono, grupo Shimano 105, peso total 8.2 kg.', 3),
  ('Kids Trek 24"',     'Niños',    65000, 'Perfecta para los peques de 8 a 12 años. Ruedas de entrenamiento incluidas.', 0),
  ('Gravel Adventure',  'Gravel',  240000, 'Para conquistar cualquier terreno. Neumáticos 700×40c, manubrio flared drop.', 4),
  ('City Comfort 26"',  'Urbana',   78000, 'Con portaequipaje, guardabarros y luces LED integradas. Lista para usar.', 7);