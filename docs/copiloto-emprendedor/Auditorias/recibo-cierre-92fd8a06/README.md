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

**Integridad de la copia — el control es el `blob sha1`, no un `md5`.**

```
git rev-parse origin/main:docs/copiloto-emprendedor/Auditorias/recibo-cierre-92fd8a06/92fd8a06ad3ef0eb748603aa2e88541522b82a4b.json
# => b2b5d0cdf0c4742ffe24019f749a15962b3281c3
```

Ese sha1 se reproduce desde **cualquier** clon y **cualquier** OS, porque nombra el objeto que git
guarda, no el archivo que cada checkout escribe. Verificable con
`git show <ref>:<path> | git hash-object --stdin` (control positivo: da el mismo sha1; negativo: un
byte agregado da otro).

⚠️ **La primera versión de esta línea estaba mal, y vale escribir por qué.** Decía
«`md5` del JSON = `4ff97e68…`, idéntico al original». Ese md5 es real, pero es el de **la copia de
trabajo en una máquina Windows**, no el del contenido que recibe quien clona:

| sujeto | md5 |
|---|---|
| el archivo en disco en este checkout (CRLF) | `4ff97e6839f90d3b3bfdc83ee1800740` |
| el contenido tal como git lo guarda (LF) | `c4df00b66c53c80d789ad6157d412fde` |

El JSON es **una sola línea** con un fin de línea al final; `core.autocrlf=true` lo normalizó a LF al
commitearlo y lo reconstruye a CRLF al hacer checkout en Windows. Contenido idéntico (el JSON
parseado compara igual, campo por campo), **bytes distintos** — así que un auditor en Linux o el CI
hubiera medido `c4df00b6…`, leído `4ff97e68…` acá, y concluido que la copia estaba corrupta. **Un
hash de control que depende del OS del que lo verifica no es un control.**

Nota al margen que es un hallazgo en sí: `.gitattributes` fija `eol=lf` para `*.sh`, `*.bash`,
`*.service`, `Dockerfile` y `*.snippet` —y su encabezado dice, con razón, «esto NO depende de la
config git de cada máquina: viaja con el repo»— pero **no cubre `.json`**. O sea que los bytes de un
**artefacto de evidencia** commiteado acá los decide el `core.autocrlf` de quien commitea. Para este
archivo no importa (el control es el blob sha1), pero es la misma clase de no-determinismo que ese
`.gitattributes` existe para matar.

Los `md5` de los 5 logs de la tabla de arriba **no** tienen este problema: son los bytes en disco de
archivos que nunca pasan por git.

**Lo que esto NO resuelve.** El podador sigue sin guard por `.ci-recibos` no vacío (tiene uno para
`_vigia-pins/` en `scripts/podar-worktrees.sh:202`), así que **el próximo recibo va a correr el mismo
riesgo**. Eso sigue siendo de **planificación**, dueña de la cola de cierre.
