# Plan de implementación — manejo de errores del copiloto

> **v2 — 2026-07-28.** Reescrito tras auditar `aplicacion-arca-fe` (5 barridos con globs exclusivos + lectura directa).
> **Objetivo del operador:** *que el software pueda mantenerse solo, con HITL principalmente en el merge a main.*
>
> **El cambio de v1 a v2:** v1 diseñaba A-4 desde la metodología INL. v2 **porta selectivamente un sistema que ya corre**. ARCA implementó esto y dejó las cicatrices puestas — pero también dejó partes muertas y partes sin terminar, y la mitad del trabajo es distinguirlas.
>
> **Insumos:** [mapa de puntos de fallo](2026-07-28-mapa-puntos-de-fallo-del-sistema.md) · [metodología INL](2026-07-28-metodologia-inl-manejo-de-errores.md) · [auditoría de la app](2026-07-28-analisis-manejo-de-errores-toda-la-app.md) · repo ARCA.

---

## 0. La advertencia que ordena todo lo demás

**ARCA migró de n8n a Temporal el 2026-06-15 (ADR-050), y Zep Cloud quedó deprecado a favor de Graphity.** Toda la documentación de `docs/12_Error_Handling_System/` es de abril 2026 — **anterior a ambas migraciones**.

Consecuencia práctica: **la carpeta de docs describe mayormente el motor muerto.** Portar desde ahí sería portar el diseño de un sistema apagado.

| Artefacto | Estado real | Evidencia |
|---|---|---|
| `01_ARQUITECTURA_GLOBAL_L0_L4.md` (las 7 capas L0-L6) | ⚰️ **motor n8n legacy** — sólo 2 de 7 niveles tienen equivalente verificado en Temporal | rep-A |
| `04_CONTRATO_CUSTOMDATA.md`, `09_GUIA_ACTIVACION_Y_TESTING.md` | ⚰️ n8n (`$execution.customData` no existe fuera de n8n) | rep-D |
| `03_BOT08_REFERENCIA_TECNICA.md` (recuperador DLQ) | ⚠️ el propio doc dice **"❌ Pendiente activación"** | `03_BOT08:6` |
| `06_INTEGRACION_SENTINEL_C1.md`, `08_GITHUB_DEDUPLICACION.md` | ⚰️ n8n + Zep | rep-C |
| **Código Temporal en `lib/shared/temporal/` e `infra/temporal/workers/`** | ✅ **VIVO** — es de donde hay que portar | rep-A, lectura directa |
| **`.github/workflows/`** | ✅ **VIVO** — el ciclo de autosanación corre acá | rep-E, lectura directa |

**Regla del port: se porta desde el código, no desde los docs.** Los docs sirven para entender el *por qué*; el *qué* sale de `.ts` y `.yml`.

---

## 1. Lo que ARCA resolvió y se porta (verificado en código)

| # | Pieza | Archivo de ARCA | Al copiloto |
|---|---|---|---|
| 1 | **`djb2Hash()`** — 9 líneas, cero dependencias | `lib/shared/temporal/err00-djb2-hash.ts:28-36` | copiar tal cual; fingerprint = `workflow\|errorType\|errorMessage[:200]` |
| 2 | **`handleGlobalError()`** — valida input, upsertea con dedupe, auditea sin PII, alerta sólo ante flood, **nunca lanza por fallo de DB** | `lib/shared/temporal/activities/err00-handle-global-error.ts:170-292` | el artefacto más copiable de todo el repo |
| 3 | **Upsert atómico con dedupe** `ON CONFLICT (error_fingerprint) DO UPDATE … RETURNING dedupe_count, (xmax = 0)` | `migraciones_supabase/2026-06-01_sprint1_wave4_err00_dedupe.sql:184-199` | 1:1 a Postgres. **El copiloto ya usa `xmax=0`** en `afip_comprobante_store.py:63` — mismo linaje |
| 4 | **`FLOOD_THRESHOLD`** — alerta sólo al superar N reincidencias | `err00-handle-global-error.ts:63` | portar como **parámetro**, no como el `10` hardcodeado |
| 5 | **Taxonomía tipada** `AfipBusinessError`→`nonRetryable`, `AfipRateLimitError`/`AfipInfraError`→`retryable` | `mot07-consulta-fe.ts:336-379` | es el `ERROR_MAP` de A-1, ya escrito |
| 6 | **Categorías con semántica de acción** `business_error` (DLQ, fix humano) · `infra_error` (retry auto) · `manual_intervention` (DLQ bloqueado) · `cascading` (revisar padre) | `error-drawer.tsx:21-55` | casi calcado de Temporal nativo; el copiloto tiene 16 `RetryPolicy` sin categorizar |
| 7 | **Agrupación por fingerprint + contador** en vez de lista plana | `centro-errores-view.tsx:9,264,270-274` | sin esto, 42 `except` genéricos = ruido 1:1 |
| 8 | **Máquina de 3 estados de DLQ** `Resolved` / `Still_Failing` / `Skip_Irrecuperable` + ventana `updated_at < now()-N` | `03_BOT08:44-65,94-96` | evita el loop infinito que ARCA ya vivió en v1.0 |
| 9 | **Audit log SIN `errorMessage`** — excluido por PII/datos fiscales | `err00-handle-global-error.ts:403-413` + test `:298-304` | principio directo |
| 10 | **Graceful degradation en observabilidad**: registrar el error nunca puede romper el flujo | `err00-handle-global-error.ts:264-276` | *"un error al loguear un error no debe generar un error nuevo"* |

## 1.bis El ciclo de autosanación (`.github/workflows/`, vivo)

| # | Pieza | Archivo | Por qué importa |
|---|---|---|---|
| 11 | **Trigger acotado por prefijo** `if: startsWith(title, '[AUTO-HEALING]')` | `copilot_autorepair.yml:10` | nada arranca el ciclo salvo un marcador explícito |
| 12 | **Zero-Mutation: el agente abre PR, NUNCA mergea** | `copilot_autorepair.yml:107-112` · `10_L3_SRE:15` | **es exactamente el HITL que el operador pidió**, ya definido en ese punto |
| 13 | **Modo `DIAGNOSTIC_ONLY` por dominio crítico** — capas core no se auto-mutan, sólo se auto-diagnostican | `ISSUE_TEMPLATE/auto_healing.yml:30-35` | guardarraíl de blast-radius |
| 14 | **Guards de "no mentir con el PR"**: sin mutaciones → no PR; fallback ambiguo (`.patch.json`) → no PR, sólo artifact | `copilot_autorepair.yml:58-75` | *"Un PR 'auto-repair' con solo un .patch.json es engañoso — se intercepta aquí"* |
| 15 | **Auditor adversarial**: un segundo LLM barato valida el parche del caro (¿viola la constitución? ¿toca `credentials`? ¿el diff es coherente con el diagnóstico?) | `10_L3_SRE:55-60` · secret `GPT_AGENTE_AUDITOR` | |
| 16 | **Regression suite con fixtures adversariales** que verifican que el agente reparador **rechaza** mutaciones peligrosas (credentials hardcodeadas, `DISABLE RLS`) | `sre_regression_test.yml:41-63` | *el agente que repara está testeado contra romper las invariantes* |
| 17 | **`forbidden_log`** — aserción **negativa**: verifica que el LLM **no** fue invocado en casos deterministas | `sre_regression_test.yml:145-153` | prueba que el pre-clasificador de 0 tokens hace su trabajo |
| 18 | **Checklist de idempotencia de 3 capas en el PR template** (`workflowIdReusePolicy` + check pre-action + **verify post-action contra AFIP**) | `PULL_REQUEST_TEMPLATE.md:69-104` | gate humano; ataca directo el bug fiscal #1 |
| 19 | **Artefactos de debug siempre** (`if: always()`, 30 días) + comentario de resultado en el issue en 3 variantes | `copilot_autorepair.yml:114-141` | trazabilidad sin abrir logs de CI |

---

## 2. Lo que ARCA **NO** resolvió — no hay nada que copiar

Esto es tan importante como lo anterior, y es lo que evita construir sobre una ilusión.

| Hueco | Evidencia | Qué significa para el copiloto |
|---|---|---|
| **"Consultar antes de reintentar" (DEUDA-03)** — el guard pre-reintento contra la doble emisión | `2026-04-19_AUDITORIA:139-160`, **issue #200 ABIERTO** | **ARCA tiene el mismo bug de fondo.** Tiene la pieza (`MOT-07`) y **no la cableó** como guard de emisión. No hay solución que portar: hay que construirla. |
| **Acciones del panel de errores** (Resolver/Asignar/Ignorar) | `error-drawer.tsx:174-182` — `onClick={() => void 0}`, `TODO Wave 3` | UI construida, lógica ausente. Copiar la UI sí; "cómo se resuelve un error desde acá", no. |
| **Recuperador de DLQ (BOT-08)** | `03_BOT08:6` — **"❌ Pendiente activación"** | el reintentador automático no corre |
| **Tope de PRs automáticos / kill switch** del autorepair | ausencia verificada en `copilot_autorepair.yml` (rep-E) | si el copiloto porta el ciclo, **tiene que agregar lo que ARCA no tiene** |
| **Dual-approval de fixes de IA** | `centro-errores-view.tsx:33-54` — flujo declarado, `ai-suggestion-card.tsx` no verificado | diseño parcial |

### El dato que valida todo el diagnóstico del copiloto

La auditoría de errores silenciosos de ARCA (2026-04-19) encontró que **3 de 9 casos fueron "regresión o claim falso"** — fixes de error-handling **declarados resueltos que no estaban en el código** (`2026-04-19_AUDITORIA:26-29`).

Es exactamente la clase raíz que el copiloto tiene medida (*"el fix existe y no se propagó"*, 8 instancias), confirmada de forma independiente en otro repo del mismo autor. **Un tercio de los fixes de manejo de errores declarados eran falsos.** Por eso el gate mecánico (§Transversal) no es higiene: es la única defensa contra que este mismo plan se degrade igual.

Y la respuesta de ARCA es portable: un **catálogo declarativo de patrones de error silencioso con firmas grep/jq re-ejecutables** (`ES_CATALOG.yaml` + `audit_silent_errors.js`) — el equivalente de `scripts/inventario-errores.sh` que el copiloto ya tiene, pero con aserciones.

---

## Fase 0 — Cerrar los fail-open

| # | Cambio | Dónde | Cierre binario |
|---|---|---|---|
| **0.1a** | **Consultar el comprobante que se intentó emitir.** Write-ahead: registrar la intención (`nro=siguiente`, sin CAE) **antes** de llamar a AFIP; en el retry, consultar **ese** número con `FECompConsultar` (no `ultimo+1`). El copiloto ya tiene `idem_key` en la tabla. | `afip_factura_activities.py:94-95` | AFIP autoriza y la activity lanza → el retry **adopta**, no emite otro |
| **0.1b** ✅ | **`ResultGet` puede venir como array** — anti-pattern P5 de ARCA. **Dos modos de falla distintos**, medidos con control diferencial: (a) `ResultGet` lista → se devolvía **la lista**, y `_emitir_sync:100` hace `.get()` sobre ella → **`AttributeError` crudo** (no `ErrorAfip`) → propaga → Temporal reintenta → `getLastVoucher` ya avanzó → **emite el número siguiente**; (b) lista en la raíz → `{}` → *"no existe"* → reemite directo | `afip_gateway.py:146` | ✅ **HECHO** — `_primer_result_get()`; 4 tests nuevos + control negativo (lista vacía sigue siendo ausencia). 30 passed en el VPS |
| **0.1c** ✅ | **Aceptar `CAE` **y** `CodAutorizacion`** (y `CAEFchVto`/`FchVto`). ARCA: *"FIX smoke 2026-06-15: antes buscaba `det.CAE` → devolvía `found:false` pese a que AFIP traía el comprobante real"* | `afip_factura_activities.py:100` | ✅ **HECHO** — test parametrizado por campo; el fake **revienta si se emite**, así que sin el fix falla por la emisión duplicada (el daño real), no por un assert |
| **0.1d** | **`existe_comprobante` deja de tragar `ErrorAfip`** → fail-**closed**. ⚠️ Ver nota de rollout abajo | `afip_gateway.py:155-158` | `getVoucherInfo` lanza → **no** llama a `createNextVoucher` |
| 0.2 | `marcar_comprobante_anulado` dentro de `try` + estado terminal | `afip_anulacion_workflow.py:98-101` | agota reintentos → `terminado: True` (hoy: polling eterno) |
| 0.3 | `consultar_*` distingue caído de inexistente | `web.py:169,268,348` | Temporal caído → **503**; inexistente → **404** |
| 0.4 | `confirmar` deja de devolver `{"ok":true}` con token inválido | `afip_web.py:311-328` | el cliente puede discriminar |
| 0.5 | `idem_key` en `send_channel_message` / `notify_staff` | `agent_activities.py:51-70` | envía y lanza → el retry no duplica |
| 0.6 | `try/except` de cierre en `ConversationWorkflow` | `conversation_workflow.py:249-533` | 5 intentos agotados → la sesión sobrevive |
| 0.7 | `catch` en `Linking.openURL` / `Share.share` | `DetalleComprobante.tsx:128-134` | promesa rechazada → se muestra algo |
| 0.8 | Timeout canónico (`AbortController`) | `http.native.ts`, `http.web.ts` | 0 → 4 llamadas con timeout |

> ⚠️ **Rollout de 0.1d — corregido por ARCA.** v1 proponía fail-closed de una. ARCA tomó la decisión opuesta y la documentó (`12_DUAL_CHECK:139`): *"no bloquear escrituras en este PR. Razón: si el dual-check tuviera un falso positivo, **bloqueamos comprobantes legítimos**. Primero observar, luego bloquear con evidencia"*, con roadmap a bloqueante tras **≥30 días de baseline sin falsos positivos** (`§9 PR-C`).
> **Aplicado acá:** 0.1a/b/c van directo (corrigen lecturas erróneas, no cambian la política de emisión). **0.1d observa primero** — registra el caso en la DLQ y sigue; se vuelve bloqueante con baseline.

---

## Fase 1 — Captura (A-4 paso 1)

Hoy: `fingerprint=0 · structlog=0 · sentry=0 · request_id=0`. **Casi todo es port.**

- **1.1** `djb2Hash()` portado (`err00-djb2-hash.ts:28-36`), fingerprint `workflow|errorType|errorMessage[:200]`
- **1.2** Log estructurado — el patrón de `mot07-consulta-fe.ts:275-283`: `ctx.log.info` con `tenantId, cuit, ptoVta, modo, durationMs`
- **1.3** Taxonomía única, portada de `mot07-consulta-fe.ts:336-379` + categorías de `error-drawer.tsx:21-55`
- **1.4** Clasificar los 22 `except` silenciosos: *best-effort legítimo* (como `warm_fn`) vs *error tragado*. **La clasificación es el trabajo.** Formalizar como catálogo re-ejecutable (patrón `ES_CATALOG.yaml`) sobre `scripts/inventario-errores.sh`
- **1.5** **Contrato de contexto mínimo con fallback explícito por campo** (`04_CONTRATO_CUSTOMDATA.md:48-57`) — y la regla arquitectónica: **el contexto lo inyecta el caller de más alto nivel**, no la activity interna (`:130-135`)

## Fase 2 — Depositar (A-4 pasos 2-4)

- **2.1** Tabla `copiloto_traumas` con el **upsert atómico de ARCA** (`ON CONFLICT (fingerprint) DO UPDATE … RETURNING dedupe_count, (xmax=0)`), provisionada con `provision()` (RLS gratis)
- **2.2** `handleGlobalError()` portado — incluido *nunca lanzar por fallo de DB*
- **2.3** `FLOOD_THRESHOLD` parametrizado
- **2.4** Máquina de 3 estados + ventana `updated_at < now()-N`
- **2.5** El usuario ve **"procesamiento diferido"** → ⚠️ cruza la junta backend↔app, exige `contrato_`

## Fase 3 — Auto-sanación

> **Decisión del operador (2026-07-28): la autosanación NO va en GitHub Actions — vive en el propio cluster de Temporal.**
> Se porta de ARCA el **diseño del ciclo** (clasificar → contextualizar → forjar parche → auditar con un segundo modelo → proponer), no su mecanismo de transporte. Concretamente: `copilot_autorepair.yml` es un *workflow disparado por un evento con guardarraíles*; en el copiloto eso es un **workflow Temporal** disparado por una entrada en la DLQ, lo cual además elimina la dependencia de GitHub como cola y aprovecha el moat (durabilidad, reintentos, visibilidad). Lo que **sí** se porta literal son los guards: Zero-Mutation, `DIAGNOSTIC_ONLY` por dominio, "no mentir con el PR", auditor adversarial, y los que ARCA **no** tiene (tope por día, kill switch).
>
> **Y el encuadre completo, en orden:** primero se resuelven los errores que hoy existen (Fase 0) → después se implementa el manejo de errores para que **la superficie de fallo sea mínima y enteramente descriptible** (Fases 1-2) → recién ahí la autosanación es viable, porque un agente con acceso al código y al grafo puede proponer la solución de raíz de cada fallo **sólo si la superficie es chica y está bien caracterizada**. Autosanar sobre una superficie grande y mal capturada es automatizar el parche, no la raíz.

**Portar el ciclo** con sus guardarraíles, **más los que ARCA no tiene**: tope de reparaciones/día y kill switch.

**Frontera del HITL** (ya resuelta por ARCA en el punto correcto): el agente **propone PR, nunca mergea**. Sumar `DIAGNOSTIC_ONLY` para el dominio fiscal — dado el bug #1, el guard de idempotencia **nunca** debe auto-repararse sin humano.

**Precondición:** sólo se reinyecta lo idempotente.

| ✅ Se sana solo | 🛑 Espera al humano |
|---|---|
| lecturas · `avanzar_tablero_mi_dia` (`ON CONFLICT` real) · cobros e ingresos (`idem_key` + índice único) | emisión fiscal · `crear_certificado` (RPA + secreto one-shot) · `refresh_credential` (MP rota el token) |

---

## Transversal — G-2

Hoy: cero ESLint, CI corre 11/92 Python y 0/96 TS. **Con 1 de cada 3 fixes de error-handling resultando falso en ARCA, esto no es opcional.**

Portar además: **`sre_regression_test.yml`** (fixtures adversariales + `forbidden_log`) y el **checklist de idempotencia del PR template** — el gate humano más barato y el que ataca directo el bug #1.

⚠️ Toca a las tres sesiones → coordinar por buzón.

---

## Orden y disparadores

**Fase 0 → 1 → 2 → 3**, G-2 en paralelo desde el inicio.

0.1a/b/c primero: son lecturas erróneas con daño demostrable y **no cambian la política de emisión**. 0.1d espera baseline. Las Fases 1-2 son mayormente port, no diseño. La 3 no puede empezar sin cola sobre la cual operar.

**El disparador de cada fase es el criterio de cierre binario de la anterior.**
