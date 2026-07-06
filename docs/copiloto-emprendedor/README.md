# Copiloto del Emprendedor — Índice de documentación

> **Qué es esto:** mapa único de TODA la documentación del Copiloto del Emprendedor, esté donde esté en el repo (y en repos vecinos). Punto de entrada para cualquier agente/persona que retome el proyecto.
> **Regla:** los docs narrativos de producto viven **en esta carpeta** (`docs/copiloto-emprendedor/`); los specs/plans técnicos viven en su carpeta canónica `docs/superpowers/{specs,plans}/` (convención del proyecto, NO se mueven); los cross-cutting (Graphity, RAG) viven donde su tema pertenece. Este índice los ata a todos.
> **Fecha:** 2026-07-01.

---

## 📍 En esta carpeta (`docs/copiloto-emprendedor/`) — narrativa de producto

| Doc | Qué contiene |
|---|---|
| [2026-06-29-copiloto-emprendedor-roadmap.md](./2026-06-29-copiloto-emprendedor-roadmap.md) | **Roadmap / fuente de verdad del "¿qué sigue?"**: fases, decisión MAYOR (fábrica arma B), gaps A/B/C, servicios Composio decididos, decisiones tomadas/abiertas. |
| [2026-07-01-copiloto-vision-producto-diferencial-pricing.md](./2026-07-01-copiloto-vision-producto-diferencial-pricing.md) | **Visión de producto**: diferencial (correlación cross-servicio), posicionamiento, arquitectura macro (soberana, Graphity + RAG), pricing PLG, panorama competitivo, capa RAG. |
| [2026-07-01-copiloto-economia-cogs-composio-llm.md](./2026-07-01-copiloto-economia-cogs-composio-llm.md) | **Economía / COGS**: pricing Composio + LLM verificado, modelo de tokens, COGS por tier, soporte agéntico, pendientes de validación (spike #97). |

---

## 🛠️ Specs y planes técnicos (`docs/superpowers/` — carpeta canónica, NO mover)

**Specs** (`docs/superpowers/specs/`):
- `2026-06-30-copiloto-b-walking-skeleton-design.md` — diseño del walking skeleton E2E de B (chat web → ConversationWorkflow durable → Composio).
- `2026-06-30-composio-gateway-design.md` — boundary fail-closed a Composio (3er provider del arquetipo `conversational_agent`; **infra compartida**, no exclusivo del copiloto).
- `2026-06-30-runbook-composio-servicios-design.md` — runbook para agregar toolkits Composio.

**Plans** (`docs/superpowers/plans/`):
- `2026-06-30-copiloto-b-walking-skeleton.md`
- `2026-06-30-composio-gateway.md`
- `2026-06-30-runbook-composio-servicios.md`

---

## 🔗 Cross-cutting (mencionan/afectan al copiloto pero su tema es otro)

| Doc | Ubicación | Relación con el copiloto |
|---|---|---|
| Handoff fix aislamiento Graphity | `docs/Follow up/2026-06-30-handoff-fix-aislamiento-graphity.md` | Aislamiento de tenant de Graphity (afecta a TODO el fleet, ARCA incluido). El operador reporta el fix aplicado (2026-06-30/07-01); **pendiente confirmar test adversarial de aceptación** = el spike `graphity-tenant-isolation`. |
| Memoria de agentes con Graphity (trifecta) | `docs/research/2026-06-30-memoria-agentes-graphity-trifecta.md` | Research de la capa de memoria del agente (aplica al copiloto y en general). |
| Idea — estudio de mercado | `docs/Ideas a explorar/me gustaria hacer un estudio de mercado completo s.md` | Idea exploratoria. |

---

## 🧠 Capa RAG (repo vecino `supabase-self-host-blueprint`)

RAG production-ready multi-tenant (pgvector + hybrid RRF, RLS por cliente/namespace) en el VPS **fusion**. El copiloto lo usa en **tiers altos** (docs del dueño); el **bot de atención al público** lo usa para info del emprendimiento (ya hecho).

- `supabase-self-host-blueprint/docs/rag/README.md` — quickstart + stack + costos.
- `supabase-self-host-blueprint/docs/rag/HTTP_API.md` — endpoints PostgREST.
- `supabase-self-host-blueprint/docs/rag/fusion_done_right_trifecta_2026-07-01.md` — **por qué NO fusionar RAG + Graphity todavía** (diferido, trigger definido).
- `supabase-self-host-blueprint/docs/rag/onboarding_cliente_nuevo.md` — alta de cliente/namespace.

---

## 🗂️ Docs maestros del proyecto (contexto general)

- `CLAUDE.md` — constitución técnica de Unreal Copilot.
- `docs/ROADMAP.md` — roadmap maestro de la fábrica (el copiloto es una línea dentro).
- `docs/ARCHITECTURE.md` — arquitectura completa del sistema.
- `docs/HANDOFF.md` — onboarding del agente.

---

## 🧭 Memorias relevantes (auto-memory del proyecto)

Índice: `~/.claude/projects/.../memory/MEMORY.md`. Claves para el copiloto:
- `copiloto-emprendedor-roadmap` — estado + decisión MAYOR.
- `copiloto-economia-cogs` — COGS Composio+LLM marginal.
- `tool-overload-routing-agente` — orden de defensas de ruteo de tools.
- `composio-gateway-ladrillo` — boundary + runbook Composio.
- `factory-identidad-automatizacion-ia` — identidad/moat.
- `agente-conversacional-hardening-3-lentes` — 6 defensas anti-LLM (aplican al bot público + RAG).

---

## Código relevante (para trazar del doc al código)

- Arquetipo `conversational_agent`: `deploy/skeleton_kit/archetypes/conversational_agent/` (motor durable + providers LLM/STT/ComposioGateway/channels).
- `ComposioGateway`: `.../reference/clients/agent/providers/composio_gateway.py`.
- Walking skeleton de B: `apps/copiloto/**`.
- Habilitador de conexiones Composio: `.../tools/enable_services.py`.
