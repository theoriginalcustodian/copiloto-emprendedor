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
