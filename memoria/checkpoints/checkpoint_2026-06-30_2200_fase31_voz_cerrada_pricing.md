---
name: checkpoint-fase31-voz-cerrada-pricing-2026-06-30-22-00
description: "Snapshot ejecutivo. Fase 3.1 del agente de voz CERRADA (ElevenLabs/Valeria, PR"
metadata: 
  node_type: memory
  type: checkpoint
  session_id: 71f17f51-8d23-4cc1-8f4e-882a39f99ff8
  project_root: c:\Proyectos\Claude\Claude code\unreal-copilot
  parent_checkpoint: memory/checkpoints/checkpoint_2026-06-30_1932_voz_fase31_pre_investigacion_prompting.md
  originSessionId: 71f17f51-8d23-4cc1-8f4e-882a39f99ff8
---

# Checkpoint — fase31_voz_cerrada_pricing — 2026-06-30 22:00

## 🎯 Objetivo de la sesión / sprint
Cerrar la Fase 3.1 del agente de voz en vivo (Canal C) con calidad de demo + analizar la economía/pricing del servicio. Ambos hechos.

## ✅ Hecho
- **Fase 3.1 CERRADA y en main:** TTS migrado Voxtral→**ElevenLabs (voz Valeria es-AR, `9oPKasc15pfAbMr7N6Gs`)** detrás de flag `TTS_PROVIDER=voxtral|elevenlabs`; SYS v3 (español blindado + concordancia de horas + teléfonos deletreados); barge-in (VAD 0.02 vs eco AEC); audio de fondo; log PHI gateado. **PR #99 (código, `365f8a9`) + PR #100 (docs, `9581946`)** mergeados; ramas limpiadas.
- **Causa raíz "habla raro" (verificada por log real STT→LLM):** el STT Voxtral realtime no acepta forzar idioma → anglifica nombres propios y manda cifras; el LLM los espejaba → fix en el SYS. **Residual "deivid" (TTS pronuncia nombres en inglés) ACEPTADO** = límite de motor.
- **Relevamiento de parámetros ElevenLabs + clasificación por tier** → `docs/Follow up/2026-06-30-elevenlabs-parametros-pulido-proximo-sprint.md` (las 3 mejoras reales — naturalidad/deivid/latencia — NO requieren Pro/Enterprise).
- **Análisis de economía + pricing** (memoria `agente-voz-economia-pricing`): COGS ~$41/1000min (TTS=89%); ElevenLabs=suscripción; **por-minuto NO cierra para agenda → SaaS flat $299-399/mes anclado a no-shows/24-7**.
- **Propagación del cierre:** memoria del spike + MEMORY.md + ROADMAP maestro + roadmap dedicado de voz (Fase 3.1 marcada CERRADA).
- **Finding de seguridad** (PHI en logs) direccionado: log gateado tras `VOICE_DEBUG_TRANSCRIPTS`.
- **Aprendizaje de proceso guardado:** no insistir con rotación de keys en dev (memoria `no-insistir-rotacion-keys-desarrollo`).

## 🔄 En curso
- **Servicios VIVOS por pedido del operador** (sigue probando + compartió la URL con un amigo): server `spike-voice` + túnel `spike-tunnel` ACTIVOS, provider=elevenlabs, debug log ON. **NO bajarlos.** URL efímera abajo.

## ⏭️ Próximos pasos concretos
1. **Leer los turnos de la prueba con el amigo** cuando el operador avise: `ssh unreal-copilot "journalctl -u spike-voice --no-pager -o cat | grep '^\\[TURN\\]' | tail -40"` → detectar ajustes de prompt/voz.
2. **Volver empírico el modelo de costos/pricing:** medir chars/turno reales del log `[TURN]` + min/cliente/mes con el 1er cliente → reemplazar supuestos.
3. **Fase 3.3 (MAYOR, otro sprint):** integrar la voz al agente de agenda durable real (Temporal / `clinic-management`). Requiere aprobar scope. (La 3.2 del roadmap = robustez de producción, 🟡 parcial.)
4. **Go-to-market / pricing:** modelo SaaS flat diseñado (memoria pricing); falta validar con 1er cliente real.

## ⚠️ Bloqueos / decisiones pendientes del operador
- Fase 3.3 (voz↔agenda) = MAYOR → aprobar scope antes de construir.
- Pricing definitivo = decisión de negocio (análisis listo; falta cliente real para calibrar min/cliente/mes).

## 📚 Contexto crítico para retomar
- **Servicios vivos** en el VPS `/opt/spikes/voice-ws/`: `spike-voice.service` (uvicorn 127.0.0.1:8080, health 200) + `spike-tunnel.service`. **URL efímera: https://browse-enjoying-rss-vast.trycloudflare.com** (cambia si el túnel reinicia → releer con `journalctl -u spike-tunnel -o cat | grep trycloudflare | tail -1`).
- **`.env`:** `TTS_PROVIDER=elevenlabs` · `ELEVEN_VOICE_ID=9oPKasc15pfAbMr7N6Gs` (Valeria) · `VOICE_DEBUG_TRANSCRIPTS=1` (ON, dev) · `VOICE_TIMING` off.
- **Deploy = scp manual** de `.py`/`.html` + `systemd-run` restart. **El merge a main NO actualiza el VPS.** Reiniciar solo el server manteniendo el túnel: `systemctl stop spike-voice` + `systemd-run --unit=spike-voice --working-directory=/opt/spikes/voice-ws -p EnvironmentFile=/opt/spikes/voice-ws/.env /opt/spikes/voice-ws/.venv/bin/uvicorn app:app --host 127.0.0.1 --port 8080`. Levantar todo (URL nueva): `bash /opt/spikes/voice-ws/run.sh`. Bajar: `stop.sh`.
- **Código en main** (`spikes/clinic-agent-s3-voice-ws/`). Rama local `feat/agente-voz-fase3` (mergeada). git status: docs de otras líneas untracked (NO de este scope, no commitear).
- **Key ElevenLabs** en `.env` del VPS + archivo local `Apikey elevenlabs.txt` (gitignored ✓). NO rotar en dev.
- **Sub-agents bg / cronjobs activos:** ninguno.

## 🧠 Modelo mental / supuestos
- Costos/pricing basados en SUPUESTOS (chars/min, min/cliente/mes) → validar con cliente real.
- Fase 3.1 = prototipo de voz standalone; NO conecta a agenda real todavía (eso es 3.2).
- Servicios vivos = decisión explícita del operador (probar + compartir), NO olvido de cierre.

## 📊 Estimación de progreso
- **Fase 3.1: 100% cerrada** (código+docs en main, validada en vivo por oído).
- Restante del frente de voz: Fase 3.2 (robustez, 🟡 parcial) + Fase 3.3 (integración con agenda, MAYOR) + go-to-market (negocio).
