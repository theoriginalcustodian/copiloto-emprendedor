---
name: la-senal-de-confianza-del-stt-ordena-al-reves-del-caso-de-uso
description: Las alucinaciones de ruido salen CONFIADAS y la voz legítima corta sale pésima, así que todo umbral de confianza mata la confirmación HITL.
metadata:
  type: reference
---

Medido por backend el 2026-11-05 sobre el STT real: el ruido alucinado da `avg_logprob` **-0,19 a
-0,36** (tan confiado como voz real, -0,25 a -0,46), y el peor puntaje de todo el corpus es **voz
legítima corta**: «Sí» → **-0,78**. `compression_ratio` y `no_speech_prob` también se solapan.

**Why:** el orden de la señal es **inverso al del caso de uso**. Cualquier corte por confianza que
atrape ruido rechaza primero las confirmaciones de una palabra del HITL — el input más importante
del sistema. Un proxy (largo, confianza) mide otro eje que el que importa, que es plausibilidad.

**How to apply:** el guard del STT discrimina por **energía de la señal**
(`apps/copiloto/audio_sin_voz.py`: `STT_RMS_MIN`, `STT_DINAMICA_MIN`, kill-switch
`STT_GUARD_ENERGIA=0` para rollback sin deploy), nunca por confianza ni por largo. Y el corte de
**plausibilidad** va en la UI mostrando el transcript, no en `/transcribir`, que es genérico:
[[un-guard-despues-de-la-confirmacion-humana-contradice-al-usuario-informado]].
