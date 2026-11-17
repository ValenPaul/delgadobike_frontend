-- ============================================================
-- Categorías de bicicletas — migración 2026-11-17
-- Aplicada en Neon el 2026-11-17 (idempotente: CREATE IF NOT EXISTS +
-- ON CONFLICT DO NOTHING).
--
-- Hasta ahora `productos.categoria` era texto libre (VARCHAR(100) NOT NULL,
-- sin FK ni índice) y los valores posibles estaban hardcodeados en el
-- frontend (src/datos.js). Esta tabla pasa a ser la fuente de verdad de las
-- categorías y su color, administrable desde el panel de admin vía
-- /api/categorias (GET público, POST/PUT/DELETE con auth).
--
-- La relación con productos SE MANTIENE POR NOMBRE: `productos.categoria`
-- no lleva FK para no romper los productos existentes ni el filtro del
-- frontend. El endpoint de renombrar actualiza `productos.categoria` en la
-- MISMA transacción, así ningún producto queda huérfano.
-- `nombre` es UNIQUE a nivel de tabla; el endpoint además compara con
-- LOWER(TRIM(nombre)) para bloquear duplicados que difieran solo en
-- mayúsculas o espacios.
--
-- La semilla carga las 5 categorías reales que hoy tiene la base de
-- producción, con los colores que usa el frontend. Ojo: como no se pasa `id`
-- a mano, la secuencia SERIAL avanza sola (no repetir el error de
-- MAX(id)+1 del resto del proyecto).
-- ============================================================

CREATE TABLE IF NOT EXISTS categorias (
  id        SERIAL PRIMARY KEY,
  nombre    VARCHAR(100) NOT NULL UNIQUE,
  color     VARCHAR(20)  NOT NULL DEFAULT '#0066FF',
  creado_en TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO categorias (nombre, color) VALUES
  ('Montaña', '#2D7D46'),
  ('Urbana',  '#1A6FA8'),
  ('Ruta',    '#FF4D00'),
  ('Niños',   '#9B59B6'),
  ('Gravel',  '#8B5E3C')
ON CONFLICT (nombre) DO NOTHING;
