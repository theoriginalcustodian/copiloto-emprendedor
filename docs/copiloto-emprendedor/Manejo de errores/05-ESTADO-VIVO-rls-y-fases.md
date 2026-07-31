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

### 2.3 🔴 EL PRÓXIMO PASO EXACTO — 98 tests rojos, y son la buena noticia

```
98 failed, 1189 passed, 16 skipped, 8 errors
ERROR: new row violates row-level security policy for table "mp_credentials"
```

**El RLS está funcionando y frena a los tests**, porque siembran datos **sin declarar tenant**. Es la
prueba de que el mecanismo actúa; antes esas escrituras pasaban porque el RLS no existía en la práctica.

**Lo que falta hacer (el trabajo restante del PR #162):**

1. Que los tests declaren el tenant al sembrar — usar `with tenant(cliente_id):` o la factory
   envuelta. Archivos afectados (al menos 9): `test_actividad_store`, `test_afip_stores_integracion`,
   `test_cobros_y_catalogo`, `test_context_factory`, `test_grafo_log`, `test_imputacion_y_margen`,
   `test_inteligencia_queries`, `test_mp_credential_store`, `test_mp_payment_store`.
2. ⚠️ **Antes de tocarlos, revisar uno por uno si el rojo es del test o de la APP.** Si un store
   escribe sin que el borde haya declarado el tenant, el bug es del código, no del test. Ese es el
   valor real de este rojo: **está mostrando qué caminos operan sin tenant declarado**.
3. Recién con el CI verde: mergear, desplegar (paso 1, el flag apagado), verificar por efecto que la
   GUC llega, y **encender `UC_RLS_FORCE=1`** (paso 2).

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
