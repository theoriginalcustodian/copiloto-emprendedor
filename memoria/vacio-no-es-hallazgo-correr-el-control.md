---
name: vacio-no-es-hallazgo-correr-el-control
description: "Un cero/vacío del propio instrumento es una pregunta, no buena noticia — correr el control del control"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 37aeed5a-4657-4d45-ac7e-0a64568aac87
  modified: 2026-07-20T15:49:08.396Z
---

**Antes de leer un `0` como buena noticia, comprobar que el detector sepa encontrar algo.**

Caso vivido (sprint mobile-first, 2026-07-20). Escribí en `S2-classify-port.mjs` un detector de
"fugas de dominio" (archivo agnóstico que importa uno descartado). Reportó `fugasDeDominio: 0` y lo
leí como que el boundary estaba limpio. **Era estructuralmente imposible que reportara otra cosa:**
`path.resolve` en Windows devolvía `C:\packages\...` y mi `.slice(1)` dejaba `:/packages/...`, así
que ningún import matcheaba jamás con el registro. Un agente encontró después, a mano, una fuga real
(`api/index.ts` → `api/clinical.ts`) que ese chequeo debía haber cazado.

**Why:** es exactamente el fallo que la constitución llama *un vacío es una pregunta, no un
hallazgo* — pero aplicado al **propio instrumento**, que es donde más engaña: un `0` producido por
código propio se siente verificado, no asumido. Y una vez leído como buena noticia, se canoniza:
entra al reporte y contamina todo lo que se apoye encima.

**How to apply:**
1. Todo detector/validador que pueda devolver "no encontré nada" necesita un **control**: quitarle
   deliberadamente lo que debe detectar y confirmar que lo detecta. Cuesta un minuto.
2. Mejor todavía, **hornear el control en el script**: si el grafo inverso sale vacío en un árbol de
   250 archivos, eso es imposible → reventar, no emitir un `0`. Un instrumento que no distingue
   "no hay" de "no puedo buscar" es peor que no tenerlo, porque da sensación de vigilancia.
3. Lo mismo aplica a vigías y monitores: el primer vigía del build devolvía `UNKNOWN` en cada
   iteración y habría reportado "sigue en cola" para siempre.

Se aplicó bien después, en el mismo sprint: al escribir el validador de assets de S4 corrí el
control (saqué `icon.png`, verifiqué que abortara, lo restauré) **antes** de confiar en él.

[[no-codificar-la-esperanza-principio-raiz]] · [[spike-first-central-proyecto]] · [[copiloto-mobile-first-cascara-glass]]

---

## El giro que costo mas caro: el control puede fallar en FALSO POSITIVO (2026-09-28)

Esta entrada nacio sobre el `0` que miente. El caso de hoy es el mismo mecanismo en la direccion
**opuesta**, y por eso engaña mas: **un instrumento que no midio puede producir la senal de EXITO
del control.**

Probando el brazo `pageerror` de un guard ajeno, monte tres canarios: C0 sin excepcion (no debe
abortar), C1 excepcion inocua (debe abortar), C2 la excepcion real (debe abortar). Los **tres**
salieron `EXIT=1`. Si hubiera contado exit codes, el veredicto era limpio y falso: *«C1 y C2 abortan
⇒ el brazo funciona»*. La salida cruda decia `ERR_MODULE_NOT_FOUND: pwa-lib.mjs` — **ninguno de los
tres habia llegado a cargar la pagina**, y C0, que deberia haber PASADO, tambien fallaba. Ese C0 era
la unica pista, y un contador de «cuantos abortaron» la borra.

**La regla que se agrega:** un control positivo necesita su propio control negativo **en la misma
corrida**. Si todas las celdas del control dan el resultado esperado, incluida la que deberia dar el
contrario, no se probo nada: se midio el entorno.

## Contador: CUATRO veces en un dia un numero significo «no medi» y se leia como veredicto

No es una anecdota. Es la firma de trabajar con instrumentos que devuelven escalares:

| # | lo que dijo el contador | lo que era |
|---|---|---|
| 1 | `0/8` activaciones en un server | el script aborto en la fase de linea base |
| 2 | `EXIT=1` del detector de superficie | `MODULE_NOT_FOUND` de `playwright-core` |
| 3 | `EXIT=1` en los **tres** canarios | `pwa-lib.mjs` ausente — falso positivo del control (arriba) |
| 4 | **10** filas en una tabla de 11 | la fila partida por dimension se perdio en silencio |

Las cuatro las cazo lo mismo, y no fue re-medir: **leer la salida cruda teniendo el titular servido.**
Los dos primeros eran `0` y `1` — numeros opuestos, misma causa: *no medi*. Un contador que no
distingue «medi y salio cero» de «no llegue a medir» produce las dos lecturas con igual confianza.

**Como se hornea, concretamente** (los cuatro se habrian cazado con esto):

```bash
# el control del ENTORNO va antes de medir, y aborta con un codigo propio
node -e "require('playwright-core')" 2>/dev/null || { echo "ABORT: el 0 de abajo seria mio"; exit 9; }
[ -f "$CHROME_PATH" ] || { echo "ABORT: falta el browser"; exit 9; }
```

Un `exit 9` reservado para «no pude medir» separa de una vez las dos poblaciones que `1` mezclaba.
Y para el caso 4: cuando una unidad del documento no rinde dato, **emitirla como
`SIN_VEREDICTO_PARSEABLE` en vez de no emitir nada** — un hueco se nombra, no se cuenta como cero.

## El par de controles se compara ENTRE SÍ, no contra tu expectativa (2026-09-29)

**Regla nueva, y es la que más rinde de toda esta entrada:** si el control **positivo** y el
**negativo** devuelven **el mismo valor**, el par no discrimina — no absolviste ni condenaste, **no
medisteis**. La entrada ya decía «si todas las celdas dan el resultado esperado, se midió el entorno».
Esto es la otra mitad: si dan el **mismo** resultado entre ellas, da igual cuál esperabas.

El caso: verifiqué por efecto un merge propio y salió `EFECTO=0` — la frase no estaba en `origin/main`.
Se lee como «el merge no llegó». **El control negativo también dio 0.** Dos ceros: el par estaba vacío.
Y era mío — grepeé la entrada de memoria buscando una frase que sólo existía en el **doc de auditoría**
del mismo PR. Re-medido con una sonda que primero probé contra el archivo local (positivo 1 y 2,
negativo 0, ahora sí distintos): el merge había entrado perfecto, `#707` → `c9c8c852`.

**Lo barato que lo cierra:** antes de grepear el sujeto remoto, grepeá **el archivo local** con la misma
sonda y exigí `>0`. Si la sonda no encuentra nada donde sabés que está, no mide nada donde no sabés.

**Y el contador sigue: TRES más el mismo día, todas mías, todas cazadas por el control y ninguna por la
lectura.**

| # | lo que dijo | lo que era |
|---|---|---|
| 5 | `0` comentarios de una forma en dos lotes | un `for` sobre `find` se partió en el espacio de «Claude code» y grepeaba la palabra `Claude` como si fuera un archivo. Lo cazó el positivo: una forma que el propio reporte declaraba en 3 tenía que dar >0 |
| 6 | `0` huérfanos leyendo el JSON | **el ciego era mi lector**: busqué las claves `huerfanos`/`detalle[].huerfano` y la real es `veredictos_huerfanos`. La salida humana decía 4. Casi acuso al instrumento ajeno con el mío roto |
| 7 | `EFECTO=0` post-merge | sonda inexistente en el archivo grepeado (arriba) |

Las tres son de un turno en el que **auditaba instrumentos ajenos**. Ahí está lo incómodo y lo útil: el
que mide instrumentos usa más instrumentos que nadie, y no hay razón para que los propios estén mejor
controlados que los que juzga. **El control no es un trámite del sujeto: es del acto de medir.**

## Y el reverso, que vale igual: un control que FALLA puede acusar al valor esperado

Dos veces el mismo dia un control horneado aborto y el equivocado era **el numero de referencia**, no
el instrumento: el `8` de `mic-funcion` (eran 4 — dos menciones estaban en comentarios) y nueve paths
`screens/*.tsx` que asumi cuando la estructura real es `modules/<dominio>/`. Sin ese segundo control
habria leido nueve «VIGENTE» que solo significaban «el path no existe», y con ellos habria declarado
vigentes filas caducadas de una matriz de conformidad.

**Lo dificil no es poner el control: es no tocar el umbral cuando falla.** Hay que poder sospechar
del esperado, no solo del instrumento — y cual de los dos es se averigua yendo a mirar, nunca
ajustando hasta que aparezca el verde. Emparentada con
[[contar-un-simbolo-no-dice-en-que-rol-aparece]] y [[el-instrumento-respondio-sobre-otro-sujeto]].

---

## Refuerzo 2026-09-30 — el MISMO NÚMERO de antes no distingue «no hace falta» de «no corre»

Apliqué un fix al lector de sujetos, corrí la medición sobre el corpus real y **dio exactamente lo
mismo que antes**: las mismas 5 filas ciegas, en los mismos 2 documentos. Esa lectura admite dos
explicaciones opuestas y el número no las separa:

- el fix **no hacía falta** (el enfoque estaba mal), o
- el fix **no corrió** (la implementación no se ejercita).

Bajé a un **fixture mínimo** con la forma exacta del documento, imprimiendo el estado intermedio
(`columna_de_sujeto` por línea). Ahí se vio en una corrida: la cabecera devolvía la columna correcta
y las filas seguían saliendo sin sujeto. La causa era mía y de una línea — `fila_de_tabla` devuelve
`None` para el **separador**, el separador vive **siempre** entre la cabecera y sus filas, y mi
reset «si no es fila, se muere el alcance» borraba la columna **una línea después de calcularla**.
El fallback no corrió nunca.

**El detalle que lo vuelve regla:** `veredictos_de`, 100 líneas más arriba **en el mismo archivo**,
ya abría su loop con `if es_separador(linea): continue`. Reimplementé su mecanismo de cabecera y
dejé afuera su guarda. Es [[el-fix-ya-existe-en-otro-call-site]] en su forma más cara: no es que el
fix estuviera en otro repo, estaba en la función de al lado, y aun así reescribí la mitad sin ella.
**Al copiar un mecanismo, copiá también sus guardas — y andá a leer el original, no tu recuerdo.**

**La regla operativa, que es de método:** cuando una medición sobre el sistema real da **idéntico**
a la de antes del cambio, eso NO es evidencia de nada todavía. Antes de concluir sobre el enfoque,
probar que el código nuevo **se ejecuta**: un fixture mínimo que imprima el estado intermedio, o un
canario que falle a propósito. Sin eso, el instrumento está midiendo mi hipótesis sobre el diseño
cuando el hecho es que la rama nueva no se toca. Hermano de
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] y de
[[el-instrumento-respondio-sobre-otro-sujeto]]: acá el sujeto era el correcto, pero la rama medida
no era la nueva.

**Y el contraste que cierra el aprendizaje:** una vez arreglado, el control decisivo fue correr el
gate sobre `origin/main` y sobre la rama. `main` daba **verde** y el fix lo puso **rojo** (dos
documentos sin clasificar). Ese rojo era el progreso: el verde de antes era verde **por ceguera**.
Ver [[el-instrumento-tambien-CONDENA-no-solo-absuelve]].

---

## Refuerzo 2026-10-08 — el control que corrí no era el que mi afirmación necesitaba

Afirmé que los 11 encabezados comidos por `0x01` en el backlog **no tenían fuente en git** —
«`480d2cc0` nació corrupto, no hay versión previa de la que copiarlos» — y sobre esa base
**reconstruí los 11 títulos** del cuerpo de cada ítem, marcándolos. **Era falso: los 11 están
exactos en `1c011840`,** y el diff de `480d2cc0` los **borra** (11 líneas `-### … BL-…`).

| corrí | qué mide de verdad | qué afirmé con eso |
|---|---|---|
| `git show 480d2cc0 -- F \| grep -c '^-.*'` → **0** | líneas borradas **que contienen el byte corrupto** | «no hay fuente» |
| lo que hacía falta: `grep -cE '^-#{2,4} .*BL-'` → **11** | líneas **de encabezado** borradas | — |

El `0` era **correcto**: ninguna línea borrada contenía `0x01`, porque las borradas estaban
**limpias**. Un encabezado que se pierde al ser *sustituido* por basura desaparece como
`-<línea buena>` / `+<basura>`: **buscar la basura entre los `-` es buscarla donde por definición
no está.** Mi control medía la ausencia del síntoma en el lado equivocado del diff, y como el
vacío coincidía con lo que ya creía, no lo leí como «no medí».

**El segundo error, encadenado y peor:** busqué la fuente **por número de línea**. Miré la línea
144 de `1c011840`, encontré otro ítem (`BL-D3`) y concluí «el contenido es otro» — cuando dos
comandos antes yo mismo había medido que el documento **pasó de 879 a 1140 líneas** y se
reorganizó. Con el contenedor corrido, la posición no identifica nada; el **`id`** sí. Mi propio
script llevaba escrito *«anclar por contenido, nunca por número de línea»* — y busqué la fuente
por número de línea.

**Lo que se rompe, y por qué ningún test lo caza:** los títulos que escribí **degradaban** el
documento en silencio. `BL-B4` real es `` `gate.sh` que corra en **macOS** (bash 3.2) `` y el mío
decía «Gate corriendo en bash 3.2» — borré «macOS», que es la razón entera del ítem. `BL-P1` real
es «Respuesta **del operador** a §6.1» y el mío se lo atribuía **a Martín**: reasigna un pendiente a
otra persona. Queda escrito, plausible y mal.

**La pregunta que lo caza** no es *«¿qué dice mi control?»* sino **«¿de qué afirmación es control
esto?»**. Un `0` responde la pregunta que el comando hace, no la que tengo en la cabeza; cuando son
distintas, el `0` confirma lo que yo ya quería creer. Dos controles concretos:

1. **Para «no existe»: buscá el objeto por su identificador, no por su posición.** Si el contenedor
   cambió de tamaño, la posición ya no lo nombra.
2. **Antes de *reconstruir* algo, control positivo de que la fuente no existe — con la forma del
   objeto buscado (`^### <id>`), no con la forma del daño (`0x01`).** Reconstruir es caro y
   silencioso: produce texto que después nadie puede distinguir del original.

Ver [[el-instrumento-respondio-sobre-otro-sujeto]] y
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]].

## Refuerzo 2026-10-08 (b) — SEIS veces el mismo patrón en una sesión: el comando midió el subconjunto, la frase afirmó el conjunto

El refuerzo de arriba ya decía «el instrumento contestó con precisión una pregunta más chica que la
que yo iba a responder». Lo escribí a media sesión **y reincidí cinco veces después**. Eso corre el
hallazgo de lugar: no falta la lección, falta un **control previo a publicar**. Las seis, medidas:

| # | El comando que corrí midió… | …y la frase que publiqué afirmó | El daño |
|---|---|---|---|
| 1 | si el byte corrupto aparecía entre las líneas `-` del diff — donde **no podía estar**, porque una sustitución borra la línea *limpia* | «los 11 encabezados **no tienen fuente en git**» | reconstruí 11 títulos que existían: uno perdió «macOS» (su razón entera), otro reasignó un pendiente del operador a otra persona |
| 2 | el script del gap, corrido local antes y después de mi edición: `rc=0`, 79 líneas idénticas | «mi cambio **no lo afecta**» | su sujeto es `origin/main`, ciego a mi working tree por diseño. Rompí el invariante y lo vi recién al mergear |
| 3 | dónde el `66` **decide** (la comparación del guard) | «el `66` vive en **un** lugar» | vivía en 6 líneas; mi `pedido_` citó 4 y omitió `:8` y `:144` — las encontró el par |
| 4 | los `BL-O` que yo había **tocado** (los 5 que venían de los 11 encabezados) | «son **5** los `BL-O` previamente invisibles» | eran **7**: `BL-O4` y `BL-O8` nunca pasaron por mis manos, así que no entraron en mi lista |
| 5 | las filas de `BL-Q3` que había **mirado** (2) | «está partido en **dos** filas» | son **3** (`:380`, `:412`, `:440`) ⇒ el instrumento que cruza por id deja 2 mitades «sin diff», no 1 |
| 6 | casillas de DoD que nombran auditoría, con el patrón **anclado** `^\s*-?\s*\[ \].*auditor` | «hay **1** trabajo mío escondido en los DoD» | son **3**: dos están *inline* en la misma línea del `- **DoD:**`, y una de ésas era justo el caso que había motivado la búsqueda |

**Lo que las seis tienen en común:** el comando estuvo *bien*. Lo que falló es que la frase era más
grande que él — un cuantificador («no hay», «un solo lugar», «son cinco», «dos filas», «uno») que el
comando nunca midió. **Un instrumento correcto no protege de una afirmación mal dimensionada**, y por
eso ninguna de las seis dio síntoma: cada salida era verdadera sobre su propio sujeto.

**El control es de orden, no de más herramienta:** escribir la afirmación **primero**, subrayarle el
sujeto y el cuantificador, y **derivar el comando de ahí**. Las seis veces lo hice al revés — corrí el
comando que tenía a mano y le puse encima la frase que quería. La pregunta que lo caza en un renglón:

> **¿el comando que corrí tiene el mismo sujeto y la misma amplitud que la frase que estoy a punto de escribir?**

Si la frase dice *no hay*, el comando tuvo que mirar **todo** el universo; si dice *un solo lugar*,
tuvo que contar **todas** las apariciones, no sólo las que deciden; si dice *son cinco*, el conteo
tuvo que salir del universo, no de lo que yo toqué.

**Y el control positivo más barato que existe, que la instancia 6 deja como receta:** antes de creerle
un conteo a un patrón, **grepeá el caso que ya sabés que existe**. Yo tenía uno en la mano (`[ ]
auditoría re-mide`, el DoD de `BL-P2`) y el patrón anclado lo había perdido; un `grep` de una línea
contra ese caso conocido convirtió «1» en «3» antes de publicarlo. Un patrón que no encuentra el
ejemplo que motivó la búsqueda está mal escrito, y es la forma más rápida de saberlo.

**Corolario, que pagué tres veces el mismo día:** cuando el sujeto de la frase es *mi propio trabajo*
(«lo que me falta pushear», «las filas que abrí», «lo que tengo asignado»), la tentación es citarlo
**de memoria**, porque se siente sabido. Las tres veces estaba vencido: un commit que creía retenido
ya estaba en el remoto, otro ya había viajado dentro de un PR ajeno, y tenía dos trabajos asignados
adentro de DoD ajenos que mi cola —alimentada sólo por el buzón— no podía ver. Mi cola merece el mismo
`git log --grep` + `git ls-remote` + grep de asignaciones que le exijo a cualquier documento ajeno —
ver [[el-instrumento-respondio-sobre-otro-sujeto]].
