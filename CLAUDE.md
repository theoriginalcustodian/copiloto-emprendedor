# Copiloto del Emprendedor — Constitución Técnica

> **Repo:** `copiloto-emprendedor` (privado). **Owner:** David Lin / Agencia HyC.
> **Idioma:** instrucciones y comentarios en español; código, scripts e identificadores en inglés.
> **Origen:** graduado de `unreal-copilot` el 2026-07-06 vía `git filter-repo` (historia/blame preservada). El copiloto era la app-estrella del arquetipo `conversational_agent` de la fábrica; se extrajo a repo propio para separación comercial/producto.
> **Arranque de sesión → [`HANDOFF.md`](HANDOFF.md)** (init cero-fricción: seed de memoria, accesos, flujos de trabajo).

---

## 0. Qué es

Agente conversacional **durable** para emprendedores: chatea por web (PWA), integra sus apps (Composio: Gmail, Drive, Sheets, Docs, HubSpot, Instagram, Calendar), cobra por MercadoPago, y recuerda su actividad (memoria de grafo Graphity). El moat es la **orquestación durable con Temporal** (sobrevive cortes, reintenta, sesión permanente vía continue-as-new).

---

## 1. Estructura

```
copiloto-emprendedor/
├── apps/copiloto/          # backend (capa CLIENTE): worker Temporal, web front-door FastAPI,
│                           #   dispatcher, servicios Composio, MercadoPago, memoria, auth
├── apps/copiloto-web/      # frontend PWA (Vite + React + TS), autocontenido (HTTP + JWT)
├── motor/                  # MOTOR VENDORIZADO (capa PLATAFORMA): backend/agent + clients/agent
│                           #   — el ConversationWorkflow ReAct, gateways, canales, providers
├── deploy/copiloto/        # scripts de deploy (deploy.sh, sync-web.sh, GoTrue, Caddy snippet)
├── deploy/worker/          # provision_tables.py (infra de tablas, RLS + policy)
├── docs/copiloto-emprendedor/
├── scripts/sync-motor.sh   # sync-con-drift-check del motor vs la fábrica
└── requirements.txt        # deps python pinneadas (del venv de prod)
```

## 2. El motor vendorizado (boundary clave)

`apps/copiloto/**` importa el motor con `from backend.agent... / from clients.agent...`. El path se resuelve en **un solo lugar**: `apps/copiloto/_paths.py` → `MOTOR_REF` = `UC_MOTOR_REF_PATH` (env) o el default `motor/`. `conftest.py` corre `ensure_paths()` una vez por sesión de pytest. **NUNCA volver a esparcir `sys.path.insert` por los módulos** (se colapsaron 92 a este mecanismo en la Fase 1 de graduación).

El motor es una **copia vendorizada** del arquetipo `conversational_agent` de `unreal-copilot`. Hasta el fork duro se mantiene alineado con `scripts/sync-motor.sh` (`check` reporta drift, `sync` actualiza). Decisión: vendorizar-con-sync (patrón `fleet-platform`).

## 3. Reglas no negociables

1. **Cero secretos en repo.** `.env*` (salvo `.template`) gitignored. Verificar `git status` antes de commit.
2. **Tests corren en el VPS**, no en la PC (la PC no tiene `temporalio`/`psycopg2`/etc.). Flujo: editar local → sync al VPS → `pytest` en el venv del VPS. **No declarar verde sin correrlo en el VPS.**
3. **Temporal es la columna.** ANTES de tocar cualquier workflow/activity/worker, invocar la skill `temporal-developer` (+ `temporal-ai-patterns` para ReAct/HITL/child-workflow). Los workflows NO pueden tener side effects ni no-determinismo.
4. **Versiones pinned** (`requirements.txt`, imágenes Docker). Nada de `latest`.
5. **PR + rama** — sin push directo a `main`. Conventional Commits en minúscula.
6. **Spike-first** ante supuestos críticos no validados; **no codificar la esperanza** (evidencia ejecutable, no autoevaluación).
7. **Multitenant real:** ningún `cliente_id`/`composio_user_id`/seller sale de env — todo per-request vía `context_factory` (`TenantCtx`). Aislamiento cross-emprendedor verificado con test adversarial.

## 4. Deploy y cutover (Fase 2.5)

El deploy (`deploy/copiloto/deploy.sh`, idempotente, corre desde la PC y orquesta el VPS por SSH) ya está **reconciliado al layout graduado**: el path del motor pasó de `deploy/skeleton_kit/.../reference` a `motor/` en `deploy.sh`, ambos units `uc-copiloto-{web,worker}.service` (PYTHONPATH), `sync-test-backend.sh` y `gotrue/deploy-gotrue.sh`. Mount verificado en el VPS (spike: **333 colección VERDE** con `motor/`).

**Único pendiente = el cutover del servicio vivo:** hoy el copiloto corre desde `/opt/uc-repos/copiloto` (scp-seeded desde la fábrica); falta el switch para que corra desde este repo — **una sola instancia**, mismo dominio/DB/usuarios, solo cambia el origen del código. **Runbook con backup + rollback en [`HANDOFF.md`](HANDOFF.md) §5.3.** Runtime: Caddy (`copilotoemprendedor.duckdns.org` → :8099) + GoTrue dedicada (`copiloto-auth`) + Postgres (fusion) + Temporal (`127.0.0.1:7233`) + Graphity. Fase 3 (infra 3 nodos dedicados) = diferida.

## 5. Referencias

- **Arranque / init cero-fricción → [`HANDOFF.md`](HANDOFF.md)** (raíz). **Memoria del proyecto → `memoria/`** (índice `MEMORY.md` + 113 entradas); sembrala en el slug de Claude Code con `scripts/seed-memory.sh` (idempotente).
- Plan de graduación (Fase 0/1/2): `docs/copiloto-emprendedor/2026-07-06-graduacion-plan-fase0-fase1.md`.
- Dominio propio + auth Google: `docs/copiloto-emprendedor/` + config en `deploy/copiloto/`.
- Assets de diseño/voz (fuera del repo): `docs/ASSETS-EXTERNAL.md`.
