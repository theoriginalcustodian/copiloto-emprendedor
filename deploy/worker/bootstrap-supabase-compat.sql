-- Compatibilidad mínima con Supabase para levantar el schema en un Postgres PELADO.
--
-- Por qué existe (2026-07-28): `provision_tables.py` no sólo crea tablas — también activa RLS con
-- una policy que llama `auth.jwt()` y otorga permisos a `anon` / `authenticated` / `service_role`.
-- Nada de eso es Postgres: es **Supabase**. En el VPS lo trae la instancia de Supabase; en un
-- Postgres limpio no existe, y el provisionado muere con `schema "auth" does not exist`.
--
-- Consecuencia práctica, y es la que importa: **el runbook de "levantar el copiloto en un entorno
-- nuevo" nunca se pudo ejecutar** sin una instancia de Supabase completa. Este archivo lo desbloquea
-- para tests, CI, staging y DR.
--
-- ⚠️ **NO se corre contra la base de producción.** Ahí `auth` ya existe con la implementación real de
-- GoTrue, y todo lo de abajo es `IF NOT EXISTS` / `CREATE OR REPLACE` sobre objetos que **no** hay que
-- pisar. Su lugar es un Postgres efímero.
--
-- **Fidelidad, que es lo que hace que el test valga:** `auth.jwt()` no devuelve un valor inventado —
-- lee `request.jwt.claims`, exactamente la misma GUC que usa la implementación real de Supabase. Por
-- eso un test puede hacer `set_config('request.jwt.claims', '{"cliente_id":"..."}', true)` y ejercitar
-- la policy **de verdad**. Un stub que devolviera un tenant fijo probaría el stub, no el aislamiento
-- (que es justo el modo de fallo que este frente viene combatiendo).

-- ── Roles de Supabase ────────────────────────────────────────────────────────────────────────────
-- `NOLOGIN`: son roles de permisos, nadie se conecta con ellos. `DO` + catálogo porque
-- `CREATE ROLE` no admite `IF NOT EXISTS`.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

-- ── Schema y funciones de auth ───────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth;

-- Los claims del JWT del request. `true` en el tercer argumento de `set_config` = alcance de
-- transacción, que es como los setea PostgREST/Supabase en la vida real.
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

-- `auth.uid()` no la usa la policy de `uc_factory`, pero sí aparece en `.sql` sueltos del repo.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(auth.jwt() ->> 'sub', '')::uuid;
$$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
