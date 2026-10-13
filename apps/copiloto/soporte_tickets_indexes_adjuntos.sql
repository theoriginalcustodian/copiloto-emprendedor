-- soporte_tickets_indexes_adjuntos.sql — PROTO4DEPS §4 (adjuntos del chat de soporte).
--
-- ⚠️ El NOMBRE importa: `provision._apply_sql_files` aplica los `.sql` por orden alfabético y la FK de
-- acá referencia `copiloto_tickets_cliente_id_id_key`, que crea `soporte_tickets_indexes.sql`. Con
-- el sufijo `_adjuntos` éste sorta DESPUÉS (`.` < `_`). Si lo renombrás para que sorte antes, una base
-- NUEVA falla en el `ADD CONSTRAINT` (la viva no lo notaría: el constraint ya existe ahí).
--
-- La tabla se declara en `uc_tables.json` (RLS + FORCE los pone `provision_tables`). Lo que el
-- manifiesto no sabe expresar vive acá:

-- Para listar los adjuntos de un ticket de este tenant sin seq scan.
CREATE INDEX IF NOT EXISTS copiloto_ticket_adjuntos_tenant_ticket
  ON uc_factory.copiloto_ticket_adjuntos (cliente_id, ticket_id, created_at);

-- Mismo agujero H1 que `copiloto_mensajes` (ver `soporte_tickets_indexes.sql`): la policy
-- `tenant_isolation` sólo valida que `cliente_id` sea el propio, NO que `ticket_id` sea de un ticket de
-- ese tenant. Sin la FK compuesta, B podría insertar un adjunto con SU `cliente_id` y el `ticket_id` de
-- un ticket de A y la fila pasaría el `WITH CHECK`. La FK ata ambas columnas: el ticket tiene que existir
-- con ESE mismo `cliente_id`, o la base rechaza el INSERT antes de que la policy lo acepte.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'copiloto_ticket_adjuntos_ticket_del_mismo_tenant')
  THEN
    ALTER TABLE uc_factory.copiloto_ticket_adjuntos
      ADD CONSTRAINT copiloto_ticket_adjuntos_ticket_del_mismo_tenant
        FOREIGN KEY (cliente_id, ticket_id)
        REFERENCES uc_factory.copiloto_tickets (cliente_id, id);
  END IF;
END $$;
