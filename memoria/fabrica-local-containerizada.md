---
name: fabrica-local-containerizada
description: "Fábrica unreal-copilot replicada en la PC del operador (Docker Desktop+WSL2), instancia local soberana e independiente del VPS. Estado de fases y gotchas."
metadata: 
  node_type: memory
  type: project
  originSessionId: 12059cb1-332d-4821-a3ba-e04ea45ababe
---

Réplica **local soberana** de la fábrica `unreal-copilot` en la PC del operador, para sus desarrollos personales — **independiente** del VPS (NO sincroniza estado; cada fábrica tiene su Temporal/datos/repos). Bonus: paridad ("si corre local, sé que corre en prod"). Iniciada 2026-06-23.

**Dónde vive:** worktree aislado `C:\Proyectos\Claude\Claude code\uc-fabrica-local`, rama `feat/fabrica-local-containerizada` (sin PR aún). El working tree principal `unreal-copilot` quedó en `main` para la otra sesión (composición). Spec: `docs/superpowers/specs/2026-06-23-fabrica-local-containerizada-design.md`. Planes/gates: `docs/superpowers/plans/2026-06-23-fabrica-local-*`.

**Decisiones (operador):** containerizado (un `docker compose up`, portable) · músculo **DeepSeek/OpenRouter** (Kaggle diferido vía relay) · **paridad 1:1** (Temporal+worker+sandbox+MCP+Hermes+Telegram×2+WhatsApp/Evolution+eval) · **parametrización COMPLETA** VPS→env backward-compatible · frontera relajada (doméstico: worker monta docker.sock; el sandbox sigue `--network none`) · WSL2 como runtime (Windows nativo descartado).

**Estado de fases:**
- **Fase 0 (spikes) PASS** — auth Max **portable** a contenedor (`~/.claude/.credentials.json` OAuth file-based, montar rw) · sandbox `--network none` vía docker.sock OK. `spikes/local-*`.
- **Fase 1A (parametrización) ✅ VALIDADA en VPS** — 14 archivos VPS→env (`config.py` DEEPSEEK_TASK_QUEUE · ops-scripts TEMPORAL_TARGET+UC_REPOS_DIR · services UC_REPO_PATH/VENV/ENV_DIR/VAL_PYTHON). Backward-compatible (default==valor actual). Gate A6: `pytest 245==245` en `/opt/unreal-copilot` vivo (no rompe prod). Commit `3a7afcc`+`abf9d9e`.
- **Fase 1B (núcleo + gate) ✅ COMPLETA, CORRIENDO local** — `docker-compose.local.yml` (overlay external sobre cluster Temporal, reusa redes `fusion-local_default`+`graphity-personal-net`) + `Dockerfile.worker` (temporalio+docker-cli+claude-code-cli+gh+graphity-sdk) + `Dockerfile.mcp` (fastmcp 3.4.2). Imágenes sandbox `unreal-copilot-sandbox:2` (299MB) + `-temporal:1` (383MB) construidas (browser opt-in diferido). Worker `workers UP: [coding-agents-deepseek, whatsapp, feature-dev, coding-agents-temporal]`; MCP `:8931`; jaula python smoke OK (`--network none`). Commit `50f5330`. `.env.local` con `TEMPORAL_DB_PWD` generado.

**Secretos `.env.local` ✅ COMPLETOS** (sin pasar por chat): OPENROUTER_API_KEY (del VPS) + SUPABASE_URL/SERVICE_ROLE_KEY (de `fusion-local`) + GRAPHITY_BASE_URL/API_KEY (**provisionada** vía `docker exec graphity-personal-api python - < Graphity/deploy/ops/provision_tenant.py` con `PROVISION_TENANT_ID=unreal-copilot`; el bootstrap HTTP daba 410 "already executed" → Vía A docker-exec; smoke search 200). URLs internas: `supabase-kong:8000`, `graphity-personal-api:8000` (host: `127.0.0.1:8000`). TEMPORAL_DB_PWD generado. Falta solo Telegram×2 + Evolution (Fase 2/3).

**Fase 2/3 PARIDAD TOTAL IMPLEMENTADA (listos para activar, SIN activar) ✅** — imagen base compartida `uc-base` (python+temporalio+graphity-sdk; worker/mcp refactorizados a `FROM uc-base`, hitl/wa-sender nuevos). `docker-compose.local.yml` con **PROFILES**: núcleo (worker+mcp, sin profile) · `telegram` (uc-hitl-listener, bot #1) · `whatsapp` (evolution-api/postgres/redis + uc-wa-sender, bot #2) · `hermes` (copia fiel del VPS: imagen `hermes-agent:latest` 7.81GB cargada via docker save/load + config en `deploy/hermes/data` = `/root/.hermes` del VPS, 2 servicios `gateway run` + `dashboard`). 9 servicios, `compose config` (todos los profiles) válido. `deploy/evolution/.env` generado (AUTH+PG). Commit `cbb738e`. **Activación = `deploy/ACTIVAR-paridad.md`** (2 bots @BotFather + QR WhatsApp = pasos manuales del operador).

**Pendiente:** arranque E2E de los profiles (se valida al poner bots/QR — al activar `hermes` vigilar permisos del volumen `deploy/hermes/data` con `HERMES_UID`) · Fase 1C (generar 1ª app E2E contra Supabase+Graphity locales) · subir `.wslconfig` a 24GB **mínimo** (diferido) · cage browser opt-in (`UC_BUILD_BROWSER_SANDBOX`).

**Cómo retomar Fase 1C:** levantar (si Docker reinició) `docker compose --env-file deploy/.env.local -f deploy/docker-compose.agentic.yml up -d` + `... -f deploy/docker-compose.local.yml up -d`. Completar los `__...__` de `deploy/.env.local` con secretos reales. Generar app vía el flujo C / SeniorWorkflow contra Supabase+Graphity locales.

**Gotchas caros (verificados):**
- **`.wslconfig` con `[experimental] autoMemoryReclaim` COLGÓ el engine** en "starting" indefinido. Removido → arranca normal con defaults (15.4GB). Re-introducir solo `memory=24GB`, sin experimental, con paciencia.
- **Tras `wsl --shutdown`, Docker Desktop NO rearranca el engine solo**; y **NO relanzar el `.exe` con la app abierta** (duplica procesos/instancias → confusión). Arrancar UNA vez y ESPERAR (la VM tarda + relevanta 16 contenedores). Los múltiples procesos "Docker Desktop" son helpers de Electron normales, no duplicados.
- **`/opt/unreal-copilot` del VPS NO es git** (deploy por sync). El checkout git es `/root/workspace/unreal-copilot` pero está **desincronizado** (`defeece` vs `954182c`) — NO usar para validar; validar contra `/opt` vivo.
- **`requirements.txt` del worker MIENTE** (declara solo temporalio; el worker importa `graphity-sdk` instalado de `Graphity/clients/graphity-sdk-py` local + httpx + anyio). Deuda del repo. En local: COPY del SDK al build context.

[[plataforma-agentica-estado]] [[tests-se-corren-en-vps]] [[no-codificar-la-esperanza-principio-raiz]] [[migracion-cockpit-vps-preparada]]
