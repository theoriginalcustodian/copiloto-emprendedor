-- Índices del hito 7 (Mi día + detector proactivo).
-- Idempotente: corrible N veces.
--
-- La TABLA (`copiloto_avisos_emitidos`) la crea `provision_tables.py` desde `uc_tables.json`.
--
-- Aplicar:  psql "$DATABASE_URL" -f apps/copiloto/mi_dia_migrations.sql

-- 🔴 Este índice ES la idempotencia del silenciado, no una optimización.
--
-- El detector corre una vez por día y puede volver a encontrar el MISMO candidato (mismo trabajo,
-- mismo presupuesto) mientras sigue vigente. Sin este índice, "emitir" sería un INSERT ciego y cada
-- corrida agregaría una fila nueva — la tabla crecería sin límite y "¿está silenciado?" tendría que
-- mirar la fila MÁS RECIENTE en vez de una sola verdad. Con el índice, `emitir()` hace
-- `INSERT ... ON CONFLICT (cliente_id, regla, entidad_tipo, entidad_id) DO UPDATE` — una fila por
-- candidato, siempre.
CREATE UNIQUE INDEX IF NOT EXISTS copiloto_avisos_emitidos_regla_entidad_ux
  ON uc_factory.copiloto_avisos_emitidos (cliente_id, regla, entidad_tipo, entidad_id);

-- La lectura del detector es siempre "¿este candidato sigue silenciado?" — por cliente+regla+entidad.
-- El índice único de arriba ya cubre esa consulta (es su propio índice de lookup); no hace falta uno
-- aparte.
