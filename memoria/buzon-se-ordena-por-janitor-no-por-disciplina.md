---
name: buzon-se-ordena-por-janitor-no-por-disciplina
description: El archivado del buzón NO puede depender de que alguien se acuerde de mover a cerrado/ — se apila; lo garantiza un janitor determinista corrido por el dueño en cada ciclo
metadata:
  type: feedback
---

**Cuando `abierto/` se apila, no escribas otra regla de conducta — automatizá el archivado.**

El 2026-07-22 `abierto/` llegó a 32 y se escribió la regla manual "el `mv` va pegado al acuse"
(COORDINACION §4.2.bis). El 2026-07-23 llegó a **136 — peor**. Una regla de disciplina que empeora
tras escribirse no es el mecanismo.

**Por qué la disciplina falla acá:** archivar cae en el hueco entre tareas — cuando acusás, tu tarea
es *acusar*, y el `mv` queda para un después que no llega ([[mensaje-entregado-donde-nadie-mira]]).
Y hay un agujero que la disciplina no puede tapar: las difusiones `-a-todos_` **no tienen condición
de cierre** (nadie acusa un broadcast) → bajo la regla manual nunca se archivan, y son el grueso.

**How to apply:** `scripts/archivar-buzon.sh` (PR#90) — janitor determinista, idempotente, corrido por
PLANIFICACIÓN (dueña del buzón) en **cada ciclo de su cadencia de monitor**. Ciclo de vida: obligaciones
(`contrato_`/`pedido_`/`urgente_`) nunca se auto-archivan (cierre manual — son el **ancla** del hilo);
tráfico fresco (`mtime` < TTL 90min) se queda; el resto (`dato_`/`avance_`/`listo_`/`hallazgo_`/
`respuesta_`/…) > TTL → `cerrado/<fecha>/`. `coordinacion/` es gitignored → `mv` puro, no toca git.
El ancla es el `contrato_`, no los satélites: un hilo vivo se reconoce por su contrato abierto; el
papeleo consumido va a `cerrado/` (retrievable, no perdido). Detalle: COORDINACION §4.2.quater.

**El patrón general:** un estado que hay que acordarse de actualizar se desincroniza y miente. Si el
mantenimiento de un instrumento de coordinación depende de disciplina humana, tarde o temprano falla
bajo presión — movelo a un barrido automático del dueño del estado. [[frentes-abiertos-tablero]]
