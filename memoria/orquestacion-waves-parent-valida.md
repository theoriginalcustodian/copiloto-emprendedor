---
name: orquestacion-waves-parent-valida
description: "En waves de sub-agentes sobre un working tree compartido, el parent valida+commitea y los sub-agentes solo editan; los general-purpose pueden delegar a hijos bg silenciosos → verificar estado real, no el reporte"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ec33fdc4-2762-40dc-aa4d-a1d591ef80fb
---

Patrón de orquestación validado en el sprint del frontend glass de la clínica (2026-06-29, PR #6 de `clinic-management`).

**Failure mode observado:** un sub-agente `general-purpose` al que se le dio una tarea grande **delegó a un hijo en background** y devolvió un **placeholder** ("te aviso cuando termine") tras 1 tool-use. El parent leyó un estado intermedio del working tree, lo interpretó como "abandonado", y **re-despachó** → dos agentes haciendo la misma fase en paralelo (colisión, sin daño esta vez).

**Why:** sub-agentes con la tool `Agent` disponible pueden sub-delegar fuera del control del parent; su reporte final no es evidencia del trabajo. Y con **working tree + dir de build compartidos**, varios agentes validando/commiteando concurrentemente se pisan (race en el git index y en el build dir del VPS).

**How to apply:**
1. **El parent es el único que valida y commitea** (estado compartido = git). Los sub-agentes de la wave **solo editan** (file-ownership exclusiva por entidad), NO validan en el recurso compartido, NO commitean, NO delegan — instrucción tajante "hacelo VOS, no uses la tool Agent".
2. **Verificar estado real, no el reporte** del sub-agente (git status/log + grep de los archivos), sobre todo antes de re-despachar — el reporte puede ser un placeholder de una delegación oculta. [[no-codificar-la-esperanza-principio-raiz]]
3. Edición paralela disjunta = segura; **validación serializada en el parent** (un solo sync+gate por barrier) evita races en el build dir compartido del VPS.
4. Gate por fase = runner de tests (no-regresión funcional) + screenshots/MCP (visual). [[tests-se-corren-en-vps]] [[apps-deploys-siempre-vps]]
