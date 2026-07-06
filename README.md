# Copiloto del Emprendedor

Agente conversacional **durable** para emprendedores: web PWA + integraciones (Composio), cobros (MercadoPago), memoria de grafo (Graphity), orquestado con **Temporal**. Graduado de `unreal-copilot` (2026-07-06).

## Mapa

| Dir | Qué |
|---|---|
| `apps/copiloto/` | Backend: worker Temporal, front-door FastAPI, dispatcher, servicios Composio, MercadoPago, memoria, auth |
| `apps/copiloto-web/` | Frontend PWA (Vite + React + TS), autocontenido |
| `motor/` | Motor vendorizado (ConversationWorkflow ReAct + gateways + canales) — ver `CLAUDE.md §2` |
| `deploy/` | Scripts de deploy + `provision_tables.py` |
| `scripts/sync-motor.sh` | Sync-con-drift-check del motor vs la fábrica |
| `docs/` | Diseño, economía, decisiones |

## Desarrollo

- **Los tests corren en el VPS** (la PC no tiene las deps). Ver `CLAUDE.md §3`.
- Backend: `cd apps/copiloto && python -m pytest tests` (en el venv del VPS).
- Frontend: `cd apps/copiloto-web && npm install && npm run build`.
- Deps python pinneadas en `requirements.txt`.

## Estado

Graduación **Fase 2 (extracción)** hecha. **Fase 2.5 (redefinir deploy + cutover del VPS)** pendiente — ver `CLAUDE.md §4`.
