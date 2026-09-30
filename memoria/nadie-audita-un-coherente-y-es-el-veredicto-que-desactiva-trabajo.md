---
name: nadie-audita-un-coherente-y-es-el-veredicto-que-desactiva-trabajo
description: Se revisa lo que acusa, no lo que absuelve. Un falso DESVÍO cuesta una recaptura y alguien lo encuentra al ir a arreglarlo; un falso COHERENTE cierra un frente roto y no deja rastro. Y una salvedad de captura es de la corrida, no de la fila
metadata:
  type: feedback
---

**El caso (2026-09-29).** El lote A traía 9 COHERENTE y 7 DESVÍO. Cuando apareció que 11 filas se
habían medido a 1280×900 contra un prototipo que **no reflowea** (a ≥520px dibuja un teléfono de
390×844 con marco — `prototipo/index.html:63`), FE1 cruzó **los 7 DESVÍO** contra el ancho y concluyó
que ninguno se invalidaba. **Nadie cruzó los 9 COHERENTE.** Yo tampoco iba a hacerlo: fui a
verificarlos sólo porque el contrato me obliga a exigir más evidencia al veredicto que **desactiva**
trabajo.

Lo que encontré fue lo contrario de lo esperado: **los COHERENTE @1280 sobrevivieron** (uno se había
re-declarado por lectura de código; el otro afirmaba sobre la zona visible de la captura), y el que
cayó fue **un DESVÍO** — `bi`, falso positivo entero: el Rail lateral expandido tapaba la columna
izquierda de una grilla de 2 columnas, y las 2 cards declaradas ausentes estaban debajo. Verificado
por código: `InteligenciaScreen.tsx:224-227` renderiza las 4.

## Las dos mitades de la lección

**1. El sesgo de revisión tiene dirección, y la asimetría de costos va al revés.** Se audita lo que
acusa. Pero un **falso DESVÍO** cuesta una recaptura y **se descubre solo**: alguien va a arreglarlo y
encuentra que ya estaba bien. Un **falso COHERENTE** cierra un frente que estaba roto y **no deja
rastro** — nadie vuelve a mirar lo que ya pasó. El veredicto que desactiva trabajo es el que menos
ojos recibe y el que menos puede permitírselo.

**2. Una salvedad de captura es de la CORRIDA, no de la fila.** El autor escribió «la captura quedó
parcialmente tapada por el Rail… si hace falta certeza total, recapturar» **en la fila `bi`** y no en
`bi-refresh` — misma pantalla, mismo ancho, mismo método, misma corrida. Miré las dos imágenes: **el
Rail tapa idénticamente la misma columna en ambas.** Una salvedad que se declara donde el autor
sospecha depende de que sospeche en la fila correcta. El fix: se declara **una vez por corrida** y se
hereda a todas las filas que citan PNG de esa corrida; el que quiera exceptuar una, lo escribe. Al
revés no converge.

## El criterio que salió, para no verificar seis motivos a mano la próxima

Una fila medida contra una referencia del régimen equivocado **sobrevive si su motivo es sobre
CONTENIDO** (taxonomía, inventario de filas, causa de backend, composición de controles) y **cae si es
sobre DISPOSICIÓN o VISIBILIDAD** («cuántas cards se ven» es una afirmación sobre el render). El
contenido no depende del ancho de la referencia; cuántos elementos se ven, sí.

## El detalle que lo hace peor

La salvedad **ya estaba escrita** por su propio autor, con la acción correcta indicada. Nadie la tomó,
y la fila viajó igual al triage como trabajo de producto. Un `[UNVERIFIED]` escrito adentro de una
fila que por lo demás se lee como cerrada **no frena a nadie**: no tiene gancho, no escala, no aparece
en ningún conteo. Es el mismo agujero que [[un-disparador-cumplido-no-avisa-a-nadie]].

Emparentado: [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] (el falso rojo parece prudencia; acá
es el falso verde el que parece cierre) · [[dos-causas-suficientes-el-test-no-atribuye]] ·
[[el-dod-que-escribi-estaba-mal-y-la-evidencia-lo-corrigio]] ·
[[un-control-calibrado-a-tu-propio-valor-no-ve-al-productor-ajeno]] ·
[[el-canario-el-control-positivo-de-lo-que-falla-callado]].
