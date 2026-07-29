-- apps/copiloto/replies_indexes.sql — índices de `copiloto_web_replies` (idempotente).
--
-- Mismo patrón y mismo motivo que `mp_indexes.sql`, cuyo encabezado ya describía este modo de fallo
-- palabra por palabra: **`provision_tables.py` crea tablas con sus columnas, NO índices**, así que un
-- `ON CONFLICT` que dependa de un índice único falla con *"no unique or exclusion constraint matching
-- the ON CONFLICT specification"* si nadie lo creó.
--
-- Por qué está acá y no en `_ensure_reply_idem_key` (2026-07-28): los `_ensure_*` corren **antes** del
-- pase estándar, cuando en una base fresca la tabla todavía no existe. La versión anterior salteaba la
-- creación del índice en ese caso "porque lo crea el pase estándar" — **suposición falsa que costó una
-- corrida de CI**: el pase estándar no crea índices. Los `.sql` de esta carpeta, en cambio, se aplican
-- al FINAL de `provision()`, con las tablas ya creadas. Ese es el lugar correcto.
--
-- El índice es PARCIAL (`WHERE idem_key IS NOT NULL`): las filas anteriores a la migración no tienen
-- clave, y un índice único sobre NULLs las bloquearía entre sí. Y es un índice único —no un `SELECT`
-- previo— porque "si ya existe no insertes" deja una ventana entre la consulta y el INSERT por la que
-- pasan justo los dos intentos concurrentes que esto viene a evitar.
CREATE UNIQUE INDEX IF NOT EXISTS copiloto_web_replies_idem_key_uk
  ON uc_factory.copiloto_web_replies (cliente_id, idem_key)
  WHERE idem_key IS NOT NULL;
