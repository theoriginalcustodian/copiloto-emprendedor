-- traumas_indexes.sql — la clave de deduplicación de la DLQ (Fase 2, ítem 2.1).
--
-- ⚠️ EL ÍNDICE VA SOBRE (cliente_id, fingerprint), NO SOBRE fingerprint SOLO — corrección del spike
-- S2 (`spikes/RESULT.md`), y no es obvia: el plan original decía `ON CONFLICT (fingerprint)`.
--
-- Con RLS, dos tenants que sufren EL MISMO error tienen el mismo fingerprint (se calcula de
-- workflow + tipo de error, no del tenant). Con un índice único global, el segundo tenant chocaría
-- contra una fila **que su propia policy le impide ver**: `ON CONFLICT DO UPDATE` no puede resolver
-- un conflicto sobre una fila invisible, y el error resultante no se parece en nada a su causa.
-- Con la clave compuesta, cada tenant tiene su propia fila del mismo error y su propio contador.
--
-- El índice ÚNICO además es lo que hace que el upsert sea idempotente de verdad: el spike S3 midió
-- que un `if ya existe` deja una ventana que 8 hilos concurrentes atraviesan (7 `UniqueViolation`).
-- Lo que protege es el índice, no el `if`.
CREATE UNIQUE INDEX IF NOT EXISTS copiloto_traumas_tenant_fingerprint
  ON uc_factory.copiloto_traumas (cliente_id, fingerprint);

-- Para el barrido de la máquina de estados: "los pendientes más viejos primero" y el rescate de los
-- `en_proceso` que quedaron colgados (`updated_at < now() - N`). Sin esto, cada pasada del recuperador
-- hace un seq scan sobre toda la DLQ del tenant.
CREATE INDEX IF NOT EXISTS copiloto_traumas_estado_updated
  ON uc_factory.copiloto_traumas (cliente_id, estado, updated_at);
