---
name: deuda-secretos-rotar
description: "Inventario consolidado de secretos que pasaron por chat y deben rotarse PRE-PRODUCCIÓN (no urgente en dev, decisión operador 2026-06-26). Único lugar de verdad; antes estaba disperso en ~6 entradas."
metadata: 
  node_type: memory
  type: project
  originSessionId: 6784837f-d1f4-4fa0-ba69-0620e24abcf0
---

**Deuda de secretos a rotar — inventario consolidado (deuda GESTIONADA, no urgente).**

**Prioridad:** diferida a **pre-producción**. El operador (2026-06-26) declaró que la rotación **no le preocupa en dev** — el sistema corre en un VPS de desarrollo, uso personal. Esta entrada existe para que la deuda sea **visible** (no invisible) con propietario + condición de pago, NO para tratarla como urgente. **Antes de ir a producción: rotar todo lo de abajo.**

**Propietario:** operador. **Condición de pago:** primer deploy con tráfico real / exposición pública.

| Secreto | Ubicaciones | Caveat al rotar |
|---|---|---|
| **GitHub PAT classic** (operativo) | `~/.claude/secrets/github.env` (pasó por chat) | **Rotar primero** (decisión operador). |
| **GitHub PAT fine-grained** | `gh` del VPS · `~/.claude/secrets/github.env` | El `gh` del VPS lo usa para open_pr/merge. |
| **Graphity key** | **5 lugares** (grep antes de rotar para enumerar exacto) | Reconciliar TODAS en el mismo PR (grep-first). |
| **Composio key** | config MCP user-scope | Riesgo lethal trifecta; NO heredar a agentes autónomos. |
| **code-server secret** | VPS | — |

**Decisiones explícitas (NO rotar / excepciones):**
- **Bot HITL de Telegram (`Unreal_Copilot_HITL_bot`):** el operador decidió **NO rotar** — riesgo aceptado, uso personal, el token **nunca tocó el repo**.
- **wa-sender bot token** (canal WhatsApp): rotar pre-prod.

**Why:** un secreto pegado en chat = comprometido (regla de oro #6). Tenerlos dispersos en ~6 entradas = deuda invisible; consolidarlos en un solo inventario la vuelve gestionada.
**How to apply:** antes de exponer a producción, rotar en orden (classic PAT → resto), con **grep-first** para cazar todas las ocurrencias de cada key en un solo PR (un deploy parcial revierte el resto), y **restart** de los servicios que la consumen.

[[plataforma-agentica-estado]] [[composio-mcp-gmail-acceso-completo]]
