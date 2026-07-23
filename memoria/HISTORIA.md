---
name: historia-hitos-cerrados
description: "Bitácora de hitos CERRADOS del Copiloto del Emprendedor + entradas movidas del índice activo. NO es estado vivo (eso está en MEMORY.md, HANDOFF.md y CLAUDE.md §4-5). Buscable, no se carga por sesión."
metadata:
  type: reference
---

# Historia — Copiloto del Emprendedor (hitos cerrados)

> **Qué es:** entradas de memoria de **hitos cerrados** o superados, sacadas del índice activo
> (`MEMORY.md`) para no penalizar el prompt-cache — pero el topic file sigue existiendo y es
> **buscable**. NO es estado vivo: el "¿qué sigue?" vive en `HANDOFF.md` (raíz), el detalle en
> `CLAUDE.md §4-5`, el tablero de frentes en `coordinacion/PLAN.md`, la doctrina viva en `MEMORY.md`.
>
> **Política:** cuando un hito cierra, su línea de índice se mueve acá; el topic file permanece en
> `memoria/`. La historia **pre-graduación de la fábrica `unreal-copilot`** (builds del músculo
> autónomo, jun-2026) NO vive acá — su fuente de verdad es el repo de la fábrica.

## Movidos del índice el 2026-07-22 (auditoría de memoria)

- [💳 Billing — J27 colisión de tablas → namespacing](billing-system-sistema-compuesto.md) — `project`. **Afecta TODA app nueva.** + guard en provision_tables. Arquetipo `recurring_charge`.
- [🚀 Copiloto del Emprendedor — walking skeleton E2E (#97)](copiloto-emprendedor-roadmap.md) — `project`. Snapshot pre-graduación (2026-06-30): agente durable + Composio + BI; reusa `ConversationWorkflow`. Superado por el estado vivo en HANDOFF/CLAUDE.
- [📱 Copiloto frontend móvil (PWA) — UX + retoma](copiloto-frontend-movil-ux-estado.md) — `project`. Deploy solo-frontend=`sync-web.sh` (NO deploy.sh). Sesión persistente vía refresh-token (PR #118). [[pwa-sw-staleness-gotcha]]
- [Plataforma Agéntica — accesos/infra del VPS](plataforma-agentica-estado.md) — `project`. VPS Hetzner 133209712, 178.105.191.1, alias SSH `unreal-copilot`. Temporal `127.0.0.1:7233`. (Puntero; los accesos también en HANDOFF.md.)
- [🔌 MCP Composio — Gmail (scope user)](composio-mcp-gmail-acceso-completo.md) — `project`. Auth Bearer. Riesgo lethal trifecta. NO heredar a agentes autónomos.
- [🎓 Graduación a repo propio `copiloto-emprendedor` (Fase 0/1/2/2.5, cutover vivo)](copiloto-graduacion-fase0-fase1.md) — `project`. Hito CERRADO 2026-07-06: filter-repo 123 commits, motor vendorizado en `motor/`, cutover VIVO (smoke 10/10). El boundary del motor vive en CLAUDE.md §2 y en [[motor-fork-duro-fix-buffer-corto]].
- [💳 MercadoPagoGateway — 2º boundary de pagos E2E VIVO (PR #110)](mercadopago-gateway-impl-followup.md) — `project`. E2E probado 2026-07-04. Pendiente EXTERNO: homologación MP. Research en [[mercadopago-integracion-research]].
