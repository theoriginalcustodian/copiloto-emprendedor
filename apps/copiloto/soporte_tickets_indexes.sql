-- soporte_tickets_indexes.sql — SOP3 (bloque B del sprint de soporte técnico).
--
-- El código SOP-XXXX se reserva ATÓMICAMENTE en `copiloto_ticket_secuencia` (provision.py, DDL
-- bespoke junto a `tenants`) antes de insertar la fila del ticket -- ver soporte_store.py. Este
-- índice único es la segunda línea de defensa, no la primera: si algún día un caller inserta un
-- ticket sin pasar por la secuencia, un choque de código explota acá en vez de silenciarse.
--
-- Compuesto por (cliente_id, codigo) y no por `codigo` solo -- mismo motivo que
-- `copiloto_traumas_tenant_fingerprint`: con RLS, dos tenants pueden compartir el MISMO código
-- (ambos generan su "SOP-0001" el mismo día) y un índice único global rechazaría al segundo tenant
-- por una fila que ni siquiera puede ver.
CREATE UNIQUE INDEX IF NOT EXISTS copiloto_tickets_tenant_codigo
  ON uc_factory.copiloto_tickets (cliente_id, codigo);

-- Para listar los mensajes de un ticket en orden, filtrado por tenant. Sin esto, cada apertura de
-- ticket hace un seq scan sobre toda la tabla de mensajes del tenant.
CREATE INDEX IF NOT EXISTS copiloto_mensajes_tenant_ticket
  ON uc_factory.copiloto_mensajes (cliente_id, ticket_id, created_at);

-- Para la Consola (A4/A6, más adelante): "los tickets más recientes primero", cross-tenant.
CREATE INDEX IF NOT EXISTS copiloto_tickets_tenant_estado
  ON uc_factory.copiloto_tickets (cliente_id, estado, created_at);

-- ⚠️ H1 real, no teórico (control adversarial, 2026-08-07): la policy `tenant_isolation` de
-- `copiloto_mensajes` sólo valida que `cliente_id` sea el propio -- NO que `ticket_id` pertenezca a
-- UN TICKET de ese mismo tenant. Sin esto, el tenant B puede insertar un mensaje con su propio
-- `cliente_id` y el `ticket_id` de un ticket de A: la fila pasa el `WITH CHECK` (cliente_id es
-- correcto) y "responde" un ticket ajeno sin que RLS lo note -- RLS filtra POR FILA, no valida
-- relaciones entre tablas. La FK compuesta es la que ata ambas columnas: el `ticket_id` que B
-- declara tiene que existir como fila de copiloto_tickets con ESE MISMO cliente_id, o la base
-- rechaza el INSERT antes de que la policy tenga oportunidad de aceptarlo.
--
-- `ADD CONSTRAINT` no tiene `IF NOT EXISTS` en Postgres -- mismo patrón que
-- `inteligencia_migrations.sql`.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'copiloto_tickets_cliente_id_id_key')
  THEN
    ALTER TABLE uc_factory.copiloto_tickets
      ADD CONSTRAINT copiloto_tickets_cliente_id_id_key UNIQUE (cliente_id, id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'copiloto_mensajes_ticket_del_mismo_tenant')
  THEN
    ALTER TABLE uc_factory.copiloto_mensajes
      ADD CONSTRAINT copiloto_mensajes_ticket_del_mismo_tenant
        FOREIGN KEY (cliente_id, ticket_id)
        REFERENCES uc_factory.copiloto_tickets (cliente_id, id);
  END IF;
END $$;
