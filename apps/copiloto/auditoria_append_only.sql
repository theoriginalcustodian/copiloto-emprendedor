-- auditoria_append_only.sql — CONS1: `copiloto_auditoria` es append-only, de verdad.
--
-- ⚠️ Por qué NO es un REVOKE UPDATE/DELETE. La app se conecta con `DATABASE_URL`, el MISMO rol que
-- corre `provision.py` y por lo tanto es OWNER de `uc_factory` (ver `provision.py::_ensure_schema`,
-- `AUTHORIZATION ${APP_USER}` + `ALTER SCHEMA ... OWNER TO`). En Postgres el dueño de una tabla
-- ignora sus propios GRANT/REVOKE — es la MISMA trampa ya documentada para RLS
-- (memoria: rls-activado-que-no-filtraba-el-dueno-esta-exento). Un REVOKE acá sería un control que
-- confirma sin verificar: se ve correcto en el catálogo y no frena nada.
--
-- Un trigger SÍ dispara para el dueño (y para superuser): la única forma de saltearlo es deshabilitarlo
-- explícitamente (`ALTER TABLE ... DISABLE TRIGGER`), acción visible y auditable en sí misma. Es el
-- mecanismo idiomático de Postgres para tablas append-only y no depende de qué rol escribe.
CREATE OR REPLACE FUNCTION uc_factory.copiloto_auditoria_bloquear_mutacion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'copiloto_auditoria es append-only: % no permitido (fila id=%)',
    TG_OP, COALESCE(OLD.id, NEW.id);
END;
$$;

DROP TRIGGER IF EXISTS copiloto_auditoria_append_only ON uc_factory.copiloto_auditoria;
CREATE TRIGGER copiloto_auditoria_append_only
  BEFORE UPDATE OR DELETE ON uc_factory.copiloto_auditoria
  FOR EACH ROW EXECUTE FUNCTION uc_factory.copiloto_auditoria_bloquear_mutacion();
