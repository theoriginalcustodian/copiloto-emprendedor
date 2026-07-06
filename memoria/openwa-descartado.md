---
name: openwa-descartado
description: "OpenWA (gateway WhatsApp self-hosted, github.com/rmyndharis/OpenWA) evaluado el 2026-06-19 y DESCARTADO — legítimo pero innecesario, no se adopta."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**OpenWA evaluado y DESCARTADO (2026-06-19).** `github.com/rmyndharis/OpenWA` — gateway WhatsApp self-hosted **legítimo** (9.6k stars, MIT, NestJS/Node 22, REST API + webhooks HMAC + audit log; release v0.4.4). NO es typosquatting: es un proyecto distinto del viejo `open-wa/wa-automate`. El tutorial que lo acompañaba es de tododeia.com.

**No se adopta, por:** (1) el canal HITL ya está resuelto y mejor (Telegram + botones + signal-based — ver [[canal-whatsapp-hermes]] / [[hitl-callback-signal-validado]]); (2) el tutorial arma un asistente WhatsApp **AUTÓNOMO** (Claude responde solo) — lo OPUESTO a HITL; (3) la instrucción era correrlo **LOCAL en la compu del operador** = downgrade de disponibilidad (depende de la compu encendida) frente a Evolution en el VPS 24/7. Si algún día se quisiera migrar de Evolution por su arquitectura (HMAC/audit log más sólidos), sería **en el VPS, no local** — pero no es prioridad.
