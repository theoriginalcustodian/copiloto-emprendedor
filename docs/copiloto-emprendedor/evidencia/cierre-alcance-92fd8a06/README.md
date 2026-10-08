# Evidencia del cierre del ALCANCE — `92fd8a06`

**Por qué existe esta carpeta.** `DEC-14` cierra el sprint *«contra el alcance anclado en
`92fd8a06` con recibo que cubre»*, y ese recibo vivía **sólo** en `.ci-recibos/` de un worktree
(`wt-gate-cierre`) que la poda alcanza: dos de sus tres guardas aprobaban borrarlo y la única que
lo protegía —«actividad reciente»— **expira por definición**. Hallazgo `H-RECIBOENWORKTREE` de
AUDITORÍA. Un cierre acreditado con un archivo no versionado se vuelve inauditable en cuanto se
limpia el disco.

**`.ci-recibos/` sigue ignorado a propósito** (`.gitignore:2`): esto **no** cambia esa política.
Es una copia puntual de la evidencia que un acta cita, al lado del doc que la cita.

## Qué hay

| archivo | qué acredita |
|---|---|
| `recibo-gate.json` | el recibo completo: `sha 92fd8a06` · `arbol 03083d3c` · sesión `plan` · `2026-10-08T13:30:57Z` · `duracion_seg 1398` · **`stub:false`** · **`sucio:false`** · los **5 jobs en `ok`** |
| `colas-de-log/*.tail30.log` | las **últimas 30 líneas** de cada job — donde está el veredicto |

**Por qué colas y no los logs enteros:** los 5 logs pesan **688K** y lo que acredita el verde son
sus últimas líneas. Las colas pesan **24K** y dicen lo mismo:

| job | veredicto en su cola |
|---|---|
| `core` | `53 passed` archivos · **`647 passed`** tests |
| `backend` | **`2302 passed, 27 skipped`** en 80.53s |
| `web` · `mobile` · `lint` | verde, sin líneas de fallo |

Los campos `log` del JSON apuntan a rutas **dentro del worktree original**, que ya no existirán
después de la poda: se dejan tal cual porque son parte del recibo, y lo que reemplaza su contenido
son las colas de esta carpeta.

## El falso positivo, anotado para que no se repita

Un barrido de `failed|error` sobre la cola de `backend` da **1 hit**, y no es un fallo: es
`test_admin_errores_reintentar.py: 4 warnings` — la palabra está en el **nombre del archivo**.
El nombre es una hipótesis sobre el contenido; el veredicto está en la última línea.
