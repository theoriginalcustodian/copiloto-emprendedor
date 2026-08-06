-- auditoria_indexes.sql — CONS1: índices de lectura de `copiloto_auditoria`.
--
-- Dos formas de leer que CONS6 (web) va a necesitar: "las acciones sobre ESTE tenant" (tenant-scoped,
-- vía RLS normal) y "las acciones de ESTE admin" (cross-tenant, vía `copiloto_consola`). Sin esto,
-- cada lectura hace seq scan sobre una tabla que sólo crece (append-only, nunca se poda).
CREATE INDEX IF NOT EXISTS copiloto_auditoria_tenant_created
  ON uc_factory.copiloto_auditoria (cliente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS copiloto_auditoria_admin_created
  ON uc_factory.copiloto_auditoria (admin_user_id, created_at DESC);
