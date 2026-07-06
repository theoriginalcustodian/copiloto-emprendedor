---
name: checkpoint-copiloto-b-skeleton-merged-2026-06-30-20-08
description: "Snapshot ejecutivo. Walking skeleton del Copiloto del Emprendedor (Agente B) mergeado (#97). Estado + cómo retomar Fase 1 con cero fricción."
metadata: 
  node_type: memory
  type: checkpoint
  session_id: unknown
  project_root: c:/Proyectos/Claude/Claude code/unreal-copilot
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

# Checkpoint — copiloto_b_skeleton_merged — 2026-06-30 20:08

## 🎯 Objetivo de la sesión / sprint
Construir (gate senior, NO la fábrica) el **walking skeleton del Copiloto del Emprendedor (Agente B)**: primer corte vertical E2E — chat web → `ConversationWorkflow` durable → gpt-4o-mini → agenda un evento real en Google Calendar con HITL conversacional, sobre datos sintéticos, con gate E2E verde en el VPS.

## ✅ Hecho (cerrado)
- **PR [#97](https://github.com/theoriginalcustodian/unreal-copilot/pull/97) squash-merged a `main`** (`1c46891`). Walking skeleton completo (plan Tasks 1–8).
- **Gate E2E real:** `AGENT_B_E2E: PASS` — propone con botones → confirma (`confirmed=True`) → CREATE_EVENT real → read-back independiente verifica **summary Y hora local (15:00 AR)** → cleanup idempotente (0 residuales). Suite consolidada del branch en VPS: **40 passed, 3 skipped** (skips = integración Gmail real sin user de prueba).
- **Fix de raíz del `ComposioGateway` (#95)** — el 2º uso real (Calendar) destapó 4 bugs que los unit con fake (toolkit=string) no cazaban: (1) `connection_status` objeto-vs-string→None; (2) `authorize()` endpoint legacy retirado (400)→`connected_accounts.link`+`auth_configs.list`; (3) `_unwrap_items` con `items==[]`→TypeError; (4) version pineada `20260626_00` inexistente→404 `Tool_ToolNotFound`→`20260623_00` + test `test_version_pineada_existe_real`. Cada uno con regresión en `deploy/skeleton_kit/tests/test_composio_gateway.py`.
- **Review final whole-branch (opus): APPROVE WITH FIXES** (0 critical, 1 important, 3 minor) — todos corregidos:
  - #1 (important): la hora se agendaba/mostraba en UTC (18:00 vs 15:00 pedido) y el gate no lo veía. Fix: hora **local** en display + contrato CREATE validado por mini-spike (`start/end` naive-local + `timezone` IANA; `event_duration_minutes` solo → `successful:False`). Gate reforzado: el E2E asserta `start==15:00-03:00`.
  - #2 `successful` fail-closed (default False) · #3 `build_default_app` frágil borrado (web deploy = follow-up con smoke) · #4 docstring RLS de `reply_store` corregido.
- **Keys aseguradas** (OpenAI + Composio): `.env` local + `.claude/settings.local.json` + VPS `/etc/unreal-copilot/copiloto.env` (chmod 600), los 4 archivos gitignored, `.txt` borrados.
- **Conexión Calendar autorizada** por el operador: `ca_zhLfWyP31r-g` **ACTIVE** (user `copiloto-e2e-test`, auth_config `ac_QW4g6Xw4wf0X`).
- **Memoria propagada:** `copiloto-emprendedor-roadmap.md`, `composio-gateway-ladrillo.md`, `MEMORY.md` (índice ×2 líneas).

## 🔄 En curso (a medio hacer)
- Nada bloqueante abierto. El walking skeleton está cerrado y mergeado.
- El código de B vive en `main` pero **NO está desplegado al worker productivo del VPS** (corrió solo en el staging `/opt/uc-copiloto-stage`). El canal web tampoco está cableado (no hay entrypoint uvicorn).

## ⏭️ Próximos pasos concretos
1. **Fase 1 MVP de B (brainstorming → spec → plan):** Gmail por chat + dashboard BI mínimo + ladrillo 2 `MemoryProvider`. Empezar por la decisión de scope con el operador (¿es B el frente principal ahora, o sigue junto a clínica/hardening?).
2. **⚠️ ANTES del E2E de Gmail:** validar la version del toolkit `gmail` contra `available_versions` (la `GMAIL` policy del #95 usa `20260626_00`, el MISMO placeholder inválido que rompió Calendar). Patrón: `Composio().toolkits.get("gmail").meta.available_versions`.
3. **Ladrillo 2 — `MemoryProvider`** (provider agnóstico del arquetipo, paralelo a `ComposioGateway`): `recall`/`remember` batcheado/`forget`, impl#1 GraphityMemoryProvider con namespacing `group_id` **no-adivinable** (UUID/HMAC). Precede un spike de aislamiento per-user de Graphity. Detalle → `docs/Follow up/2026-06-29-copiloto-emprendedor-roadmap.md` + memoria `copiloto-emprendedor-roadmap`.
4. **Deploy del canal web** (cuando Fase 1 lo pida): entrypoint uvicorn con `asyncio.run`/lifespan FastAPI (NO `get_event_loop().run_until_complete`) + smoke. El composition root ya está en `apps/copiloto/worker_b.py` + `seed.py`.
5. **Desplegar el worker de B al VPS** cuando se active: `scp apps/copiloto/* + reference/` al deploy real + registrar worker task_queue `agent-emprendedor` (hoy solo en staging).

## ⚠️ Bloqueos / decisiones pendientes del operador
- **Scope de continuación:** ¿arrancamos Fase 1 MVP de B ya, o hay otro frente prioritario? (decisión MAYOR de dirección).
- **Graphity aislamiento ROTO** (server-side) — NO bloquea dev con datos sintéticos + namespacing no-adivinable; el fix va en el repo Graphity (handoff `docs/Follow up/2026-06-30-handoff-fix-aislamiento-graphity.md`, levantar desde una sesión de Graphity). Límite duro: no poner datos reales de múltiples emprendedores en prod hasta el fix.
- **Rotar pre-prod** las keys OpenAI (`sk-proj-…`) + Composio (`ak_…`) que pasaron por archivos del repo + contexto → memoria `deuda-secretos-rotar`. Diferido a pre-producción por el operador.

## 📚 Contexto crítico para retomar
- **Archivos sin commitear:** ninguno relevante (solo `.superpowers/` = ledger SDD scratch, git-ignored).
- **Branch:** worktree `uc-copiloto-b` quedó en **`main` @ 1c46891`** (el `--delete-branch` borró `feat/copiloto-b-walking-skeleton` local+remoto). Worktree principal `unreal-copilot` sigue en `feat/agente-voz-fase3` (otra sesión). 3 worktrees activos.
- **PRs:** #97 MERGED. #95 (gateway), #96 (dupla-fugu, otra sesión) ya en main.
- **Sub-agents bg:** ninguno activo. **Cronjobs:** ninguno.
- **Código de B:** `apps/copiloto/**` (cliente) + `deploy/skeleton_kit/archetypes/conversational_agent/reference/clients/agent/channels/web.py` (cosechado al arquetipo). Plan/spec: `docs/superpowers/{plans,specs}/2026-06-30-copiloto-b-walking-skeleton*`.
- **VPS — cómo correr el E2E (todo en el VPS, la PC no tiene temporalio/fastapi):**
  - Staging: `/opt/uc-copiloto-stage` (NO muta `/opt/unreal-copilot`). Venv con TODAS las deps (temporalio+psycopg2+composio+fastapi): **`/opt/uc-copiloto-venv`** (py3.12). (Ojo: `/opt/uc-worker-venv` NO tiene psycopg2; `/opt/uc-val-venv` NO tiene composio.)
  - Env: `set -a; . /etc/unreal-copilot/fusion-pg.env; . /etc/unreal-copilot/copiloto.env; set +a` (DATABASE_URL + COPILOTO_COMPOSIO_USER_ID=copiloto-e2e-test + COPILOTO_CLIENTE_ID=`47c13b16-5379-4c51-9f82-43865be48256` + OPENAI/COMPOSIO keys).
  - Seed (idempotente): `cd /opt/uc-copiloto-stage && /opt/uc-copiloto-venv/bin/python apps/copiloto/seed.py`
  - E2E: `/opt/uc-copiloto-venv/bin/python -m pytest apps/copiloto/tests/test_e2e.py -v -s` → `AGENT_B_E2E: PASS`.
  - Regenerar connect-link Calendar (si caduca): `c.connected_accounts.link(user_id="copiloto-e2e-test", auth_config_id="ac_QW4g6Xw4wf0X")` — NO `toolkits.authorize` (retirado).
- **Memorias relevantes:** `copiloto-emprendedor-roadmap` · `composio-gateway-ladrillo` (LEER al usar Composio) · `deuda-secretos-rotar` · `tests-se-corren-en-vps` · `deploy-factory-code-vps`.

## 🧠 Modelo mental / supuestos
- El motor de B **reusa `ConversationWorkflow` durable** del arquetipo (mapeo empírico CORRIGIÓ el plan que proponía un motor web efímero nuevo — el durable cuesta igual y da gratis HITL+reintentos). Decisión validada por el E2E verde.
- Este corte va **SIN memoria** (MemoryProvider = ladrillo 2, diferido). Acordado con el operador.
- El evento se crea a la hora correcta porque mandar `start/end` naive-local + `timezone` IANA es el ÚNICO contrato validado empíricamente (mini-spike). Mandar UTC con offset crea bien pero el display corría +3h.
- Asumido NO validado: que el `gmail` toolkit funcione con la misma forma de args que Calendar — **a spikear en Fase 1** (la version Gmail es placeholder sin validar).
- El worktree `uc-copiloto-b` en `main` no estorba; lo creó el operador (no superpowers) → no se limpia automáticamente.

## 📊 Estimación de progreso
- Avance del walking skeleton de B: **100% (cerrado y mergeado)**.
- Avance del Copiloto del Emprendedor completo: ~**20%** (ladrillo 1 ComposioGateway + walking skeleton; falta Fase 1 MVP Gmail+BI+memoria, Fases 2-5).
- Tiempo restante a Fase 1 MVP: estimado 2–4h wall con waves (NO días — reconvertir si aparece "días").
