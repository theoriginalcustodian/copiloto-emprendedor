---
name: agente-voz-economia-pricing
description: Economía del agente de voz — stack DEFINITIVO Deepgram self-hosted (STT+TTS Deepgram · Groq LLM · Telnyx inbound · Pipecat · Temporal). Costos por min/hora verificados + pricing SaaS flat.
metadata: 
  node_type: memory
  type: project
  originSessionId: 100872f9-d250-477c-9c8b-e2888c1d9139
---

**Economía del stack DEFINITIVO (2026-07-06).** Precios oficiales verificados. **LEER antes de fijar pricing / presupuestar.** Detalle completo (tabla por servicio min+hora, comparación Vapi, alternativas descartadas) en el doc `docs/Follow up/2026-07-06-agente-voz-stack-definitivo-selfhosted.md` y [[agente-voz-stack-definitivo-selfhosted]].

## Costo por minuto (self-hosted, todo incluido — solo INBOUND)
| Servicio | $/min | $/hora |
|---|---|---|
| STT Deepgram Nova-3 (multiling. streaming) | $0.0058 | $0.348 |
| LLM Groq llama-3.3-70b | ~$0.003 * | ~$0.18 |
| TTS Deepgram Aura-2 (Antonia) | $0.0135 | $0.810 |
| Telnyx trunking inbound (SIP fee) | $0.0032 | $0.192 |
| Telnyx media streaming (WebSocket) | $0.0035 | $0.210 |
| **TOTAL** | **~$0.029** | **~$1.74** |

\* LLM Groq = estimación (~4.5k in/250 out por min); medir con tráfico real. Resto = precios oficiales.

**Fijos:** DID Argentina Telnyx **$1/mes** · VPS Hetzner ya pago ($0 marginal).
**Add-on concurrencia:** canales Telnyx **$12/mes/10 concurrentes** (minutos ilimitados) → facturar a la clínica con recargo (costo fijo → margen). Breakeven vs por-minuto ~3.750 min/mes; de momento se usa por-minuto.

## vs Vapi (descartado)
Con Vapi: **~$0.075/min (~$4.53/h)** — su fee $0.05/min ~2,6× el self-hosted. Descartado (ver [[agente-voz-stack-definitivo-selfhosted]]).

## Pricing / go-to-market (sigue vigente)
- **Por-minuto NO cierra** para agenda de clínica (alto volumen/bajo valor unitario). Vehículo = **SaaS FLAT $299-399/mes**, anclado al ROI (no-shows evitados + cobertura 24/7), no al minuto.
- Márgenes con flat $349: COGS ~$0.029/min → **~83% a 2.000 min/mes · ~79% a 2.500 min/mes** (muy sanos; el cambio ElevenLabs→Aura-2 bajó el COGS ~-52% vs el stack anterior).
- El agente NO reemplaza 100% la recepcionista (HITL para lo complejo) → ahorro honesto = "no contratás la 2da / turno noche".

**Histórico (stack anterior, descartado):** Voxtral STT $0.006 + Groq + **ElevenLabs Valeria $0.037** = ~$0.046/min. TTS ElevenLabs dominaba (~80%). Reemplazado por Deepgram Aura-2 ($0.0135) → mitad de costo. [[factory-identidad-automatizacion-ia]]
