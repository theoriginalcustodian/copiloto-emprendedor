# 05 — ESTADO VIVO · dónde quedó todo (2026-07-31)

> **Punto de retome.** Escrito para sobrevivir a una compactación de contexto: si algo no está acá, se
> perdió. Lo que está **en `main`** y lo que está **a mitad de camino**, con el próximo paso exacto.

---

## 1. Lo CERRADO y en producción

| Bloque | PR | Evidencia |
|---|---|---|
| Fases 0 · 0.5 · G-2 · 1 del frente de errores | #154-#159 | VPS 1143 → CI 1269 |
| Flag `MODO_AUTOMATICO_NO_DISPONIBLE` **retirado** | #159 | retest 0/10 contra el LLM real; prod: `POST /perfil-negocio` con `automatico` → **200** |
| Reporte + plan al día + memoria | #160 | `03-REPORTE-implementacion.md` |
| Guard de drift + metodología INL | #155, #153 | (estaban abiertos y sin mergear; se cerraron) |
| **Fase 1.5 — las dos costuras** | **#161** | VPS 1166 passed · verificado en el binario desplegado |

**Fase 1.5, en una línea:** la captura de errores pasó de **2 rutas cableadas a mano** (de 80) a **dos
costuras** — `interceptor_errores.py` (todas las activities) y `handler_errores_web.py` (las 80 rutas).
Una feature nueva **nace cubierta**.

**1.5c se canceló al leer el código que iba a borrar:** los dos `log_error` de `presupuestos_web.py`
no eran redundantes — viven en `except` que **degradan y no re-lanzan**, así que la costura no los ve.
Regla que quedó escrita: *si tu `except` re-lanza, no cablees; si degradás y seguís, cableá.*

---

## 2. 🔴 LO QUE ESTÁ A MITAD — el PR #162 (RLS)

**Rama:** `fix/rls-real-force-y-tenant` · **PR #162** · **CI en ROJO a propósito** (ver §2.3).

### 2.1 El hallazgo

Medido en producción: una consulta **sin ningún JWT**, con las credenciales de la app, devolvió filas
de **3 tenants distintos**.

| Dato | Valor |
|---|---|
| Tablas en `uc_factory` | **77**, todas con RLS activado |
| Con `FORCE` | **5** (las de `documed`) |
| Owner de las 77 | `uc_factory` — **el mismo rol que usa la app** |
| Policies sin `WITH CHECK` | **65 de 70** |
| ¿`uc_factory` es superuser/bypassrls? | **No** (`False, False`) — por eso el fix es viable |

Postgres **exime al dueño de sus propias policies** salvo `FORCE`. El RLS existía en el catálogo y no
filtraba nada. **No había fuga** (el aislamiento lo dan los `WHERE cliente_id` de los stores), pero
**no había segunda línea**.

**Y estaba documentado:** el docstring de `test_adversarial_multitenant.py` ya decía *"el worker usa el
rol OWNER (**bypassa RLS**)"*. Deuda **conocida y sin pagar** — sin TODO, sin dueño, sin fecha.

### 2.2 Lo implementado (ya commiteado en la rama)

| Pieza | Archivo |
|---|---|
| `ContextVar` con el tenant + la conexión lo declara a la base | `apps/copiloto/contexto_tenant.py` **(nuevo)** |
| Borde HTTP: `require_tenant` **pasó a `async`** y declara el tenant | `apps/copiloto/auth.py` |
| Borde activities: la costura C3 declara el tenant | `apps/copiloto/interceptor_errores.py` |
| Las dos `conn_factory` envueltas | `serve.py`, `worker_b.py` |
| `FORCE` + `WITH CHECK` + `uc_factory.current_cliente_id()` | `deploy/worker/provision_tables.py` |
| Tests (5 unitarios + 2 con Postgres) | `tests/test_contexto_tenant.py` **(nuevo)** |
| CI con rol **no-superuser** | `.github/workflows/tests.yml` |

**Validado por el spike S6** (`spikes/s6-rls-real-con-conexion-directa/`) contra un rol que replica
producción: el tenant ve sólo lo suyo · el `ContextVar` sobrevive a `asyncio.to_thread` · **sin tenant,
0 filas** · escribir como otro es **rechazado**.

**Dos hallazgos que habrían sido catástrofes silenciosas:**
1. **`require_tenant` tuvo que pasar a `async`.** Una dependencia **sync** de FastAPI corre en
   threadpool y su `ContextVar` **no llega** al handler (medido: `{'visto': None}`). Con `FORCE` activo
   y la dependencia sync, **la app habría dejado de ver sus propios datos**, sin error.
2. **El spike S6 dijo "no funciona nada"** en su primera corrida — su rol era **superuser**, y los
   superusuarios saltean RLS **incluso con `FORCE`**. Hay un test que vigila eso permanentemente.

### 2.3 Los 98 rojos: **una sola causa**, no 98 problemas

```
98 failed, 1188 passed, 17 skipped, 8 errors
ERROR: new row violates row-level security policy for table "mp_credentials"
```

**El RLS estaba funcionando y frenaba a los tests**, porque sembraban datos **sin declarar tenant**.
La causa era única: 16 archivos repetían su propio `conn_factory` con `psycopg2.connect()` **crudo**.
Producción no usa eso —`serve.py` y `worker_b.py` envuelven con `conexion_con_tenant(...)`— así que
**los tests ejercitaban un camino que no existe en producción**, y por eso ninguno podía haber
detectado que el RLS no aplicaba: no pasaban por la pieza que lo hace aplicar.

**El fix, en un solo lugar:** el fixture `conn_de_tenant` de `apps/copiloto/conftest.py`.
`conn_de_tenant(cid)` devuelve la fábrica **de ese tenant**, equivalente exacto del borde real. Los
16 archivos lo usan; ninguno vuelve a abrir una conexión cruda.

### 2.4 ⚡ La suite ahora corre LOCAL en 24 segundos (no 8 minutos en el CI)

`deploy/copiloto/test-db.sh` y `sync-test-backend.sh` ya existían; les faltaba **el rol**. La base
entregaba la URL de `postgres`, que es **superuser** — y un superuser saltea RLS *incluso con FORCE*.
Su propio comentario lo decía sin alarma: *"los tests abren la conexión como admin, que bypassea RLS
igual"*. **El instrumento que iba a reemplazar al CI tenía el mismo defecto que el CI.**

```bash
bash deploy/copiloto/test-db.sh --recreate     # Postgres 17 efímero, rol copiloto_app NO-superuser
export UC_TEST_DATABASE_URL='<la url que imprime>'
bash deploy/copiloto/sync-test-backend.sh "tests ../../motor -q"
```

Aborta si el rol puede saltear RLS. `--admin` vuelve al rol viejo **y lo dice en pantalla**.
`UC_TEST_STAGE` da a cada sesión su stage propio en el VPS. El CI de GitHub queda como **gate final**,
no como consola de errores.

### 2.5 🔑 Hallazgo mayor: `tenants` NO puede tener `FORCE` — nunca

`resolve_cliente_id()` (`auth.py:56`) consulta `uc_factory.tenants` con el `sub` del JWT **para
averiguar** el `cliente_id`; recién después el borde puede declarar el tenant. Control diferencial
sobre la base de tests:

| | filas visibles para `copiloto_app` |
|---|---|
| admin — **control positivo** | 1 ← la fila existe |
| `tenants` **sin** FORCE (como está hoy) | **1** ← el login funciona |
| `tenants` **con** FORCE | **0** ← `resolve_cliente_id` → `None` → **403 a TODOS** |

Hoy se sostiene **por accidente**: `tenants` quedó fuera de `uc_tables.json`, que es lo que el
provisionado recorre para aplicar `FORCE`. Agregarla —un cambio que **se lee como una mejora de
seguridad**— tumba la autenticación entera, y ningún test de store lo notaría.

**Guard permanente:** `tests/test_rls_invariantes.py`, con tres invariantes: el efecto
(`relforcerowsecurity` en `tenants`), la causa (que no entre al manifiesto) y que ninguna policy
`FOR ALL` con `FORCE` quede sin `WITH CHECK`.

### 2.6 Bugs de la APP que el rojo destapó (no eran de los tests)

| Dónde | Qué pasaba con `FORCE` | Estado |
|---|---|---|
| `apps/copiloto/derivar_clientes.py` | consulta **global** sin tenant → 0 filas → imprime *"no hay tenants con presupuestos ni comprobantes"* y **sale con éxito** | ✅ arreglado: enumera desde `tenants` y pregunta por cada uno con su tenant declarado |
| `deploy/copiloto/limpiar_residuos_test.py` | todos sus `count(*)` darían 0 → parte *"0 huérfanas de 0"*, indistinguible de "está limpio" | ✅ control determinista: aborta si el rol no puede saltear RLS y hay tablas con `FORCE` |

Los dos son el mismo modo de fallo: **el vacío que no protesta**. Ninguno tira error.

### 2.7 ✅ El paso 2 (encender `FORCE` en prod) ya está de-riskeado

El riesgo real no era el `FORCE`: era que las **policies vivas** no entendieran nuestra GUC. Medido
contra producción el 2026-07-31:

| | |
|---|---|
| tablas en `uc_factory` | **77**, todas con RLS, sólo **5** con `FORCE` (las de documed) |
| `tenants` con `FORCE` | **no** ✔ coherente con el guard de §2.5 |
| policies con `auth.jwt() ->> 'cliente_id'` | **64** |
| `uc_factory.current_cliente_id()` en prod | **todavía no existe** (la crea el provisionado nuevo) |

La pregunta que decidía todo: **¿`auth.jwt()` lee la misma GUC que seteamos?** Su definición en
producción:

```sql
select coalesce(nullif(current_setting('request.jwt.claim',  true), ''),
                nullif(current_setting('request.jwt.claims', true), ''))::jsonb
```

Y el control **por efecto**, seteando la GUC igual que `contexto_tenant.declarar_en_conexion`:

```
auth.jwt() ->> cliente_id  = 11111111-1111-1111-1111-111111111111
sin claims                 = None
```

**Las 64 policies viejas funcionan tal cual con el mecanismo nuevo** — no hay que migrarlas antes de
encender `FORCE`, y sin claims dan `NULL` (fail-closed, que es lo correcto). Las 18 tablas del
manifiesto además pasan a `current_cliente_id()`, que lee esa misma GUC: los dos caminos conviven.

**Lo que falta del PR #162:** CI verde → mergear → desplegar (paso 1, flag apagado) → verificar por
efecto que la GUC llega en el binario desplegado → **encender `UC_RLS_FORCE=1`** (paso 2).

⚠️ **El pre-push está trabado:** sincroniza el grafo y es *fail-closed*; Graphity responde **HTTP 000**
(ni conecta). Los dos commits de hoy se pusharon con `--no-verify`, que es el bypass que el propio hook
documenta para fallo transitorio. **Deuda abierta:** reingestar el grafo con `--since` cuando vuelva.

**Por qué el flag:** activar `FORCE` antes de que el código que declara el tenant esté corriendo
dejaría la app viendo 0 filas en todo. `TODO(rls-force, backend, 2026-07-31)` para retirarlo cuando
las 77 tablas estén migradas.

---

## 3. Diseño y spikes (en `main`, PR #160/#161)

- **`04-DISENO-costuras-y-autohealing.md`** — el rediseño por **costura** (no por feature), los
  disparadores nuevos, los modelos (`gpt-4o-mini` forjador / `gpt-4o` auditor) y por qué el autohealing
  **no espera 30 días** (el mapa de fallos ya acotó la superficie).
- **`spikes/RESULT.md`** — S1..S5 con evidencia. Los dos que cambiaron el diseño:
  - **S5:** el forjador **falla con diff unificado** y **pasa con SEARCH/REPLACE** (12 tests verdes).
    El cuello de botella era **el formato de entrega**, no el modelo. El auditor **rechazó 3/3**
    parches rotos (lógica, fiscal, y el que modifica el test) → es un gate, no un sello.
  - **S3:** con el `if ya existe` y la ventana forzada, **los 8 hilos lo atravesaron** (7
    `UniqueViolation`). Protege **el índice único**, no el `if`. Por eso el `DIAGNOSTIC_ONLY` fiscal
    pasó de precaución a **conclusión medida**: `existe_comprobante` consulta a **AFIP**, no a la DB.

---

## 4. Cola pendiente, en orden

| # | Qué | Estado |
|---|---|---|
| 1 | **Cerrar el PR #162** (§2.3) | 🔴 en curso — 98 tests por revisar |
| 2 | Encender `UC_RLS_FORCE` en prod y verificar por efecto | bloqueado por 1 |
| 3 | **Fase 2 — DLQ** (`copiloto_traumas`) | listo para arrancar; nace con `FORCE` + índice `(cliente_id, fingerprint)` (correcciones de S2) |
| 4 | **Fase 3 — Autosanación** | diseñada; disparador = Fase 2 cerrada |
| 5 | Reingestar el grafo con `--since` | bloqueado: **Graphity da 503** (Caddy responde, el servicio detrás no). El operador lo está resolviendo aparte |

---

## 5. Reglas de esta sesión que no se pueden perder

- **Batchear.** No abrir un PR por cada cambio chico (instrucción explícita del operador, 2026-07-31).
- **El deploy es manual desde la PC**; el CI **no despliega**: corre la suite contra base virgen y
  bloquea el merge.
- **Checkout compartido:** `git add` con rutas explícitas vía `GIT_INDEX_FILE` temporal. Nunca `-A`,
  `--amend`, `rebase`, `reset`, `checkout`, `pull`, `stash`.
- **Dos venvs y no son equivalentes:** `/opt/uc-worker-venv` **no** tiene `psycopg2` ni `openai`; el
  del deploy es **`/opt/uc-copiloto-venv`**.
- **El exit code miente** en al menos dos lugares medidos hoy: el spike S1 aborta con 134 en el
  teardown **después** de imprimir su veredicto, y una notificación de background reportó "exit 0"
  sobre un sync que había fallado con 1. Leer la salida, no el código.
