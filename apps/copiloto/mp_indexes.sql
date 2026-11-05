-- apps/copiloto/mp_indexes.sql — aplicar en el VPS tras provision_tables (idempotente).
-- ⚠️ DEPENDENCIA DE DEPLOY (deuda gestionada M2, review 2026-07-03): los stores usan `ON CONFLICT
--    (cliente_id, seller_user_id)` / `(cliente_id, payment_id)`, que EXIGEN estos índices únicos.
--    provision_tables.py NO los crea → si se provisiona SIN aplicar este archivo, cada save()/upsert tira
--    "no unique or exclusion constraint matching the ON CONFLICT" (falla RUIDOSA). El deploy DEBE correr
--    provision_tables Y este SQL juntos (lo hace scratchpad/provision_mp.sh). Pago antes del go-live:
--    plegar la creación del índice al flujo de provisioning de la app. Propietario: operador.
CREATE UNIQUE INDEX IF NOT EXISTS mp_credentials_tenant_seller
  ON uc_factory.mp_credentials (cliente_id, seller_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS mp_payments_tenant_payment
  ON uc_factory.mp_payments (cliente_id, payment_id);

-- Task 7 (spike C): MP /checkout/preferences NO deduplica -> dedup app-side por (cliente_id, idem_key).
CREATE TABLE IF NOT EXISTS uc_factory.mp_link_dedup (
    cliente_id          text        NOT NULL,
    idem_key            text        NOT NULL,
    preference_id       text        NOT NULL,
    init_point          text        NOT NULL,
    external_reference  text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (cliente_id, idem_key)
);

-- SEC-A2-2 (auditoría de seguridad 2026-11-04): esta tabla quedó con RLS habilitado, SIN policy y SIN
-- FORCE. El owner (`uc_factory`, el rol del worker) la bypasseaba: el aislamiento dependía sólo del
-- filtro `cliente_id` explícito del store. Mismo patrón que las demás tablas del copiloto
-- (`provision_tables.py`): policy `tenant_isolation` con USING + WITH CHECK y FORCE, idempotente.
-- Los accesos pasan por `conexion_con_tenant` (worker_b), que declara el tenant al abrir la conexión.
ALTER TABLE uc_factory.mp_link_dedup ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON uc_factory.mp_link_dedup;
CREATE POLICY tenant_isolation ON uc_factory.mp_link_dedup
  FOR ALL USING (cliente_id = uc_factory.current_cliente_id()::text)
  WITH CHECK (cliente_id = uc_factory.current_cliente_id()::text);
ALTER TABLE uc_factory.mp_link_dedup FORCE ROW LEVEL SECURITY;
