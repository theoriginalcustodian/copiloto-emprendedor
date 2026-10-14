---
name: la-cita-de-procedencia-muere-en-el-merge
description: Un «medido @ sha» de rama deja de resolver en el instante del squash-merge, justo cuando el documento empieza a circular. Medido: 26% de las citas de SHA del repo no sobrevive a un clon nuevo.
metadata:
  type: feedback
---

Un documento que declara con qué versión del instrumento midió —«medido @ `527e5408`»— cita un
commit **de rama**. El merge es por **squash**: crea un commit nuevo y borra la rama. La cita se
vuelve no-resoluble **en el momento exacto del merge**, que es cuando el documento deja de ser
borrador y empieza a circular. Resuelve en los checkouts que ya tenían el objeto —por eso nadie lo
nota— y falla en un clon limpio, que es donde se audita.

**Medido el 2026-10-05** sobre 564 `.md` (`docs/` + `memoria/` + el buzón): **835 citas de SHA** →
585 OK · 26 OK-blob · 4 OK-tree · **136 ZOMBI** (resuelve acá, no es ancestro de `main`) ·
**84 FANTASMA** (no resuelve ni acá). **220 de 835 = 26% no sobrevive a un clon**, repartidas en 65
archivos. Controles positivos en la misma corrida, los tres en su clase: `origin/main` = OK ·
`deadbee1` = FANTASMA · `527e5408` = ZOMBI.

**Hay progresión temporal, y es lo que lo vuelve irreversible:** el `gc` acaba borrando el objeto, así
que **el ZOMBI de hoy es el FANTASMA de mañana**. Se ve en la distribución: los FANTASMA se concentran
en checkpoints de junio/julio y los ZOMBI en documentos de septiembre/octubre. Mientras es zombi
todavía se puede resolver a mano desde un checkout que lo tenga; después, no.

**La raíz, y es barata:** la procedencia se cita con el **merge commit** del PR
(`gh pr view <N> --json mergeCommit` — verificado: #770 → `515d50f6`), que es lo único que sobrevive
al squash. Mientras el PR está **abierto no existe un SHA citable estable**, así que se cita el PR
(`#770`) o el **blob** del archivo, que el squash preserva si el contenido llegó.

**El gate que esto pide nace con falsos positivos si no se diseña con cuidado, y la medición lo
predice:** tras corregir el tablero quedaron **2** menciones del sha muerto y las dos son legítimas —
el relato de la corrección, y el **control positivo**, que necesita nombrar un zombi para
acreditarse. Un gate de «todo sha resuelve» las marca igual: la FORMA no codifica el ROL. **El patrón
de solución ya existe en este repo:** para ilustrar un mecanismo se usa un valor **fuera del padrón**
(el delimitador ficticio de los ejemplos internos; el id fuera del padrón en el ejemplo del formato).
Aplicado: **para ILUSTRAR, un sha imposible** (`deadbee1`); **para PROCEDENCIA, el merge commit**.

**Y la decisión de alcance, que no es cosmética:** el **tablero vivo se corrige** (circula, y es lo que
se lee para decidir) y los **documentos fechados se dejan** — reescribir la cita de un doc fechado es
reescribir lo que midió ese día. Para ellos vale la regla nueva de ahí en adelante; el gate mide el
**incremento** (las citas que un PR agrega), no el stock, porque un umbral sobre el stock sería una
foto del corpus del día.

Relacionadas: [[medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero]] (el mismo
ref inexistente, del lado del instrumento) ·
[[un-id-que-fabrica-el-instrumento-no-puede-parecerse-a-uno-real]] (un sello que parece referencia y
no lo es) · [[si-el-formato-no-codifica-el-rol-ningun-parser-lo-recupera]] (por qué el gate no puede
distinguir ilustrar de citar) · [[un-umbral-calibrado-es-una-foto-del-sistema-de-ese-dia]].

---

## Refuerzo 2026-10-12 — el squash borró la SEPARACIÓN DE COMMITS que era la evidencia

Para acreditar que un esperado se había escrito **antes** del instrumento, armé la prueba en la
forma que git puede atestiguar: el fixture en **su propio commit** (`8606def6`, 23:18:44), tocando
**un solo archivo**, y recién después la corrida (23:18:57) y el fix (`655c370d`). El orden no era
una afirmación: era historia.

El squash-merge lo fusionó todo en `43b77379`. Medido después:

```
commits en main que tocan el fixture ciego: 1
el sha 8606def6 (fixture solo) existe en main? NO — lo absorbio el squash
sigue existiendo localmente? SI (solo local, la rama remota se borro)
```

En `main`, fixture e instrumento comparten commit — **exactamente la objeción que la separación
venía a resolver, reintroducida por el merge**. Y al borrar la rama remota, el único lugar donde
vivía la secuencia quedó siendo mi checkout local y el transcript.

**La regla:** cuando el **orden entre dos commits** es la evidencia —no su contenido—, el squash la
destruye, porque colapsa N commits en uno y descarta sus fechas. Si la prueba es temporal, no puede
viajar en la estructura de commits de una rama que se va a squashear: hay que **escribirla en el
contenido** (encabezado del artefacto, cuerpo del PR, el propio transcript) o pedir merge sin
squash. Lo mismo vale para «este archivo se agregó sin tocar nada más»: el stat del squash muestra
los 3 archivos de la rama, no el 1 del commit.

→ [[un-control-positivo-con-esperado-falso-acusa-al-script]] · [[push-es-el-ultimo-paso-no-el-primero]]
---

### Refuerzo 2026-10-13 — cuatro predicados de «¿ya está en `main`?» dieron 43, 22, 20 y 20

El squash no sólo mata la **procedencia**: también deja sin predicado barato la pregunta
*«¿esta rama ya aterrizó?»*. Medido hoy sobre las **332 ramas remotas** del repo, con el mismo corpus
y cuatro instrumentos distintos:

| predicado | dio | por qué está mal |
|---|---|---|
| `git merge-base --is-ancestor rama main` | **43** mergeadas | el squash crea un commit NUEVO: el de la rama nunca queda ancestro. Subestima 7×. |
| `git cherry main rama` (patch-id) | 20 ausentes | caza el squash **1:1** y nada más: con 2+ commits el squash une los patches y ningún patch-id individual coincide. |
| `git diff main rama` (árbol completo) | **22 de 22** difieren | compara los árboles enteros: una rama vieja difiere en 900 archivos **por estar atrasada**, no por aportar ([[base-rancia-invierte-la-direccion-del-diff]]). |
| `git diff main rama -- <sólo los archivos que tocó desde su merge-base>` | 20, y **pasa los controles** | es el único que pregunta *«¿mi aporte está?»* en vez de *«¿los árboles son iguales?»*. |

**Los tres primeros fallaron contra el MISMO control positivo:** una rama que yo mismo había mergeado
media hora antes (PR #1066, merge commit conocido). El 1º la cuenta como no-mergeada, el 2º le encuentra
«2 pendientes», el 3º «22 líneas de diferencia»; el 4º da `0/11`. Sin ese control los cuatro números
son igual de citables — y el que se cita es el que salió primero.

Y el predicado autorizado para «¿aterrizó?» no es de git sino de la **forja**:
`gh pr list --state merged --head <rama>`. Dio **309 de 332** con PR mergeado y 23 sin ninguno — contra
una cifra de «89» que yo arrastraba en una lista corta al operador y que no salía de ninguna medición
reproducible ([[una-cifra-sin-unidad-se-deja-citar-para-cualquier-pregunta]]).

**Y un último giro, que es el que importa antes de borrar algo:** de las 20 ramas con contenido
*ausente del árbol*, la muestra de 4 que verifiqué **por símbolo** (¿vive el fix en `main`, aunque no
viva el patch?) dio **4 de 4 ya aterrizadas por otro camino** — `sanitizeLegacyHitlTokens`, el gate de
la card stale, los tokens `--r-pill`, y `BL-V23`, cuyo PR #713 fue **CLOSED** y reemplazado por #719
«reconstruido limpio». O sea: **«el patch no está» y «el trabajo no está» son preguntas distintas**, y
la segunda no la contesta ningún comando de ramas: se contesta grepeando el **símbolo** en `main`.

**How to apply:** para «¿esta rama se puede borrar?», dos preguntas en este orden — (1) *¿tiene PR
mergeado?* → `gh pr list --state merged --head`, que es el único registro que el squash no destruye;
(2) si no lo tiene, *¿vive el fix en `main`?* → grep del símbolo distintivo, **no** diff de ramas. Y
cualquier conteo de «ramas mergeadas» se acompaña del predicado con el que se midió: sin eso, cuatro
números contradictorios son todos «la cifra».

---

## Refuerzo 2026-10-13 — lo mismo mata un **DISPARADOR**, y ahí el síntoma es una sesión que no arranca

Hasta acá esto era sobre **citas** y sobre **borrar ramas**. Tiene una tercera forma, más caro todavía:
usar `--is-ancestor` como **condición de arranque** entre dos sesiones. Una sesión propuso esperar con
`git merge-base --is-ancestor 6fb08eef origin/main` para empezar su parte cuando la otra mergeara. Con
squash-merge ese commit **nunca** va a ser ancestro de `main`: el predicado queda en «todavía no» para
siempre, sobre trabajo ya mergeado, y el síntoma no es un error — es **quietud**, que es justo lo que
nadie mira.

**Cómo aplicarlo:** un disparador entre sesiones se mide por **EFECTO**, no por procedencia.
`git grep -c "<símbolo distintivo>" origin/main -- <ruta>` > 0 sobrevive al squash, al rebase, al
cherry-pick y al «lo reconstruí limpio». Y si el símbolo todavía no tiene nombre, el disparador
tampoco está listo para escribirse.
→ [[una-espera-sin-disparador-nombrable-es-paralisis]] · [[un-disparador-cumplido-no-avisa-a-nadie]]
