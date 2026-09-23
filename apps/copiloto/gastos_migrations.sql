-- Índices de GASTOS. Idempotente (IF NOT EXISTS): corrible N veces sin efecto.
-- Las TABLAS las crea `deploy/worker/provision_tables.py` desde `uc_tables.json` (con RLS + policy
-- tenant_isolation + grants); acá van sólo los índices, que ese mecanismo no cubre.

-- El listado: `WHERE cliente_id = ? ORDER BY fecha DESC`. Sin esto es un seq scan sobre la tabla de
-- TODOS los tenants — no se nota con 30 gastos y se nota con 30.000.
CREATE INDEX IF NOT EXISTS copiloto_gastos_tenant_fecha_ix
    ON uc_factory.copiloto_gastos (cliente_id, fecha DESC);

-- El resumen: `GROUP BY categoria` acotado por rango de fecha. Es la pantalla que se abre en cada
-- confirmación de gasto, así que es la consulta más caliente de la feature.
CREATE INDEX IF NOT EXISTS copiloto_gastos_tenant_categoria_fecha_ix
    ON uc_factory.copiloto_gastos (cliente_id, categoria, fecha);

-- 2026-09-22 — IDEM-gasto-duplica-plata: idempotencia del alta. La MISMA intención (doble toque de
-- "Guardar" sobre una card recargada, reintento de red) no abre un segundo gasto. Parcial: los
-- clientes viejos no mandan `idem_key` (NULL) y no deben bloquearse entre sí. Es índice único y no
-- sólo un SELECT previo porque entre la consulta y el INSERT hay una ventana por la que pasan justo
-- las dos altas concurrentes que esto evita (mismo criterio que `copiloto_presupuestos_cliente_idem_uk`
-- en `presupuestos_migrations.sql`).
CREATE UNIQUE INDEX IF NOT EXISTS copiloto_gastos_cliente_idem_uk
    ON uc_factory.copiloto_gastos (cliente_id, idem_key)
    WHERE idem_key IS NOT NULL;
