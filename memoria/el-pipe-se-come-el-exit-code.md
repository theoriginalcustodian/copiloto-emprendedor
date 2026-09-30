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

---

## Segunda faz (2026-09-30): el `; echo` final se lo come igual, y la NOTIFICACIÓN lo repite

El pipe no es el único sumidero. **Cualquier cosa después del `;` se vuelve el veredicto**, y en un
comando lanzado en background el harness reporta el exit del **último** comando de la línea.

**Caso.** Lancé un push así, creyendo que lo estaba instrumentando mejor:

```bash
git push origin <rama> > push9.log 2>&1; echo "EXIT=$?"
```

La notificación del background dijo **«completed (exit code 0)»**. El log decía:

```
httpx.WriteTimeout: The write operation timed out
[graph-sync] ❌ el sync salió con status 1.
error: failed to push some refs to 'https://github.com/…'
```

**El push había fallado** (el pre-push aborta cuando el sync del grafo se cae — ver
[[graphity-backup-cron-tumba-el-api-4x-dia-60-90s]]), y el `echo` final —que sí terminó bien— fue el
exit que el harness reportó. Lo cazó el control correcto: `git ls-remote` mostraba el SHA **anterior**
mientras `git rev-parse HEAD` mostraba el nuevo. Es [[git-push-puede-salir-exit-0-sin-haber-pusheado]],
pero llegando por otra puerta: ahí el engaño era del `push`, acá del **envoltorio que yo mismo escribí
para no ser engañado**.

**El agravante:** el `echo "EXIT=$?"` **sí** imprime el código correcto **dentro** de la salida. Sirve si
alguien lee la salida. No sirve para el resumen de una tarea en background, que es justo donde uno confía
en el semáforo y no abre el archivo — [[el-parte-del-proveedor-existe-y-no-lo-lei]].

**Cómo aplicarlo:** para una operación cuyo éxito importa, el veredicto no se lee del exit code **de
ninguna forma** — se mide en el efecto: `ls-remote` para un push, contenido para un merge, el blob para
un archivo. Y si igual querés el código, que el comando **termine** en la operación y no en un `echo`,
un `tail` ni un `||  true`.
