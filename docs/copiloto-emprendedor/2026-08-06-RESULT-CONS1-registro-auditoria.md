# CONS1 — Registro de auditoría de la Consola de Operador

**De:** Backend · **2026-08-06.** Precondición de CONS7 (las 3 acciones que mutan). `PLAN.md`
§Consola: *"lo único que no existe hoy... por eso es precondición de toda acción que muta"*.

## §0 Reutilización — qué se evaluó y se descartó

`copiloto_eventos`/`evento_store.py` (log append-only ya existente, alimenta el grafo de negocio) se
revisó antes de proponer una tabla nueva. **No sirve**: registra eventos de NEGOCIO del tenant
(comprobante/gasto/presupuesto/cobro), explícitamente fuera del boundary de la consola
(`PLAN.md`: *"la consola opera la APP, no los DATOS de negocio de los tenants"*). Auditar acciones de
**administrador** es un concern disjunto por diseño — mezclarlo violaría ese boundary, no lo cumpliría.

Se reutilizó en cambio: el mecanismo genérico de tablas (`uc_tables.json` + `provision_tables.py`,
igual que toda tabla del repo), el patrón de store de `trauma_store.py`, y el rol `copiloto_consola`
de CONS0a (extendido de 3 a 4 tablas).

## Decisión no obvia: trigger, no `REVOKE`, para el append-only

`copiloto_auditoria` tiene que ser append-only — es un registro de auditoría, y una fila editable o
borrable no audita nada. El primer diseño fue `REVOKE UPDATE, DELETE ... FROM anon, authenticated,
service_role`, calcado del estilo de grant/revoke del resto del repo.

**Se descartó tras verificar contra el mecanismo real de conexión.** La app se conecta con
`DATABASE_URL`, el mismo rol que corre `provision.py` — y por lo tanto **dueño** del schema
`uc_factory` (`provision.py::_ensure_schema`, `AUTHORIZATION ${APP_USER}` + `ALTER SCHEMA ... OWNER
TO`). En Postgres, el dueño de una tabla ignora sus propios `GRANT`/`REVOKE`. Es la misma trampa que
ya mordió a RLS ([[rls-activado-que-no-filtraba-el-dueno-esta-exento]]): un `REVOKE` acá habría sido
un control que confirma en el catálogo sin frenar nada en la práctica — exactamente el patrón de
"instrumento que confirma en vez de verificar".

**Solución: un trigger `BEFORE UPDATE OR DELETE` que siempre lanza** (`auditoria_append_only.sql`).
A diferencia de `GRANT`/`REVOKE`, un trigger dispara para el dueño de la tabla y para superuser — la
única forma de saltearlo es deshabilitarlo explícitamente (`ALTER TABLE ... DISABLE TRIGGER`), una
acción visible y auditable en sí misma. Verificado con la conexión MÁS peligrosa (la del dueño, no
una acotada): `test_copiloto_auditoria_es_append_only_NI_EL_DUENO_puede_mutarla`.

## Divergencia deliberada de `trauma_store.py`

`trauma_store.depositar()` nunca lanza (regla 1: un fallo del manejo de errores no puede generar más
errores). `AuditoriaStore.registrar()` hace lo opuesto — **lanza** si el INSERT falla. Razón: acá el
registro ES la precondición de la mutación, no una captura de error secundaria. Si no se puede dejar
constancia de una acción de administrador, la mutación no debe seguir en silencio. El llamador
(CONS7, todavía sin construir) decide si aborta o reintenta, pero nunca deja pasar la mutación sin
su rastro.

## Qué se entrega

- `apps/copiloto/uc_tables.json` — `copiloto_auditoria` (`admin_user_id`, `admin_email`, `accion`,
  `detalle jsonb`, `resultado`), vía el mecanismo genérico (`id`+`cliente_id`+RLS+policy+grants).
- `apps/copiloto/auditoria_append_only.sql` — el trigger.
- `apps/copiloto/auditoria_indexes.sql` — `(cliente_id, created_at)` y `(admin_user_id, created_at)`.
- `apps/copiloto/auditoria_store.py` — `AuditoriaStore.registrar()`/`.listar()`.
- `deploy/copiloto/provision-rol-consola.sh` + `verificar-rls.sh` + `test-db.sh` — `copiloto_consola`
  pasa de 3 a 4 tablas con `SELECT`.
- Tests: `test_auditoria_store.py` (registrar/listar, aislamiento por tenant, lectura cross-tenant
  vía consola, `registrar()` lanza) + 2 tests nuevos en `test_rls_invariantes.py` (grants exactos en
  4 tablas, append-only ni-el-dueño-puede-mutar).

## Lo que NO incluye (deliberado, fuera de scope de CONS1)

Ningún endpoint llama a `AuditoriaStore.registrar()` todavía — eso es CONS7 (las 3 acciones que
mutan), que no existe aún. CONS1 entrega el mecanismo, no el cableado.

## Pendiente de ejecutar contra producción (fusion)

`provision-rol-consola.sh` con el nuevo GRANT necesita correr en `fusion` para que el rol
`copiloto_consola` vivo tenga acceso a `copiloto_auditoria` — igual patrón que CONS0a, requiere
autorización explícita del operador antes de mutar prod (§3 CLAUDE.md).
