---
name: el-pipe-se-come-el-exit-code
description: `cmd | tail` devuelve el exit code de `tail`, no de `cmd`. Una tarea de fondo reportó "completed (exit code 0)" con un traceback adentro y el grafo sin sincronizar.
metadata:
  type: reference
---

`comando | tail -12` devuelve el status del **último** proceso del pipe (`tail`), que casi siempre
sale 0. El fallo del comando real queda **sólo en el texto**.

El 2026-07-24 lancé el sync del grafo de código así, en background. La notificación dijo
**«completed (exit code 0)»** — y el output terminaba en
`GraphityError: timeout esperando la migración mig_QMCawbV38o6S0NhK`. Sin abrir el archivo, el
grafo se habría dado por sincronizado con hito 9 adentro, cuando no lo estaba.

**Por qué esta variante es peligrosa:** un exit code es la señal que uno consulta *en vez de* leer la
salida, sobre todo en background, donde el output vive en un archivo aparte que hay que abrir a
propósito. El pipe convierte un fallo ruidoso en un éxito silencioso — la forma exacta de
[[instrumentos-que-confirman-en-vez-de-verificar]], acá a nivel de shell.

**Fixes, por orden de preferencia:**
- No pipear lo que se va a juzgar por exit code. Guardar todo y leerlo (`> out 2>&1`).
- Si hace falta el pipe: `set -o pipefail`, o consultar `${PIPESTATUS[0]}`.
- Y la regla general: **para un comando de fondo, el veredicto es el output, no el status.**

Corolario del mismo caso: **el grafo desactualizado es peor que no tener grafo** — responde con
confianza sobre el estado anterior. Ver [[grafo-primero-codigo-despues-para-localizar]] §frescura.

---

## La variante que engaña a quien mira notificaciones: el harness reporta el exit del ÚLTIMO comando

No hace falta un pipe. **Un `;` alcanza.** Un comando en background que termina en
`... ; echo EXIT=$?` devuelve el exit del **`echo`**, no el del trabajo — y el harness anuncia
**«completed, exit code 0»** sobre una corrida donde el proceso murió.

Lo vivido (2026-09-23): el veredicto verde y el fallo real quedaron **en el mismo archivo**, y el
verde era el que llegaba como notificación.

> **El «exit code» de una tarea en background es el del último comando del compuesto, no el del
> trabajo que te importa.** Si tu comando termina en `echo`, `tail`, `python -c` o cualquier resumen,
> ese exit no mide nada.

**Dos formas de no depender de él:**
1. **Capturar el código inmediatamente:** `mi_trabajo; RC=$?; ...; exit $RC`.
2. **Mejor: no creerle al exit y leer el artefacto** — el recibo, el JSON, el log. El exit es una
   señal de un solo bit que atraviesa varias capas; el artefacto lo escribió el trabajo mismo.

**Y un modo de falla del artefacto, para no reemplazar un engaño por otro:** leer una clave que no
existe. `d.get("arbol_sucio")` sobre un recibo cuyo campo se llama `sucio` devuelve `None` sin
fallar, y `None` **no es** «limpio» ni «sucio»: es «no miré». Imprimir las claves disponibles antes de
consultarlas cuesta una línea.
