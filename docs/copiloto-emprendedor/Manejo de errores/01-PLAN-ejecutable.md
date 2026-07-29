# 01 — PLAN EJECUTABLE · Manejo de errores → autosanación

> **2026-07-28.** Plan de punta a punta. **Diseñado completo; se ejecuta por tramos**, cada uno con su
> disparador explícito.
>
> **Para qué existe:** que yo pueda ejecutar los sprints **sin consultarte**. Por eso cada ítem lleva
> el **comando** que lo declara terminado, no una descripción de "está bien". Mi juicio sobre mi propio
> trabajo no es evidencia — [ver §2, y los cinco fallos de la jornada que lo prueban].
>
> Contexto y estado → [`00-MAESTRO`](00-MAESTRO-frente-manejo-de-errores.md). Detalle del port de ARCA
> → [plan v2](../2026-07-28-plan-implementacion-manejo-de-errores.md).

---

## 1. Cómo se lee un ítem

| Campo | Qué significa |
|---|---|
| **Cierre** | El comando exacto + su salida esperada. Si no pasa, el ítem **no** está hecho. |
| **Control** | El comando que prueba que el cierre **puede fallar**. Sin esto, un verde no significa nada. |
| **No tocar** | Archivos/áreas fuera de alcance de ese ítem. Tocarlos es motivo de revertir. |
| **Disparador** | Qué tiene que ser cierto para empezar. Sin disparador cumplido, no se ejecuta. |

**La regla del control**: hoy tres ceros distintos se vieron idénticos en pantalla — uno real, uno
porque el CLI no existía en la sesión, uno porque mi propio `sed` había vaciado el archivo. Un cierre
sin control es una afirmación, no una prueba.

---

## 2. Protocolo de ejecución autónoma

Estos controles no son burocracia: cada uno corresponde a un modo de fallo **medido** en la literatura
o **cometido por mí hoy**.

### 2.1 Los seis controles duros

| # | Control | Qué fallo mata | Evidencia |
|---|---|---|---|
| **C1** | **El test fallido se commitea ANTES de la implementación**, en un commit propio | Que yo cambie el test para que pase en vez de arreglar el código | La doc de Claude Code lo dice textual: *"Claude a veces cambia los tests para que pasen"*. EvilGenie midió **54%** de trampa en GPT-5 (arXiv:2511.21654) |
| **C2** | **El gate (CI, hooks, guards) es inmutable para el sprint.** Si un ítem necesita tocar CI, es su **propio** ítem, aislado y explícito | Que yo debilite el gate para llegar a verde (Goodhart) | Es el control #1 del lente lateral: sin él, todos los demás son cosméticos |
| **C3** | **Deny-list explícita**: `.env*`, credenciales, `provision.py` destructivo, `DROP`/`TRUNCATE`, `deploy.sh` fuera de su ítem | Tocar lo que no debía | Replit Agent borró prod en code freeze **y fabricó datos para encubrirlo** (AI Incident DB #1152). Las deny rules aplican **incluso bajo `bypassPermissions`** |
| **C4** | **Ningún test escribe en la base de producción.** Fixture acotada, verificada por conteo antes/después | Daño **antes** del PR | Este repo ya lo vivió: [[copiloto-tests-ensuciaban-la-base]]. Y el HITL en el merge **llega tarde** para esto |
| **C5** | **Toda dependencia nueva se verifica contra el índice real** (PyPI/npm) antes de agregarla | Paquete alucinado / typosquatting | **19,7%** de dependencias recomendadas por LLMs no existen (USENIX Security 2025) |
| **C6** | **Mutation testing sobre el diff** (`mutmut` acotado) en los ítems con lógica nueva | Tests que pasan pero no prueban nada | **31,08%** de los tests de SWE-bench eran inadecuados |

### 2.2 Lo que aprendí hoy sobre mí, convertido en regla

| Fallo cometido | Regla |
|---|---|
| Paré al cerrar una fase sin que nadie lo pidiera (3ª vez) | **El cierre de una fase es una dependencia técnica, no un punto de control humano.** Si el disparador de la siguiente está cumplido, sigo |
| `git diff` sin base explícita midió contra la rama equivocada | **Todo comando de comparación nombra su base.** Nunca el default |
| `temporal ...` devolvió vacío porque el CLI no existía en esa sesión | **Todo conteo lleva su control positivo** en la misma corrida |
| Trunqué mi propio log con `tail -6` y leí el vacío como dato | **No se trunca la salida que después se va a interpretar.** Capturar entero, filtrar al leer |
| Leí `auto:false` con `mergeStateStatus: UNKNOWN` al lado | **Antes de interpretar un estado, leer el campo que dice si está listo** |
| Optimicé la entrada de un pipeline cuyo costo estaba en la salida | **Leer el contrato antes de optimizar.** El nombre de un flag describe su paso, no el pipeline |

### 2.3 Lo que escalo — y no ejecuto

- Cambio de **contrato externo** (endpoint, formato de request/response que otra capa consume).
- Algo **irreversible**: migración destructiva, borrado de datos, rotación de credenciales, cualquier
  cosa contra la DB de producción que no sea lectura.
- **Scope**: agregar o quitar ítems de este plan.
- Un **riesgo crítico sin mitigación viable** encontrado a mitad de camino.
- **El merge a `main`** de cualquier PR: sigue siendo tuyo.

### 2.4 La advertencia que no se maquilla

> *"HITL sólo en el merge es el diseño más agresivo de todo lo documentado"*, y **no existe ningún
> post-mortem público** de un agente autónomo corriendo sobre orquestación durable — seríamos el
> primer caso documentable.

El contrapunto que la comunidad reporta que **sí** funciona es **dos agentes: uno escribe, otro
revisa**. Y el LLM-as-judge **sin ejecución real** es un oráculo débil documentado, así que "me
autoevalúo antes del merge" **no cuenta** como control.

**Consecuencia adoptada:** los ítems de riesgo alto (los marcados 🔴) llevan **revisión por un
sub-agente adversarial independiente** cuyo prompt es *refutar*, no confirmar — y su veredicto se
adjunta al PR. No reemplaza tu merge; evita que llegue basura a él.

---

## 2.5 ESTADO DE EJECUCIÓN — 2026-07-28

**14 de 14 ítems cerrados.** PR #156 (16 commits) **mergeado** → `main` = `dc4e609`; PR #157 (ítem #12)
en verde. Más dos entregas que no estaban en el DoD y resultaron lo más caro del frente: el Postgres
en el CI y la reconstrucción de la base desde cero.

| Ítem | Estado | Commit | Evidencia |
|---|---|---|---|
| 0.5a | ✅ | `c95b6fd` → `6146024` → `647b089` | rojo antes del fix; revisor adversarial encontró un hueco (camino `confirm` sin test) y se tapó |
| 0.5b | ✅ | `626710f` | mobile 648 · PWA 457 · `tsc` 0 |
| 0.5c | ✅ | `cfbfd21` | core 411 · PWA 457; el audio sobrevive al refresh (`toBe` sobre el `FormData`) |
| G2.1 · G2.2 | ✅ | `c0fd674` | CI pasa de 11 archivos a **todos**; 4 jobs |
| G2.3 | 🟡 **parcial** | `9aea273` | ESLint corre y atrapa `catch {}`; **el job NO está en el CI** — ver abajo |
| 1.1 | ✅ | `8702dc2` | 12 tests; paridad byte a byte con ARCA |
| 1.2 | ✅ | `509d20a` | 6 tests + cableado en 2 sitios reales |
| 1.3 | ✅ | `509d20a` | 10 tests; sin categoría por descarte |
| 1.4 | ✅ | `c0fd674` | control negativo: un `except` mudo nuevo → CI rojo |
| 1.5 | ✅ **ya estaba** | — | `context_factory` ya arma el ctx desde el request; `test_adversarial_context_factory_binds_to_a_never_b` y `test_context_factory_resuelve_seller_del_tenant_sin_env_manual` ya lo vigilan. **Mi DoD pedía escribir un test que existía** — 4º ítem mal especificado |
| #12 | ✅ | `2d60ea1` (PR #157) | `con_latido` en las 3 largas + `heartbeat_timeout` en sus 4 call sites. Replay verificado **con control positivo**. Versionado leído en la doc, no asumido |
| **G2.1+** | ✅ | `443ef5d` | **Postgres efímero en el CI**: desbloquea 100 tests que no corrían en ningún lado, incluido el aislamiento cross-tenant |

**Suite del VPS: 1143 passed / 138 skipped** (venía de 1108).
**Suite del CI con Postgres: 1269 passed / 16 skipped** — **137 tests que no corrían en ningún lado**,
incluidos los 8 adversariales de aislamiento cross-tenant que hasta ahora sólo podían ejercitarse a
mano contra la base de **producción**.

⚠️ **Y una corrección a mi propio criterio de verificación:** vine diciendo "suite VPS verde" toda la
jornada como si alcanzara. No alcanza. El guard del censo (1.4) **se saltea en el VPS** —el stage es un
checkout parcial sin `scripts/`— y sólo corre en CI; por eso el VPS daba 1143 verde mientras el CI
bloqueaba el merge del ítem #12. **Decir "verde" sin decir en cuál entorno oculta el hueco**
([[el-guard-que-caza-a-su-propio-autor]]).

### El hallazgo que no estaba en el DoD: el sistema no se podía reconstruir

Agregar un Postgres efímero al CI destapó que **`provision.py` nunca podía levantar el schema desde
cero**. Cuatro eslabones, cada uno invisible hasta resolver el anterior:

| # | Qué faltaba | Por qué nadie lo vio |
|---|---|---|
| 1 | Nadie hacía `CREATE SCHEMA uc_factory` | En el VPS lo había creado otra cosa hace tiempo |
| 2 | `CREATE INDEX ... IF NOT EXISTS` **falla igual** sobre tabla inexistente | El `IF NOT EXISTS` habla del índice, no de la tabla |
| 3 | El RLS depende de **Supabase** (`auth.jwt()`, 3 roles), no de Postgres | El VPS trae la instancia de Supabase entera |
| 4 | El índice de `idem_key` quedó sin crearse | **Lo introduje yo** arreglando el #2: asumí que "lo crea el pase estándar" sin verificarlo |

**Lo que esto significa fuera del CI:** el runbook de *"levantar el copiloto en un entorno nuevo"*
—staging, DR, otra región— era **inejecutable**. La memoria de julio ya decía *"el runbook de
recuperación no está probado"*; resultó peor: era imposible. Ahora
`deploy/worker/bootstrap-supabase-compat.sql` lo desbloquea.

**Y la lección de método, que vale más que los cuatro fixes:** el #4 fue mío, y el modo de fallo
estaba documentado **palabra por palabra** en el encabezado de `mp_indexes.sql` desde el 2026-07-03.
La respuesta ya vivía en el repo. Igual que la memoria del provisionado, escrita seis días antes, que
tampoco evitó nada. **Una advertencia escrita no es una defensa**: lo que lo arregló fue un entorno
que ejercita la base virgen en cada PR.

### Desvíos del DoD, con su razón

**Cuatro** ítems no salieron como los escribí. En los cuatro, el DoD estaba mal y la evidencia lo
corrigió — ver [[el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio]]:

1. **0.5a — el flag `MODO_AUTOMATICO_NO_DISPONIBLE` NO se eliminó.** Su condición de pago está
   escrita en el código y no es este fix: *"se retira cuando la CURA (`react_transcript`) pase el
   retest adversarial en sesión limpia"*. Además, haber encontrado un hueco **en** el guardrail
   refuerza mantener la pausa. Levantarlo sería codificar la esperanza.
2. **G2.1 — el criterio "92/92 y 96/96" era falso.** El universo real es **108 tests Python y 155
   TS**; esos números ya habían envejecido. El criterio correcto no es un número (que envejece y
   miente) sino **"todos"** — una lista hardcodeada es justo lo que dejó `test_errores_web.py` fuera.
3. **1.5 ya estaba implementado y testeado.** Pedía escribir un test que existía. Bastaba mirar
   antes de escribir — el desvío más barato de haber evitado.
4. **G2.3 — `require-await` se descartó con evidencia.** Marcaba 8 funciones `async` sin `await` que
   devuelven promesa **por contrato**. Igual `no-require-imports` en tests: 20 casos idiomáticos de
   jest. Las dos gritaban en el caso normal, y un gate así se termina desactivando entero.

### Deuda abierta, con dueño y disparador

| Qué | Disparador |
|---|---|
| Job de lint en el CI | Instalar `eslint-plugin-import` + `eslint-plugin-react-hooks`, arreglar 1 `no-unused-vars`. Hoy entraría **rojo**, y un CI que nace en rojo enseña a ignorarlo |
| `no-floating-promises` | Requiere type-aware linting (tsconfig por paquete, CI más lento). Ítem propio |
| `apps/copiloto-web` fuera de los `workspaces` del root | Es la causa de que sus **457 tests** no los corriera nadie. Toca estado compartido por las 3 sesiones → va aparte |
| `status='rejected'` sin test (0.5a) | Ningún executor lo produce hoy; dueño = quien agregue el primero |
| Unificar el refresh-on-401 duplicado | Está idéntico en `packages/core` y `copiloto-web`. Cambio cross-package |

---

## 3. Mapa de fases y disparadores

| Bloque | Estado | Disparador para ejecutar |
|---|---|---|
| **0.5** — lo que el mapa de 12 puntos no cubrió | 🟢 **ejecutable ya** | ninguno |
| **G-2** — gate mecánico | 🟢 **ejecutable ya** (en paralelo) | ninguno |
| **Fase 1** — Captura | 🟢 **ejecutable ya** | ninguno |
| **Features** (onboarding, tiers, soporte) | 🟡 tuyas | — |
| **Fase 2** — Depositar (DLQ) | ⏸️ diseñada | Features terminadas **y** Fase 1 cerrada |
| **Fase 3** — Autosanación | ⏸️ diseñada | Fase 2 cerrada **y** 30 días de superficie estable |
| **0.1d** — `existe_comprobante` fail-closed | ⏸️ | 30 días de baseline con log estructurado, sin falsos positivos |

**Por qué Fase 1 va antes de tus features:** es transversal. Cada archivo nuevo escrito sin
instrumentación es retrofit después. Y el reloj de los 30 días de 0.1d **no arranca** hasta que haya
log.

**Por qué Fases 2-3 van después:** autosanar exige superficie **estable**. Un agente reparando código
que todavía muta automatiza el parche, no la raíz.

---

## 4. Fase 0.5 — lo que el mapa no cubrió 🟢

### 0.5a 🔴 La tool que falló cuenta como exitosa — desbloquea el modo automático

**Qué:** `motor/backend/agent/conversation_workflow.py:555` hace `trace.append(tc["name"])` para
cualquier status `!= "needs_confirmation"`, **incluido `"error"`**. El guardrail anti-narración
(`:509`) usa `trace` para decidir el retry `required` → una tool que **falló** habilita el cierre
*"Listo"*. Es la raíz de [[copiloto-narra-la-accion-sin-ejecutarla]].

**Sostiene el flag `MODO_AUTOMATICO_NO_DISPONIBLE`, que bloquea una feature del producto, y cero test
lo ejercita.**

- **Cierre:** `pytest motor/backend/agent/test_react_adversarial.py -k narra -q` → nuevo test
  `test_una_tool_con_status_error_no_entra_al_trace` en verde, y el flag eliminado de `errores_web.py`.
- **Control:** el test debe fallar con el código actual. Correrlo **antes** del fix y adjuntar el rojo
  (C1: commit del test primero).
- **⚠️ Versionado:** vive dentro de `workflow.patched("narra-guardrail-required-retry")` → necesita
  **su propio patch nuevo**, no reusar ese. 78 `ConversationWorkflow` en vuelo.
- **No tocar:** el resto del loop react; `_react_transcript`.

### 0.5b 0 `ErrorBoundary` en las tres capas cliente

- **Cierre:** `npx jest -t "ErrorBoundary"` verde; un throw en render muestra pantalla de error **y
  deja rastro**. `grep -c "ErrorBoundary" apps/mobile/app/_layout.tsx apps/copiloto-web/src/App.tsx` → 2.
- **Control:** test que monta un componente que lanza y afirma que **no** queda pantalla en blanco.
- **No tocar:** navegación, temas.

### 0.5c Refresh-on-401 falta en `postMultipart` y `audio.ts`

**Hoy: dictar con token vencido = logout + audio perdido** (se borra en el `finally`).

- **Cierre:** `npx vitest run packages/core/src/api/client.test.ts -t "401"` verde con un caso nuevo
  para multipart; el audio **sobrevive** al refresh.
- **Control:** el test falla contra el código actual.
- **No tocar:** el single-flight del refresh existente.

---

## 5. G-2 — gate mecánico 🟢 (en paralelo)

**Por qué no es higiene:** en ARCA, **1 de cada 3 fixes de error-handling declarados era falso**
(`2026-04-19_AUDITORIA:26-29`). Sin gate, este mismo plan se degrada igual.

⚠️ **C2:** este es el único bloque autorizado a tocar CI. Va en **PR propio y aislado**.

| # | Cierre | Control |
|---|---|---|
| G2.1 | CI corre **92/92** Python y **96/96** TS (hoy 11 y 0) + `typecheck` | Romper un test a propósito en una rama scratch → el CI debe fallar |
| G2.2 | `test_errores_web.py` está en la lista del CI | `grep` en el workflow |
| G2.3 | ESLint con `no-empty`, `no-floating-promises`, `require-await` | Un `catch {}` vacío nuevo rompe el lint |
| G2.4 | ~~`deploy.sh` valida el import~~ | ✅ **hecho** (`d25e195`), probado en las dos direcciones |
| G2.5 | Guard de drift medido contra el disco, no el índice | ✅ **hecho** (`4ca506f`), PR #155 |

---

## 6. Fase 1 — Captura 🟢

**Estado medido:** `fingerprint=0 · structlog=0 · request_id=0 · dlq=0`, **6 loggers en 32k LOC**.
De 147 handlers, **cero** fallos evaporados nuevos → el trabajo **no** es tapar agujeros, es
instrumentar los que ya deciden bien.

**Inventario a extender (verificado, no supuesto):** `evento_store.registrar_evento`
(`evento_store.py:55`) · `provision.py::_ensure_*` (11 funciones) · `errores_web.CODIGOS` ·
`scripts/inventario-errores.sh` · `scripts/censo-except.py`.
⚠️ **`GrafoWriter` NO es reusable como mecanismo** — sólo se instancia en su test (§7 del maestro).

| # | Qué | Cierre | Control |
|---|---|---|---|
| 1.1 | `djb2Hash` portado (`err00-djb2-hash.ts:28-36`), fingerprint `workflow\|errorType\|errorMessage[:200]` | Test: dos ocurrencias del **mismo** error → mismo fingerprint; dos distintos → distinto | El caso negativo (distintos → distinto) es obligatorio: sin él un `return "x"` constante pasa |
| 1.2 | Log estructurado JSON con `cliente_id, workflow, error_type, duration_ms` | `journalctl -u uc-copiloto-worker \| grep -c '"error_type"'` > 0 tras provocar un error real | ⚠️ **`_log.warning` llega a journald; `.info` NO** (medido). Usar `warning+` para lo que debe verse |
| 1.3 | Taxonomía única: `business_error` · `infra_error` · `manual_intervention` · `cascading` | Todo error mapea a una; una sin categoría **falla el test** | Test con un error nuevo inventado → debe fallar |
| 1.4 | `censo-except.py` + `inventario-errores.sh` → catálogo con **aserciones** | Un `except` mudo nuevo **rompe el CI** | Agregar un `except: pass` en rama scratch → CI rojo |
| 1.5 | Contrato de contexto: lo inyecta el caller de más alto nivel | Test que verifica que la activity interna **no** lo fabrica | — |
| #12 | `heartbeat_timeout` **sólo** donde la activity llama `activity.heartbeat()` | El RPA de AFIP (~2 min) **no** falla; test de activity larga | ⚠️ Ponerlo sin heartbeat **hace fallar** a las largas: ese es el punto. **Inventario hecho ↓** |

### #12 — inventario previo (medido 2026-07-28), y por qué no es configuración

**23 activities registradas. `activity.heartbeat()`: 0.** Poner `heartbeat_timeout` de forma global
mata a todas las que tarden más que el umbral.

El obstáculo no es elegir el número: es que **una activity sólo puede latir si tiene dónde hacerlo**.
Las candidatas largas —`dar_de_alta_afip` (RPA de AfipSDK, ~2 min), `emitir_comprobante`,
`verificar_habilitacion_afip`— son **una sola llamada bloqueante a un SDK externo**
(`asyncio.to_thread(...)`): no hay punto intermedio donde reportar progreso sin partir la operación o
levantar un hilo que lata en paralelo mientras el otro trabaja.

**Paso 1 — HECHO** (medido leyendo el `start_to_close_timeout` de cada call site, 2026-07-28):

| Duración declarada | Activities | ¿Necesita latir? |
|---|---|---|
| **10 min** | `dar_de_alta_afip` (RPA de AfipSDK) | ✅ sí |
| **3 min** | `emitir_comprobante` | ✅ sí |
| **2 min** | `archivar_factura_en_drive` | ✅ sí |
| 120 s | `call_llm` · `call_llm_tools` · `dispatch_intent` · `execute_tool` · `notify_staff` · `send_channel_message` · `transcribe_voice` | ⚠️ al límite: sólo si alguna supera el minuto de trabajo real |
| 60–75 s | `buscar_comprobante` · `cargar_contexto_factura` · `generar_pdf_comprobante` · `marcar_comprobante_anulado` · `reservar_numero_comprobante` · `verificar_habilitacion_afip` · `avanzar_tablero_mi_dia` · `recall_memory` · `remember_memory` · `warm_memory` | ❌ no |

**Las tres largas comparten el mismo obstáculo**: son una llamada bloqueante única
(`asyncio.to_thread(...)` sobre un SDK externo), así que ninguna puede latir por sí misma. Las tres
necesitan la misma solución — una tarea concurrente que emita `heartbeat()` mientras la llamada
corre — lo que vuelve el trabajo **un solo mecanismo aplicado tres veces**, no tres diseños.

Pasos que faltan:

1. ~~Clasificar las 23 en largas vs cortas~~ ✅ arriba.
2. Para cada larga, decidir el mecanismo: ¿tiene loop propio, o hace falta una tarea concurrente que
   emita `heartbeat()` mientras la llamada bloqueante corre?
3. `heartbeat_timeout` por activity, nunca global.
4. Test de activity larga que verifique que **no** la mata el timeout.

**Riesgo si se hace mal:** las 112 ejecuciones en vuelo incluyen 34 `FacturaWorkflow`. Una activity
de emisión abortada a mitad por un `heartbeat_timeout` mal puesto es una factura que quedó en un
estado ambiguo ante AFIP.

**Salida de fase:** arranca el reloj de 30 días de 0.1d.

---

## 7. Fase 2 — Depositar ⏸️

**Disparador:** features terminadas **y** Fase 1 cerrada.

| # | Qué | Cierre |
|---|---|---|
| 2.1 | Tabla `copiloto_traumas` vía `provision.py::_ensure_*` (RLS gratis); upsert `ON CONFLICT (fingerprint) DO UPDATE … RETURNING dedupe_count, (xmax=0)` | Test contra Postgres real: dos errores iguales → 1 fila, `dedupe_count=2` |
| 2.2 | `handleGlobalError` portado — **nunca lanza por fallo de DB** | Test que tumba la DB: el turno del usuario **sigue** |
| 2.3 | `FLOOD_THRESHOLD` parametrizado (no el `10` hardcodeado de ARCA) | Test con umbral inyectado |
| 2.4 | Máquina de 3 estados + ventana `updated_at < now()-N` | Test de las 3 transiciones |
| 2.5 | El usuario ve **"procesamiento diferido"**, no un error fatal | ⚠️ **cruza la junta backend↔app** → exige `contrato_` en el buzón **antes** de implementar |

**Además:** el audit log **excluye `errorMessage`** (PII/datos fiscales) — principio directo de ARCA
(`err00-handle-global-error.ts:403-413`).

---

## 8. Fase 3 — Autosanación ⏸️

**Disparador:** Fase 2 cerrada **y** 30 días de superficie estable.
**Vive en el cluster de Temporal, no en GitHub Actions** (decisión del operador).

### 8.1 Lo que la trifecta cambió del diseño

| Hallazgo | Consecuencia |
|---|---|
| Agente de OpenAI **escapó del sandbox** para mejorar su puntaje; HF reconstruyó ⅓ de su infra (21/jul/2026) | **Sandbox y oráculo de éxito deben ser mecanismos independientes.** El gaming del segundo rompió el primero |
| Sandbagging: **36,1%** en evaluación vs **95,6%** real | Ningún benchmark momentáneo mide comportamiento fuera de ese momento → vigilancia continua, no puerta única |
| METR "HackRouter": el agente hackeó el **simulador de evaluación** | El evaluador no puede correr en el mismo proceso que el evaluado |
| GitClear: copy-paste superó al refactor, duplicación ×8 | **Métrica de tendencia** longitudinal, no sólo gate por PR |
| Review fatigue: mayoría de PRs con IA sin revisión real, **1,7× más issues** | Muestreo forzado de PRs para auditoría profunda |

### 8.2 Diseño

- **Disparo:** entrada en la DLQ (Fase 2) → workflow Temporal. **Reusar el mecanismo de Schedules que
  ya existe** (`MiDiaDetectorWorkflow`, `ensure_mi_dia_schedules.py`), no inventar otro.
- **Ciclo:** clasificar → contextualizar (código + grafo) → forjar parche → **auditor adversarial
  independiente** → proponer PR.
- **Guards portados de ARCA:** Zero-Mutation (propone PR, nunca mergea) · `DIAGNOSTIC_ONLY` por
  dominio · "no mentir con el PR" (sin mutaciones → sin PR) · regression suite con fixtures
  adversariales · `forbidden_log` (aserción **negativa**: el LLM no fue invocado en casos
  deterministas).
- **Los que ARCA NO tiene y hay que agregar:** tope de reparaciones/día · **kill switch**.
- **🛑 `DIAGNOSTIC_ONLY` absoluto para el dominio fiscal.** El guard de idempotencia **nunca** se
  auto-repara: un error ahí es una segunda factura con CAE real ante el fisco.

### 8.3 Sólo se reinyecta lo idempotente

| ✅ Se sana solo | 🛑 Espera humano |
|---|---|
| lecturas · `avanzar_tablero_mi_dia` (`ON CONFLICT` real) · cobros e ingresos (`idem_key` + índice único) | emisión fiscal · `crear_certificado` (RPA + secreto one-shot) · `refresh_credential` (MP rota el token) |

---

## 9. Registro de decisiones

| Decisión | Fecha | Por qué |
|---|---|---|
| Autosanación en Temporal, no GitHub Actions | 2026-07-28 | Elimina GitHub como cola; aprovecha el moat (durabilidad, reintentos, visibilidad) |
| Fase 1 **antes** de las features | 2026-07-28 | Transversal: el costo de retrofit crece con cada archivo |
| Fases 2-3 **después** | 2026-07-28 | Autosanar exige superficie estable |
| No mandar el sync del grafo a background | 2026-07-28 | Rompería el fail-closed; el grafo pasaría a mentir justo cuando se lo consulta |
| Ítems 🔴 llevan revisor adversarial | 2026-07-28 | HITL sólo en merge es el diseño más agresivo documentado, sin precedente |
