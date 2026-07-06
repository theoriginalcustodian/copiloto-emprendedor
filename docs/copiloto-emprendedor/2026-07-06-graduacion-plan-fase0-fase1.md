# Plan Fase 0 + Fase 1 — Graduación del Copiloto del Emprendedor

> Sprint autónomo, sesión dueña única del estado compartido. Objetivo: dejar TODO consolidado y con el motor con boundary explícito, **listo para Fase 2 (extracción a repo propio)**. Fase 2 NO se ejecuta acá.
> Fuente: auditoría de 4 frentes (A wip-git · B vps-drift · C motor-deps · D infra), 2026-07-06.
>
> **ACTUALIZACIÓN 2026-07-06 (handoff duckdns) — POSTERIOR a la auditoría.** Se agregó acceso por dominio propio `copilotoemprendedor.duckdns.org` → 178.105.191.1 (los `*.sslip.io` los bloquean resolvers de terceros → un usuario externo vio `ERR_NAME_NOT_RESOLVED`). Todo **ADITIVO**; el dominio viejo `copiloto.178-105-191-1.sslip.io` **sigue vivo** (no romper callbacks MP). Impacto: (a) **PR #143** (`d6f1f10`, en main) — `sync-web.sh` default `UC_AUTH_URL`→duckdns (verificado en origin/main); (b) **config de runtime NO versionada** (Caddy vhost duckdns, GoTrue env, Google Console redirect) → nueva dimensión del bundle de graduación. Detalle en memoria `copiloto-dominio-duckdns`.

---

## 0. Resumen ejecutivo — estado REAL medido

La auditoría **encogió y de-riskeó el sprint** respecto de la hipótesis inicial. Tres hallazgos cambian el plan:

1. **El working tree local está ~60 commits detrás de `origin/main`** (`f152742` vs `685a1e2`). Le falta más de la mitad del copiloto real (todo `apps/copiloto-web/`, motor ReAct, MercadoPago, GoTrue, recall, memoria, ~9 `.py` nuevos). **La fuente de verdad del copiloto es `origin/main`, no este checkout.** Todo trabajo de Fase 1 va contra `origin/main`.
2. **Drift de código VPS↔git = CERO.** Las 5 superficies (apps/copiloto 81/81, copiloto-web 148/149 —solo metadata de lockfile—, motor 49/49, deploy/worker 19/19, shared 5/5) idénticas a `origin/main`. **No hay código vivo que rescatar del VPS.** El copiloto vivo corre desde `/opt/uc-repos/copiloto/` (scp-seeded, no git), no desde `/opt/unreal-copilot` (huérfano). Único accionable: `deploy/copiloto/sync-web.sh` vivo es una versión VIEJA sin `VITE_AUTH_URL` — **git ya tiene la correcta**; partir de git, nunca del VPS.
3. **6 de 7 ramas ya están 100% mergeadas** a `origin/main` (verificado por hash de contenido en las puntas, no por conteo de commits). Fase 0 **no es un sprint de merges** — es rescate de WIP sin commitear + limpieza.

**Consecuencia:** el riesgo de "no perder nada" se concentra en **UN** punto: **33 entradas sin commitear en el worktree raíz** (~144 archivos + 2 zips ~20MB). Todo lo demás es housekeeping.

---

## 1. Inventario consolidado

### 1.1 En riesgo REAL de pérdida (solo esto)
| Ubicación | Qué | Riesgo |
|---|---|---|
| worktree raíz `unreal-copilot` (`feat/agente-voz-fase3`) | **33 entradas sin commitear**: 2 `M` (ROADMAP.md, composio-gateway-design.md), 1 `R` (rename roadmap), 30 `??` (~144 archivos reales + 2 zips) | **ALTO** — no está en commit/stash/reflog; `git clean/reset` lo borra sin recuperación |
| ídem | `docs/ESTADO-FRENTES-ABIERTOS.md` (90 líneas) | **ALTO** — la memoria ya lo referencia como si existiera commiteado (ref colgante si se pierde) |
| worktree `uc-copiloto-b` | `.superpowers/sdd/progress.md` (ledger sprint MP) | BAJO — reconstruible desde PR #110 + memoria |

Desglose de los 30 untracked (conteo real `find -type f`):
- Docs del copiloto (keep): `docs/copiloto-emprendedor/*.md` (~10 archivos), `docs/research/*.md` (3), `docs/superpowers/plans/2026-07-03-copiloto-cliente-web.md`, `docs/Follow up/2026-06-30-handoff-fix-aislamiento-graphity.md`, `Loops/transcripcion_completa loops nico.md`.
- Assets de diseño (triage): `docs/copiloto-emprendedor/{APP Copiloto Movil/ (42), Web copiloto/ (47), Copiloto App.html}` + **2 zips ~10MB c/u** (`APP Copiloto Movil.zip`, `Web copiloto.zip`).
- Spikes/otros (triage): `es-ar-listen/` (50 archivos — spike de voz), `spikes/graphity-tenant-isolation/` (5).
- PNGs sueltos en raíz (triage — ¿duplican `apps/copiloto-web/public/`?): `apple-touch-icon.png`, `pwa-192x192.png`, `pwa-512x512.png`, `login-final.png`, `walking-skeleton-e2e-ok.png`, `chat-*.png`, `cuenta-daylight.png`, `desktop-chat.png`.
- Config: `.claude/settings.json`.

### 1.2 Ya seguro (NO tocar / housekeeping)
- 6 ramas mergeadas: `mercadopago-gateway` (#110), `copiloto-recall-temporal` (#125), `smoke-beta-e2e` (#141), `gap-b-conversational-agent` (#103), `agente-voz-fase3` (ancestro), `afinar-prompt-react` (#142). **Borrables tras verificación.**
- `main` local (`uc-copiloto-web`): 51 commits stale, subconjunto exacto de origin/main. Solo `git pull`.

### 1.3 Fuera del scope del copiloto (decisión aparte)
- **`feat/fabrica-local-containerizada`**: ÚNICA rama con código real sin mergear (7 commits, 32 archivos, 2 conflictos: `.gitignore` trivial + `deploy/worker/senior_activities.py` real). **NO es del copiloto** (réplica local de la fábrica). → decisión abierta (§7).
- `feat/r5-generar-plano-unico-generador`: verificación inconclusa (8/17). Generador de la fábrica, no copiloto. → verificar en limpieza de ramas, no bloquea.
- 1638 objetos unreachable: asumidos stash-snapshots superados. → resolver a nivel `git gc` (no en este sprint).

---

## 2. FASE 0 — Consolidación (pasos atómicos)

> Regla: **rescatar ANTES de limpiar**. Nada destructivo en el worktree raíz hasta que el WIP esté en un commit.

**F0.1 — Rescatar el WIP del worktree raíz.**
- Triage previo de los untracked (decisión de qué entra a git vs `.gitignore` vs descartar):
  - PNGs sueltos: comparar hash vs `apps/copiloto-web/public/` → si duplican, descartar; si únicos, mover a ubicación correcta.
  - 2 zips ~20MB: **NO a git** (anti-pattern) → `.gitignore` o almacenamiento externo; conservar solo las carpetas descomprimidas si aportan.
  - Docs → commitear.
- Crear rama `docs/rescate-wip-pre-graduacion` sobre `feat/agente-voz-fase3`, `git add` selectivo (según triage), commit, PR a `main`.
- **Done:** `git status` del worktree raíz limpio (salvo lo deliberadamente gitignored); PR abierto; `docs/ESTADO-FRENTES-ABIERTOS.md` commiteado (cierra la ref colgante de memoria).

**F0.2 — Resolver `.superpowers/sdd/progress.md` en `uc-copiloto-b`.** Archivar o descartar (bajo valor). **Done:** worktree `uc-copiloto-b` limpio.

**F0.3 — Fix del drift de memoria.** Actualizar `gap-b-router-fixed-mount-r1.md` (dice "fix pendiente"; está mergeado PR #103). **Done:** memoria refleja estado real.

**F0.4 — Limpieza de ramas/worktrees mergeadas** (tras F0.1 a salvo). Orden menor→mayor riesgo: `smoke-beta-e2e` → `copiloto-recall-temporal` → `gap-b` (+ remover worktree) → `mercadopago-gateway` → `afinar-prompt-react` (+ worktree `uc-motor-react`) → `agente-voz-fase3` (último, era base del WIP). `git pull` en `uc-copiloto-web`. Verificar cada una por hash antes de borrar (r5 queda pendiente de pasada dedicada). **Done:** solo quedan ramas vivas; worktrees huérfanos removidos.

**F0.5 — Poner el entorno de trabajo sobre `origin/main`.** El worktree raíz queda stale; Fase 1 se hace en un worktree fresco de `origin/main` (o se actualiza el raíz tras F0.1). **Done:** existe un worktree limpio en `origin/main` `685a1e2`+ para Fase 1.

**Gate Fase 0:** working trees limpios · WIP rescatado en PR · memoria reconciliada · entorno sobre origin/main. Cero pérdida verificable.

---

## 3. FASE 1 — Boundary explícito del motor (pasos atómicos)

> Objetivo: convertir el fixed-mount implícito (33+ `sys.path.insert` dispersos) en UN mecanismo único, sin romper la fábrica ni las otras apps del arquetipo. Vale exista o no la extracción.

**Bundle de graduación = 15 archivos** (todos existen en origin/main, ninguno falta):
- 14 del arquetipo `conversational_agent/reference/`: `backend/agent/{types,agent_runtime,agent_activities,conversation_workflow,inbound_router}.py` + `clients/agent/{channels/web,datetime_resolver,providers/{composio_gateway,llm,crypto,mercadopago_gateway,mp_refresh_activities,mp_refresh_workflow,stt}}.py`.
- 1 de infra: `deploy/worker/provision_tables.py`.

**F1.1 — Mecanismo único de mount.** Reemplazar los **33+ `sys.path.insert`** (13 archivos no-test + 20 tests, cada uno con `parents[N]` hardcodeado) por: un `conftest.py` + módulo `_bootstrap.py` compartido que lee `UC_MOTOR_REF_PATH` (default = ruta actual del arquetipo). Funciona hoy dentro de unreal-copilot; en Fase 2 solo cambia el default a la copia vendorizada. **Done:** `git grep sys.path.insert apps/copiloto` = 0; tests importan vía el mecanismo único.

**F1.2 — Formalizar el contrato del bundle.** Documentar los 15 archivos como el boundary del motor (manifiesto versionado en repo). Alinear el `PYTHONPATH` del systemd (`uc-copiloto-worker.service`) con el mecanismo. **Done:** manifiesto commiteado; service usa el mismo mecanismo.

**F1.3 — Gate en el VPS (regla del proyecto: los tests corren en el VPS).** Sync del refactor a `/opt/uc-repos/copiloto/` (partiendo de git, no de la copia stale) → correr la suite del copiloto en `/opt/uc-worker-venv` → **verde**. **Done:** `pytest` de apps/copiloto verde en el VPS post-refactor; servicios reinician healthy.

**Deuda a documentar (visible, no resolver a ciegas):**
- `dispatcher_emprendedor.py` (hand-rolled) coexiste con `dispatch.py` (genérico R1) → decisión §7.
- `transcribe_voice` definida pero nunca registrada en `worker_b.py` (inerte hoy; colgaría 120s si un canal emitiera `needs_stt`) → registrar o documentar.
- `test_react_adversarial.py` (fábrica) espeja por comentario el contrato de `context_factory.py` (copiloto) → drift silencioso post-graduación → decisión §7.

**F1.4 — Capturar la config de runtime como IaC (2ª dimensión del bundle, por handoff duckdns).** La config viva del VPS que git NO captura y el repo nuevo debe versionar/replicar:
- **Caddy:** agregar el vhost `copilotoemprendedor.duckdns.org` a `deploy/copiloto/Caddyfile.snippet` (hoy solo tiene `copiloto.*`/`mp.*` sslip). Bloque: `handle /auth/v1/authorize*` y `/auth/v1/callback*` → `127.0.0.1:9997` (GoTrue); `handle` (resto) → `127.0.0.1:8099` (front-door). **Aditivo — no tocar el vhost sslip viejo** (callbacks MP).
- **GoTrue:** verificar que `deploy/copiloto/gotrue/.env.gotrue.template` incluya (sin valores) `GOTRUE_URI_ALLOW_LIST` (con ambos dominios), `GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI` (duckdns/callback), `COPILOTO_API_EXTERNAL_URL`. Agregarlas si faltan; `deploy-gotrue.sh` ya preserva el env real server-side.
- **Runbook (no versionable):** documentar el redirect URI de Google Console (`.../auth/v1/callback`) + modo Testing (usuarios de prueba) como paso de provisioning del repo nuevo.
- **Done:** `Caddyfile.snippet` tiene el vhost duckdns; template GoTrue completo; runbook actualizado. Sin secretos en git.
- **Trabajo contra `origin/main`** (mi checkout no tiene #143) — por eso **F0.5 se ejecuta ANTES de F1.4**.

**Gate Fase 1:** 0 `sys.path.insert` dispersos · mecanismo único verde en el VPS · manifiesto del bundle commiteado · **config runtime versionada (Caddy vhost + template GoTrue), dominio viejo sslip intacto** · deudas documentadas visibles.

---

## 4. Riesgos y mitigaciones
| Modo de fallo | Mitigación |
|---|---|
| Se pierde WIP del worktree raíz por `clean/reset` | F0.1 PRIMERO; nada destructivo antes del commit |
| Fase 1 se hace sobre el working tree stale (~60 atrás) → refactor incompleto | F0.5: trabajar sobre origin/main obligatorio |
| Se parte de la copia stale del VPS (sync-web.sh viejo) | Partir SIEMPRE de git; el VPS es destino, no fuente |
| Refactor de mount rompe otras apps del arquetipo | Mecanismo con default retrocompatible; 0 acoplamiento inverso de código confirmado |
| Borrar rama con residuo no verificado (r5) | Pasada de hash dedicada antes de borrar; en duda, no borrar |
| 2 zips de 20MB entran a git | Triage F0.1: gitignore/externo |
| Migración rompe el dominio viejo sslip → callbacks MP caen | Todo ADITIVO; nunca tocar el vhost `copiloto.*.sslip.io` ni el env que MP usa como redirect |
| Editar `/etc/caddy/Caddyfile` deja 600 root → `reload caddy` "permission denied" | Tras editar: `chmod 644`; validar `caddy validate --adapter caddyfile` (lección handoff) |
| Config runtime del VPS (Caddy/GoTrue/Google) se pierde al graduar (git no la captura) | F1.4: versionarla como IaC en `deploy/copiloto/**` antes de Fase 2 |
| Editar deploy/config sobre mi checkout stale (sin #143) | F0.5 obligatorio ANTES de F1.4: entorno sobre origin/main |

---

## 5. Criterio de cierre binario (listo para Fase 2)
- [ ] `git status` limpio en los 8 worktrees (salvo gitignored deliberado).
- [ ] WIP rescatado y mergeado a `main` (incl. ESTADO-FRENTES-ABIERTOS.md).
- [ ] Ramas mergeadas borradas; worktrees huérfanos removidos; memoria reconciliada.
- [ ] `git grep sys.path.insert apps/copiloto` = 0; mecanismo único de mount.
- [ ] Suite del copiloto verde en el VPS con el nuevo mount; servicios healthy.
- [ ] Manifiesto del bundle (15 archivos) commiteado; deudas del motor documentadas.
- [ ] Config runtime versionada como IaC (Caddy vhost duckdns en `Caddyfile.snippet` + template GoTrue con las 3 vars); dominio viejo sslip verificado intacto; runbook Google Console actualizado.

---

## 6. Lo que este sprint NO hace (blindaje de fases)
Fase 2 (extracción a repo propio: `filter-repo`, mover bundle+apps+deploy, CI/deploy propios) y Fase 3 (infra propia: 3 nodos) quedan FUERA. Este sprint deja el terreno listo, no ejecuta la mudanza.

---

## 7. Decisiones — LOCKEADAS 2026-07-06

- **Fábrica local (`feat/fabrica-local-containerizada`): DIFERIR.** Fuera del scope del copiloto; queda como el único pendiente real de merge del repo, en su propio frente. NO se toca en este sprint.
- **`dispatcher_emprendedor.py`: DEJAR DIVERGENTE.** No se migra al genérico `dispatch.py`. Se registra como deuda gestionada visible (TODO + memoria + propietario + condición de pago).
- **Motor: VENDORIZAR-CON-SYNC** (patrón fleet-platform) como intención de Fase 2. Fase 1 deja `UC_MOTOR_REF_PATH` con default retrocompatible (forward-compatible con esa estrategia).
- **Historia git: `filter-repo`** (preservar blame/provenance) — se decide/ejecuta en Fase 2.

### Decisiones abiertas originales (archivadas)
1. **Estrategia del bundle (gate de Fase 1):** ¿el mecanismo apunta a (a) copia vendorizada-con-sync del motor —recom. dado driver comercial—, (b) paquete versionado, o (c) sigue tirando de la fuente única hasta Fase 2? Recom: (a) con default retrocompatible; el fork duro se decide en Fase 2.
2. **`feat/fabrica-local-containerizada`:** ¿se consolida en este sprint (higiene, es la única rama con código real sin mergear, 1 conflicto real en senior_activities.py) o se difiere (no es del copiloto)?
3. **`dispatcher_emprendedor.py`:** ¿migrar al genérico `dispatch.py` (R1) ahora, o dejar divergente como deuda visible documentada?
4. **Historia git (afecta Fase 2, decidir temprano):** ¿preservar con `filter-repo` (blame/provenance — recom. para activo comercial) o repo limpio?
