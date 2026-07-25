# Copiloto del Emprendedor — README técnico

Agente conversacional **durable** para emprendedores: app móvil (Expo/RN) + web PWA, integraciones
vía Composio, cobros con MercadoPago, memoria de grafo (Graphity), orquestado con **Temporal**.
Graduado de `unreal-copilot` el 2026-07-06 vía `git filter-repo` (historia y blame preservados).

> **La versión de producto —qué hace y para quién— está en [README.md](README.md).**
> Este archivo es el mapa para quien va a tocar el código.

---

## Por dónde empezar

| Si venís a… | Leé |
|---|---|
| **Arrancar una sesión de trabajo** | [`HANDOFF.md`](HANDOFF.md) — init cero-fricción |
| Entender las reglas no negociables | [`CLAUDE.md`](CLAUDE.md) — constitución técnica |
| **Nombrar una entidad, endpoint o campo** | [`CONTEXT.md`](CONTEXT.md) — glosario del dominio |
| Saber en qué estado está cada frente | `coordinacion/PLAN.md` (no versionado) |

---

## Mapa del repo

| Dir | Qué |
|---|---|
| `apps/copiloto/` | Backend (capa **cliente**): worker Temporal, front-door FastAPI, dispatcher, servicios Composio, MercadoPago, memoria, auth |
| `apps/copiloto-web/` | Frontend PWA (Vite + React + TS), autocontenido (HTTP + JWT) |
| `apps/mobile/` | App móvil (Expo / React Native, New Architecture) — la cáscara glass |
| `packages/core/` | Lógica compartida entre clientes |
| `motor/` | **Motor vendorizado** (capa plataforma): `ConversationWorkflow` ReAct, gateways, canales, providers — ver `CLAUDE.md §2` |
| `deploy/` | Scripts de deploy idempotentes + `provision_tables.py` |
| `docs/` | Diseño, ADRs, economía, decisiones |
| `memoria/` | Memoria operativa del proyecto (índice `MEMORY.md`) |

---

## Las cuatro reglas que más muerden

1. **Los tests corren en el VPS, no en la PC** — la PC no tiene `temporalio`/`psycopg2`. Editar
   local → sync al VPS → `pytest` en el venv del VPS. **No declarar verde sin correrlo ahí.**
2. **Temporal es la columna.** Antes de tocar cualquier workflow/activity/worker, invocar la skill
   `temporal-developer`. Los workflows no pueden tener side effects ni no-determinismo.
3. **El motor está en fork duro** desde 2026-07-07: `scripts/sync-motor.sh` quedó retirado
   (fail-closed). Un fix del motor se hace **acá** — re-sincronizar pisaría la divergencia.
4. **Multitenant real:** ningún `cliente_id`/`composio_user_id`/seller sale de env — todo
   per-request vía `context_factory` (`TenantCtx`), con test adversarial de aislamiento.

Y las de siempre: cero secretos en el repo (`.env*` gitignored salvo `.template`), versiones
pinneadas, PR + rama sin push directo a `main`, Conventional Commits en minúscula.

---

## Correr las cosas

```bash
# Backend (en el venv del VPS)
cd apps/copiloto && python -m pytest tests

# Web
cd apps/copiloto-web && npm install && npm run build

# Móvil — Metro local + dev-client ya instalado en el device
cd apps/mobile && npx expo start --dev-client

# Grafo de código (sync manual; el pre-push lo hace incremental en cada push)
bash scripts/graph-sync.sh
```

Deps de Python pinneadas en `requirements.txt` (tomadas del venv de producción).

---

## Runtime

Caddy (`copilotoemprendedor.duckdns.org` → :8099) · GoTrue dedicada (`copiloto-auth`, Google OAuth
live) · Postgres (fusion) · Temporal (`127.0.0.1:7233`) · Graphity.

Deploy con `deploy/copiloto/deploy.sh` — idempotente, corre desde la PC y orquesta el VPS por SSH.
Runbook completo en [`HANDOFF.md`](HANDOFF.md) §5.3.

**Arquitectura objetivo de producción = 3 nodos dedicados** (Fase 3, diferida). Hoy corre una sola
instancia; el VPS actual es de desarrollo.

---

## El grafo de código

El repo está indexado en un grafo consultable por MCP (`graphity-code`,
`group_id="code-copiloto-emprendedor"`): archivos, funciones, clases y sus relaciones, extraído sin
LLM y actualizado en cada `git push`. Sirve para **localizar** (`file:line` en milisegundos, en vez
de barrer con greps) — y después **se prueba contra el archivo real**, siempre.

Cubre el código y sólo el código: `apps/*`, `packages/core`, `motor`, `scripts`, `spikes`, `deploy`.
**No cubre `docs/` ni `memoria/`, y es por diseño** — el valor del grafo es ser un índice isomorfo
del repo, y mezclarle prosa rompe justo eso. Manual completo en
`memoria/grafo-primero-codigo-despues-para-localizar.md`.

---

## Cómo se trabaja este repo

Tres sesiones simultáneas —**planificación**, **backend** y **frontend/app**— coordinadas por un
buzón de archivos (`coordinacion/`, **no versionado** a propósito). El estado de un trabajo **es la
ubicación de su archivo**: `abierto/` → `en-curso/` → `cerrado/<fecha>/`. Las reglas vivas están en
`coordinacion/COORDINACION.md` y se leen al arrancar la sesión y antes de cualquier commit.

⚠️ **Checkout compartido:** `git add` con rutas explícitas, nunca `-A`; jamás `checkout` / `pull` /
`stash` / `reset --hard` / `--amend`.
