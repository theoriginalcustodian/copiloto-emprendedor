-- apps/copiloto/grafo_sync_indexes.sql — índices únicos de BETA-G0 (idempotente).
--
-- Mismo patrón y mismo motivo que `replies_indexes.sql`: `provision_tables.py` crea tablas con sus
-- columnas, NO índices — así que un `ON CONFLICT` que dependa de un índice único falla con "no unique
-- or exclusion constraint matching the ON CONFLICT specification" si nadie lo creó. Estos dos índices
-- son lo que hace atómico el upsert de `grafo_sync_store.GrafoSyncStore` (cursor y vigencia, uno por
-- tenant / uno por clave de estado).
CREATE UNIQUE INDEX IF NOT EXISTS copiloto_grafo_cursor_cliente_uk
  ON uc_factory.copiloto_grafo_cursor (cliente_id);

CREATE UNIQUE INDEX IF NOT EXISTS copiloto_grafo_vigencia_clave_uk
  ON uc_factory.copiloto_grafo_vigencia (cliente_id, entidad_tipo, entidad_id, campo);
