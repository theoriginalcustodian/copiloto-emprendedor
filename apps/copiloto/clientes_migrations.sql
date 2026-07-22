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
--
--    🔴 Y lleva `homonimo` (int, default 0) en la clave, que es lo que le da SALIDA al humano sin
--    aflojarle nada al backfill. La dedup por nombre existe para la derivación automática —ahí no hay
--    nadie mirando y sin ella el backfill inventa cartera leyendo cinco presupuestos de la misma
--    panadería—. Pero dos clientes SÍ se pueden llamar igual de verdad: dos «Juan Pérez», dos
--    «Kiosco». Aplicarle al alta explícita de un humano la regla pensada para el backfill lo dejaba
--    trabado y sin maniobra, pidiéndole un CUIT que no tiene.
--
--    Con `homonimo` en la clave: el backfill inserta SIEMPRE con 0, así que sigue colapsando igual de
--    fuerte; y un alta que el emprendedor confirmó como «es otro» entra con 1, 2, 3… La atomicidad no
--    se toca — la sigue poniendo el índice, no un `if`.
DROP INDEX IF EXISTS uc_factory.copiloto_clientes_tenant_nombre_ux;
CREATE UNIQUE INDEX IF NOT EXISTS copiloto_clientes_tenant_nombre_hom_ux
    ON uc_factory.copiloto_clientes (cliente_id, nombre_normalizado, homonimo)
    WHERE doc_nro IS NULL OR doc_nro = '';

-- ── El vínculo con lo que ya está vivo (§5, strangler) ──────────────────────────────────────────
-- `copiloto_presupuestos.cliente_ref` la agrega `provision.py::_ensure_presupuestos_cliente_ref_column`
-- (tiene que correr ANTES del pase estándar, ver ahí). Acá va sólo su índice: la ficha del cliente
-- pregunta «los presupuestos de ESTE cliente», y sin índice eso es un seq scan por cada ficha que se
-- abre. Parcial, porque las filas viejas y las de consumidor final lo tienen en NULL para siempre.
CREATE INDEX IF NOT EXISTS copiloto_presupuestos_cliente_ref_ix
    ON uc_factory.copiloto_presupuestos (cliente_id, cliente_ref)
    WHERE cliente_ref IS NOT NULL;

-- ── El listado ──────────────────────────────────────────────────────────────────────────────────
-- `WHERE cliente_id = ? ORDER BY nombre`. Sin esto es un seq scan sobre la tabla de TODOS los
-- tenants: no se nota con 30 clientes y se nota con 30.000.
CREATE INDEX IF NOT EXISTS copiloto_clientes_tenant_nombre_ix
    ON uc_factory.copiloto_clientes (cliente_id, nombre_normalizado);
