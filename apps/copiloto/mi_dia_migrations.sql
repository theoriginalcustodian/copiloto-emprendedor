-- Índices del hito 7 (Mi día + detector proactivo).
-- Idempotente: corrible N veces.
--
-- Las TABLAS (`copiloto_avisos_emitidos`, `copiloto_mi_dia_tarjetas`) las crea `provision_tables.py`
-- desde `uc_tables.json`.
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

-- ── TARJETAS (Kanban "Mi día", contrato §2) ─────────────────────────────────────────────────────

-- 🔴 Este índice ES la idempotencia de "crear la tarjeta" — mismo motivo que el de arriba, pero
-- PARCIAL (`WHERE regla IS NOT NULL`): las tarjetas MANUALES (creadas por voz, contrato §2.4) no
-- tienen regla ni entidad — cada una es su propia fila, nunca colisiona con otra. Sin el `WHERE`,
-- dos tarjetas manuales (regla=NULL, entidad_tipo=NULL, entidad_id=NULL) chocarían entre sí como si
-- fueran "el mismo candidato" y la segunda pisaría a la primera.
CREATE UNIQUE INDEX IF NOT EXISTS copiloto_mi_dia_tarjetas_regla_entidad_ux
  ON uc_factory.copiloto_mi_dia_tarjetas (cliente_id, regla, entidad_tipo, entidad_id)
  WHERE regla IS NOT NULL;

-- El tablero lee por estado (`para_hoy`/`haciendo`/`hecha`) y por antigüedad (`movida_en`, para la
-- caducidad de 21 días, contrato §2.2) — un solo índice compuesto cubre las dos lecturas del GET.
CREATE INDEX IF NOT EXISTS copiloto_mi_dia_tarjetas_estado_idx
  ON uc_factory.copiloto_mi_dia_tarjetas (cliente_id, estado, movida_en);
