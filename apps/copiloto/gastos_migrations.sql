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
