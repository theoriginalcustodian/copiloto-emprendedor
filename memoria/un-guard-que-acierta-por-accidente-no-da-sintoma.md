---
name: un-guard-que-acierta-por-accidente-no-da-sintoma
description: Un comportamiento correcto por una razón que nadie diseñó se ve idéntico a uno correcto por diseño, y se rompe cuando tocás lo de al lado — la pregunta es por qué este caso sale bien, no si sale bien.
metadata:
  type: feedback
---

Arreglé dos cegueras del parser de veredictos y **las dos tenían un caso que salía bien por la razón
equivocada**. Ninguno daba síntoma, y los dos se rompieron al tocar lo de al lado.

**Caso 1 — el guard acertaba con el resultado correcto.** Un documento con 22 filas `COHERENTE` era
**invisible** para el parser porque no usaba backticks. Parecía puro daño hasta ver el detalle: ese
documento está **retirado**, así que no contarlo era el resultado *correcto*. El único caso donde se
podía observar la ceguera era el único donde la ceguera acertaba. Una medición **vigente** escrita
igual habría desaparecido sin que nadie lo notara, porque el caso visible salía bien.

**Caso 2 — el guard protegía algo que no era su trabajo.** `SUJ_CELDA` exigía backticks para
reconocer el sujeto de una fila. Efecto colateral no diseñado: la **cabecera** de la tabla
(`| sujeto | veredicto |`) nunca matcheaba, así que nunca se contaba como medición. Al relajar el
backtick —el fix correcto— apareció el bug que llevaba ahí todo el tiempo: `sujeto` empezó a entrar
como sujeto. Hubo que saltear cabeceras **explícitamente**, reusando `es_separador`, que ya
documentaba que la fila anterior a un separador ES la cabecera.

## La pregunta que los caza

**No «¿este caso sale bien?» sino «¿POR QUÉ sale bien este caso?»** — y si la respuesta no es el
mecanismo que uno diseñó, hay un bug latente esperando el próximo cambio de al lado.

Es la razón por la que un control positivo no alcanza acá: el positivo pregunta *¿detecta cuando el
caso está presente?* y estos dos **detectaban** — daban el resultado esperado. Lo que estaba mal era
la **causa**, y ningún verde la inspecciona. Es el hermano de
[[un-control-positivo-prueba-que-el-instrumento-ve-no-que-mira-donde-hay-que-mirar]]: ahí el defecto
era el sujeto o el universo; acá es el **mecanismo**.

⚠️ **Y el corolario al arreglar de raíz:** quitar un guard accidental **destapa** lo que tapaba. El fix
de los backticks no era «relajar la regex» — era relajarla *y* codificar a mano lo que la regex hacía
gratis. Si sólo se hace la primera mitad, el cambio parece correcto, pasa los tests que existían, y
mete mediciones fantasma. Antes de relajar un patrón conviene escribir la lista de lo que hoy
excluye **sin quererlo**.

💡 Un caso del corpus que sale bien por accidente es, además, un **fixture diferencial gratis**: no se
puede fabricar, porque nadie escribiría a propósito dos documentos idénticos salvo en el ancho de la
tabla. Vale clavarlo en un test antes de arreglar nada.
