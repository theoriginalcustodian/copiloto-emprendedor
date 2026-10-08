# Recibo del gate que `DEC-14` cita como evidencia del cierre — preservado por AUDITORÍA

**Qué es.** El recibo de `scripts/gate.sh` para el SHA **`92fd8a06`**, que es el alcance anclado del
cierre firmado en `DEC-14` («cierra contra el alcance anclado, con recibo que cubre»).

**Por qué está acá y no en `.ci-recibos/`.** `.ci-recibos/` está **gitignored a propósito**
(`.gitignore:2`), así que el recibo vivía **sólo** en `/c/gfw-src/wt-gate-cierre/.ci-recibos/` — un
worktree que la **poda** (tarea #1 de la cola de cierre) alcanza. De las tres guardas del podador,
mergeado y limpio **aprueban borrarlo**, y la única que lo protegía es «sin actividad reciente», que
**expira por definición**. Ver la fila `H-RECIBOENWORKTREE` en
[`../../ALCANCE-CIERRE-BETA.md`](../../ALCANCE-CIERRE-BETA.md).

Esta copia **no cambia la política**: `.ci-recibos/` sigue ignorado. Es un `cp` a la carpeta de
Auditorías, para que el recibo sea legible **desde un clon limpio** y el cierre no quede acreditado
por un archivo que ya no existe.

**Qué acredita el JSON** (verificado al copiarlo, no citado de memoria):

| campo | valor |
|---|---|
| `sha` | `92fd8a06ad3ef0eb748603aa2e88541522b82a4b` |
| `arbol` | `03083d3cbeab4ed7bb053f2b57fa2677da48672c` |
| `sesion` | `plan` |
| `fecha` | `2026-10-08T13:30:57Z` |
| `duracion_seg` | 1398 |
| `stub` | **false** (no es un recibo de relleno) |
| `sucio` | **false** (árbol limpio al medir) |
| jobs | `web` `core` `backend` `lint` `mobile` → todos **`ok`** |

**Los 5 logs NO se commitean** (694 KB de logs de CI en un repo público es ruido), pero quedan
**huellados** para que un log recuperado siga siendo verificable:

| log | md5 | bytes |
|---|---|---|
| `…-backend-1791466157.log` | `fe3b75db627848fafb70de1de18a7c79` | 203.928 |
| `…-core-1791464859.log` | `4692b9a4fecc1f88c9bf20cfce2d2af2` | 7.813 |
| `…-lint-1791465489.log` | `487747f8b6995c8791ea42e1e5517838` | 64.917 |
| `…-mobile-1791465163.log` | `0a4bb2979833512f071da234213c04ba` | 327.963 |
| `…-web-1791464958.log` | `17c2c010bb3803a568762aab01a12a87` | 89.782 |

Los `log` de cada job, dentro del JSON, apuntan a rutas **dentro de `wt-gate-cierre`**: cuando ese
worktree se pode, esas rutas dejan de resolver. El JSON y estas huellas son lo que queda.

**Integridad de la copia:** `md5` del JSON = `4ff97e6839f90d3b3bfdc83ee1800740`, idéntico al original
en `wt-gate-cierre` al momento de copiarlo.

**Lo que esto NO resuelve.** El podador sigue sin guard por `.ci-recibos` no vacío (tiene uno para
`_vigia-pins/` en `scripts/podar-worktrees.sh:202`), así que **el próximo recibo va a correr el mismo
riesgo**. Eso sigue siendo de **planificación**, dueña de la cola de cierre.
