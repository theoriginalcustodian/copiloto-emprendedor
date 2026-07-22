-- Índices del hito 3 del sprint de Inteligencia de Negocio: COBROS, ESTADO DE PRESUPUESTO y CATÁLOGO.
-- Idempotente: corrible N veces.
--
-- Las TABLAS (`copiloto_cobros`, `copiloto_conceptos`) las crea `provision_tables.py` desde
-- `uc_tables.json`. La COLUMNA `estado` de presupuestos la agrega `provision.py::_ensure_presupuesto_estado`
-- (una columna nueva en una tabla que ya existe NO puede ir al manifiesto: el guard anti-colisión la
-- vería faltante en la tabla viva y abortaría el deploy con "colisión de tabla").
--
-- Aplicar:  psql "$DATABASE_URL" -f apps/copiloto/inteligencia_migrations.sql

-- ── COBROS ───────────────────────────────────────────────────────────────────────────────────────

-- 🔴 Este índice ES la idempotencia. No es una optimización.
--
-- Marcar cobrada dos veces no puede dejar dos cobros, y "si ya existe, devolvelo" resuelto con un
-- `SELECT` + `if` en Python TIENE CARRERA: entre el SELECT y el INSERT entra la otra request. Ya lo
-- pagamos facturando: dos borradores → dos CAE. Acá la segunda inserción con la misma `idem_key`
-- choca contra el índice (SQLSTATE 23505) y el store devuelve el cobro que ya estaba.
--
-- PARCIAL (`WHERE idem_key IS NOT NULL`) a propósito: sin `idem_key`, dos cobros del mismo monto son
-- un caso REAL (dos pagos parciales iguales) y el backend no puede distinguirlo de un doble toque.
-- Esa distinción sólo la sabe quien hizo el gesto — por eso la app manda la clave.
CREATE UNIQUE INDEX IF NOT EXISTS copiloto_cobros_idem_uk
  ON uc_factory.copiloto_cobros (cliente_id, idem_key)
  WHERE idem_key IS NOT NULL;

-- Todo cobro se lee por comprobante, con el tenant por delante (la barrera efectiva de aislamiento:
-- el rol owner de DATABASE_URL bypassa RLS, así que el filtro por `cliente_id` es lo que aísla).
CREATE INDEX IF NOT EXISTS copiloto_cobros_cliente_comprobante_ix
  ON uc_factory.copiloto_cobros (cliente_id, comprobante_id);

-- ── PRESUPUESTOS: el estado ──────────────────────────────────────────────────────────────────────

-- El listado filtra por estado ("mostrame los que no me contestaron") y ordena por fecha.
CREATE INDEX IF NOT EXISTS copiloto_presupuestos_cliente_estado_ix
  ON uc_factory.copiloto_presupuestos (cliente_id, estado, fecha DESC);

-- ── CATÁLOGO DE CONCEPTOS ────────────────────────────────────────────────────────────────────────

-- Un concepto por nombre y por emprendedor. Sobre el nombre NORMALIZADO, no el crudo: "Pintura de
-- living" y "pintura de living" son el mismo concepto, y si entraran los dos la serie de precios del
-- grafo (hito 5) quedaría partida en dos — que es exactamente el problema que el catálogo viene a
-- resolver.
--
-- Incluye los INACTIVOS a propósito: si el único índice fuera sobre los activos, desactivar y volver
-- a crear el mismo nombre dejaría DOS filas con la misma historia partida. Reactivar el existente es
-- lo correcto, y para eso tiene que chocar.
CREATE UNIQUE INDEX IF NOT EXISTS copiloto_conceptos_cliente_nombre_uk
  ON uc_factory.copiloto_conceptos (cliente_id, nombre_normalizado);

-- El listado de Ajustes → Mi negocio: los activos primero, alfabético.
CREATE INDEX IF NOT EXISTS copiloto_conceptos_cliente_activo_ix
  ON uc_factory.copiloto_conceptos (cliente_id, activo, nombre_normalizado);

-- ── IMPUTACIÓN DE GASTOS AL TRABAJO (addendum del hito 3) ────────────────────────────────────────

-- 🔴 EXCLUYENTES, y garantizado por el MOTOR, no por el endpoint.
--
-- El addendum lo pide con test ("no se puede imputar a los dos a la vez"), pero un chequeo sólo en
-- Python deja entrar cualquier otra vía: la tool del copiloto, un backfill, una corrección a mano.
-- Y el síntoma no sería un error: sería el MISMO GASTO CONTADO DOS VECES en el margen, que se ve
-- exactamente igual que un margen malo. Un check en la tabla no se puede esquivar.
--
-- `ADD CONSTRAINT` no tiene `IF NOT EXISTS` en Postgres, de ahí el bloque: sin él, el segundo deploy
-- moriría con "constraint already exists" — y esto corre en CADA deploy.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'copiloto_gastos_un_solo_trabajo') THEN
    ALTER TABLE uc_factory.copiloto_gastos
      ADD CONSTRAINT copiloto_gastos_un_solo_trabajo CHECK (
        (CASE WHEN presupuesto_ref IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN comprobante_ref IS NOT NULL THEN 1 ELSE 0 END)
      + (CASE WHEN cobro_ref       IS NOT NULL THEN 1 ELSE 0 END) <= 1);
  END IF;
END $$;

-- "Los gastos de este trabajo" es la consulta del margen, y va por cada eslabón.
CREATE INDEX IF NOT EXISTS copiloto_gastos_cliente_presupuesto_ix
  ON uc_factory.copiloto_gastos (cliente_id, presupuesto_ref) WHERE presupuesto_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS copiloto_gastos_cliente_comprobante_ix
  ON uc_factory.copiloto_gastos (cliente_id, comprobante_ref) WHERE comprobante_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS copiloto_gastos_cliente_cobro_ix
  ON uc_factory.copiloto_gastos (cliente_id, cobro_ref) WHERE cobro_ref IS NOT NULL;

-- Los cobros sueltos (dictados, sin comprobante) que apuntan a un presupuesto: la otra mitad del
-- margen cuando el trabajo nunca se facturó.
CREATE INDEX IF NOT EXISTS copiloto_cobros_cliente_presupuesto_ix
  ON uc_factory.copiloto_cobros (cliente_id, presupuesto_ref) WHERE presupuesto_ref IS NOT NULL;
