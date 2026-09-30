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

```
### `<basename del sucesor>`
SUPERSEDE: `<basename del superado>`
ALCANCE: total | parcial
IDS: <ids afectados, si ALCANCE es parcial>
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

## 3 · Las relaciones, con la cita de su autor

### `2026-09-22_dato_frontend1-a-planificacion_matriz-web-re-medida.md`
```
SUPERSEDE: 2026-09-22_dato_frontend1-a-planificacion_BL-Q3-web-barrido-35-pantallas.md
ALCANCE: total
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
DECLARANTE: frontend2 · §«Alcance» — ⚠️ SIN PATH: cita por hora y por tarea
```
> «las 7 pantallas que **mi barrido BL-Q3 (02:11)** marcó ✅/COHERENTE, re-medidas contra el prototipo
> BL-P2 (17-18/09)»

**La única entrada donde el path lo puse yo, y lo marco.** FE2 identifica el superado por hora (`02:11`) y
por nombre de tarea, no por archivo. La resolución es **inequívoca por unicidad** —hay un solo barrido
BL-Q3 de frontend2 en todo el buzón— pero es *mi* inferencia, no su declaración, y el `IDS` queda
`[POR CONFIRMAR]` a propósito: **no voy a enumerar 7 pantallas que el autor no enumeró.** De `CONFLIC2` ya
está verificado que `cuenta` y `detalle` están entre ellas.

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

## 6 · Los cuatro defectos que tuvo el instrumento mientras se construía

Los anoto porque **dos habrían entrado a este registro como hallazgos sobre el corpus**, que es la
patología que ya tengo medida y vuelve a aparecer:

| defecto | qué mostraba | por qué era creíble |
|---|---|---|
| appendear la relación **antes** de terminar de leer el bloque | las 4 relaciones con `alcance=?` | «el registro no declara alcance» es un hallazgo plausible sobre el corpus, y el corpus sí lo declaraba |
| `print` de una cita con `·`/`«»` en consola **cp1252** | crash a mitad del reporte, con datos válidos ya impresos | el exit ≠ 0 parecía del sujeto; estaba en el terminal |
| **el pipe por `tail` se comió el exit code** | `EXIT=0` con un traceback en pantalla | un gate que leyera ese código habría pasado un crash como verde |
| `relative_to` con el registro del canario (fuera del repo) | exit 1 en los 4 canarios | **indistinguible de «los controles no se activan»** — el andamio rompía antes de llegar al guard |

El tercero es reincidencia declarada: `memoria/el-pipe-se-come-el-exit-code.md`. Por eso todas las
corridas de arriba se hicieron **sin pipe y a archivo completo**.

Y el cuarto tiene una cara propia que vale registrar: **un canario que falla por su propio andamio se
lee igual que un guard que no funciona.** El control del control —«¿el mutante quedó distinto del
original?»— es lo que separa las dos cosas, y está horneado en el test.

**Y el paso 3 tiene una precondición que el paso 2 recién hizo medible:** `ALCANCE: parcial` significa que
la exclusión es **por fila, no por documento**. Un excluidor que retire documentos enteros retira filas
vigentes — 3 de las 4 relaciones son parciales.

---

**delegación:** 0 sub-agentes · ~14 lecturas inline · scripts: 3 corridas (versionado del buzón, cobertura
de la convención con su control positivo, reportador con sus 4 controles).

🤖 auditoría
