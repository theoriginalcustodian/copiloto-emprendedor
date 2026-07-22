-- Índices de las tablas de PRESUPUESTOS y PERFIL DEL NEGOCIO. Idempotente: corrible N veces.
--
-- Las TABLAS las crea `provision_tables.py` desde `uc_tables.json` (con `id bigserial`, `cliente_id`,
-- RLS y la policy `tenant_isolation`). Lo que ese script NO hace es índices: los pone acá.
--
-- Aplicar:  psql "$DATABASE_URL" -f apps/copiloto/presupuestos_migrations.sql

-- 2026-07-21 — Perfil del negocio: UNA fila por tenant.
-- El índice único no es una optimización: es lo que habilita el `ON CONFLICT (cliente_id) DO UPDATE`
-- del upsert. Sin él, dos POST concurrentes desde dos dispositivos crean DOS perfiles y el `SELECT`
-- devuelve cualquiera de los dos — el clásico "guardé y no se guardó".
CREATE UNIQUE INDEX IF NOT EXISTS copiloto_perfil_negocio_cliente_uk
  ON uc_factory.copiloto_perfil_negocio (cliente_id);

-- 2026-07-21 — Presupuestos: el número es correlativo POR TENANT, no global.
-- Único por (cliente_id, numero): dos emprendedores tienen cada uno su "presupuesto N° 1", y ninguno
-- puede tener dos. Es también la red que atrapa una carrera en la asignación del correlativo — si dos
-- creaciones simultáneas calculan el mismo `max(numero)+1`, la segunda choca acá en vez de duplicar
-- el número en silencio (el store reintenta; ver `PresupuestoStore.crear`).
CREATE UNIQUE INDEX IF NOT EXISTS copiloto_presupuestos_cliente_numero_uk
  ON uc_factory.copiloto_presupuestos (cliente_id, numero);

-- El listado siempre filtra por tenant y ordena por fecha desc (la card más nueva primero).
CREATE INDEX IF NOT EXISTS copiloto_presupuestos_cliente_fecha_ix
  ON uc_factory.copiloto_presupuestos (cliente_id, fecha DESC);

-- `facturado` se DERIVA cruzando `factura_id` contra `afip_comprobantes.workflow_id` (que ya existe y
-- guarda el id del workflow de la factura). Este índice sirve a ese cruce y al 409 de "ya facturado".
CREATE INDEX IF NOT EXISTS copiloto_presupuestos_factura_ix
  ON uc_factory.copiloto_presupuestos (cliente_id, factura_id)
  WHERE factura_id IS NOT NULL;

-- El cruce mira `afip_comprobantes` por `workflow_id`; sin índice es un seq-scan por cada presupuesto
-- del listado.
CREATE INDEX IF NOT EXISTS afip_comprobantes_workflow_ix
  ON uc_factory.afip_comprobantes (cliente_id, workflow_id)
  WHERE workflow_id IS NOT NULL;

-- 2026-07-21 — Ítems: siempre se leen todos los de un presupuesto, en orden.
-- `cliente_id` va PRIMERO en el índice aunque el filtro natural sea `presupuesto_id`: toda query lleva
-- el tenant por delante (es la barrera efectiva de aislamiento, porque el rol owner de DATABASE_URL
-- bypassa RLS), así que el índice tiene que empezar por donde empieza el WHERE.
CREATE INDEX IF NOT EXISTS copiloto_presupuesto_items_cliente_presu_ix
  ON uc_factory.copiloto_presupuesto_items (cliente_id, presupuesto_id, orden);
