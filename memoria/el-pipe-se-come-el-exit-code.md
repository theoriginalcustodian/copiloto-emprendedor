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

---

## Refuerzo 2026-10-05 · `merge-tree` salió **rc=0 con tres CONFLICT en el output**, y el culpable fue mi propio `tr`

Midiendo conflictos de merge, el patrón era: capturar la salida de `git merge-tree --write-tree` pasándola
por `tr -d` para limpiar los CR, y leer `$?` en la línea siguiente.

`$?` quedó en **0** mientras la salida traía un `CONFLICT (add/add)` y dos `CONFLICT (content)`. No es una
rareza de `merge-tree`: el código de una sustitución con tubería es el del **último** comando — `tr`, que
siempre sale 0. Y el `tr` estaba ahí por una razón legítima: el CRLF de `gh`/`jq` en Windows ya había
fabricado un falso rojo horas antes. **El fix de una capa se comió el canal de veredicto de la siguiente.**

Lo que salvó la medición fue tener **dos** defensas y no una: el veredicto se decidía por el **mensaje**
(buscando `CONFLICT`, con una rama aparte para `not something we can merge`) y el rc era sólo informativo.
Con el rc como juez habría publicado «LIMPIO» sobre un merge con tres conflictos, y ese veredicto habría
mandado a cuatro sesiones a mergear.

**La regla, afilada:** cuando metés un filtro (`tr`, `sed`, `tail`) entre una operación y su veredicto,
estás eligiendo el exit code del filtro. Si el código importa, sacalo **antes** del pipe —guardar la salida
cruda y leer `$?` ahí, o `PIPESTATUS[0]`— y aun así, que el juez sea el efecto o el mensaje. Corolario de
proceso: **un fix puede romper el instrumento de la capa de al lado**, y el único modo de notarlo es que el
veredicto no dependa de un solo canal.

Pariente de [[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]] y de
[[git-push-puede-salir-exit-0-sin-haber-pusheado]].

## Refuerzo 2026-10-08 — el pipe se comió el exit code DEL GATE, y lo que el gate decidía era un merge

Esta entrada ya existía, la había escrito yo, y reincidí **en el único lugar donde el exit code no es
informativo sino constitucional**: el gate de CI que decide si un PR se mergea.

    bash scripts/ci-verde.sh "$N" 2>&1 | tail -9; rc=$?
    if [ "$rc" -eq 0 ]; then gh pr merge "$N" --squash; fi

`rc` valió **0** porque es el exit de `tail`. El gate había impreso, en ese mismo log,
«ROJO — SIN MEDIR: no hay ninguna medición del PR 952», y el PR se mergeó igual. Reproducción, dos
líneas: `bash -c 'exit 7' | tail -1` ⇒ `0`; `bash -c 'exit 7' > /dev/null` ⇒ `7`.

**Por qué entró el pipe, que es lo que hay que recordar:** no lo puse para filtrar nada — lo puse para
que el log fuera **legible**, para ver las últimas 9 líneas en vez de la corrida entera. La decisión
era cosmética; el efecto fue sacarle el voto al juez. ⇒ **un filtro agregado por legibilidad cambia,
callado, quién es el juez.** Es peor que un filtro puesto a propósito, porque nadie revisa una
decisión de formato buscando un cambio de semántica.

**Cómo salió benigno, y por qué no cuenta como que salió bien:** el run del PR apareció 20 s después
del merge y dio `success`, igual que el `push` de `main`. El contenido estaba verde. Pero **verde
medido después no es lo mismo que gateado**: la medición no participó en la decisión. Si el contenido
hubiera estado rojo, el resultado habría sido idéntico — merge — y eso es la definición de un gate que
no gatea.

**La forma que uso desde ahora, en una línea:** sacar el veredicto del pipe, nunca el pipe del
veredicto.

    bash scripts/ci-verde.sh "$N" > "$G" 2>&1; rc=$?; tail -9 "$G"

Primero el `$?` crudo, después la legibilidad. (`PIPESTATUS[0]` también sirve, pero obliga a recordar
que existe; redirigir a archivo no obliga a recordar nada.)

Hermana nueva: [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] — acá el instrumento **condenaba**
correctamente y el pipe le tapó la boca; y el hallazgo `H-WATCHSINCHECKS`, que explica por qué el
gate condenaba (el `--watch` no esperó porque el CI aún no se había registrado).

## Refuerzo 2026-10-12 · el pipe no sólo **esconde** un fallo propio: **fabrica un defecto ajeno**, y el «fix» habría sido una regresión

Tercera recurrencia de esta clase en una sola sesión, y la más cara de las tres por lo que iba a
hacer **después** de la mala lectura.

Corrí un instrumento ajeno así:

```
bash scripts/cola-check.sh 2>&1 | head -30; echo "rc=$?"
   -> ❌ COLA: no puedo ver mi sujeto — no existe .../PLAN.md
      Esto NO es «cola en orden»: es «no medí nada»
      rc=0
```

Y concluí: *«el instrumento avisa bien pero sale rc=0 sin haber medido nada… lo anoto»*. Lo anoté
como defecto de **otro** — un fail-open — y me puse a planear el arreglo.

Medido sin pipe, el mismo comando:

| cómo se corre | rc |
|---|---|
| `bash cola-check.sh >/dev/null 2>&1` | **2** |
| `bash cola-check.sh 2>&1 \| head -3` | **0** — el rc es de `head` |

**`cola-check.sh:45` hace `exit 2`.** El instrumento estaba **bien**. Y no sólo bien: su
`cola-check.sh:34-40` ya **documenta este exactísimo defecto como arreglado el 21/09**, con el
porqué escrito — *«acá había un `exit 0`: este script —que existe para cazar una fábrica parada en
silencio— se paraba en silencio él mismo… Y entonces hay que enterarse, no que lo tape un rc=0»*.

**Por qué esta cara es peor que la original.** Cuando el pipe se come **mi** exit code, el daño es
que un fallo propio pasa por verde. Cuando se lo come al de **otro**, el daño se invierte: aparece un
defecto que no existe, con todas las señales de ser real — el mensaje de error **sí** se imprimió, la
prosa del script **sí** habla de no haber medido, y «imprime una alarma y sale 0» es un fail-open
perfectamente plausible. Nada en lo que vi contradecía la hipótesis.

Y el arreglo habría sido una **regresión**: ir a ponerle un exit distinto de 0 a una línea que ya
tenía `exit 2`, o peor, tocar el camino de salida de un fix pagado tres semanas antes. Un falso rojo
sobre código ajeno no cuesta una medición perdida: cuesta un commit que deshace trabajo bueno.

**La regla que queda, más dura que «no pipees»:** antes de anotar un defecto en un instrumento que
no escribiste, **re-corrélo sin pipe y lee su código en la línea del veredicto**. Acá las dos cosas
tomaban diez segundos y las dos refutaban la hipótesis sola. Y si el script tiene un comentario largo
justo en esa rama, **leelo**: en este caso el comentario era literalmente el acta del defecto que yo
estaba por «descubrir».
→ [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] · [[un-control-positivo-con-esperado-falso-acusa-al-script]]

## Refuerzo 2026-10-13 · cuarta recurrencia, y esta vez **acusé al instrumento** — que estaba bien

Mergeé el PR #1119 con el CI **indeterminado**. El chequeo había impreso `NO VERDE — no mergear` y yo
leí el `exit code 0` que me llegó en la **notificación del harness**.

**Lo nuevo no es el pipe: es la vía.** El refuerzo del 10-08 ya dejó escrita la forma correcta —
`bash scripts/ci-verde.sh "$N" > "$G" 2>&1; rc=$?; tail -9 "$G"` — y funciona en *foreground*. Yo lo
corrí con `run_in_background`, donde **no hay `$?` que escribir**: el harness entrega el exit code en
la notificación, y lo entrega del **pipe**, rotulado como si fuera del comando («completed (exit code
0)»). El pipe sigue estando por lo mismo que siempre, legibilidad (`| tail -12`). O sea: el fix del
10-08 corrigió la *escritura* del comando, y el background lo esquiva por un canal donde no hay nada
que escribir. ⇒ **con `run_in_background`, el único veredicto válido es abrir el archivo de output.**
La notificación no es una versión resumida del resultado: es el status de otro proceso.

### Y el error más caro del día: anoté un defecto en `ci-verde.sh` sin medirlo

Escribí —en el buzón y en esta misma memoria— que *«`ci-verde.sh` imprime `NO VERDE` y sale 0, así que
cualquiera que lo juzgue por `$?` mergea»*, y lo anoté como deuda de instrumento. **Es falso.**
`ci-verde.sh:70-71`:

    echo "NO VERDE — no mergear"
    exit 1

El instrumento condena **correctamente** y por el canal correcto. El 0 era del `tail`, otra vez.

Esto es exactamente lo que el refuerzo del 2026-10-12 de esta entrada prohíbe —*«antes de anotar un
defecto en un instrumento que no escribiste, re-corrélo sin pipe y leé su código en la línea del
veredicto»*— y lo repetí **sobre el mismo instrumento del refuerzo del 10-08**. Diez segundos de
`grep -n "exit " scripts/ci-verde.sh` lo refutaban.

### Por qué reincidí teniendo los dos refuerzos escritos: **leí esta entrada TRUNCADA**

La abrí desde el checkout compartido, que tenía una versión de **27 líneas**. En `main` tiene **197**,
con cinco refuerzos — incluidos los dos que me habrían frenado. Y el truncamiento **no da síntoma**:
frontmatter correcto, título correcto, y el cuerpo cierra con una regla general sensata (*«para un
comando de fondo, el veredicto es el output, no el status»*) que **parece** el final del documento.
Consulté la memoria, me dio la sensación de haber consultado, y no estaba.

Peor: la versión corta nombra el defecto **como el pipe**, así que concluí lo que esa causa invita a
concluir — «no hay pipe en el camino crítico ⇒ el status sirve» — y de ahí a acusar al script hay un
paso. Un mecanismo nombrado con precisión hace creer que es el único:
[[el-comentario-que-declara-una-proteccion-desactiva-la-busqueda-del-proximo]].

Detalle que casi costó 167 líneas de `main`: appendeé el refuerzo sobre esa versión corta. Commitearlo
habría **borrado los cinco refuerzos anteriores** con un diff que dice `+36 −167` y un mensaje que dice
«agrega refuerzo». Lo cacé midiendo `git diff origin/main --numstat` **antes** de commitear, no
leyendo el archivo. Ver [[el-checkout-compartido-sirve-comandos-viejos]] §memoria truncada.

**Cómo aplicarlo:** (1) con `run_in_background`, el veredicto es el archivo de output — la
notificación nunca; (2) «todavía corriendo» no es ni rojo ni verde: es *no sé*, y con *no sé* no se
mergea; (3) antes de anotar un defecto ajeno, `grep -n "exit " <script>`; (4) antes de appendear a una
memoria, `git diff origin/main --numstat` del archivo: si borra líneas, lo que estás leyendo no es la
entrada.
