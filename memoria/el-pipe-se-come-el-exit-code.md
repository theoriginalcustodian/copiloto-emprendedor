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
