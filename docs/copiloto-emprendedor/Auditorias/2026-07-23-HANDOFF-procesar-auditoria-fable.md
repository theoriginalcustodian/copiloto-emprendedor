# HANDOFF — Procesar la auditoría de Fable 5 (Fase 2 del loop: ANALIZAR + DISEÑAR)

> **Para:** el agente de la sesión PARALELA de auditoría que el operador abre el 2026-07-23.
> **De:** sesión PLANIFICACIÓN (la que condujo la eval y sigue conduciendo el cierre E2E del sprint).
> **Tu modelo debería ser Opus** (es el paso de JUICIO del loop, no de ejecución).
> **Objetivo de tu sesión:** convertir el informe report-only de Fable en **diseños de fix de raíz**
> (sin sobreingeniería) para backend y frontend, y **redactar los contratos** — SIN implementar código.

---

## 0. Arranque cero-fricción (leé esto y después los 3 archivos del §2)

Sos la **Fase 2** de un loop de mejora dirigida por auditoría que ya tiene doctrina escrita. El reparto:

```
Fable 5 (zero-context)  →  VOS (Opus, contexto)   →  contrato_   →  backend/frontend (Sonnet)
  AUDITA report-only        ANALIZÁS + DISEÑÁS       CONTRATÁS      IMPLEMENTAN + E2E device
  [HECHO ✅]                 [← TU TRABAJO]           [← TU TRABAJO] [después, no vos]
```

La Fase 1 (Fable) **ya corrió**. Su informe existe. Vos hacés Fase 2 (diseño de raíz de cada hallazgo)
y Fase 3 (redactar los `contrato_`). **NO implementás** — eso es de backend/frontend, con prueba E2E en
device. El loop completo está en `memoria/loop-auditoria-fable-analisis-opus-contratos-e2e.md`.

---

## 1. Rutas exactas (todo lo relativo a la auditoría)

| Qué | Ruta ABSOLUTA |
|---|---|
| **📄 EL INFORME DE FABLE** (tu input principal, ya escrito) | `C:\Proyectos\Claude\Claude code\copiloto-emprendedor\docs\copiloto-emprendedor\2026-07-23-eval-fable5-global.md` |
| El prompt exacto que se le dio a Fable (para saber qué se le pidió) | `C:\Users\Admin\AppData\Local\Temp\claude\c--Proyectos-Claude-Claude-code-copiloto-emprendedor\73f7ec06-da1d-4bba-beb7-635af7896c47\scratchpad\eval-fable5-prompt.md` |
| Memoria: cómo se corrió la eval + decisiones fijadas del operador | `...\copiloto-emprendedor\memoria\eval-global-app-fable5-zero-context-pendiente.md` |
| Memoria: el loop reutilizable de 4 fases (tu marco) | `...\copiloto-emprendedor\memoria\loop-auditoria-fable-analisis-opus-contratos-e2e.md` |
| Constitución del repo (boundaries, reglas duras) | `...\copiloto-emprendedor\CLAUDE.md` |
| Arranque general del repo | `...\copiloto-emprendedor\HANDOFF.md` |

> ⚠️ El scratchpad (`...\Temp\claude\...\73f7ec06-...\scratchpad\`) es de **esta** sesión y puede no ser
> legible desde la tuya. El informe y las memorias sí están en el repo — usá esos. Si necesitás el prompt
> y no lo alcanzás, está transcripto en la memoria `eval-global-...`.

---

## 2. Leé primero, en este orden (3 archivos)

1. **El informe** (`docs/.../2026-07-23-eval-fable5-global.md`) — de punta a punta. Es tu materia prima.
2. **`memoria/eval-global-app-fable5-zero-context-pendiente.md`** — las **decisiones fijadas del operador**
   sobre qué evalúa, qué queda fuera de scope, y la hipótesis SQLite.
3. **`memoria/loop-auditoria-fable-analisis-opus-contratos-e2e.md`** — cómo tenés que trabajar (las 4 fases,
   el gate spike-first, el DoD binario, la exigencia E2E en device).

---

## 3. Resumen del informe (orientación — NO reemplaza leerlo)

Fable evaluó 6 dimensiones sobre la rama `feat/mobile-first-cascara-glass` (working tree), con lo verificado
contra `origin/main` marcado explícito. **Impresión general: arquitectura disciplinada** (DI en composition
roots, boundary del motor respetado, multitenant per-request real con test adversarial genuino). Los
hallazgos son huecos puntuales, salvo **dos frentes de deuda sistémica**: idempotencia de writes externos
bajo retry, y conexiones Postgres sin pool.

**Ranking de los 7 más accionables (del informe):**

| # | Hallazgo | Sev | Dónde |
|---|---|---|---|
| 1 | Cerrar `POST /auth/signup` (invite-token env u off en prod) + rate-limit Caddy en `/auth/*` | ALTO | `web.py:671`, Caddyfile |
| 2 | **Pool de conexiones Postgres** detrás del `conn_factory` (arregla 4.3, 6.2 y ½ de 6.1 de un golpe) | ALTO | `serve.py:89-100`, `worker_b.py:237` |
| 3 | **Dedup genérico de writes externos** con el `idem_key` que ya viaja (hoy solo el link MP react está cubierto → emails/eventos/posts se duplican bajo retry) | ALTO | `tool_catalog.py`, `dispatcher_emprendedor.py:84-137` |
| 4 | **Frontend tap→glass**: acuse `PRESS_FADE` en `Tile` (3 líneas) + fix `setState` por frame de scroll (4 líneas) + medir gap release→frame | ALTO | `Tile.tsx:56-71`, `EscritorioFunciones.tsx:238-267` |
| 5 | **`margen_por_trabajo` set-based** (CTE) + FK real presupuesto↔comprobante (mata el join por string) | ALTO | main `inteligencia_queries.py:410-446`, `trabajo_store.py:100-115` |
| 6 | **"Narra sin ejecutar"**: persistir el tool-trace compacto en `self._history` | ALTO | `conversation_workflow.py:404-411,495-499` |
| 7 | **Cap del historial de chat** cliente (`slice(-N)`) — degradación silenciosa por sesión permanente | MEDIO | `useChat.ts:101-103`, `chatMachine.ts` |

Menciones menores que no deben perderse: secretos en claro fuera del árbol (2.4), TTL-cache Composio en
`/me`/`/catalog` (6.3), índice de `copiloto_web_replies` (6.2.3), claim-first en dedup MP (1.2), y el
supuesto "1 turno → 1 reply" (1.3) escrito en el contrato antes de que las recurrentes lo rompan.

---

## 4. 🔴 Lo que TENÉS que saber antes de diseñar (o repetís errores ya pagados)

### 4.1 El hallazgo #6 "narra sin ejecutar" YA está en curso — NO lo re-contrates
Backend ya tiene el de-risk **VERDE** (replay-verify OK) y está **esperando el visto del operador a v1**
para implementar el fix del motor. Bloquea los hitos 7/8/9. Contrato vivo:
`coordinacion/abierto/2026-07-23_contrato_planificacion-a-backend_narra-sin-hacer-el-bloqueador-de-tres-hitos.md`.
Tu diseño puede **enriquecer** la recomendación (el informe da la raíz exacta: `:404-411` descarta los
`tool_calls` del historial cross-turn), pero **no emitas un contrato nuevo** — ya existe dueño.

### 4.2 La hipótesis SQLite YA fue resuelta: **NO por ahora** (D5.5 del informe)
El operador la puso como candidato explícito. Fable la verificó y la **descartó con evidencia**: el
cold-fetch NO bloquea el paint (todas las pantallas montan con spinner + fetch async), y la latencia del
síntoma #1 vive en el disparo+mount, que SQLite no toca. **No re-spikees SQLite para reintroducirlo.** Si
tras medir en device se quiere matar el spinner, el informe propone un cache en memoria
stale-while-revalidate (90% del beneficio, 5% de la complejidad). Esto es **gate spike-first ya cumplido** —
respetá el veredicto.

### 4.3 Gate spike-first para el RESTO (regla dura del loop)
Si un hallazgo se apoya en un supuesto crítico no validado, **medí/spikeá ANTES de diseñar** — el diseño
sale del resultado, no de la recomendación de Fable. Ejemplos en el informe marcados
`[ASUMIDO — PENDIENTE VERIFICAR]`: el require lazy de rutas en la 1ª apertura (5.1c), el rate-limit real de
la GoTrue dedicada (2.2), el solape `_TOOLKIT_NAMES` (4.4). Esos NO se diseñan sin verificar primero.
Fable flaggea candidatos; **vos decidís qué es real y cómo se resuelve de raíz** (`memoria/raiz-no-parche`,
`memoria/no-codificar-la-esperanza-principio-raiz`).

### 4.4 TODO fix se cierra con evidencia de DEVICE — mecanismo §6 (recién establecido, no negociable)
Una orden está **TERMINADA** solo con: implementado → desplegado → **probado FUNCIONANDO en el device** →
evidencia adjunta en `_evidencia/`. "Mergeado a main" ≠ terminado. Tus contratos DEBEN incluir la exigencia
E2E en device en el DoD. Ver `coordinacion/COORDINACION.md §6` y
`memoria/una-orden-cerrada-exige-evidencia-de-device.md`. Verde en jest/vitest ≠ verificado
(`memoria/gate-jsdom-no-ve-gestos-tactiles`).

### 4.5 Arquitectura mínima (verificala en el informe, no la asumas)
- **Motor vendorizado:** `apps/copiloto/**` importa `from backend.agent... / from clients.agent...`; el
  path se resuelve SOLO en `apps/copiloto/_paths.py`. El motor vive en `motor/` (fork duro, no se
  sincroniza con la fábrica — `memoria/motor-fork-duro-fix-buffer-corto.md`).
- **Temporal es la columna (el moat durable):** workflows sin side effects ni no-determinismo. Todo fix que
  toque `conversation_workflow.py` u otra activity/workflow → invocar skill `temporal-developer`
  (+ `temporal-ai-patterns` para el scratchpad ReAct del #6). Los fixes de idempotencia (#3) son
  semántica at-least-once de activities — mismo gate.
- **Multitenant per-request** vía `context_factory`/`TenantCtx`; el aislamiento se verifica con test
  adversarial (el informe confirma que existe y es genuino — D2.3).
- **Contrato del front:** `POST /chat` fire-and-forget + polling `GET /reply`. Esa latencia es inherente al
  agente durable — NO se "arregla" con cache local.

---

## 5. 🔀 Coordinación — sos una CUARTA sesión sobre un checkout COMPARTIDO

El repo se trabaja con 3 sesiones (planificación + backend + frontend) que coordinan por un buzón de
archivos en `coordinacion/` (gitignored). Vos entrás como una 4ª. Reglas duras
(`memoria/coordinacion-tres-sesiones-buzon.md`, `coordinacion/COORDINACION.md`):

- **NUNCA** `git add -A`, `--amend`, `rebase`, `reset --hard`, `checkout`, `switch`, `pull`, `stash`,
  `clean` — pisás el trabajo no commiteado de otra sesión. `git add` con **rutas explícitas** solamente.
- **No edites la carpeta de otra sesión** en el buzón. Se pide.
- **`coordinacion/` NO se versiona** (está en `.gitignore`) — no la agregues a git.
- **Memoria** nueva → escribila en `memoria/` del repo (no solo en el auto-memory del harness; divergen y
  `scripts/seed-memory.sh` espeja con `--delete` — ver `memoria/memoria-repo-vs-slug-drift.md`).

**El punto crítico de coordinación para vos:** el buzón (`coordinacion/`) es **estado compartido con una
sola dueña — la sesión PLANIFICACIÓN principal** (la que redactó este handoff). Backend y frontend están
**mid-sprint ahora** (cerrando el E2E de IN/voz/freeze + backlog en device). Si vos volcás 7 contratos
nuevos al buzón mientras ellos están en eso, los saturás. **Recomendación fuerte:** producí tu salida como
un **DOSSIER DE DISEÑO** (un doc en `docs/copiloto-emprendedor/`, ej.
`2026-07-23-diseno-fixes-auditoria-fable.md`) con el diseño de raíz de cada hallazgo + los contratos
**redactados pero en borrador**, y **coordiná con la sesión planificación principal** la emisión al buzón
(cuándo, en qué orden, sin colisionar con el cierre E2E). Así hay **una sola dueña del buzón** y backend/
frontend reciben el frente nuevo cuando terminen el actual. El operador decide el timing final.

---

## 6. Estado del sprint AHORA (para que NO colisiones)

- **Vivo (prod-beta):** desplegado multitenant, smoke 10/10 histórico.
- **En vuelo (backend+frontend, device):** cierre E2E del sprint IN+mobile-first. Se destrabó recién un bug
  upstream de Expo dev-launcher (ANR) con bypass avión+`adb reverse`; el dev-client se está reapuntando de
  la rama vieja (colchón) a `_wt-device-main` (= main+PR#78) para correr el E2E acumulativo contra el bundle
  correcto. **El device es EXCLUSIVO de backend** y **escribe datos reales** — vos no lo tocás.
- **PR abierto:** #78 (wiring IN: 4 gráficos + solapa "Preguntar" en `/inteligencia`), gated a device.
- **Git:** `origin/main` @ `5e09690` es el **tronco real**. La rama `feat/mobile-first-cascara-glass` está
  **congelada, 47 commits detrás de main** (ojo: el informe se leyó sobre esa rama; el hallazgo #5/#6.1 se
  marcó verificado contra `origin/main` porque el código de inteligencia vive allá). Si releés código para
  diseñar, **hacelo contra `origin/main`** (`git show origin/main:<path>`), no contra el working tree de la
  rama vieja, o diseñás sobre código obsoleto.

---

## 7. Tu primer paso concreto

1. Leé los 3 archivos del §2.
2. Para cada uno de los 7 hallazgos rankeados (+ las menciones menores que quieras rescatar): **diseñá el
   fix de raíz, simple, sin sobreingeniería.** Releé el código citado **contra `origin/main`** para no
   diseñar sobre la rama congelada. Aplicá el gate spike-first (§4.3) donde haya `[ASUMIDO]`.
3. Agrupá por frente (backend / frontend) y por dependencia (ej: #2 pool habilita ½ de #6.1; #4.2 FK real
   hace trivial la CTE de #6.1 → conviene diseñarlos juntos, como dice el informe).
4. Redactá los **contratos en borrador** con **DoD binario + exigencia E2E en device** (§4.4). NO el de
   narra-sin-hacer (#6), que ya tiene dueño (§4.1).
5. Escribí todo en un **dossier de diseño** en `docs/copiloto-emprendedor/` y **coordiná con la sesión
   planificación principal** la emisión al buzón (§5). No inundes `coordinacion/` por tu cuenta.

## 8. Qué NO hacer
- ❌ Implementar código (sos diseño; ejecutan backend/frontend con E2E device).
- ❌ Re-contratar narra-sin-hacer (#6) — ya está en curso.
- ❌ Reintroducir SQLite — ya se descartó con evidencia (#D5.5).
- ❌ Tocar el device / el buzón de otra sesión / `git add -A` / reescribir historia.
- ❌ Diseñar sobre el working tree de la rama vieja — leé `origin/main`.
- ❌ Volcar 7 contratos al buzón mientras backend/frontend cierran el E2E — dossier primero, emisión
  coordinada.
```

---

*Handoff redactado por la sesión PLANIFICACIÓN el 2026-07-23. El informe de Fable y las memorias citadas
son la fuente de verdad; este documento es el índice de arranque.*
