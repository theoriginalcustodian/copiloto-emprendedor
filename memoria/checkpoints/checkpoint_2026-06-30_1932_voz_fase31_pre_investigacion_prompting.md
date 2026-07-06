---
name: checkpoint-voz-fase31-pre-investigacion-prompting-2026-06-30-19-32
description: Snapshot ejecutivo para retomar. Pulido del agente de voz Fase 3.1 casi cerrado; cuello = entonación (causa raíz verificada = prompt); pausa para investigar SOTA de prompting de voice agents.
metadata: 
  node_type: memory
  type: checkpoint
  session_id: unknown
  project_root: c:\Proyectos\Claude\Claude code\unreal-copilot
  originSessionId: 71f17f51-8d23-4cc1-8f4e-882a39f99ff8
---

# Checkpoint — voz_fase31_pre_investigacion_prompting — 2026-06-30 19:32

## 🎯 Objetivo de la sesión / sprint
Pulir el agente de voz en vivo full-duplex (Canal C / Fase 3.1) para que se sienta natural: voz es-AR, baja latencia, barge-in, audio de fondo, y un prompt que entone bien. Dejar todo impecable antes del PR. **NO** se toca la integración con la agenda real (eso es Fase 3.2, otro sprint).

## ✅ Hecho (qué ya quedó cerrado)
- **Voz** = clon de Lucas (ElevenLabs pro, 0.90) vía `ref_audio`, **PCM crudo sin normalizar** (la normalización sonaba a "locutor de radio" — validado A/B). Commit `217582f`.
- **Latencia**: STT 1255→**201ms** (skip del evento `Done`), TTS por streaming de la respuesta completa (prosodia íntegra, sin gaps). Validado por el operador ("va fluida").
- **Barge-in**: cableado (VAD client durante playback + watcher único server que cancela el TTS) + recalibrado a umbral **0.02** (el `echoCancellation` del browser atenúa la voz; con 0.05 nunca disparaba). FUNCIONA (1 barge real en log).
- **Prompt v1**: SYS+GREETING reescritos (puntuación expresiva + frases cálidas + tono rioplatense). Operador: "va bastante mejor".
- **Audio de fondo #1** ("quiet clinic reception"): procesado a mono 24kHz seamless (crossfade 0.2s, -3dBFS) con `process_ambient.py`, desplegado en el VPS (`/ambient.wav` sirve 200, 1.43MB), cliente con bed gain 0.06 + ducking. **VALIDADO por el operador** ("el toque que faltaba").
- **Consolidación**: commit `217582f` en `feat/agente-voz-fase3` (6 archivos del spike + .gitignore, sin secretos, scoped).

## 🔄 En curso (qué está a medio hacer)
- **Cuello = ENTONACIÓN.** Síntoma del operador: las respuestas suenan robóticas, "entona como si la frase siguiera, no baja el tono al final".
  - **Causa raíz VERIFICADA empíricamente** (script `inspect_replies.py` en el VPS, ejercita el LLM+SYS reales): **5 de 6 respuestas terminan en pregunta** (`¿...?` → tono ascendente) + **frases largas con enumeraciones** ("¿qué día te viene bien, lunes, martes, miércoles...?") → Voxtral mantiene tono de continuación y nunca resuelve hacia abajo. **Es el TEXTO (prompt), NO un límite de Voxtral.**
- **Decisión del operador (este checkpoint):** NO seguir ajustando el SYS a ciegas → hacer **investigación de SOTA de prompting de agentes de voz** ANTES de seguir. Esa investigación se va a extender → por eso este checkpoint.

## ⏭️ Próximos pasos concretos
1. **Investigar SOTA de prompting de agentes de voz** (el frente que el operador abrió). Cubrir: cómo escribir el SYS para naturalidad + **cierre tonal** (que baje el tono al final) en TTS conversacional es-AR; manejo de preguntas vs afirmaciones; longitud/estructura de respuesta para TTS; patrones de turn-taking conversacional. Producir trifecta (SOTA + failure-map + decision-matrix) en `docs/research/`. Revisar primero si `docs/research/2026-06-29-voice-agent-sota-failuremap.md` ya cubre algo de prompting (es de arquitectura, probablemente no).
2. **Aplicar los hallazgos al SYS** (respuestas más cortas, cerrar con afirmación cuando se pueda, pregunta breve y clara) → redeploy → **validar en vivo** (el operador escucha si baja el tono).
3. **Velocidad de respuestas cortas**: probar clip de referencia `lucas_ref_093.mp3` (ya en el VPS) — solo si las cortas-lentas aún molestan; NO arregla entonación.
4. **Limpieza pre-cierre** (AL FINAL, baja el túnel + apaga instrumentación): `VOICE_TIMING=1`→off en `.env`, quitar el medidor `bargePeak` DEBUG de `index.html`, borrar voces de prueba en ElevenLabs (Lucas queda), bajar `spike-tunnel`.
5. **PR** de `feat/agente-voz-fase3` → main (el operador lo pidió "al final").
6. (Futuro, MAYOR, otro sprint) **Fase 3.2**: conectar la voz a la agenda durable real (Temporal / agente de Fase 1 en `clinic-management`).

## ⚠️ Bloqueos / decisiones pendientes del operador
- **Decisión tomada:** investigar prompting de voice agents antes de seguir tocando el SYS (este checkpoint la registra).
- **Pendiente del operador (para Fase 3.2, futuro):** aprobar scope de la integración voz↔agenda (MAYOR).
- **Audio de fondo:** elegido #1 (de #1/#4). El #4 quedó procesado en scratchpad por si quiere cambiar.

## 📚 Contexto crítico para retomar
- **Branch**: `feat/agente-voz-fase3` @ `217582f`. Código del spike **commiteado y limpio** (git status NO muestra el spike como modificado).
- **Untracked en el repo (NO del agente de voz — de otras líneas/sesiones):** `.claude/settings.json`, `Loops/`, varios `docs/Follow up|research|superpowers/`, `es-ar-listen/`, `spikes/graphity-tenant-isolation/`. NO commitear en este scope.
- **Server VIVO en el VPS** (`unreal-copilot`, `/opt/spikes/voice-ws/`): `spike-voice.service` ACTIVO (uvicorn 127.0.0.1:8080, health 200, código de `217582f` + ambient #1). Retomar/levantar: `ssh unreal-copilot 'bash /opt/spikes/voice-ws/run.sh'` (imprime URL). Bajar: `stop.sh`.
- **Túnel PÚBLICO ACTIVO**: `spike-tunnel` (cloudflared, URL efímera `https://relevance-impose-blacks-cleaning.trycloudflare.com`). ⚠️ Expuesto a internet — **bajarlo si la pausa es larga** (`ssh unreal-copilot 'systemctl stop spike-tunnel'`).
- **Assets**: `ambient.wav` (#1 procesado) desplegado en el VPS; fuentes en `es-ar-listen/voces-argentinas/Ambiente/` (gitignored). `lucas_ref_093.mp3` en el VPS (no commiteado).
- **Scripts de diagnóstico (scratchpad + VPS)**: `inspect_replies.py` (cómo escribe el agente), `process_ambient.py` (procesa el bed), `intonation_test.py`, `tts_isolation.py`, `probe_*`.
- **Memoria del proyecto**: `agente-voz-vivo-spike-s3.md` (bloque "FASE 3.1" con todos los hallazgos: voz cruda, barge-in 0.02, prompt v1, **cuello de entonación con el spike dirigido pendiente**).
- **Sub-agents bg activos**: ninguno. **Cronjobs activos**: ninguno.

## 🧠 Modelo mental / supuestos
- **Verificado, no asumido:** la entonación robótica = el prompt (5/6 respuestas terminan en pregunta + frases largas), NO Voxtral. Voxtral entona según el texto.
- **Supuesto NO validado aún:** que un SYS mejorado (respuestas cortas + cierre con afirmación) hará que Voxtral baje el tono al final. **Falta el spike de audio**: generar declarativa-terminada-en-punto vs pregunta con el clip Lucas → ¿Voxtral produce la caída tonal terminal en es-AR? Si NO → cambio de motor TTS (MAYOR). Este spike es parte del paso 1/2.
- **Decidido posponer:** Fase 3.2 (agenda real), pulido fino del prompt hasta tener la investigación, velocidad de cortas (0.93) salvo que moleste.
- El operador valida SIEMPRE por oído en vivo antes de aceptar un cambio de audio.

## 📊 Estimación de progreso
- **Avance vs objetivo (Fase 3.1 pulido):** ~80%. Cerrado: voz, latencia, barge-in, audio de fondo, prompt v1, consolidación. Falta: entonación (bloqueada en investigación), limpieza, PR.
- **Tiempo gastado:** sesión larga de pulido iterativo (validación por oído en vivo).
- **Tiempo estimado restante:** investigación de prompting ~1-2h + aplicar/validar ~0.5-1h + limpieza+PR ~0.5h = **~2-3.5h wall** para cerrar Fase 3.1.
