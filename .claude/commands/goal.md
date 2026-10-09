# /goal — fijar (o leer) la orden de trabajo activa

Uso: `/goal <ID>` · `/goal <ID> — <nota>` · `/goal` (muestra la activa) · `/goal clear`

Hacé **exactamente esto**, sin preámbulo:

1. `bash scripts/goal.sh set <ID> "<nota si vino>"` — si el id no está en el padrón, el comando
   **rechaza** y lista candidatos: no inventes un goal ni lo fuerces, pedí el id correcto.
   Sin argumento: `bash scripts/goal.sh show`. Con `clear`: `bash scripts/goal.sh clear`.
2. Leé el **DoD de la fila** que imprimió y la fuente (`path:línea`). Abrí ese doc y leé la fila
   completa más su contexto inmediato. El criterio de cierre es el del doc, no el que yo resuma.
3. Decí en **una línea** qué vas a hacer primero y cuál es la evidencia que va a cerrar el DoD.
4. **Arrancá.** No pidas confirmación: fijar el goal ES la autorización (CLAUDE.md §3.8).

Desde ese momento:

- El hook `scripts/hooks/goal_activo.mjs` inyecta el goal en cada turno (y nada si no hay).
- `scripts/ci/atribucion.sh` (pre-push) marca `FUERA-GOAL` cualquier commit que cite otro id.
  Citá el id en el **asunto** del commit, o agregá una línea `ATRIBUCION: libre — <motivo>`.
- Trabajo que no sea el goal: **no se hace**. Si aparece algo que parece urgente, se escribe como
  hallazgo o `pedido_` en el buzón y se sigue con el goal. Eso es lo que el forense del
  2026-10-08 midió que faltaba: 64 PRs en un día, 4 del backlog firmado.
- `goal.sh clear` cuando el DoD está cumplido **con evidencia**. Con la cola vacía, cerrar con el
  estado ES el cierre correcto (CANON 8a) — no se fabrica trabajo para no cerrar en reporte.
