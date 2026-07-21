-- Migraciones ADITIVAS de las tablas AFIP. Idempotente: corrible N veces sin efecto.
--
-- Por qué no alcanza con `uc_tables.json` + `provision_tables.py`: ese script usa
-- `CREATE TABLE IF NOT EXISTS`, que sobre una tabla YA existente no agrega nada — y su guard
-- anti-colisión aborta con "colisión de tabla" al ver columnas declaradas que faltan. Ese guard es
-- correcto (detecta que otra app pisó el nombre en el schema compartido), pero significa que una
-- columna nueva sobre una tabla viva se agrega acá, no allá. El manifiesto sigue siendo la fuente de
-- verdad para una instalación desde cero; esto reconcilia las que ya existen.
--
-- Aplicar:  psql "$DATABASE_URL" -f apps/copiloto/afip_migrations.sql

-- 2026-07-21 — archivado del PDF en el Drive del emprendedor.
-- La URL de AfipSDK expira a las 24 h y no la re-hosteamos: sin esta copia, la factura deja de existir
-- para el usuario al día siguiente.
ALTER TABLE uc_factory.afip_comprobantes ADD COLUMN IF NOT EXISTS drive_file_id text;
ALTER TABLE uc_factory.afip_comprobantes ADD COLUMN IF NOT EXISTS drive_link text;

-- El ajuste vive en el perfil (es por CUIT, igual que el punto de venta). Default FALSE: subir los
-- datos fiscales de alguien a una cuenta de Drive es una decisión del usuario, nunca un default.
ALTER TABLE uc_factory.afip_perfil
  ADD COLUMN IF NOT EXISTS guardar_en_drive boolean NOT NULL DEFAULT false;
