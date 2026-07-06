---
name: agente-voz-stt-groq
description: "Integración de mensajes de voz (Groq Whisper STT) en el agente conversacional — cerrada; cómo funciona, lecciones, deuda de pulido"
metadata: 
  node_type: memory
  type: project
  originSessionId: 71f17f51-8d23-4cc1-8f4e-882a39f99ff8
---

Integración de **mensajes de voz CERRADA** (2026-06-29 · clinic-management #7 + cosecha al arquetipo #94). Una nota de voz de Telegram → se descarga → Groq `whisper-large-v3` → el transcript sigue el flujo de texto normal. Validado en vivo + 38 unit + E2E (escenario S6). Worker en vivo con `GROQ_API_KEY`.

**Cómo funciona (capa plantilla, cosechada al arquetipo `conversational_agent`):** el canal marca `kind=needs_stt` con el file_id en `text`; el motor ejecuta la activity `transcribe_voice` (download del canal → `get_stt_provider().transcribe`) ANTES de clasificar; el transcript reemplaza al file_id → `call_llm`. Si el STT falla → pide texto sin romper el hilo. `GroqSTT` (`clients/agent/providers/stt.py`) = gemelo de `LlmProvider`: urllib (sin SDK), endpoint OpenAI-compatible, registrado global con `register_stt_provider`.

**Lecciones de integración (spike S4/Motor C — validar contra el proveedor y audio REALES):** (1) Telegram envía `.oga`; Groq lo rechaza por extensión pero acepta OGG/Opus → subir con filename `.ogg`, **sin ffmpeg**. (2) Groq/Cloudflare devuelve **403** al User-Agent default de urllib → mandar uno propio. (3) **La voz dispara caminos que el texto no**: el transcript es más largo/formal → Flash clasifica distinto (mete la especialidad en `professional` → el name_hint borraba al profesional; marca `ask_info` una pregunta de disponibilidad → derivaba). Los fixes fueron ESTRUCTURALES: `name_hint` desambigua pero no vacía una especialidad que matchea; un book en curso hace que `ask_info` AVANCE en vez de derivar; `book` se limpia al agendar. [[agente-conversacional-hardening-3-lentes]]

**Deuda de pulido (gestionada · diferida — operador 2026-06-29 "cosas por pulir para más adelante"):**
- `_specialty_matches` no maneja orden invertido ("médico clínico" ≠ "clínica médica") ni sinónimos ("medicina general").
- El log `STT_TRANSCRIPT` expone el transcript en journalctl → **gatear por env en producción real con PHI**.
- Apellido propio de profesional dicho por voz **sin validar** (ninguna de las muestras lo ejercitó).
- STT single-provider (Groq); sin failover (ElevenLabs validado / Voxtral documentado en `docs/playbooks` como alternativas + TTS).
- **Mini-barrido adversarial de los flujos de voz** pendiente (como el de Fase 1.7) — la voz expone caminos que el texto no ejercitaba.

**Modelo:** `whisper-large-v3` (turbo ≈ en calidad, fallback si se excede cuota free). Stack sin SDK OpenAI (urllib). GROQ_API_KEY a rotar → [[deuda-secretos-rotar]].
