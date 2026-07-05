-- deploy/copiloto/gotrue/init-auth-schema.sql
-- Corre UNA vez en el primer init del Postgres dedicado (docker-entrypoint-initdb.d).
-- GoTrue arranca con search_path=auth y AUTO-MIGRA todo el resto de sus tablas a ese
-- schema; solo necesita que el schema exista de antemano. Idempotente por si acaso.
CREATE SCHEMA IF NOT EXISTS auth;
