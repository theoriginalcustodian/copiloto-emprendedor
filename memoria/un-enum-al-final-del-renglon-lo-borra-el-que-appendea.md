---
name: un-enum-al-final-del-renglon-lo-borra-el-que-appendea
description: "Si un instrumento lee un enum en el último campo de un renglón, el reflejo de appendear narrativa lo destruye en silencio — y un estado no reconocido que se trata como texto libre es indistinguible de uno legítimamente cerrado"
metadata:
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
---

Cuando un instrumento lee un **enum** (`pendiente` / `arrancando`) del **último campo** de un renglón
que también contiene **narrativa libre**, ese enum tiene dos formas de morir sin ruido: alguien
appendea texto al final del renglón y lo pisa, o la narrativa contiene el separador y el parseo se
corre de campo. En los dos casos el instrumento no falla: **responde con confianza lo contrario de la
verdad**.

**Why:** el 2026-09-22 `cola-check.sh` leía el estado de los hitos con
`while IFS='|' read -r id nombre disp estado`. Con 4 variables, `$estado` recibe *todo* lo que sigue
al tercer `|`. Dos hitos cayeron el mismo día, por los dos caminos:

- **OLA3** estaba declarada `arrancando` desde las 02:40 en un renglón de 5 campos → `$estado` valía
  `«…narrativa…|arrancando»`, que no matchea `arrancando`. Estuvo **~12 h invisible**.
- **A4ARR**: yo actualicé su estado escribiendo el resumen del avance **al final del renglón**, que es
  exactamente donde vivía el enum. Lo borré sin darme cuenta.

El veredicto resultante fue el mismo las dos veces —`⚠️ NADA arrancando`— y su consecuencia no era
cosmética: el monitor me mandaba a **arrancar el hito siguiente de la cola**, que eran los
interruptores del operador (OAuth, legal, reescritura de historia), teniendo dos frentes vivos. El
instrumento no mentía por un bug exótico: mentía porque el formato invita al error que lo rompe.

El agravante estaba en el `else` implícito: los estados no reconocidos se documentaban como *"done
(✅…), bloqueado, o cualquier otro texto libre — el resto ya tiene su propio seguimiento"*. Esa frase
convierte un renglón **roto** en un renglón **cerrado**: son indistinguibles, y el costo de
confundirlos es perder de vista un frente activo.

**How to apply:** (1) leer el enum del **último** campo (`${linea##*|}`), nunca del n-ésimo, cuando el
renglón admite separadores en la narrativa. (2) Validar el enum contra la lista cerrada y **gritar
`MALFORMADO` con el id** ante cualquier otro valor: un instrumento tiene que distinguir *"no aplica"*
de *"no entiendo"* — tratar lo segundo como lo primero es el fail-open clásico de un parser. (3) El
test del arreglo necesita el **control negativo del parseo viejo** (que el caso real no se viera
antes); sin él, el positivo no prueba que la regresión sería visible. (4) Al actualizar a mano un
renglón que un script parsea, escribir en el campo de narrativa y **releer la última columna** — o
mejor, correr el instrumento inmediatamente después de editar: acá el propio ciclo de cron lo delató
en 3 minutos, y por eso el daño fue de minutos y no del día.

Relacionado: [[instrumentos-que-confirman-en-vez-de-verificar]] ·
[[un-instrumento-tiene-dos-modos-de-no-saber-callarse-e-inundar]] (aquél es el instrumento que calla o
inunda; éste **contesta bien la pregunta equivocada**) ·
[[una-allowlist-manual-no-puede-saber-lo-que-le-falta]] ·
[[el-watchdog-que-solo-ve-al-que-llega-tarde-nunca-al-que-no-vino]]

## Reincidencia 2026-09-22 — **seis** renglones a la vez, y uno tenía un pedido del operador

Un año de `How to apply` escrito, y el mismo `PLAN.md` tenía **6 filas** con el enum sepultado:
`BETA5` `CONS8` `SOP4` `SOP6` `SOP7` `CAL1`. Cinco eran cierres que se escribieron con `🟢` o con
texto libre (`DONE 2026-08-07`) en vez del enum de la lista cerrada. La sexta, `CAL1`, es la que
duele: su estado real vivía en el campo 4 y un appendeo posterior lo empujó al 5 — y ese appendeo
**empieza con la palabra «pendiente»**, así que a ojo el renglón parece bien formado.

Lo que esto agrega al caso original: **no alcanza con leer el último campo; hay que VALIDAR contra la
lista cerrada**, que es el punto (2) de arriba y es justamente el que no se había implementado.
Cinco de las seis se habrían cazado solas con esa validación el día que se escribieron.

Y el `How to apply` (4) —«correr el instrumento inmediatamente después de editar»— falla acá por una
razón que no estaba prevista: **quien appendea no es quien escribió el enum**. La sesión que agrega
«+ 2026-09-xx: …» al final de un renglón ajeno no siente que esté tocando un campo parseado; está
agregando una nota. Por eso el formato sigue invitando al error aunque todos conozcan la regla.

**Normalización que sí sirve:** appendear el enum como **campo nuevo al final**, sin editar una sola
palabra del texto histórico. El registro queda intacto y el parser vuelve a ver el estado — y como el
appendeo natural es al final, el próximo que agregue una nota vuelve a romperlo. La única defensa
real es la validación ruidosa, no la disciplina.

---

## 2026-09-23 — el que rompió el enum no fue un append: fui yo, "mejorando" la redacción

La entrada nació con el appendeo ciego. El tercer caso llegó por otra puerta y es peor, porque fue
**deliberado**: al cerrar seis frentes escribí el último campo como `CERRADA -- #676 en main` en vez
de `✅ cerrada`. Más informativo para un humano; **vacío** para el parser, que normaliza el campo y
exige `pendiente` | `arrancando` | prefijo ✅/❌.

Nueve hitos quedaron invisibles, entre ellos el único frente **vivo**. El veredicto pasó a ser
«NADA arrancando → arrancá CIERREB», que son los interruptores del **operador**: el instrumento
mandaba a las tres sesiones a un frente sin nada arrancable, con LEGAL activo al lado.

**La regla: un campo que un instrumento parsea no admite mejoras de redacción.** El contexto va al
campo de texto libre —acá el disparador—, nunca al del enum. Un enum es una interfaz, y ampliarla
unilateralmente desde el lado del escritor rompe al lector sin error.

Y el remate: el modo de falla estaba escrito **en el comentario del propio `cola-check.sh`**, que yo
había leído ese mismo día al arreglar los dos casos anteriores. **Conocer el modo de falla no lo
evita.** Lo único que lo evita es correr el instrumento **después** de editar el archivo que el
instrumento lee — acá, un `bash scripts/cola-check.sh` de dos segundos.

---

## Caso 4 (2026-09-23) — lo cometí **veinte minutos después de escribir el caso 3**

Agregué una fila al tablero y la cerré con `| en curso — bloqueada por GRAFO`. Ni `pendiente`, ni
`arrancando`, ni `✅`: **inválida**. La fila quedaba invisible para `cola-check.sh`, igual que las
nueve del caso 3.

Y no fue descuido ni prisa. Fue **querer decir dos cosas en un campo que sólo admite una**: el
estado (*en curso*) y el motivo (*bloqueada*). El enum no tiene lugar para el matiz, así que se lo
agregué — exactamente el mismo impulso del caso 3, que fue «mejorar» `✅ cerrada` a
`CERRADA -- #676 en main`. **El campo parseado atrae contexto como un imán**, porque es el que se
lee de un vistazo; y es justo el que no lo tolera. El matiz va en el campo de texto libre, que está
al lado y no tiene límite.

**Lo que lo atrapó no fue acordarme de esta memoria: fue correr `cola-check.sh` inmediatamente
después de editar.** Lo escribo así de crudo porque tenía el archivo abierto y el aprendizaje
fresco, y lo repetí igual. La conclusión del caso 3 —«conocer el modo de falla no lo evita; lo evita
correr el instrumento»— queda **confirmada por reincidencia**, que es la única forma seria de
confirmarla.

**Regla operativa, sin excepción:** después de editar un archivo que un instrumento parsea, **correr
el instrumento en el mismo comando**. No al final de la tanda, no antes de commitear: en el mismo
comando, mientras el cambio todavía es el sospechoso obvio.

---

## Refuerzo 2026-09-30 — el enum no lo borra sólo el que appendea: lo borra un `|` en la PROSA

Variante nueva y más barata de disparar. `cola-check.sh:76` no parsea columnas: toma **todo lo que
viene después del ÚLTIMO carácter `|` de la línea** (`${linea##*|}`, después `tr -d ' '` y a
minúsculas). O sea que el "último campo" no es el quinto campo de la tabla: es lo que quede a la
derecha del último pipe, **venga de donde venga**.

Lo rompí yo mismo escribiendo una fila del PLAN. En el campo de detalle puse un grep entre backticks:

```
… el cableado (`gastoIdInicial|abrirGasto`) …  | backend | … | pendiente
```

Ese `|` de la alternación del grep no era una columna: era prosa. Pero para `cola-check.sh` el último
pipe pasó a ser otro, y el estado de la fila quedó ilegible → **fila malformada**, o peor, el frente
deja de contarse sin que nadie lo note. Dos frentes se me volvieron invisibles así en un día.

**Por qué esta variante es peor que la original:** la de arriba (el que appendea al final del renglón)
requiere que alguien edite el final de la fila. Ésta se dispara desde el **medio** del texto, en un
campo que no tiene nada que ver con el estado, escribiendo algo perfectamente correcto —un patrón de
grep, una alternancia de regex, una tabla anidada, un `awk -F'|'` citado—. El autor no está tocando el
estado y no tiene motivo para sospechar que lo movió.

**La regla operativa:** en una fila cuyo estado se lee por posición, **el separador es un carácter
reservado y la prosa no lo puede contener**. Si hace falta nombrar una alternancia, se escribe
`gastoIdInicial` / `abrirGasto` con barra, o se saca el detalle a otro campo. Y el control es correr
el lector (`cola-check.sh`) **después de cada edición del tablero**, no al final de la sesión: es lo
que cazó las dos filas mías, incluyendo una donde además había marcado `⏳` (bloqueado por tercero) un
trabajo que era **mío y arrancable** — el instrumento corrigió dos errores distintos de la misma edición.

⚠️ Y el hermano del mismo día, midiendo con `awk -F' \| '`: el `|` desnudo en una ERE es **alternancia**,
así que `awk` partió por espacios y me devolvió `"hoy)."` como último campo. Un instrumento malo que
se veía igual que una fila rota. Ver [[contar-un-simbolo-no-dice-en-que-rol-aparece]].

---

**Refuerzo (2026-10-06): la barra parte el renglón AUNQUE esté dentro de un code span — y un code span parece
inocente.** Rompí dos filas del tablero escribiendo el enumerado `CLEAN` / `HAS_HOOKS` / `UNSTABLE` con barras
entre backticks. Markdown lo renderiza perfecto, la fila **se ve bien**, y el parser —que corta por `|`— toma como
«estado» el último pedazo, así que la fila queda **invisible para la cola**. Lo escribí **dos veces**: la segunda,
dentro de la fila que documentaba la primera. El bloque ya tenía la leyenda avisándolo; leerla no alcanzó, porque
el reflejo es «esto está entre backticks, es texto». **No hay excepción por backticks.** Control que sí funciona:
un guard en el script que aborta si el campo contiene `|`, sin whitelists — me cazó a mí mismo.

**Y dos formas más de fila invisible, del mismo barrido:**
- **El id con GUION.** `STUBGH-4` y `CUENTA-REMEDIR` nunca matchearon `^[A-Z0-9]+` seguido de barra, así que
  **ningún** barrido previo los contó — ni los míos. El patrón del id es parte del contrato de la tabla: si lo
  escribís más estrecho que los ids reales, las filas no están «mal», están **fuera del universo medido**
  ([[el-universo-externo-del-instrumento-tiene-su-propio-denominador-incompleto]]).
- **El id DUPLICADO.** `LEGAL` nombraba **dos asuntos sin relación** (el texto legal de BL-O6 y el ratchet de
  versión TS↔Python). Una búsqueda por id lee **una de las dos al azar** y la otra no existe para quien pregunta;
  peor, un «ya está cerrado» legítimo de una tapa a la otra. Renombradas `LEGALTEXTO` / `LEGALRATCHET`. El control
  es de una línea y no estaba: contar ids y asertar que el set no tiene repetidos.

**How to apply:** antes de barrer una tabla por id, corré tres controles sobre **el archivo**, no sobre tu idea de
él: (1) ¿el patrón del id matchea **todas** las filas? (contá filas totales vs. filas que matchean); (2) ¿hay ids
repetidos?; (3) ¿el último campo de cada fila es un estado legible? Las tres son una línea cada una y las tres
fallaron acá.

---

## Refuerzo 2026-10-06 — el glifo SOBRECARGADO: calmar el warning del guard fue lo que enterró la fila

Cuarto vector, y el más caro de los cuatro porque el renglón estaba **perfectamente formado**. `cola-check.sh`
documenta su vocabulario así: *«el último campo debe ser exactamente `pendiente`, `arrancando` … o empezar con
✅/❌»*. Tres filas cuyo estado real era **`⏳` (trabada por un disparador externo: sólo el operador la mueve)**
salían como «estado no reconocido» en cada corrida del monitor, así que las *arreglé* prefijándoles `❌`. El
warning se calló. **Y con él se calló la fila:** `❌` ya significaba «descartada», o sea *terminal*, así que el
siguiente lector —mi propio script de bajada al historial— las trató como cerradas y las mandó al archivo que
nadie abre. Dos de las tres eran **decisiones del operador**: una fila que lo espera y no circula es una decisión
que nadie se la va a presentar ([[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]]).

**El filo exacto, que no es «escribí mal un enum»:** el vocabulario del instrumento **no tenía token** para
«viva pero intomable por ninguna sesión», así que ese estado tuvo que pedirle prestado el glifo de otro. Un
glifo con dos significados no se detecta leyendo el renglón —es válido— ni corriendo el guard —queda verde—.
Y el camino que lleva al error es el que *parece* prudente: ver un warning repetido y hacerlo callar. El guard
que grita en el caso normal se desarma solo ([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]), pero la
forma de desarmarlo que elegí **destruyó el dato**, no sólo el ruido.

**Lo cazó un `0` ajeno, no un diff.** Otra sesión grepeó una fila por id, obtuvo cero hits, y en vez de explicar
el cero corrió un control positivo (grepear una fila que ella misma había citado hacía horas: también 0). Sin ese
control, el cero se lee como «esa fila no existe» y el entierro queda permanente. Ningún diff contenía el defecto:
el renglón que se movió era idéntico al que se había escrito.

**How to apply:** (1) antes de agregar un estado nuevo a una tabla, preguntá si el vocabulario **ya tiene** un
token para él — si no lo tiene, el token se **agrega**, no se le presta el de otro; (2) un glifo cuyo significado
dependa de lo que viene después (`❌ descartada` vs `❌ ⏳ espera`) no es un enum: es prosa, y todo parser va a leer
el primer carácter; (3) cuando un guard grite en el caso normal, el arreglo es **ensanchar el guard**, nunca
maquillar el dato para que calle; (4) si un barrido por id te da 0, el control positivo es grepear algo que
**sabés** que está — y si eso también da 0, el que está roto es el barrido o el universo, no el archivo.
---

## Refuerzo 2026-10-07 — **escribí el estado de dos veredictos yo, horas después de escribir esta entrada**

Esta entrada ya decía, textual: *«un glifo cuyo significado dependa de lo que viene después (`❌ descartada` vs
`❌ ⏳ espera`) no es un enum: es prosa, y todo parser va a leer el primer carácter»*. Ese mismo día, al rescatar
filas congeladas, escribí dos estados así:

```
CORPUSETIQUETA | … | … | ❌ ⏸ **CONGELADA 2026-10-06 — fila de INSTRUMENTO**
INDICETRESVIAS | … | … | ❌ ⏸ **CONGELADA 2026-10-06 — fila de INSTRUMENTO**
```

Las dos filas estaban **vivas** (congeladas = estado con condición de entrada declarada), y las dos quedaron
clasificadas como **terminales**: `cola-check.sh` hace `case "$estado" in ✅*|❌*) : ;;` ⇒ el primer carácter
decide. Mi propio criterio de bajada las habría mandado a `PLAN-HISTORIA.md` como cerradas, que es exactamente
el entierro que esta entrada describe.

**Lo que NO funcionó: tener la lección escrita.** La escribí yo, el mismo día, y reincidí igual. Escribir la
regla no la aplica — es la misma forma que citar el punto 4 de un DoD dos párrafos antes de violarlo.

**Lo que SÍ funcionó: medir antes de actuar.** El script de bajada contaba las filas terminales e imprimía el
número **antes** de mover nada. Esperaba 7 y dijo **9**; las dos de más eran éstas. No las vi leyendo el
archivo —las había leído varias veces ese día—, las vio el **denominador**.

**Y el segundo guard que pagó solo:** ese script aborta si un estado contiene **más de un glifo de veredicto**
(`✅ ❌ ⏸ ⏳ 🚦`). No «si el formato es raro»: si hay **dos veredictos**, que es la condición exacta del defecto.
Un estado ambiguo no se baja ni se adivina — se desambigua primero y recién después se mueve.

**Un tercer hallazgo del mismo barrido, que no es de glifos pero vale:** el script también abortó en una fila con
**6 campos** en vez de 4, y la fila **no estaba mal**. `cola-check.sh` lee el estado como el **último** campo, así
que unas comillas con una barra adentro en la prosa no le molestan. El estricto era **mi** validador, no el
formato. Cuando un control propio contradice al que ya vive en producción, el que manda es el de producción:
copiá su regla, no inventes una más dura. (La fila igual se normalizó, porque la convención existe para los otros
lectores.)

**How to apply (se suma a lo de arriba):** (1) **un control que cuenta y dice cuántos** caza lo que la relectura
no caza, porque el defecto no está en lo que leés, está en lo que **no volvés a leer**; (2) escribí el esperado
**antes** de correr el barrido —«espero 7»— y si sale otro número, pará: la diferencia es el hallazgo;
(3) un guard de «más de un veredicto en el campo de estado» es barato y dispara en el caso real, no en el
hipotético; (4) antes de endurecer un validador propio, comparalo con el parser que ya está en producción: si
el tuyo rechaza lo que el otro acepta, el falso rojo es tuyo.
