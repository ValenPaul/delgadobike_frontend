-- ============================================================
-- Migración: 2026-10-19 — Envíos Andreani (tarifas por franja de peso)
-- Proyecto: Bicicleteria Delgado (Neon Postgres)
--
-- Política de negocio (definitiva): el cliente SIEMPRE paga el envío real.
-- Sin envío gratis, sin mínimos y sin reglas por provincia. El costo sale de
-- la tabla tarifas_envio (franjas de peso, editables desde el admin) más dos
-- opcionales con recargo fijo (seguro por valor declarado / express 12hs),
-- centralizados en envio_opcionales (un solo registro).
-- Andreani no nos da API: los envíos se despachan manuales desde su portal,
-- por eso pedidos guarda kit de despacho + número de tracking.
--
-- REGLAS DE ESTA MIGRACIÓN:
--   * Idempotente: se puede re-correr sin romper (IF NOT EXISTS + ON CONFLICT).
--   * No destructiva: sin DROP, RENAME ni ALTER de columnas existentes.
--   * No toca datos existentes (los 21 pedidos y 8 productos quedan intactos).
--
-- OJO con los estados: NO se crea ninguna columna de estado nueva. Sigue
-- existiendo solo pedidos.estado (pendiente | en camino | entregado |
-- cancelado): 'pendiente' = pago aprobado y listo para despacho,
-- 'en camino' = con tracking pegado. Un solo estado, no dos máquinas.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A. productos — dimensiones para poder calcular el bulto
--    DEFAULT 0 = "sin cargar": el backend aplica un peso de reserva
--    mientras el admin no cargue los valores reales.
-- ------------------------------------------------------------
ALTER TABLE productos ADD COLUMN IF NOT EXISTS peso_g   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS alto_cm  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS ancho_cm INTEGER NOT NULL DEFAULT 0;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS largo_cm INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- B. tarifas_envio — tarifas por franja de peso
--    (tarifas publicadas de sucursal Andreani, vigentes octubre 2026,
--     envíos nacionales; precios en ARS)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- C. envio_opcionales — un solo registro (id = 1) con los dos opcionales
--    de recargo fijo, para que el admin los edite en un solo lugar y
--    tarifas_envio quede pura.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS envio_opcionales (
  id                SMALLINT PRIMARY KEY CHECK (id = 1),
  seguro_etiqueta   VARCHAR(100) NOT NULL DEFAULT 'Seguro por valor declarado',
  seguro_precio     INTEGER NOT NULL DEFAULT 17800,
  seguro_activo     BOOLEAN NOT NULL DEFAULT TRUE,
  express_etiqueta  VARCHAR(100) NOT NULL DEFAULT 'Envío express 12hs',
  express_precio    INTEGER NOT NULL DEFAULT 12500,
  express_activo    BOOLEAN NOT NULL DEFAULT TRUE
);

-- ------------------------------------------------------------
-- D. pedidos — kit de despacho + tracking + margen
--    (el backend se encarga de poblarlas; el jsonb/ metadata de MP viejo
--     queda intacto por compatibilidad)
--
--    Columnas que YA existen y por eso NO se agregan de nuevo:
--      telefono, calle, numero, piso (equivalente a piso_depto),
--      codigo_postal, localidad, provincia — todas pobladas por el webhook
--      de MercadoPago desde el formulario del checkout.
--    Aclaración: NO hay columna jsonb 'form' en pedidos; los datos del
--    formulario viven en esas columnas planas y en la metadata de MP.
-- ------------------------------------------------------------
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS dni VARCHAR(20);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS envio_desglose   JSONB;   -- {base, seguro, express, total, etiqueta}
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS envio_cobrado    INTEGER; -- lo que pagó el cliente
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS envio_costo_real INTEGER; -- lo que pagamos a Andreani (admin lo carga)
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tracking_numero  VARCHAR(50);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS envio_metodo     VARCHAR(20); -- 'sucursal' | 'domicilio' | 'link_pago'

-- ------------------------------------------------------------
-- Seeds (idempotentes: ON CONFLICT DO NOTHING, no duplica si ya existen)
-- ------------------------------------------------------------

-- Semilla de tarifas de envío (orden 1..6, cubren 1g a 1.000.000g sin huecos)
INSERT INTO tarifas_envio (id, etiqueta, peso_min_g, peso_max_g, precio, requiere_caja_grande, activa, orden) VALUES
  (1, 'Caja Andreani 2kg',                  1,      2000,  31000, FALSE, TRUE, 1),
  (2, 'Caja Andreani 3kg',                  2001,   3000,  33000, FALSE, TRUE, 2),
  (3, 'Caja Andreani 5kg',                  3001,   5000,  36000, FALSE, TRUE, 3),
  (4, 'Caja Andreani 10kg',                 5001,  10000,  40500, FALSE, TRUE, 4),
  (5, 'Caja Andreani 20kg',                 10001, 20000,  56500, FALSE, TRUE, 5),
  -- PRECIO PLACEHOLDER: "Bici en caja" se siembra con 56500 (copia de la
  -- franja de 20kg) porque todavia no conocemos el valor real de la tarifa.
  -- El admin lo edita desde el panel cuando se sepa el precio definitivo.
  (6, 'Bici en caja (ajustar precio real)', 20001, 1000000, 56500, TRUE, TRUE, 6)
ON CONFLICT (id) DO NOTHING;

-- Semilla del registro unico de opcionales (seguro 17800 / express 12hs 12500)
INSERT INTO envio_opcionales (id, seguro_etiqueta, seguro_precio, seguro_activo, express_etiqueta, express_precio, express_activo)
VALUES (1, 'Seguro por valor declarado', 17800, TRUE, 'Envío express 12hs', 12500, TRUE)
ON CONFLICT (id) DO NOTHING;

COMMIT;