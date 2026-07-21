-- apps/copiloto/afip_indexes.sql — índices de las tablas AFIP. Idempotente (IF NOT EXISTS).
-- Se pliega a provision.py (`_apply_afip_indexes`), NO se aplica a mano: la deuda M2 de mp_indexes.sql
-- documentó exactamente ese error — provisionar sin aplicar el SQL deja los `ON CONFLICT` rotos en
-- runtime con "no unique or exclusion constraint matching the ON CONFLICT".

-- Upserts de los stores: un certificado y un perfil por (tenant, CUIT).
CREATE UNIQUE INDEX IF NOT EXISTS afip_credentials_tenant_cuit
  ON uc_factory.afip_credentials (cliente_id, cuit);
CREATE UNIQUE INDEX IF NOT EXISTS afip_perfil_tenant_cuit
  ON uc_factory.afip_perfil (cliente_id, cuit);

-- Claim-check de la clave fiscal: el handle es la clave de búsqueda del consume().
CREATE UNIQUE INDEX IF NOT EXISTS afip_secret_handoff_tenant_handle
  ON uc_factory.afip_secret_handoff (cliente_id, handle);
-- Barrido de vencidos sin secuencial (la tabla es chica, pero el purgador corre seguido).
CREATE INDEX IF NOT EXISTS afip_secret_handoff_expira
  ON uc_factory.afip_secret_handoff (expira_at);

-- Un comprobante es único por (tenant, CUIT, tipo, punto de venta, número). Esto NO reemplaza la
-- idempotencia del workflow: es la última red antes de la DB si algo más intentara duplicar.
CREATE UNIQUE INDEX IF NOT EXISTS afip_comprobantes_unico
  ON uc_factory.afip_comprobantes (cliente_id, cuit, tipo_cbte, punto_venta, nro);

-- Dedup por idempotency key. Parcial: sólo aplica a las filas que la traen.
CREATE UNIQUE INDEX IF NOT EXISTS afip_comprobantes_idem
  ON uc_factory.afip_comprobantes (cliente_id, idem_key) WHERE idem_key IS NOT NULL;

-- Listado "mis comprobantes": el orden natural es el más reciente primero.
CREATE INDEX IF NOT EXISTS afip_comprobantes_listado
  ON uc_factory.afip_comprobantes (cliente_id, cuit, created_at DESC);
