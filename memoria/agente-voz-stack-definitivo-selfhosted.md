---
name: agente-voz-stack-definitivo-selfhosted
description: "Stack DEFINITIVO del agente de voz (2026-07-06): self-hosted Pipecat + Telnyx (inbound) + Deepgram STT+TTS + Groq LLM + Temporal. Vapi evaluado y DESCARTADO por la fee. Doc detallado + economía."
metadata: 
  node_type: memory
  type: project
  originSessionId: 100872f9-d250-477c-9c8b-e2888c1d9139
---

**Stack DEFINITIVO del agente de voz (2026-07-06) — reemplaza el del spike S3 (Voxtral+ElevenLabs a mano).** Doc fuente de verdad: `docs/Follow up/2026-07-06-agente-voz-stack-definitivo-selfhosted.md`. **LEER al retomar voz.**

**Arquitectura self-hosted (media plane + durable plane):**
- **Telefonía = Telnyx, SOLO INBOUND** — DID Argentina local + Media Streaming (WebSocket). Único caso: recibir la llamada **desviada** desde la clínica cuando la recepcionista no atiende/rechaza/ocupado (desvío condicional GSM `*61*`/`*67*`/`*62*`, lo configura la clínica en su línea; ella paga el tramo del desvío). **Sin outbound** (decisión de producto → elimina móvil AR ~$0.35/min, verified caller-ID, anti-spam).
- **Media plane = Pipecat** (BSD-2, self-hosted en el VPS) — orquesta STT/LLM/TTS + turn-taking (Smart Turn) + barge-in + VAD, ya resueltos (reemplaza el FastAPI/WS a mano del spike S3). Invoca a Temporal por **function-calling**.
- **STT = Deepgram Nova-3** (`es-419` + keyterm prompting → fuerza idioma, resuelve el "deivid" en el STT, no con parche de prompt).
- **LLM = Groq** `llama-3.3-70b-versatile`.
- **TTS = Deepgram Aura-2 voz "Antonia"** (acento argentino explícito; validado por oído por el operador). Deepgram cubre STT+TTS → un proveedor, una key.
- **Cerebro = Temporal** `ConversationWorkflow` (el moat, intacto). Pipecat es media plane, NO orquestador de lógica → NO contradice "no migrar a frameworks".

**Vapi (orquestador gestionado) EVALUADO y DESCARTADO** — fee $0.05/min se paga aun con BYO keys → ~$0.075/min (~2,6× el self-hosted). Con el stack tan barato, la fee sería ~65% del costo. El moat es Temporal, no el media plane → Pipecat da lo mismo self-hosted sin la fee. Trade-off: operamos la infra (proceso Pipecat + cuenta Telnyx).

**Economía → detalle en [[agente-voz-economia-pricing]] y el doc.** Total **~$0.029/min (~$1.74/h)**, todo incluido. + DID $1/mes. Add-on concurrencia = canales Telnyx $12/mes/10 concurrentes → upsell con recargo.

**Pendientes = spikes de validación (deuda gestionada; propietario operador; pagar antes de piloto):** (1) telefonía AR (tramitar DID + desvío real + viabilidad multi-tenant/bundle por clínica) `[REQUIRES_LIVE_VALIDATION]`; (2) WER Deepgram STT es-AR real; (3) latencia E2E Pipecat (sweet spot 750-900ms); (4) migrar media plane spike S3 → Pipecat (S3 = fallback); (5) medir costo real LLM Groq; (6) definir recargo del add-on de concurrencia.

[[agente-voz-vivo-spike-s3]] [[agente-voz-economia-pricing]] [[agente-voz-stt-groq]] [[factory-identidad-automatizacion-ia]] [[no-codificar-la-esperanza-principio-raiz]]
