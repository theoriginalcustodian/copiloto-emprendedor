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
| **GitHub PAT fine-grained** (fábrica) | `gh` del VPS · `~/.claude/secrets/github.env` | El `gh` del VPS lo usa para open_pr/merge. |
| **OpenRouter key** | **3 lugares:** Hermes `~/.hermes/.env` · PC `~/.claude/secrets/openrouter.env` · worker DeepSeek `/etc/unreal-copilot/deepseek-worker.env` | **Restart de Hermes + worker DeepSeek** al rotar (si no, siguen con la vieja). |
| **Graphity key** | **5 lugares** (grep antes de rotar para enumerar exacto) | Reconciliar TODAS en el mismo PR (grep-first). |
| **Fugu (Sakana) key** | spike `spikes/fugu-ultra/` config | — |
| **Composio key** | config MCP user-scope | Riesgo lethal trifecta; NO heredar a agentes autónomos. |
| **code-server secret** | VPS | — |
| **OpenAI key (GPT-4o mini — cerebro del canal C de voz)** | archivo `unreal-copilot/openai apikey.txt` (gitignored, `*Apikey*.txt`) · VPS `/opt/spikes/voice-ws/.env` | Provista 2026-06-29 para el spike S3 / Fase 3. Restart del servicio de voz al rotar. Pasó por archivo (gitignored), no por chat. |
| **Groq key (LLM + STT voz)** | archivo `unreal-copilot/Apikey Grok.txt` (gitignored) · VPS `/etc/unreal-copilot/clinic-agent.env` (STT agente agenda) · VPS `/opt/spikes/voice-ws/.env` (**LLM `llama-3.3-70b` del canal C voz en vivo, Fase 3.1** — agregada 2026-06-30) | **Restart `clinic-worker.service` + `spike-voice.service`** al rotar. Pasó por archivo (gitignored), no por chat. |
| **Mistral key (Voxtral STT realtime + TTS — canal C voz en vivo)** | archivo `unreal-copilot/Mistral Apikeys.txt` (gitignored, `*Apikeys*.txt`) · VPS env del spike/servicio de voz | Provista 2026-06-29 para el **spike S3** (voz por WebSocket). Restart del servicio de voz al rotar. Pasó por archivo (gitignored), no por chat. |

**Decisiones explícitas (NO rotar / excepciones):**
- **Bot HITL de Telegram (`Unreal_Copilot_HITL_bot`):** el operador decidió **NO rotar** — riesgo aceptado, uso personal, el token **nunca tocó el repo**.
- **wa-sender bot token** (canal WhatsApp): rotar pre-prod junto con OpenRouter.

**Why:** un secreto pegado en chat = comprometido (regla de oro #6). Tenerlos dispersos en ~6 entradas = deuda invisible; consolidarlos en un solo inventario la vuelve gestionada.
**How to apply:** antes de exponer a producción, rotar en orden (classic PAT → resto), con **grep-first** para cazar todas las ocurrencias de cada key en un solo PR (un deploy parcial revierte el resto), y **restart** de los servicios que la consumen.

[[plataforma-agentica-estado]] [[canal-whatsapp-hermes]] [[composio-mcp-gmail-acceso-completo]] [[fugu-revisor-integracion]]
