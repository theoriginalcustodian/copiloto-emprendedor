---
name: el-registro-no-se-marcaba-porque-su-id-no-circulaba
description: Un registro no se deja de marcar por descuido - se deja de marcar cuando su id no circula en el trabajo
metadata:
  type: feedback
---

El operador reclamó que el backlog «no sirve de nada» si nadie marca lo terminado. La lectura
natural —falta de disciplina— era falsa. Medido el 2026-10-14 sobre el buzón completo (460
`cierre_`, control negativo 0, ids con delimitador y no por subcadena):

> **18 de las 26 fichas nunca fueron nombradas por ninguna sesión.**

No es que la casilla no se marcara: **el id de la ficha no circulaba**. Las sesiones citaban ids
propios (`KVCAIDASALE`, `EXHAUSTIVEDEPSON`, `DRIVECERO`, `A7`, `BL-*`), así que el trabajo era
inatribuible a una ficha y su casilla no entraba al circuito de cierre. Consecuencia: el mismo
sprint se leía con **tres porcentajes incompatibles** (7% / 9% / 67%) según qué registro mirabas, y
dos fichas (`SM-B3`, `SM-B4`) llevaban un día **hechas y sin registrar**.

Debajo había una causa mecánica que nadie buscó: **`scripts/ci/atribucion.sh` nunca leyó el backlog
firmado.** Su `RE_DOC_PADRON` filtra con `grep -E '(backlog|…)'` **case-sensitive** y el doc se llama
`2026-10-11-BACKLOG-sprint-mobile-beta.md`; además su `RE_ID` sólo admitía `BL-*`/`DEC-*`/`M-*`. El
instrumento que ata commits a ids autorizados no podía atribuir **ni un solo** commit de una ficha.
Dos decisiones correctas cruzándose en un agujero, y el agujero vivía en el par.

**Why:** un registro que no se marca tiene dos causas posibles y se parecen desde afuera —nadie
marca (disciplina) o *nada puede marcarse* (el id no viaja al commit, el instrumento no lee el doc)—.
Atacar la primera cuando la causa es la segunda produce recordatorios y crones que no cambian nada:
el día del desvío medido (forense 08/10) los crones **estaban prendidos**. Y el síntoma es
silencioso: cada sesión ve su propio trabajo cerrado y correcto, nadie ve que la casilla quedó muda.

**How to apply:** ante «esto no se está marcando», **primero medí si el id circula**: grepeá el id de
la ficha —con delimitador, nunca por subcadena: `A-1` da 14 falsos positivos— en los commits de
`main` y en el buzón, y verificá que el instrumento de atribución **lea el doc** (control positivo:
¿aparece ese id en el padrón?). Si el id no circula, la corrección no es un recordatorio: es (1)
hacer que el commit/PR **cite el id**, (2) que el padrón lo acepte, y (3) que un **script** derive y
escriba el estado desde la evidencia, porque lo mecánico no se delega a la disciplina
([[buzon-se-ordena-por-janitor-no-por-disciplina]]). Prefijá los ids para que sean tokens reales
(`SM-B3`, no `B-3`) y chequeá que no colisionen con otro padrón: `D7` del mapeo y `SM-D7` del backlog
nombran cosas distintas ([[un-nombre-con-dos-referentes-prueba-A-y-concluye-B]]).

**Y el criterio de marcado es del operador, no del instrumento:** *«las tareas se marcan como
terminadas cuando el dod está hecho completo»* (2026-10-14). El merge commit es **una** de las
evidencias, no el criterio — de ahí el estado `DOD-PARCIAL` para «código en main, DoD incompleto»,
que es el que faltaba y el que impide el error que este repo ya pagó
([[una-orden-cerrada-exige-evidencia-de-device]]). Norma: `CLAUDE.md §3.quater.bis`; instrumento:
`scripts/sprint-estado.py` (`--check` en `scripts/ci/lint.sh`, `--autotest` 9/9).

---

## ⚠️ REFUERZO 2026-11-02 — la ficha RECIEN BAJADA no es asignable: el padrón se lee de `origin/main`

**Lo que pasó, dos veces el mismo día.** Bajé una ficha nueva y en el mismo ciclo la asigné como
trabajo inmediato a la sesión dueña, **con su PR todavía abierto**. Las dos veces el dueño quedó
bloqueado contra el gate: `goal.sh set <id>` **rechaza** un id que no está en el padrón, y
`--marcar` tampoco puede escribir. Backend con `SM-N1` (lo destrabó el merge de #1351) y frontend2
con `SM-N9` (#1370). Las dos sesiones hicieron lo correcto —siguieron con el código, declararon
`ATRIBUCION: libre` y lo reportaron como bloqueo **propio**— pero perdieron el marcado.

**La causa no es el gate: es que leí el padrón donde no vive.** `goal.sh` y `sprint-estado.py`
resuelven el id contra los docs versionados **de `origin/main`**, no contra mi rama ni mi working
tree. Mientras el PR de la ficha está abierto, el id **no existe para nadie más que para mí** — y
eso es correcto: un goal que el agente se inventa no es una orden, y un padrón que aceptara ramas
ajenas dejaría de ser un sujeto único.

**La regla, entonces, es de SECUENCIA y es mía, no del dueño:**
1. **Mergear la ficha primero**, verificar por efecto en `origin/main`, y **después** asignarla.
2. Si hay motivo para avisar antes (destrabar a una sesión parada ya, que es el caso legítimo),
   decirlo con **«todavía no marcable, su PR es #NNNN»** en el mismo mensaje. El costo de esa frase
   es cero; el de omitirla es que el dueño lo descubra contra un rechazo que parece suyo.

**Por qué se repite:** bajar la ficha y asignarla se sienten **un solo acto** —son el mismo
pensamiento— y el merge queda en el medio sin que nadie lo note. El síntoma aparece recién en la
otra sesión, varios minutos después, con la forma de «el gate me rechaza», o sea **lejos de la
causa y pareciendo un problema del que lo sufre**. Es la misma estructura que
[[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]] en chico: bajar la ficha está bien y
exigir que el padrón salga de `origin/main` está bien — **el hueco vive en el par**, y el orden
entre los dos no era de nadie.

**El control, si hace falta:** antes de asignar, `git show origin/main:<doc> | grep -c "^### <id> "`.
Si da `0`, el id no es asignable todavía — y `0` acá significa «mi PR no está mergeado», no «la ficha
no existe» ([[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]]).

## Refuerzo 2026-11-02 — el registro ATRASADO no sólo deja de acreditar: hace REDESPACHAR

La entrada de arriba cubre el id que no circula. Este refuerzo es el **daño simétrico y más caro**:
la ficha que **declara menos de lo que hay**. En un día, tres veces:

1. **Reporté al operador «6 fichas del sprint sin una sola línea de código».** Era falso para **4 de
   6** — `SM-N24` (`32a0d66e`), `SM-N28` (`4376027d`), `SM-N17` (`8378d53d`) y **`SM-N23`
   (`2d257f95`), el tirador que le dije que no se había corregido y ya tenía el fix en `main`**. Lo
   refutó frontend2, no el gate.
2. **Despaché a backend dos trabajos ya hechos y desplegados** (`SM-H5`, #1363 `681c3b53`): el
   `Falta:` de la ficha seguía diciendo que eran suyos. El `cierre_` existía en el buzón desde
   horas antes; la ficha no lo sabía.
3. **`SM-K6` le pedía a backend un contrato del 401 que ya estaba contestado** en ese mismo cierre.

**Por qué el estado que afirma DE MENOS es peor que el que afirma de más.** El gate
(`sprint-estado.py --check`) exige que un `TERMINADO` tenga sha ancestro de `origin/main`: vigila al
que se adelanta. Al que se queda corto **no lo mira nadie**, y **no da síntoma** — se lee como
trabajo pendiente, que es un estado perfectamente normal. Entonces se despacha de nuevo: en el mejor
caso la sesión que lo recibe lo refuta (costo: un viaje), en el peor **lo reimplementa**
([[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]] ·
[[supuesto-cuya-falla-parece-un-estado-legitimo]]).

**La causa común de los tres no es descuido: la evidencia y el registro viven en lugares distintos.**
El `cierre_` va al buzón (que no está versionado) y el `Falta:` vive en el doc. Quien cierra escribe
en el buzón; quien despacha lee el doc. **Nadie es dueño del salto entre los dos**
([[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]]).

**El control, y está escrito:** `scripts/fichas-desincronizadas.py` — para cada ficha en
`PENDIENTE`, busca commits de `origin/main` cuyo **asunto** cite su id. No prueba que el DoD esté
hecho; **refuta «no tiene una sola línea»**, que es la frase que se dijo mal. Medido antes de
embarcarlo ([[medir-si-un-gate-dispara-antes-de-embarcarlo]]): 3 sobre el `main` del momento, 6
sobre el de dos horas antes, con control positivo (caza las dos que había marcado a mano). **No está
cableado a ningún gate todavía**, a propósito.
⚠️ Y el instrumento llegó con su propio defecto, que es el mismo error en chico: el docstring decía
«asunto» y `git log --grep` busca el **mensaje completo**, así que reportaba una ficha por un commit
que la mencionaba al pasar. El filtro del asunto se hace en el script, no se delega en git
([[el-contrato-afirma-el-mecanismo-que-no-opero]]).

**Lo que el script NO cubre, y hay que hacer a mano:** el `Falta:` desactualizado de una ficha que ya
está en `DOD-PARCIAL` (casos 2 y 3). Ahí no hay estado que contradecir — **el texto miente y el
estado está bien**, así que ningún control estructural lo ve. El único control es **barrer los
`cierre_` del buzón dirigidos al frente ANTES de despachar**, que es justo el paso que me salté las
dos veces.
