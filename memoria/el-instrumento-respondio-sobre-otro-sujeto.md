---
name: el-instrumento-respondio-sobre-otro-sujeto
description: Un chequeo que sale limpio porque miró el lugar equivocado es indistinguible de uno que pasó. Seis veces en un día; una séptima con git log -S sin ref, que arranca en HEAD y fabrica un cero; una octava con tasklist buscando un PID de MSYS entre los de Windows. El caso peor - git -C sobre un worktree roto responde por el checkout principal sin fallar. Y un PR MERGED con --json files poblado cuyo merge no cambio un byte: el control es comparar el arbol del merge con el de su padre.
metadata:
  type: feedback
---

# 🎯🕳️ El instrumento respondió, pero sobre otro sujeto

El 2026-08-13 este error apareció **seis veces en un día**, en seis instrumentos distintos.
Siempre igual: el comando corre, devuelve algo plausible, y **el sujeto medido no es el que creías**.

| # | Instrumento | Lo que devolvió | El sujeto real |
|---|---|---|---|
| 1 | chequeo de deuda gateado con `-f $BUZON/PLAN.md` | verde | `coordinacion/` está gitignoreada: en un worktree el gate no se cumple y el chequeo **se saltea solo** |
| 2 | caso 8 del test en Actions | «todo verde» | el caso **no corrió**: sin ref `origin/main`, se salteaba |
| 3 | `merge-base --is-ancestor` para "¿está mergeado?" | 18 de 29 "no mergeados" | acá se mergea con **squash**: la rama nunca es ancestro, así que medía otra cosa |
| 4 | búsqueda de worktrees huérfanos | 0 huérfanos | miraba `$REPO_ROOT/.claude/worktrees`, que **no existe** cuando el script corre desde un worktree. Había 21 |
| 5 | escalador de edad del buzón | `999999min` (≈1900 años) | comparaba `fecha_del_nombre != hoy` para decir «de un día **anterior**». Las sesiones nombran en UTC y `date` corre en local: a las 22:41 los **13 archivos de hoy** eran «de otro día» |
| 6 | lint de contratos «PROSA PURA» | contrato sin artefacto | aceptaba `docs/…`, `.png`, `mockup` — **no** un path de código. El contrato citaba `…/FormularioIngreso.tsx:255` y salía marcado |
| 7 | `git log -S'texto' -- <path>` (2026-09-22) | **vacío**: «ese commit no existe» | `git log` sin ref arranca en **`HEAD`**, y el checkout compartido está 141 commits atrás. El commit existía; estaba adelante. Con `git log origin/main -S…` aparece al instante |
| 8 | `tasklist //FI "PID eq 63148"` para saber si un lock estaba huérfano (2026-09-22) | «no hay tareas»: el proceso murió | el lock guarda `$$` de bash = un **PID de MSYS**; `tasklist` enumera **PIDs de Windows**. Dos numeraciones distintas: preguntó por un proceso que nunca estuvo en esa lista. `ps` y `kill -0` decían **VIVO** |
| 9 | `git cat-file -e origin/main:<path>` para «esto ya está en main» (2026-09-29) | «no existe» ⇒ la fila sigue pendiente | **`cat-file` no consulta el remoto**: lee la copia local de la ref. Sin `git fetch` previo el sujeto es *tu* `origin/main`, no el de GitHub — y acá llegó a estar **141 commits atrás**. Lo mergeado hace diez minutos sale AUSENTE, y el informe queda limpio **por ceguera** |

## El caso 7 merece su párrafo: el cero salió del sujeto por defecto

Buscaba cuándo se había agregado el escáner de secretos al `pre-push`. `git log -S'secretos-check' --
.githooks/pre-push` devolvió **nada**. Cero hits, sin error. La lectura natural de ese cero es «no
existe tal commit» — y con ella habría concluido que el hook nunca tuvo scanner.

Lo que lo cazó fue haber puesto un control positivo en el **mismo** comando: `git show
'origin/main:.githooks/pre-push' | wc -l` devolvió 139. Un archivo de 139 líneas cuya historia
supuestamente no contiene el cambio que sí está en su contenido: la contradicción es visible en la
misma salida, y sin ella el cero pasaba como hecho.

La trampa específica: **`git log`, `git grep` y `git diff` usan `HEAD` cuando no les nombrás un ref**,
y en este repo `HEAD` es el checkout compartido, crónicamente atrasado. El comando corre, no se queja,
y contesta sobre el pasado. El mismo turno me pasó con `git log -S` y estuvo a punto de repetirse en el
script que estaba escribiendo — la línea que elegía la «base vieja» tenía el mismo bug, y habría
abortado con «no ubico el commit», haciéndome creer que el commit no existía.

## El caso 8 agrega la variante peor de todas: dos universos de nombres

Un `pre-push` avisó que el sync del grafo no había completado. Para saber si el lock estaba huérfano
—proceso muerto sin liberar— o simplemente ocupado por un sync vivo, leí el pid del lock y pregunté:

```
$ tasklist //FI "PID eq 63148"
INFORMACIÓN: no hay tareas ejecutándose que coincidan con los criterios
```

Con eso iba a reportar «lock huérfano, el sync murió». **Y el proceso estaba vivo.** El lock guarda
`$$` de bash, que es un PID del espacio de **MSYS**; `tasklist` enumera el espacio de **Windows**.
Son dos numeraciones independientes: la pregunta era sintácticamente válida y semánticamente
disparatada. `ps` de Git Bash y `kill -0 63148` contestaron **VIVO**, y `ps` mostraba `/usr/bin/bash`
arrancado a las 21:27:02, exactamente cuando se creó el lock.

Lo distinto de este caso es que **puse un control positivo y no alcanzó**: verifiqué que `tasklist`
funcionaba preguntándole por `git.exe`, y me contestó dos procesos. El control probó que la
herramienta responde — no que responde **sobre mi sujeto**. Un control positivo tomado del universo
equivocado confirma el instrumento y deja intacto el error.

Lo que sí lo cazó fue un **segundo instrumento, de otra naturaleza**: el WAL del checkpoint se había
modificado 40 segundos antes. Un proceso muerto no escribe. La contradicción entre «no existe» y
«escribió hace un rato» obligó a decidir cuál mentía, y ganó el que miraba el **efecto** en vez del
registro.

De los tres casos del mismo día (7, 8 y el `git -C` de abajo) sale una regla más filosa que
«poné un control positivo»: **cuando un instrumento contesta "no existe", la pregunta no es si lo
corriste bien, sino sobre qué universo lo corriste.** `git log` responde sobre el universo que cuelga
de `HEAD`. `tasklist` responde sobre el universo de procesos de Windows. Ninguno se queja de que le
preguntes por algo de otro universo: **te contesta que no está, y tiene razón.**

## El caso que da más miedo, porque git no falla

```
$ cd .claude/worktrees/cal1-google-calendar     # registrado en `git worktree list`
$ git rev-parse --show-toplevel
C:/Proyectos/Claude/Claude code/copiloto-emprendedor      # ← el CHECKOUT PRINCIPAL
$ git status --porcelain | wc -l
405
```

Ese directorio perdió su archivo `.git`. Git **no da error**: camina hacia arriba hasta encontrar un
repositorio y responde por **ese**. Un script de higiene que preguntaba «¿este worktree está limpio?»
estaba recibiendo el estado del checkout compartido — 405 archivos modificados de otras sesiones.

Lo salvó una decisión de diseño tomada antes, no la lógica: **`git worktree remove` sin `--force`**.
Git se negó a borrar cuatro directorios y el script los dejó intactos. Si hubiera puesto `--force`
razonando «son sólo `node_modules`», habría borrado contenido que **no se puede verificar** (sin
`.git`, ninguna herramienta de git puede decir qué hay ahí que no esté en `main`).

## Por qué es distinto de "control positivo falso"

[[un-disparador-cumplido-no-avisa-a-nadie]] cubre *«sale verde» no es un control positivo*. Esto es un
paso antes: **el instrumento sí ejerce su lógica, y la ejerce sobre el sujeto equivocado**. No hay
salteo visible, no hay error, no hay silencio sospechoso — hay una respuesta bien formada sobre otra
cosa. Por eso no lo caza revisar la lógica: la lógica está bien.

## Tres vueltas de tuerca que aparecieron en los casos 5 y 6

**(a) Una alarma permanente es un instrumento apagado, no uno estricto.** El `999999min` sonaba en
*todos* los ciclos. Nadie lo apagó — se leyó, se descartó por absurdo, y se siguió. Eso es peor que
no tenerlo: el próximo pedido realmente abandonado se lee **igual que los otros trece**. Un
instrumento que nunca calla no distingue, y no distinguir es exactamente lo que se le pide.

**(b) Al arreglar una mentira, fijate para qué lado empieza a mentir.** Corregido el atajo por fecha,
el mismo pedido de 40 minutos reales pasó a reportar **0**: sin sidecar previo, el primer avistamiento
asumía «ahora». El escalador dejó de mentir hacia arriba y empezó a mentir **hacia abajo**, que es
peor porque *no se nota* — un `999999` te hace sospechar, un `0min` te tranquiliza. El fix completo
fue poner el `mtime` como piso. **Después de arreglar un instrumento, medí el mismo caso real que lo
destapó y comparalo con la verdad conocida**, no sólo con el test.

**(c) Un instrumento puede estar desmentido por el resultado del trabajo que juzga.** El lint marcaba
«PROSA PURA» un contrato que frontend ejecutó sin una sola pregunta, cerrando PR #433 con control
negativo propio. Esa contradicción estaba disponible desde el primer ciclo y nadie la miró: la señal
más barata para auditar un juez es **preguntarle al juzgado cómo le fue**.

## How to apply

Antes de creerle a un chequeo que sale limpio, **verificá que vio al sujeto**:

- **Poné el positivo primero en el test.** Si el instrumento no puede nombrar al sujeto que está
  midiendo, los negativos no prueban nada. En `test-podar-worktrees.sh` el caso 3 («¿aparece el
  worktree de prueba en el informe?») va **antes** que los dos negativos, por esto.
- **Identidad explícita**: cuando una herramienta puede resolver un contexto por su cuenta (git
  caminando hacia arriba, un path relativo, una ref por defecto), comparalo contra lo que esperabas —
  `[ "$(git -C "$d" rev-parse --show-toplevel)" = "$d" ]`.
- **Un cero es una hipótesis, no un resultado** (canon 5). «0 huérfanos», «0 hallazgos», «nada
  pendiente»: contrastá con un conteo independiente antes de reportarlo.
- **Ante un «no existe», nombrá el universo enumerado** antes que la sintaxis del comando. Un PID de
  MSYS no vive en la lista de `tasklist`, un commit adelantado no vive en la historia de `HEAD`, un
  proceso de otro contenedor no vive en tu `ps`. El control positivo tiene que salir **del mismo
  universo que el sujeto** — preguntarle a `tasklist` por `git.exe` prueba que `tasklist` anda, no que
  sepa de tu proceso (caso 8).
- **Cuando dos instrumentos se contradicen, ganá con el que mide EFECTO.** Un archivo que cambió de
  tamaño, una ref que llegó al remoto, una fila escrita: eso lo produce el sujeto. Un registro —una
  lista, un marcador, un log— lo produce alguien **acerca** del sujeto, y puede estar mirando otro.
- **Cuidado con lo que parece prudencia.** El caso 3 se ve conservador («no mergeado, no toco»), y por
  eso pasó desapercibido: un instrumento que nunca dice que sí es indistinguible de no tenerlo.

Relacionadas: [[el-checkout-compartido-sirve-comandos-viejos]] (el contador de commits no mide el
working tree) · [[instrumentos-que-confirman-en-vez-de-verificar]] ·
[[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]].

## Dos más el 2026-09-22 — y el primero es el GEMELO del caso 1

**Caso 8 — el mismo `-f $BUZON/PLAN.md`, en el chequeo de al lado.** El caso 1 de la tabla se
arregló: el bloque DEUDA de `vigilancia-check.sh` pasó a gatearse con «`BUZON_DIR` sin setear», y
se le escribió el porqué al lado, **nombrando explícitamente a COLA** como el contraejemplo que
todavía tenía la condición vieja. COLA siguió 40 días con el defecto idéntico, en el MISMO archivo,
60 líneas más abajo. Desde cualquier worktree —26 vivos, el caso normal de este repo— el paso COLA
no se medía y tampoco se decía: el ciclo cerraba «sin novedades». Y abajo, `cola-check.sh` remataba
con `exit 0` sobre «No existe $PLAN» — el instrumento que existe para cazar una fábrica parada en
silencio se paraba en silencio él mismo.

Lo que esto agrega: **escribir el hallazgo no propaga el fix.** El comentario que nombraba al
gemelo estuvo ahí todo el tiempo y no alcanzó. Al arreglar un instrumento, grepeá el patrón del
**FIX** —no el del bug— en el mismo archivo y en sus vecinos: [[el-fix-ya-existe-en-otro-call-site]].

**Caso 9 — comparar el estado de HOY para explicar lo que un proceso leyó DÍAS ATRÁS.** El bridge
del grafo tenía un árbol configurado y el reconcile quiso borrar 420 objetos. Para decidir si el
borrado era legítimo comparé los dos árboles candidatos: los dos sanos, a una hora uno del otro, 0
archivos borrados entre ellos. Conclusión: «no hay divergencia que justifique 420 borrados».
**Falsa** — y encima había refutado con ella una hipótesis correcta. Los árboles que miraba no eran
los que el bridge leyó durante las ingestas: el `reflog` de uno tenía UNA entrada, de ese mismo día
a las 21:15. Lo habían **creado una hora antes**; hasta entonces el path configurado no existía y
el grafo estaba clavado en el pasado.

`ls`, `rev-parse` y `git log` contestan por el estado ACTUAL. Cuando la pregunta es «¿qué leyó este
proceso cuando escribió esto?», el sujeto es la **historia** del árbol, no el árbol: `git reflog`,
el mtime del marcador, la bitácora. Un árbol sano hoy no declara nada sobre lo que fue ayer — y la
trampa es que responde igual de rápido y de seguro.

## Caso 10, el mismo día — escribí «el hallazgo no propaga el fix» y no lo propagué

El caso 8 (arriba) cierra diciendo: *al arreglar un instrumento, grepeá el patrón del **FIX** —no el
del bug— en el mismo archivo y en sus vecinos*. Lo escribí, abrí el PR con `cola-check.sh` y
`vigilancia-check.sh` arreglados… y **no grepeé**. Horas después corrí `scripts/archivar-buzon.sh`
desde un worktree y salió:

```
No existe /c/gfw-src/wt-a4reg/coordinacion/abierto
```

Exit **0**. El tercer gemelo, con **las dos líneas idénticas**: `BUZON="${BUZON_DIR:-$REPO_ROOT/coordinacion}"`
y `[ -d "$ABIERTO" ] || { echo "No existe $ABIERTO"; exit 0; }`.

Y este tenía consecuencia acumulada: el vigía lo invoca en su paso 4 desde cualquier worktree, así
que **el janitor no corría nunca** y el ciclo reportaba el buzón ordenado. Al arreglarlo, la primera
corrida archivó **11** — el mismo número que una medición independiente había contado como vencidos.
La cuenta ya estaba ahí; lo que faltaba era un instrumento que la mirara.

**Lo que esto agrega sobre el caso 8:** la lección escrita no se aplica sola **ni siquiera al autor,
ni siquiera el mismo día, ni siquiera con el texto fresco**. Un hallazgo sobre un patrón no es un
recordatorio: es una tarea de barrido, y termina cuando corriste el grep, no cuando redactaste el
párrafo. El grep que faltaba era de una línea:

```bash
grep -rn 'exit 0; }' scripts/ | grep -i 'no existe'
```

Si el hallazgo no viene con su barrido **en el mismo commit**, el gemelo siguiente ya está esperando.
Ver [[el-fix-ya-existe-en-otro-call-site]] y [[barrer-llamadores-incluye-los-instrumentos-de-verificacion]].

---

## 2026-09-23 — `git diff A B` no contesta «¿qué agrega esta rama?», y sus borrados son una ilusión

Quise saber qué aportaba la rama de backend y corrí `git diff --stat origin/main 4489ea19`. La
salida mostraba **745 borrados**, entre ellos `PantallaLegal.tsx`, `legal.ts` y `_layout.tsx` — justo
los archivos que la otra sesión acababa de mergear. La lectura inmediata fue: *«si backend mergea sin
traer main, revierte la pantalla legal de FE2»*. Estuve a un mensaje de bajar esa alarma.

**Era falsa.** `git diff A B` compara **dos puntas**: lo que aparece como `-` es simplemente lo que
A tiene y B no. No describe lo que un merge haría — un merge es un three-way contra la **base
común**, y los archivos que sólo existen en `main` **se quedan**. El instrumento contestó bien; yo
le había preguntado otra cosa.

La pregunta «¿qué agrega esta rama sobre main?» tiene su propia forma, con **tres** puntos:

```bash
git log origin/main..LA_RAMA --oneline      # commits que la rama suma
git diff origin/main...LA_RAMA              # el diff desde la BASE COMUN, no entre puntas
git diff origin/main..LA_RAMA -- <paths>    # vacio => su contenido YA esta en main
```

Ese último fue el que cerró el caso: **vacío** ⇒ el trabajo de backend ya estaba íntegro en `main`
(entró por #679 mientras yo medía), sin duplicar nada. El mismo control que había cerrado #677 horas
antes — un PR que se cerró sin mergear porque su patch-id ya estaba aplicado.

**Lo que hay que aprender no es el flag, es el reflejo:** una medición que produce una alarma
grande y barata merece una segunda forma de preguntar **antes** de que la alarma circule. La primera
lectura era plausible, urgente y reenviable — la peor combinación. Ver
[[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]].

---

## Novena, y la variante peor: el sujeto equivocado fue **el RANGO**, y lo eligió el sistema

2026-09-28. Pregunta: *¿los 436 objetos que el reconcile del grafo quiere borrar son drift legítimo o
una anomalía?* De eso dependía recomendar al operador firmar `--force` o **no** firmarlo.

Medí los archivos borrados en el rango del **marcador del grafo** (`1542e3ad..origin/main`, 28
commits): **0 borrados, 0 renombrados**, 116 modificados y 28 agregados. Y **con control positivo
verde**: la misma sintaxis ve 159 borrados en los últimos 300 commits y 11 en `HEAD~150..origin/main`.
El instrumento veía borrados; el `0` era real.

**Conclusión que casi entregué: «436 muertos sin un solo archivo borrado ⇒ anomalía ⇒ NO firmes».**
Habría sido el consejo opuesto al correcto.

La causa estaba escrita en el `repos.toml` del bridge: el 2026-08-19 el árbol que el bridge LEE dejó
de ser el que el sync ESCRIBE, y el drift vivió **>1 mes invisible** (arreglado en `dd7cbd0`, el
2026-09-22 21:25, **el mismo día del marcador**). Medido en el rango real —desde el inicio de la
ceguera— hay **24 borrados, 13 de código indexable, 1 renombrado**. **Los 436 son basura legítima y el tope
de 200 estaba funcionando** — pero mi aritmética para llegar ahí («13-14 archivos × decenas de objetos
≈ 400») **estaba mal, y me la refutaron con la lista del dry-run**: de 4 archivos-fuente de la muestra,
**2 SÍ existen** (`EscritorioFunciones.tsx`, y `LegalScreen.tsx` creado esta semana). La segunda mitad
de la población son **símbolos eliminados DENTRO de archivos que sobrevivieron**, que mi conteo por
archivo no podía ver. Por eso el «≈400» salía forzado: **conté en archivos una población que se mide en
símbolos y aristas** ([[contar-un-simbolo-no-dice-en-que-rol-aparece]]).

**Y el argumento fuerte no era ninguno de los dos conteos: era `FALTANTES: 0`.**
`expected 39296 / present 39732 / zombies 436 / FALTANTES 0` — todo lo que el árbol vivo espera ya
estaba presente, así que el reconcile sólo podía **quitar sobrante**, nunca dejar hueco. Eso se lee en
una línea, no depende de reconstruir la historia, y es el criterio reusable para la próxima vez que el
tope frene: **preguntar cuántos FALTAN, no cuántos se borran.** Yo pasé el rato midiendo la magnitud del
borrado cuando la pregunta que decidía era si el borrado podía dejar un agujero.

**Por qué el rango era el sujeto equivocado, y por qué es peor que un path mal escrito:** el marcador
es el **puntero de progreso** del propio proceso, y avanzaba **correctamente** mientras la fuente que
alimentaba al proceso estaba mal. Un puntero de progreso no dice «hasta acá procesé bien»: dice
«hasta acá corrí». Con la fuente roto, el puntero mide corridas, no trabajo — así que **usarlo para
delimitar el rango del daño devuelve cero por construcción.** El rango del daño va desde que **la
fuente** se rompió, no desde donde quedó el puntero. Y a diferencia de un `git -C` mal apuntado, acá
**no elegí el sujeto**: lo heredé del estado del sistema, que es lo que lo hace invisible.

**Y el control positivo no podía salvarme**, lo cual es lo más importante de este caso: validó que el
instrumento **ve borrados**, no que **le pregunté por el período correcto**. Un control positivo
prueba la sensibilidad del instrumento, **nunca la pertinencia del sujeto** — son dos afirmaciones
distintas y la segunda casi nunca tiene control. Hermano de
[[vacio-no-es-hallazgo-correr-el-control]] por el lado opuesto: allá el control faltaba, acá estaba
verde y era irrelevante.

**How to apply:** ante un `0` que llega **con control positivo verde**, hacer una pregunta más:
**¿de dónde salió el rango / el sujeto, y quién lo movió?** Si salió de un puntero, checkpoint,
marcador, `--since`, `HEAD` o «última corrida», **ese valor es parte de la hipótesis, no del método**:
va verificado igual que el resto. La versión corta: *un control positivo dice que el instrumento ve;
no dice que le preguntaste por el sujeto correcto.* Y ante un daño acumulado, el rango se toma desde
**el evento que rompió la fuente**, que se busca en la historia de la configuración, no en la del
código.

---

## Caso 11 (2026-09-28) — el sujeto era **el FILESYSTEM** cuando la afirmación era sobre **el TRONCO**

Cuatro afirmaciones falsas en **un solo mensaje** de una sesión competente, todas con la misma forma:
*«X no existe»* / *«X ya está en la raíz»*, medidas **grepeando el árbol de trabajo**.

| afirmación | cómo se midió | la verdad, medida contra `origin/main` |
|---|---|---|
| «tu entrada de memoria no existe en ningún checkout» | `ls memoria/el-testigo-*.md` en el compartido y en su worktree → 0 | **presente**, 3 560 bytes, desde `e8fe864f` |
| «el guard de path no está en `main`» | ídem | **presente**, 1 ocurrencia en cada servidor, y 0 archivos con el patrón viejo |
| «el fix de `ci-verde.sh` ya está en la raíz» | lo escribió en su checkout | **NO está**: `origin/main:scripts/ci-verde.sh:75` sigue diciendo `NO VERDE`, y **0 commits al archivo ese día** |
| (el espejo, y es mío) «el compartido tiene ~100 archivos editados a mano» | de memoria, sin medir | **3** sucios, todos `docs/`+`memoria/` |

**Por qué este repo lo amplifica hasta volverlo el default.** Hay **36 worktrees** con HEAD distinto.
«¿Existe el archivo X?» **no es una pregunta bien formada** sin nombrar el ref: tiene 36 respuestas y el
grep devuelve la del árbol donde estás parado, sin avisar que eligió. Peor con **squash-merge**: la
rama fusionada **no es ancestro** de `main`, así que el árbol local puede tener el archivo y `main`
también, o el árbol tenerlo y `main` no, en las dos direcciones, sin que nada falle.

**El control, y es de una línea:**

```bash
git fetch -q origin main
git cat-file -e "origin/main:<path>" && echo PRESENTE || echo AUSENTE   # existencia
git log --since='<hoy>' origin/main -- <path>                            # "¿entró el fix?"
git show origin/main:<path> | grep -n '<patrón>'                         # contenido, no el del disco
```
Más el **negativo que discrimina**: `git cat-file -e origin/main:docs/no-existe-control.md` tiene que
dar ausente. Sin él, un `PRESENTE` para todo se lee igual que un acierto.

**La regla, en una línea:** *«está en `main`» es una afirmación sobre un **ref**, y sólo se contesta
nombrando el ref.* Un `ls`/`grep` sin ref contesta sobre el disco, que es **otro sujeto** — y con 36
worktrees, casi seguro uno atrasado.

**Y el filo que no es sobre git:** las cuatro salieron de alguien que ese mismo día había escrito la
regla de *«medí contra el sistema real»* y aplicado controles positivos correctos en otros frentes. La
lección no falla por ignorancia: falla porque **el grep del árbol de trabajo se siente como medir**. Es
el mismo mecanismo del caso 10 — la lección escrita no se aplica sola ni a su autor
([[el-workaround-que-usas-de-rutina-deja-de-parecerte-informacion]]).

## La precondición que se resuelve a mano se pierde justo cuando hay apuro

El mismo incidente tuvo una segunda mitad: el generador necesitaba cuatro precondiciones
(`NODE_PATH`, `CHROME_PATH`, entorno E2E, servidor del prototipo). **Las cuatro estaban documentadas
en el header del script.** Se perdieron igual.

> **Una precondición que hay que resolver a mano en cada corrida se pierde en la corrida en que uno
> tiene apuro** — y esa es, sistemáticamente, la corrida que importa.

Documentar no es un remedio: es una nota al que ya está apurado. El remedio fue un script que
**resuelve** las cuatro y, si no puede, **aborta imprimiendo el comando exacto que falta**.

## La señal de alarma: dos mediciones distintas que dan el MISMO número exacto

Caso chico y rápido (2026-09-23), útil por el síntoma. Buscaba escapes unicode sin interpretar
(`\u2014` literal, que un heredoc de bash deja crudo) en los archivos de memoria. Corrí en Python:

```
s.count("\\u2014")  ->  17      # «escapes literales»
s.count("\u2014")      ->  17      # em-dashes reales
```

Concluí «17 escapes rotos» y, como `grep` encontraba **una** sola línea, acusé a `grep` de leer el
archivo como binario. **`grep` tenía razón: había 1.** El heredoc se comía un backslash, así que las
dos líneas de Python buscaban **lo mismo** — el em-dash— y por eso daban igual. Mi contador respondió,
pero sobre **otro sujeto**.

**La señal estaba a la vista y casi la paso por alto:** dos consultas que miden cosas **distintas** y
devuelven el **mismo número exacto** son sospechosas de ser la misma consulta escrita dos veces.
Una coincidencia así no es tranquilizadora — es la forma típica de un control que colapsó sobre su
propio sujeto.

**Y el reflejo peligroso:** cuando el instrumento propio y uno ajeno discrepan, la conclusión cómoda
es que el ajeno está roto — inventé una explicación plausible («grep lo trata como binario») en vez
de desconfiar del mío. La regla barata: ante discrepancia, **pedile a cada uno que imprima lo que
encontró**, no sólo cuánto. Un `repr()` del match habría cerrado el caso en un paso.

**El barrido corregido, con control:** 311 archivos, **2** escapes reales (uno recién introducido por
mí, otro preexistente), ambos convertidos a su carácter; re-escaneo posterior → **0**.

---

## La variante más barata de provocar esto: un typo en el NOMBRE de una variable de entorno (2026-09-23)

Se le pidió al generador medir **3 ids** pasando `IDS=...`. La variable que el script lee es
`SOLO_IDS`. **El script ignoró el filtro, cayó a su default y midió 7 — informando con total
normalidad.**

> **Un nombre de variable de entorno mal escrito no da error: da otra medición.** No hay «variable no
> definida» que salte, porque el script tiene un default razonable. El valor que pasaste simplemente
> no existe para nadie.

Es el mismo daño que el `git -C` sobre un worktree roto: **el instrumento contestó bien, sobre otro
sujeto**. Y acá es peor de detectar, porque la salida tiene la forma esperada — sólo el N delata, si
alguien lo mira.

**El remedio no es acordarse del nombre: es quitarle la oportunidad.** Que el script tome los sujetos
como **argumento posicional**, que no se puede errar sin que falte, en vez de una variable de entorno
opcional que se puede escribir mal en silencio.

**Y el control que lo caza en cualquier corrida:** *comparar el N pedido contra el N medido*. Si
pediste 3 y el informe dice 7, no hace falta saber por qué para saber que no sirve.

## El caso 9 y la familia entera: **el ref local es un sujeto distinto del remoto**

Los casos 3, 7 y 9 son el mismo error con tres comandos (`merge-base`, `git log -S`, `cat-file -e`), y
conviene verlos juntos porque el reflejo «preguntarle a git» se siente como preguntarle al repositorio,
cuando en realidad le preguntás **a tu copia**. Ninguno de los tres avisa: los tres contestan rápido,
sin error, sobre un pasado.

La regla que los cubre a los tres: **`git fetch` antes de cualquier afirmación sobre `origin/*`** — y
si el instrumento es un script, el fetch va **adentro**, no en la cabeza de quien lo corre. Un script
que depende de que alguien haya fetcheado antes es un script que funciona hasta que lo automatizan.

Está horneado en `scripts/plan-drift-check.sh`: el fetch es la primera medición, y si falla el script
sale con **exit 2 — «no pude medir»— nunca con 0. Un instrumento que no pudo mirar tiene que decirlo
distinto de un instrumento que miró y no encontró nada.

---

## Caso 12 (2026-09-29) — un PR sale `MERGED`, lista sus archivos, y su merge **no aportó nada**

El PR #720 («ratchet de endpoint para el aislamiento cross-tenant») se mergeó con 6/6 verde. Todo lo
que un tablero mira dice que aportó el ratchet:

```
$ gh pr view 720 --json state,mergeCommit,files
{"state":"MERGED","mergeCommit":"1ca62d36",
 "files":["apps/copiloto/tests/test_ratchet_endpoint_tenant_scope.py"]}
```

**Y el merge no cambió un solo byte de `main`:**

```
$ git rev-parse 1ca62d36^{tree}   ->  9968121bb447…
$ git rev-parse 5601a416^{tree}   ->  9968121bb447…   # su PADRE: el MISMO arbol
$ git diff --stat 5601a416 1ca62d36
                                   # vacio
```

El contenido ya estaba: `git log origin/main -- <el archivo>` lo atribuye a `2d4b3113` (PR **#709**,
*«batch de 7 ramas huérfanas — sólo 2 eran nuevas»*), mergeado antes.

**`--json files` es el sujeto equivocado, y es el que uno mira.** Devuelve el diff del PR **contra su
base original**, no lo que el merge aportó a `main`. Las dos cifras coinciden casi siempre, así que
nadie las distingue — hasta que el contenido entró por otra vía y sólo una de las dos se entera. Lo
mismo vale para el `state: MERGED`: describe el destino del PR, no su efecto.

> **El control es de una línea y no existe en ninguna otra parte de este repo:**
> `[ "$(git rev-parse <merge>^{tree})" != "$(git rev-parse <merge>~1^{tree})" ]`
> Si los árboles son iguales, el merge fue **vacío**: el PR se cerró, el CI corrió, y `main` no cambió.

### Lo transferible no es el squash: es cómo se eligió a quién medirle el diff

El barrido que encontró la rama listó ramas «no mergeadas contra `origin/main`» — el **caso 3** de
este mismo archivo, ya escrito: acá se mergea con squash, la rama nunca es ancestro, y el criterio
devuelve falsos positivos por construcción. Pero eso no es lo interesante, porque quien barrió **sí
conocía el control**: a `a4-fila2/3/6` y a `blq2-blj1` les midió el diff, las vio vacías, y las
clasificó correctamente como residuo.

**A ésta no se lo midió.** La diferencia entre las ramas que recibieron el control y la que no fue
cómo **se veían**: las primeras parecían residuo (nombres de consolidaciones ya cerradas), y ésta
parecía trabajo real — 25 tests, verificada en el VPS, un `avance_` que la documentaba. Lo era. El
error no fue confundir residuo con sustancia:

> **«¿esta rama tiene sustancia?» y «¿falta su contenido en `main`?» son dos preguntas distintas, y
> sólo la segunda es la que un barrido de ramas huérfanas quiere responder.** Una rama puede ser
> trabajo excelente *y* estar íntegramente mergeada. La sustancia predice bien si vale la pena
> mirarla; no predice nada sobre si falta.

Y ahí está el mecanismo, que es el de esta entrada entera: **la apariencia del sujeto decidió qué
instrumento se le aplicaba.** Lo que parecía vacío recibió el control de vacío; lo que parecía lleno
se dio por bueno sin control. Un control que se aplica sólo donde uno ya sospecha no es un control:
es una confirmación. Hermano de [[el-canario-tiene-que-ser-tan-nuevo-como-lo-que-buscas]] — allá el
canario se elige por disponibilidad, acá el control se elige por sospecha, y las dos veces el sesgo lo
introduce **quién es el sujeto**, no la lógica del instrumento.

### El costo no es el CI desperdiciado: es la trazabilidad invertida

Un PR y seis jobs es barato. Lo caro es que el tablero queda diciendo «RATCH cerrado por #720», y eso
**miente en las dos direcciones para cualquiera que después quiera revertir**: revertir #720 no saca
el ratchet (no aportó nada), y revertir #709 creyendo que era «sólo docs y ramas huérfanas» **sí** se
lo lleva. La atribución equivocada no molesta hasta el día en que alguien la usa para decidir, y ese
día no avisa.

**How to apply:** al cerrar una fila «por efecto», el efecto que se cita es el **commit que introdujo
el contenido** (`git log origin/main -- <path>`), no el PR que uno acaba de mergear. Son el mismo
commit casi siempre; cuando no lo son, el que importa es el primero. Y antes de contar un merge como
trabajo entregado, comparale el árbol con el de su padre: es más barato que leer el diff y no se puede
malinterpretar.

### Posdata, medida al escribir este caso: dos controles míos fallaron en la misma edición

**(a) `perl -i -pe '...'` sale 0 aunque la regex no matchee nunca.** Actualicé el `description` de
arriba con `perl -i -pe 's{...}{...}' archivo && echo "description actualizado"`. Imprimió
`description actualizado`. **La sustitución no ocurrió.** El `&&` encadena con el **exit code del
comando**, y `perl -i` considera exitoso reescribir el archivo idéntico a sí mismo: mi «evidencia»
media que perl corrió, no que el texto cambió. Lo mismo vale para `sed -i`. **El control que
distingue es comparar el archivo, no leer el exit:** `grep -c '<el texto nuevo>'` después, o
directamente escribir con una herramienta que falle si el ancla no está.

**(b) Y el control que puse miró el lugar donde el cambio no podía estar.** Verifiqué con
`sed -n '1,6p' | cut -c1-120`. El `description` es una línea de ~400 caracteres y el texto agregado
va **al final**: `cut -c1-120` imprime exactamente la parte que no cambió. Salió plausible, salió
rápido, y no podía contradecirme ni si el cambio hubiera fallado del todo — que es lo que pasó.
**Cuando el cambio va al final de algo, el control tiene que mirar el final** (`tail -c`, `grep` del
texto nuevo). Un truncado por legibilidad es una decisión sobre **qué parte del sujeto se mide**.

**(c) Bonus del mismo rato: `grep -c $'\r'` no cuenta CR.** Lo usé para medir si `perl -i` había
convertido el archivo a CRLF, y devolvió 483 en el archivo nuevo y 410 en su padre — números
creíbles que parecían confirmar la hipótesis. Son **la cantidad de líneas de cada uno**: el patrón
no llegó a `grep` como un CR y matcheó todo. El instrumento que usé para medir el daño daba la
respuesta que yo esperaba, **por una razón distinta de la que creía**, y con eso habría «confirmado»
igual un archivo intacto. Lo cerró `python -c "print(open(f,'rb').read().count(b'\r'))"` → **0**, y
`git diff --ignore-cr-at-eol` (74 líneas reales contra 869 del diff crudo).

Las tres tienen la forma de esta entrada, y las tres me pasaron **mientras la escribía**. Lo único
que las cazó fue que el número final no cerraba: un commit de *74 líneas agregadas* no puede
reportar *471 insertions y 398 deletions*. **La aritmética que no cierra es el detector más barato que
hay, y es el último que uno mira** — ver la señal de «dos mediciones distintas que dan el mismo
número exacto», más arriba: misma familia, signo opuesto.

### Caso — el HOOK no es el COMPONENTE (2026-10-08, A3)

Para decidir si un componente de React consultaba el backend antes de ofrecer una acción destructiva,
leí su `useEffect` de carga y no encontré la consulta. Concluí «el componente nunca la hace».

El componente **sí** la hacía, en el handler que abre el flujo, 45 líneas más abajo. Mi grep había
preguntado por el **hook**; mi afirmación fue sobre el **componente**. Sujeto distinto, respuesta
correcta, conclusión falsa — y sobre ella bajé un contrato que hizo reimplementar trabajo de julio
([[el-contrato-que-manda-a-hacer-algo-ya-hecho]]).

**Lo que lo habría cazado y es más barato que el grep que usé:** en vez de buscar dónde se llama,
contar las llamadas en TODO el archivo — `grep -n <funcion> <archivo>` sin filtrar por hook. La
definición aparece una vez y cada uso aparece; si hay un uso que no explicaste, no terminó la
medición. Yo había recortado la salida al tramo del `useEffect`.

**Y el control gratis que tenía a mano sin saberlo:** el gemelo web del mismo componente. Al diffear
los dos tramos equivalentes, la única diferencia eran **acentos y comentarios**. Dos gemelos
idénticos donde uno «no tenía el fix» es una contradicción, no una asimetría — y la contradicción
acusa a la medición, no al código. Compará contra el gemelo antes de declarar que a uno le falta algo.

---

## Refuerzo 2026-10-08 (b) — un instrumento que mide `origin/main` es CIEGO a tu cambio hasta que mergeas

Reparé un documento y quise saber si rompía al único instrumento que lo lee
(`scripts/backlog-dod-gap.py`). Lo corrí **antes y después** de editar: `rc=0` las dos veces, **79
líneas de salida idénticas, sin diff**. Concluí «no lo afecta». Al mergear, el instrumento abortó:

```
🛑 NO PUDE MEDIR: esperaba 66 ítems `### BL-*` (invariante medido del backlog), encontré 77.
```

**El antes/después local no era control de nada.** El instrumento declara su sujeto en su primera
línea de salida — `sujeto: origin/main` — y yo había editado el **working tree**. Las dos corridas
midieron el mismo archivo remoto sin mi cambio: por eso eran idénticas, y la identidad se leía como
«no hay impacto» cuando significaba «no miró tu cambio».

**La trampa es peor que un sujeto equivocado cualquiera, porque el instrumento acierta.** Mide
exactamente lo que dice medir, y su respuesta es correcta; lo que está mal es **mi pregunta**: yo
preguntaba «¿rompo algo?» y el comando contesta «¿está roto en main?». Mientras el cambio no esté
en el sujeto, la respuesta no puede cambiar — y un control cuya salida **no puede** cambiar con lo
que estoy probando es un control muerto, aunque corra y devuelva `rc=0`.

**El control, en una pregunta:** *¿el sujeto que mide este instrumento incluye mi cambio?* Si mide
una ref remota, hay tres salidas honestas: correrlo con el sujeto apuntado a tu rama (si acepta
parámetro), pushear la rama y medir contra ella, o **declarar que el impacto no se midió** y
verificarlo justo después del merge. Lo que no vale es leer «sin diff» como «sin impacto».

**Lo bueno de este caso:** el instrumento es *fail-closed* — con el invariante vencido **se niega a
medir** en vez de dar un número. Un gate que ante lo inesperado contesta igual habría dejado el
gap de DoD mal medido en silencio durante el cierre. Ver
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] y [[el-instrumento-tambien-CONDENA-no-solo-absuelve]].


## 2026-10-08 (e) — publiqué un `md5` como control de integridad, y era el de OTRO sujeto

Copié el recibo que el cierre cita a un path versionado y escribí en su README: «`md5` del JSON =
`4ff97e68…`, **idéntico al original**». Verdad medida, sujeto equivocado: ese es el md5 del **archivo
en mi checkout de Windows (CRLF)**. Lo que recibe quien clona es `c4df00b6…` — `core.autocrlf=true`
normalizó el único fin de línea a LF al commitear. Contenido idéntico (el JSON parseado compara igual
campo por campo), **bytes distintos**.

Lo que lo hace peor que un número mal copiado: **el valor correcto depende del OS del verificador.**
Un clon en Windows reconstruye el CRLF y mide `4ff97e68…`; en Linux o en el CI se mide `c4df00b6…`.
El control habría absuelto en la máquina del autor y **condenado como «copia corrupta»** en la del
auditor, que es exactamente el escenario para el que lo escribí.

Lo cazó el control de cierre del propio ciclo, que hasheaba `git show origin/main:<path>` en vez del
archivo en disco, y dio distinto del esperado. Si el control hubiera leído el archivo del working
tree —lo «natural»— habría dado verde y la afirmación falsa quedaba publicada.

**La pregunta, en esta forma:** *¿el número que publico se puede volver a medir en el sujeto al que mi
afirmación se refiere?* Si la afirmación habla del clon, el instrumento tiene que interrogar al clon.

**El control que sí sirve en git: el `blob sha1`.** `git rev-parse <ref>:<path>` nombra el objeto que
git guarda, no el archivo que cada checkout escribe: independiente de EOL y de OS, con control
positivo y negativo triviales (`git show <ref>:<path> | git hash-object --stdin` da el mismo sha1; un
byte agregado da otro). Un `md5` de un archivo checkouteado sólo vale si se dice **en qué checkout**.

**Hallazgo al pasar:** `.gitattributes` fija `eol=lf` para `*.sh`/`*.bash`/`*.service`/`Dockerfile`/
`*.snippet` y su encabezado promete que «no depende de la config git de cada máquina», pero **no
cubre `.json`** — así que los bytes de un artefacto de evidencia los decide el `core.autocrlf` del que
commitea. Anotado en la fila `H-RECIBOENWORKTREE`, no corregido: cambiar `.gitattributes` en pleno
cierre es cambio de mecanismo. Ver [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] y
[[vacio-no-es-hallazgo-correr-el-control]].

## 2026-10-08 (f) — tres veces el SUJETO en un día, y ninguna fue la medición

El muestreo adversarial del punto 2 (#978, #980) me dio tres correcciones del mismo tipo en una
sesión. **Ninguna fue un error de medir**: las tres mediciones eran correctas y las tres **frases que
las reportaban hablaban de otro conjunto**.

1. **El universo de la afirmación era más grande que el medido.** Medí **4 filas** del doc de alcance
   y publiqué *«punto 2 · ✅ en sustancia, 0 asignables»* — y el punto 2 son **53 ítems**. Está
   retirado en el `§7` del doc.
2. **El universo medido incluía lo que la firma ya había sacado.** Publiqué **4 falsos ✅** y son
   **3**: `BL-O6` estaba diferido a Cierre B desde el **21/09**, nombrado por id en una fila del acta
   **sin número de `DEC-*`**, y mi filtro corría contra dos índices que se consultan **por `DEC-*`**.
   `§8`. Ver [[el-registro-vivia-en-tres-idiomas-y-el-lector-hablaba-uno]].
3. **La afirmación sobre el INSTRUMENTO era más amplia que su patrón.** Escribí *«en todo el acta,
   las filas sin `DEC-*` que nombran ids nombran exactamente tres»*. Mi grep era `^| — |`: sólo veía
   el guion largo **literal**. Con el patrón amplio aparecen **26 filas** en las 5 actas, en **dos
   clases** (sin id alguno: 1 · con id en otro espacio de nombres — `DA-*`, números de punto: 25).
   **La cifra 3 no se movió, pero su razón sí**: no se apoya en «el agujero tenía un ocupante», se
   apoya en que **ninguna de las 5 actas difiere a ninguno de los tres**, que es lo que de verdad
   medí (control positivo: 2 hits sobre `BL-O6`).

**Lo que las une, y es distinto de los casos de arriba.** Arriba el instrumento miraba el objeto
equivocado. Acá el instrumento miró bien y **el enunciado se ensanchó al salir**: de 4 filas a 53
ítems, de «los no diferidos» a «todos», de «las filas con guion largo» a «las filas sin `DEC-*`». El
defecto vive en **el salto del dato al enunciado**, y por eso **medir otra vez no lo caza** — sale
igual. Lo caza una sola pregunta, antes de publicar: **¿de qué conjunto estoy hablando, y quién
decide quién está adentro?** Para un criterio de cierre eso lo decide **un acta**, no un índice; para
una afirmación sobre un instrumento, lo decide **el patrón que el instrumento usa**, no lo que yo
creo que busca.

**El corolario operativo, que ya apliqué:** el control de vigencia tiene que vigilar los paths del
**ALCANCE** (el acta, el backlog), no sólo los de la **evidencia** (código y tests). El que corrí
antes de publicar miró 6 paths de código y salió limpio — y lo que había cambiado era **quién estaba
adentro**. Un veredicto envejece por las dos vías, y la segunda no se ve mirando el código.

**Y el detalle que lo hace reincidencia y no novedad:** las tres las cacé yo, pero **las tres después
de publicar**. La primera a horas, la segunda a 12 minutos, la tercera a minutos del merge. Mejoró la
latencia, no el gate. El gate que falta es la pregunta de arriba, **antes** del push — no un cuarto
control después. Ver [[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]].

## 2026-10-08 (g) — la cuarta del día, y la primera que cazó OTRA sesión: una cifra mía mal medida **viaja**

Las tres de `(f)` las cacé yo, siempre después de publicar. **La cuarta no la cacé yo.**

En el muestreo del punto 2 (#978) escribí que `BL-J11` tenía **«10 filas planas en UN solo
`account-screen__list`»**. En `main` había **tres** tiles (`AccountScreen.tsx:131`, `:161`, `:190`,
más el de `CambiarCredenciales`). La conclusión se sostenía —«Cerrar sesión» *sí* compartía tile con
Soporte/Cómo uso/Privacidad y *sí* se distinguía sólo por color—; lo falso era el **alcance de la
frase**: dije «las 10» cuando eran las **3** de ese tile. Otra vez el sujeto, no la medición.

**Lo que esta vez es nuevo, y es lo que vale:** la cadena de propagación.

| quién | qué hizo con el `10` |
|---|---|
| auditoría (yo) | lo **midió mal** y lo publicó en #978 |
| planificación | lo **copió al contrato** de `BL-J11` sin re-medirlo |
| frontend2 | lo **corrigió en el código** contra la realidad, **sin nombrar la discrepancia** |
| planificación | lo cazó al re-leer `main` y lo escribió en `ALCANCE-CIERRE-BETA.md:196` |

Durante unas horas **el contrato y el PR dijeron números incompatibles (10 vs 3) sin que ninguno
estuviera marcado como el equivocado**. Tres sesiones tocaron el dato; dos lo vieron de cerca y
ninguna lo contradijo en voz alta. El ejecutor que corrige en silencio deja la cifra falsa viva en el
contrato, y el que la copia la vuelve más creíble: **una cifra mía mal medida no se detiene sola,
viaja, y cada copia le agrega autoridad sin agregarle medición.**

**La pregunta que lo caza, y es distinta de las de `(f)`:** no es «¿de qué conjunto estoy hablando?»
—eso me protege a mí al publicar—. Es **«¿quién más va a citar esta cifra, y de dónde la va a
tomar?»**. Una cifra que entra en un contrato ajeno ya no es mía: es la base de otro. Y el corolario
para el que recibe: **si tu implementación contradice el número del contrato, la discrepancia es el
hallazgo** — corregirla callado es dejar el contrato mintiendo con tu firma al lado.

**Lo que mejoró:** en el `dato_` que escribí antes de ver sus implementaciones puse explícito *«si mi
fila afirma algo más amplio que lo que muestra su evidencia, refutenmelo con el path y la línea»*.
Lo hicieron, con path y línea. **Invitar la refutación por escrito y por adelantado funcionó mejor
que mis cuatro controles propios** — los tres de `(f)` los cacé tarde y solo; este lo cazó el
mecanismo que pedí.
