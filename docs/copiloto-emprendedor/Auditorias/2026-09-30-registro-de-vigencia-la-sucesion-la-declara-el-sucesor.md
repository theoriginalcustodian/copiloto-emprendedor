# Registro de vigencia de las mediciones — **la sucesión la declara el sucesor**

**2026-09-30** · **Emite:** auditoría · **Fila del PLAN:** `VIGENCIA` (dueño: auditoría)
**SHA base:** `origin/main` @ `4f5692ef`
**Paso 1 de 3.** Este documento **marca el retiro**. No cambia ningún contraste — ese es el paso 3, y
el orden es del propio eje: *marcar el retiro primero, contrastar después.*

---

## 0 · El hueco, y por qué el parser tenía razón en no cerrarlo solo

`contar-veredictos.py:111-116` clasifica el barrido de 35 pantallas como **medición vigente** y deja
escrito el motivo:

> «Auditoría lo da por RETIRADO (C3-25). Buscado en TODO el buzón: el retiro existe **únicamente en su
> `cierre_` del 29/09** — el documento no lo dice, ningún contrato lo dice […] excluirlo sería aplicar un
> retiro que sólo vive en la memoria de una sesión.»

**Esa negativa era correcta y la sostengo.** Pero la búsqueda miró dos lugares —el documento retirado y
los contratos— y el retiro no está en ninguno de los dos **por una razón estructural**:

> **Un documento no puede saber que será superado.** Cuando se emitió, era la medición vigente. La
> invalidación nace después, y la escribe **el que la produce: el sucesor.**

Y ahí estaba, desde el 22/09, escrita por **FE1** —el mismo autor del barrido— en el encabezado de su
propia re-medición:

> «La auditoría independiente muestreó 8 de las 22 filas que **mi barrido anterior**
> (`2026-09-22_dato_frontend1-a-planificacion_BL-Q3-web-barrido-35-pantallas.md`) había marcado
> `COHERENTE` […] **Por contrato, eso invalida como evidencia las 22 filas completas** — no sólo las 4
> muestreadas.»

**El retiro no es memoria de auditoría: es una afirmación del autor, con el path del archivo entre
backticks, del mismo día.** Lo que faltaba no era la declaración — era **el lugar donde un instrumento
pueda leerla**.

### Por qué este registro está en `docs/` y no en el buzón

La fila del PLAN pide «un tercer estado `RETIRADO_POR: <doc>` **en el formato**». Medí las dos cosas que
eso implica y **las dos salen en contra**:

| medición | resultado | consecuencia |
|---|---|---|
| ¿`coordinacion/` está versionado? | **0 archivos** en `origin/main` (`git ls-tree -r origin/main \| grep -c '^coordinacion/'`) | una marca escrita dentro del buzón **no existe en un clon limpio**. El propio parser ya contempla ese caso: «para un corpus ausente (CI, clon limpio, buzón movido) el glob da 0 candidatos» |
| ¿se puede escribir `RETIRADO_POR:` en el documento retirado? | exige **volver a editar un mensaje ya emitido por otra sesión** | lo prohíbe la regla del buzón (nadie edita lo de otra sesión), y nadie lo hace: por eso la cobertura de esa forma es **0 y va a seguir siendo 0** |

Así que el registro es **versionado**, vive en la carpeta de auditoría, y declara la relación **por path**.
El campo se llama `SUPERSEDE:` y lo lleva **el sucesor**, que es quien puede saberlo.

## 1 · Cobertura medida antes de escribir el formato

Regla propia que aplica acá (`memoria/medir-la-cobertura-de-una-convencion-antes-de-hacerla-obligatoria.md`):
**antes de que un instrumento lea una convención, medir qué cobertura tiene.** Sobre los **6** documentos
de medición del 22/09:

```
COBERTURA: 2 de 6 documentos declaran sucesión, y NINGUNO con campo estructurado
  palabra sin cita   | frontend1 ... BL-Q3-web-barrido-35-pantallas      (es el RETIRADO, correcto)
  SUCESION EN PROSA  | frontend1 ... matriz-web-re-medida            -> cita el path del barrido
  SUCESION EN PROSA  | frontend1 ... matriz-web-re-medida-v2         -> cita el path de re-medida
  nada               | frontend1 ... matriz-web-re-medida-v2-filas-3-a-6 (complemento, no sucesor)
  palabra sin cita   | frontend2 ... matriz-web-re-medida            (declara, pero SIN path)
  nada               | frontend2 ... BL-Q3-web-barrido-pwa-vs-prototipo  (es el superado, correcto)
```

**Cobertura 2 de 6, y el desglose es lo que informa el diseño** — no el porcentaje:

- Los **3 documentos que no declaran nada son los correctos**: dos son el extremo *retirado* de una
  cadena y el tercero es un complemento. La convención no les aplica. **La cobertura útil es 2 de 3
  sucesores, no 2 de 6.**
- El que falta es de **frontend2**, y no es desidia: declara la sucesión **por hora y por tarea** —«las 7
  pantallas que **mi barrido BL-Q3 (02:11)** marcó ✅/COHERENTE»—, nunca por path. **Existe para un
  humano y es irresoluble para un parser.** Tercer régimen, distinto de «no declara»: *declara por
  atributo ambiguo*.

**Con esta cobertura el instrumento del paso 2 REPORTA y no actúa.** Un archivador o un excluidor que
arrancara hoy movería/excluiría un puñado de filas, y su «no hizo nada» sería indistinguible de un glob
roto — el filo que ya cacé en `retirados_obsoletos=0`.

## 2 · El formato

Un bloque por **sucesor**, con el ancla `CLAVE: valor` que el repo ya usa (`RESPONDE:`, `CIERRA:`,
`ROLES:`, `DISPARADOR:`):

### `<basename del declarante>`   ← el encabezado va FUERA del fence
```
SUPERSEDE: `<basename del superado>`     ← o COMPLEMENTA: · o CORRIGE_FILAS:
ALCANCE: total | parcial
IDS: <ids afectados, si ALCANCE es parcial>
FORMA: in-situ | con-sucesor            ← sólo en CORRIGE_FILAS
ANCLA: <literal corto que el reportador grepea en el documento del declarante>
DECLARANTE: <rol que lo escribió> · <dónde>
CITA: > <texto literal del autor>
```

Tres reglas, cada una de un error medido:

1. **Se resuelve por el path citado, nunca por la etiqueta en prosa.** `matriz-web-re-medida-v2` llama
   «el barrido original» a `matriz-web-re-medida.md`, **que no es el barrido original** — el path que cita
   es correcto y el nombre con que lo llama, no. Un parser que leyera la etiqueta construiría una cadena
   falsa ([[el-nombre-es-una-hipotesis-sobre-el-contenido]]).
2. **`ALCANCE: parcial` es el caso normal, no la excepción.** De las 4 relaciones de abajo, **3 son
   parciales**. Un estado binario vigente/retirado habría retirado documentos enteros que siguen siendo la
   única evidencia de filas que nadie volvió a medir.
3. **Una relación que no es sucesión se declara igual**, como `COMPLEMENTA`. Si no se nombra, el próximo
   lector la lee como conflicto: dos documentos con los mismos 7 ids y los mismos veredictos.
4. **Los campos se leen SÓLO dentro del fence, y el fence CIERRA el bloque.** Las dos mitades de esta
   regla salen de dos bugs medidos el mismo día, y las dos me las hice yo: (a) sin cierre, el último
   bloque quedaba abierto hasta EOF y absorbía las líneas `ALCANCE:` de **la salida de este script que
   este documento transcribe** en §5 y §6 — el `alcance` real se perdía y el control CAMPOS pasaba igual,
   satisfecho con basura; (b) la plantilla de arriba mostraba el `###` *adentro* del fence, así escribí el
   quinto bloque, y el parser **no lo leyó**: la relación desapareció del reporte sin un solo error.
   Una plantilla que enseña una forma que el parser rechaza es peor que no tenerla.
5. **`ANCLA:` existe porque una cita en prosa no prueba nada.** Las citas de §3 las transcribí yo: una
   copiada de memoria, o tomada del documento equivocado, se lee exactamente igual de bien que una
   verdadera. `ANCLA` es un literal corto que el reportador **grepea en el documento del declarante**, y
   sin él la relación no pasa (`exit 8`). Las 5 anclas de este registro dan `n=1` u `n=8` contra el
   archivo real, con el control negativo en rojo. Es el control positivo **por relación**, anclado afuera:
   el texto lo escribió su autor, no este documento.

## 3 · Las relaciones, con la cita de su autor

### `2026-09-22_dato_frontend1-a-planificacion_matriz-web-re-medida.md`
```
SUPERSEDE: 2026-09-22_dato_frontend1-a-planificacion_BL-Q3-web-barrido-35-pantallas.md
ALCANCE: total
ANCLA: invalida como evidencia las 22 filas
DECLARANTE: frontend1 (autor de AMBOS) · §«Por qué existe este doc»
```
> «La auditoría independiente muestreó 8 de las 22 filas que mi barrido anterior (`…barrido-35-pantallas.md`)
> había marcado `COHERENTE` y encontró 4 con diferencias reales no declaradas (`factura`, `bi`, `soporte`,
> `apar`). **Por contrato, eso invalida como evidencia las 22 filas completas** — no sólo las 4 muestreadas.»

**`ALCANCE: total` y es el único de los cuatro.** Y el alcance no lo elegí yo: la regla de contrato
—muestrear 8, fallar 4, invalidar las 22— la aplicó el autor. Las **36 filas** del documento quedan sin
valor como evidencia.

### `2026-09-22_dato_frontend1-a-planificacion_matriz-web-re-medida-v2.md`
```
SUPERSEDE: 2026-09-22_dato_frontend1-a-planificacion_matriz-web-re-medida.md
ALCANCE: parcial
IDS: chat feedback card card-cobro card-presu card-cliente pres-hitl pres-ciclo preg
ANCLA: consolida las 9 filas
DECLARANTE: frontend1 · §«Alcance»
```
> «consolida las 9 filas que el barrido original (`…matriz-web-re-medida.md`) dejó "sin veredicto" — 2
> resueltas por implementación (chat, feedback), 7 por re-medición contra el camino correcto.»

**Sólo esas 9.** El resto de `matriz-web-re-medida` sigue vigente: v2 no lo reemplaza, lo completa. Es la
relación cuya lectura binaria produjo el error que ya corregí en `CONFLICT13` — los `REQUIRES_TRIAGE`
citados como «veredicto vigente» eran el estado **intermedio** que v2 vino a cerrar.

### `2026-09-22_dato_frontend1-a-planificacion_matriz-web-re-medida-v2-filas-3-a-6.md`
```
COMPLEMENTA: 2026-09-22_dato_frontend1-a-planificacion_matriz-web-re-medida-v2.md
ALCANCE: parcial
IDS: card card-cobro card-presu card-cliente pres-hitl pres-ciclo preg
ANCLA: pres-ciclo
DECLARANTE: auditoría (derivado) · verificado contra los dos documentos
```

**No es sucesión y por eso se declara.** Son los **mismos 7 ids con los mismos veredictos** que las filas
3-6 de v2, escritos en una tabla de 2 columnas en vez de 3 — el detalle de 7 de las 9. Verificado por
enumeración en los dos documentos: v2 lista «7 por re-medición (card family, pres-hitl, pres-ciclo, preg)»
y éste lista exactamente `card`, `card-cobro`, `card-presu`, `card-cliente`, `pres-hitl`, `pres-ciclo`,
`preg`. Ninguno supera al otro; **los dos están vigentes**.

### `2026-09-22_dato_frontend2-a-planificacion_matriz-web-re-medida.md`
```
SUPERSEDE: 2026-09-22_dato_frontend2-a-planificacion_BL-Q3-web-barrido-pwa-vs-prototipo.md
ALCANCE: parcial
IDS: [POR CONFIRMAR CON FE2 — son «las 7 que marcó OK», y el documento no las enumera]
ANCLA: BL-Q3 (02:11)
DECLARANTE: frontend2 · §«Alcance» — ⚠️ SIN PATH: cita por hora y por tarea
```
> «las 7 pantallas que **mi barrido BL-Q3 (02:11)** marcó ✅/COHERENTE, re-medidas contra el prototipo
> BL-P2 (17-18/09)»

**La única entrada donde el path lo puse yo, y lo marco.** FE2 identifica el superado por hora (`02:11`) y
por nombre de tarea, no por archivo. La resolución es **inequívoca por unicidad** —hay un solo barrido
BL-Q3 de frontend2 en todo el buzón— pero es *mi* inferencia, no su declaración, y el `IDS` queda
`[POR CONFIRMAR]` a propósito: **no voy a enumerar 7 pantallas que el autor no enumeró.** De `CONFLIC2` ya
está verificado que `cuenta` y `detalle` están entre ellas.

## 3.bis · El tercer régimen: la invalidación **por fila** ya tenía su documento, y su único caso se corrigió **adentro**

Los cuatro bloques de arriba relacionan **documentos**. La invalidación a nivel **fila** es un régimen
distinto, y no había que inventarlo: **ya tiene su documento canónico, su regla y su cruce completo**, y
`contar-veredictos.py:196` lo clasifica (como cruce, no como medición — correctamente).

> **`coordinacion/cerrado/2026-09-28/2026-09-28_dato_frontend1-a-planificacion_cierre-A-paso1-lista-de-filas-invalidadas.md`**
> Regla, literal del autor: «**invalidada si el id tiene >1 camino Y la fila no declara cuál usó** (no un
> juicio de calidad de medición, mecánico)». Cruza los **16** ids `MULTI-PATH-UI-DISTINTA` del §3 del contrato.

### La tabla mezcla TRES régimenes, y contar la palabra «invalidado» los suma como si fueran uno

| régimen | filas | qué significa |
|---|---|---|
| **A · invalidada por la regla mecánica del cruce** | **1** — `chat` | el único caso real, y es de FE1 |
| **B · ya invalidado antes, por §6 del contrato** | 4 — `card-presu`, `card`, `card-cobro`/`card-ingreso`, `factura` | otro frente, anterior a este cruce |
| **C · fuera del cruce** | 7 | **ausencia de medición**, no invalidación |
| D · camino declarado, OK | 8 | |

**Mi primer conteo dio 6, y el título del documento es «el número NO da 6».** Conté la palabra sin ver su
**rol**: 4 de esos 6 dicen «ya invalidado desde **§6 del contrato**». Lo peor no es el error, es su forma:
**la cifra falsa coincidió exactamente con la que el documento existe para refutar**, así que se leía como
confirmación en vez de como desvío ([[contar-un-simbolo-no-dice-en-que-rol-aparece]]). El control que lo
cazó está anclado afuera —el autor afirma «**1 fila invalidada, no 6**»— y la re-extracción por rol da 1.

### Y la única fila invalidada **ya no lo está**: el autor la corrigió dentro del mismo archivo

### `2026-09-28_cierre_frontend1-a-planificacion_BL-Q3-v2-lote-A-14-filas-mas-2-pendiente-device.md`
```
CORRIGE_FILAS: 2026-09-28_dato_frontend1-a-planificacion_cierre-A-paso1-lista-de-filas-invalidadas.md
ALCANCE: total
IDS: chat
FORMA: in-situ
ANCLA: Actualizado Cierre A Paso 2
DECLARANTE: frontend1 (autor de la lista Y de la fila) · L330
CITA: > «Actualizado Cierre A Paso 2 (2026-09-28): `chat` partida en 2 caminos tras la invalidación…»
```

Medido en el archivo: la fila es hoy `PARTIDO: camino-directo=COHERENTE · camino-buzón-de-pendientes=COHERENTE`
(L224), el camino B está documentado con sus 3 orígenes reales (L240), y **la frase que FE1 se reprochó
—«Múltiples puntos de entrada al chat comparten esta misma UI»— aparece 0 veces**. La corrección está
aplicada, no prometida.

**🔴 Y esto corrige lo que yo mismo escribí en §5: «excluir POR FILA» no alcanza.** No hay sucesor ni
cambio de path — para los dos lados del par, el documento y el id son **los mismos**, y lo que cambió vive
adentro ([[un-control-a-nivel-archivo-no-ve-la-divergencia-adentro]]). Un excluidor del paso 3 que tome la
lista del 28/09 como fuente de verdad **retiraría dos filas vigentes y corregidas**, que es exactamente la
falla que este registro vino a evitar, un nivel más abajo. El paso 3 excluye **por fila y por versión**, y
su fuente no es la lista: es el documento medido.

**Por eso `CORRIGE_FILAS` no cuenta como retiro.** La lista del 28/09 **sigue vigente** —su regla es la
única definición mecánica de «fila invalidada» que hay en el corpus—; lo que caducó es **usarla como
fuente de exclusión**. Un registro que la marcara «retirada» perdería la regla.

## 4 · Lo que este documento NO hace

- **No excluye ni una fila de ningún contraste.** El paso 3 es otro, y adelantarlo es exactamente lo que
  el eje prohíbe: con el contraste arreglado antes del retiro, las 8 filas se leen «COHERENTE vs DESVÍO»,
  la resolución cómoda las cierra juntas y **se fabrica el falso verde que este eje vino a cazar**.
- **No re-mide ninguna pantalla.** Cada relación sale de la cita de su autor; la única derivada
  (`COMPLEMENTA`) se verificó por enumeración de ids, no por captura.
- **No declara retirado nada que su autor no haya declarado.** Los 3 documentos sin relación se quedan
  sin relación.
- **No toca `contar-veredictos.py`.** Planificación lo modificó hoy (`fce5d17f`); el reportador del paso 2
  es un archivo nuevo que **importa** su `MEDICIONES_DECLARADAS` por AST en vez de copiarla — una segunda
  copia del universo divergiría, que es el defecto de los clientes gemelos.

## 5 · El paso 3, con su dueño y su control — y el lazo que lo tenía trabado

**Por qué esta fila llevaba días `pendiente`: la asignación era circular.** Mi propio `cierre_` del 29/09
puso el paso 1 en «planificación» (fila 1 de su tabla), el comentario del parser dice «dueño
planificación», y `PLAN.md:247` dice «Dueño: **auditoría** (es su parser)». Cada lado apuntaba al otro.
**Lo ejecuté yo, que es lo que dice el tablero vigente**, y el paso 3 queda con dueño explícito:

| paso | qué | dueño | control positivo obligatorio |
|---|---|---|---|
| 1 ✅ | este registro | auditoría | los 4 bloques citan a su autor; el reportador los reproduce |
| 2 ✅ | `scripts/evidencia/vigencia-de-mediciones.py` — **reporta**, no actúa | auditoría | el barrido de 35 pantallas **tiene que** salir RETIRADO por `matriz-web-re-medida`; si no, el instrumento está roto |
| 3 ⏳ | el contraste **excluye** las filas retiradas en vez de exhibirlas como conflicto | **planificación** (`contar-veredictos.py`) | **una fila retirada no puede aparecer como conflicto nuevo** — y el negativo que falta: con el registro vacío, el contraste tiene que volver a exhibir los conflictos de hoy |

**La corrida del paso 2, sobre `origin/main` @ `4f5692ef`:**

```
universo : 17 documentos en MEDICIONES_DECLARADAS (leidos por AST del parser)
buzon    : 2034 archivos .md
RELACIONES DECLARADAS: 4       (3 SUPERSEDE + 1 COMPLEMENTA)
COBERTURA: 6 de 17 documentos del universo aparecen en alguna relacion de vigencia
RETIRADOS (total o parcial): 3 de 17
ALCANCE: 3 de 4 relaciones son PARCIALES -- el paso 3 tiene que excluir POR FILA
CONTROLES: POSITIVO ok · NEGATIVO ok · DESCUBRIMIENTO ok · CADENA ok · CAMPOS ok
VERDICTO: REPORTE COMPLETO -- 5 de 5 controles en verde. Nada fue excluido ni movido.   exit 0
```

**Y el canario, versionado en `scripts/evidencia/test-vigencia-canario.sh` — 5 de 5:**

```
ROJO-OK POSITIVO -> exit=3   (le saco del registro el retiro que FE1 declaro)
ROJO-OK CADENA   -> exit=5   (una relacion apunta a un documento fantasma)
ROJO-OK CAMPOS   -> exit=6   (una relacion pierde su ALCANCE)
ROJO-OK NEGATIVO -> exit=4   (entra la relacion inventada)
VERDE-OK registro real -> exit=0
```

El hermano verde no es decorativo: **sin él, un script que devolviera siempre un rojo pasaría los 4
canarios.** Y el generador de mutantes corta con exit 7 si un patrón dejó de matchear — un canario
idéntico al original sale verde y se lee como «el control funciona».

## 6 · Los seis defectos que tuvo el instrumento mientras se construía

Los anoto porque **dos habrían entrado a este registro como hallazgos sobre el corpus**, que es la
patología que ya tengo medida y vuelve a aparecer:

| defecto | qué mostraba | por qué era creíble |
|---|---|---|
| appendear la relación **antes** de terminar de leer el bloque | las 4 relaciones con `alcance=?` | «el registro no declara alcance» es un hallazgo plausible sobre el corpus, y el corpus sí lo declaraba |
| `print` de una cita con `·`/`«»` en consola **cp1252** | crash a mitad del reporte, con datos válidos ya impresos | el exit ≠ 0 parecía del sujeto; estaba en el terminal |
| **el pipe por `tail` se comió el exit code** | `EXIT=0` con un traceback en pantalla | un gate que leyera ese código habría pasado un crash como verde |
| `relative_to` con el registro del canario (fuera del repo) | exit 1 en los 4 canarios | **indistinguible de «los controles no se activan»** — el andamio rompía antes de llegar al guard |
| **el bloque no cerraba**: el último quedaba abierto hasta EOF | absorbía las líneas `ALCANCE:` de **la salida de este script que este documento transcribe** en §5-§6 | el `alcance` real se perdía y el control CAMPOS **pasaba igual, satisfecho con basura**. Con 4 bloques no daba síntoma: a cada uno lo seguía otro `###` |
| **la plantilla de §2 mostraba el `###` dentro del fence** | la 5ª relación **desapareció del reporte sin un solo error** | escribí el bloque nuevo copiando mi propia plantilla. Una plantilla que enseña una forma que el parser rechaza es peor que no tenerla |

El tercero es reincidencia declarada: `memoria/el-pipe-se-come-el-exit-code.md`. Por eso todas las
corridas de arriba se hicieron **sin pipe y a archivo completo**.

Y el cuarto tiene una cara propia que vale registrar: **un canario que falla por su propio andamio se
lee igual que un guard que no funciona.** El control del control —«¿el mutante quedó distinto del
original?»— es lo que separa las dos cosas, y está horneado en el test.

**Los dos últimos son el par que más muerde, y por lados opuestos:** uno hace que el instrumento acepte
basura como declaración, el otro que **pierda una declaración verdadera en silencio**. El primero lo cazó
la salida (un `alcance=` con el texto de un reporte adentro); el segundo no lo habría cazado nadie —el
reporte salía verde con una relación menos—, y por eso ahora tiene control propio: **`exit 9`, encabezado
mudo**. Todo `### <doc>.md` que no produzca una relación es rojo.

**El canario pasó de 5 a 9 casos**, y uno de los nuevos no se inventó: el mutante `c4` empezó a dar
`exit 9` en vez de `4` en cuanto el fence se volvió obligatorio. **El canario delató que mi propio fix le
había quitado el sentido a un caso suyo** — que es exactamente para lo que está versionado.

**Y el paso 3 tiene una precondición que el paso 2 recién hizo medible:** `ALCANCE: parcial` significa que
la exclusión es **por fila, no por documento**. Un excluidor que retire documentos enteros retira filas
vigentes — 3 de las 5 relaciones son parciales. **Y §3.bis lo corrige un nivel más abajo:** con una fila
corregida *in-situ*, ni «por fila» alcanza — el paso 3 excluye **por fila y por versión**.

---

**delegación:** 0 sub-agentes · ~14 lecturas inline · scripts: 3 corridas (versionado del buzón, cobertura
de la convención con su control positivo, reportador con sus 4 controles).

🤖 auditoría
