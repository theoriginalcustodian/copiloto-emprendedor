---
name: filtro-a-planificacion-no-ve-destinatarios-compuestos
description: "El filtro del vigía `-a-planificacion_` no ve `pedido_X-a-backend-y-planificacion_…`: un pedido a dos destinatarios quedó 20+ min sin leer (K-07-B, 2026-09-21)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-09-21T23:28:49.151Z
---

El vigía filtra `abierto/` con `-a-(planificacion|todos)_`. Un pedido dirigido a DOS sesiones
(`pedido_frontend1-a-backend-y-planificacion_K-07-B…`) no matchea: el destinatario compuesto termina en
`-y-planificacion_`. FE1 esperó el contrato de K-07-B sin que planificación lo viera; apareció sólo
porque el PR #588 lo mencionaba.

**Why:** los nombres con varios destinatarios (`a-backend-y-frontend1-y-planificacion_`) son normales en la
junta, y el filtro asumía un único destinatario.

**How to apply:** listar con `find abierto en-curso -name '*planificacion_*' ! -name '*_planificacion-a-*'`
(cualquier posición del destinatario, excluyendo lo que yo emití). Pendiente: corregir el mismo filtro
en el prompt del vigía en `.claude/commands/monitoreo.md`.
