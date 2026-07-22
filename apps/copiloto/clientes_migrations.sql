-- Índices de CLIENTES. Idempotente (IF NOT EXISTS): corrible N veces sin efecto.
-- Las TABLAS las crea `deploy/worker/provision_tables.py` desde `uc_tables.json` (con RLS + policy
-- tenant_isolation + grants); acá van sólo los índices, que ese mecanismo no cubre.

-- ── Los dos ÚNICOS parciales de la deduplicación (contrato §3.3) ────────────────────────────────
--
-- Son índices y NO un `if not existe: crear` en el store, y ésa es la decisión del frente. La lección
-- está pagada en este repo con DOS facturas con CAE del mismo trabajo (`idempotencia-con-un-if-tiene-
-- ventana`): entre el SELECT que pregunta y el INSERT que crea hay una ventana, y acá el caso que la
-- abre es concreto — el backfill recorriendo presupuestos mientras el emprendedor da de alta al mismo
-- cliente por voz. Dos filas, ninguna excepción, nadie se entera.
--
-- Con el índice, la segunda CHOCA. El store atrapa el conflicto y relee la que ganó. La atomicidad la
-- pone Postgres, que es el único que puede ponerla.

-- 1. Con documento, la clave es (doc_tipo, doc_nro): la única identificación fuerte que existe. Dos
--    personas pueden llamarse igual; dos CUIT no se repiten.
CREATE UNIQUE INDEX IF NOT EXISTS copiloto_clientes_tenant_doc_ux
    ON uc_factory.copiloto_clientes (cliente_id, doc_tipo, doc_nro)
    WHERE doc_nro IS NOT NULL AND doc_nro <> '';

-- 2. Sin documento, la clave es el nombre normalizado. Parcial y no total: si fuera total, TODOS los
--    clientes sin documento colapsarían contra el mismo '' — que es exactamente el registro fantasma
--    que §3.2 existe para evitar, sólo que por la otra puerta.
CREATE UNIQUE INDEX IF NOT EXISTS copiloto_clientes_tenant_nombre_ux
    ON uc_factory.copiloto_clientes (cliente_id, nombre_normalizado)
    WHERE doc_nro IS NULL OR doc_nro = '';

-- ── El listado ──────────────────────────────────────────────────────────────────────────────────
-- `WHERE cliente_id = ? ORDER BY nombre`. Sin esto es un seq scan sobre la tabla de TODOS los
-- tenants: no se nota con 30 clientes y se nota con 30.000.
CREATE INDEX IF NOT EXISTS copiloto_clientes_tenant_nombre_ix
    ON uc_factory.copiloto_clientes (cliente_id, nombre_normalizado);
