-- ============================================================
-- Encomienda DelgadoBike (envío propio) — migración 2026-11-14
--
-- Zonas en las que el dueño de la tienda entrega personalmente con su
-- vehículo (localidades a menos de 80 km de Crespo). El checkout muestra la
-- opción "Encomienda DelgadoBike" solo si la localidad o el CP del comprador
-- figuran acá; el envío NO se cobra en MercadoPago: se coordina y se cobra
-- por WhatsApp.
--
-- `localidad` se guarda tal cual la carga el admin y `localidad_norm` sin
-- acentos / en minúsculas para comparar de forma robusta (mismo criterio que
-- `envio_destinos.provincia`). `codigo_postal` es opcional: si está cargado,
-- también matchea por CP (solo dígitos).
-- ============================================================

CREATE TABLE IF NOT EXISTS envio_zonas_propias (
  id             SERIAL PRIMARY KEY,
  localidad      VARCHAR(120) NOT NULL,
  localidad_norm VARCHAR(120) NOT NULL,
  provincia      VARCHAR(80)  NOT NULL,
  codigo_postal  VARCHAR(10),
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (localidad_norm, provincia)
);

-- Semilla inicial: localidades a menos de 80 km de Crespo (Entre Ríos).
-- Es idempotente: si una localidad ya existe, no se duplica.
INSERT INTO envio_zonas_propias (localidad, localidad_norm, provincia, codigo_postal) VALUES
  ('Crespo',                        'crespo',                        'entre rios', '3114'),
  ('Aldea San Juan',                'aldea san juan',                'entre rios', NULL),
  ('Aldea Santa Rosa',              'aldea santa rosa',              'entre rios', NULL),
  ('General Racedo',                'general racedo',                'entre rios', NULL),
  ('Estación Camps',                'estacion camps',                'entre rios', NULL),
  ('Villa Libertador San Martín',   'villa libertador san martin',   'entre rios', NULL),
  ('General Ramírez',               'general ramirez',               'entre rios', NULL),
  ('Seguí',                         'segui',                         'entre rios', NULL),
  ('Villa Fontana',                 'villa fontana',                 'entre rios', NULL),
  ('Sauce Pinto',                   'sauce pinto',                   'entre rios', NULL),
  ('Tezanos Pinto',                 'tezanos pinto',                 'entre rios', NULL),
  ('Aranguren',                     'aranguren',                     'entre rios', NULL),
  ('Strobel',                       'strobel',                       'entre rios', NULL),
  ('San Benito',                    'san benito',                    'entre rios', NULL),
  ('Oro Verde',                     'oro verde',                     'entre rios', NULL),
  ('Colonia Avellaneda',            'colonia avellaneda',            'entre rios', NULL),
  ('Diamante',                      'diamante',                      'entre rios', '3105'),
  ('Sauce Montrull',                'sauce montrull',                'entre rios', NULL),
  ('Viale',                         'viale',                         'entre rios', NULL),
  ('La Picada',                     'la picada',                     'entre rios', NULL),
  ('General Alvear',                'general alvear',                'entre rios', NULL),
  ('Paraná',                        'parana',                        'entre rios', '3100'),
  ('Villa Urquiza',                 'villa urquiza',                 'entre rios', NULL),
  ('Hernández',                     'hernandez',                     'entre rios', NULL),
  ('Tabossi',                       'tabossi',                       'entre rios', NULL),
  ('Cerrito',                       'cerrito',                       'entre rios', NULL),
  ('María Grande',                  'maria grande',                  'entre rios', NULL),
  ('Nogoyá',                        'nogoya',                        'entre rios', '3150'),
  ('Victoria',                      'victoria',                      'entre rios', '3153'),
  ('Hasenkamp',                     'hasenkamp',                     'entre rios', NULL)
ON CONFLICT (localidad_norm, provincia) DO NOTHING;
