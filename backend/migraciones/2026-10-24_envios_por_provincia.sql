-- 2026-10-24 — Envío con precio por provincia + margen global.
-- Aplicada en Neon el 2026-10-24 (idempotente: CREATE IF NOT EXISTS + ON CONFLICT).
--
-- El cliente ve el precio del envío según SU provincia (cotización posterior a
-- cargar la dirección). `costo` es lo que nos cobra Andreani (dato del admin,
-- solo visible con auth); el precio de venta se calcula con el margen global
-- de `envio_config.margen_pct` redondeado hacia arriba en múltiplos de $100.
-- Sin precio cargado para una provincia → fallback al precio nacional de
-- `tarifas_envio` (comportamiento anterior, cero regresión).

CREATE TABLE IF NOT EXISTS envio_destinos (
  franja_id INT REFERENCES tarifas_envio(id) ON DELETE CASCADE,
  provincia VARCHAR(100) NOT NULL,
  costo INTEGER NOT NULL CHECK (costo >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (franca_id, provincia)
);

CREATE TABLE IF NOT EXISTS envio_config (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  margen_pct INT NOT NULL CHECK (margen_pct >= 0 AND margen_pct <= 100)
);

INSERT INTO envio_config (id, margen_pct) VALUES (1, 15) ON CONFLICT (id) DO NOTHING;
