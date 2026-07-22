-- Índices de ACTIVIDAD RECIENTE. Idempotente (IF NOT EXISTS).
--
-- La unión ordena por la fecha de NEGOCIO de cada tabla, así que cada rama necesita su índice por
-- `(cliente_id, <su fecha> DESC)`. Sin ellos, cada `UNION ALL` es un seq scan sobre la tabla de TODOS
-- los tenants — y son cinco, en la pantalla que se abre primero.

-- Facturas y notas de crédito: la unión filtra por `cae IS NOT NULL` y ordena por `fecha_emision`.
CREATE INDEX IF NOT EXISTS afip_comprobantes_tenant_emision_ix
    ON uc_factory.afip_comprobantes (cliente_id, fecha_emision DESC);

CREATE INDEX IF NOT EXISTS copiloto_presupuestos_tenant_fecha_ix
    ON uc_factory.copiloto_presupuestos (cliente_id, fecha DESC);

-- `copiloto_gastos (cliente_id, fecha DESC)` ya existe desde `gastos_migrations.sql` — no se repite.

-- Clientes: la rama filtra `origen <> 'derivado'`, así que el índice va PARCIAL. El backfill puede
-- dejar cientos de derivados y ninguno entra a la lista: indexarlos sería pagar por filas que la
-- consulta descarta siempre.
CREATE INDEX IF NOT EXISTS copiloto_clientes_tenant_actividad_ix
    ON uc_factory.copiloto_clientes (cliente_id, created_at DESC)
    WHERE origen <> 'derivado';
