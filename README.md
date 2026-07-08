# Copiloto del Emprendedor

Agente conversacional **durable** para emprendedores: web PWA + integraciones (Composio), cobros (MercadoPago), memoria de grafo (Graphity), orquestado con **Temporal**. Graduado de `unreal-copilot` (2026-07-06).

## Mapa

| Dir | Qué |
|---|---|
| `apps/copiloto/` | Backend: worker Temporal, front-door FastAPI, dispatcher, servicios Composio, MercadoPago, memoria, auth |
| `apps/copiloto-web/` | Frontend PWA (Vite + React + TS), autocontenido |
| `motor/` | Motor vendorizado (ConversationWorkflow ReAct + gateways + canales) — ver `CLAUDE.md §2` |
| `deploy/` | Scripts de deploy + `provision_tables.py` |
| `scripts/sync-motor.sh` | RETIRADO — motor en fork duro (2026-07-07); ya no se sincroniza con la fábrica |
| `docs/` | Diseño, economía, decisiones |

## Desarrollo

- **Los tests corren en el VPS** (la PC no tiene las deps). Ver `CLAUDE.md §3`.
- Backend: `cd apps/copiloto && python -m pytest tests` (en el venv del VPS).
- Frontend: `cd apps/copiloto-web && npm install && npm run build`.
- Deps python pinneadas en `requirements.txt`.

## Estado

Graduación completa (Fase 0/1/2/2.5) — desplegado vivo en el VPS (ver `HANDOFF.md §1`, `CLAUDE.md §4`). Motor en **fork duro** desde 2026-07-07 (`CLAUDE.md §2`). Falta Fase 3 (infra 3-nodos).
