---
name: un-gate-cuyo-predicado-es-el-sintoma-de-un-bug-abierto
description: Un gate nuevo acusaba de estar mal clasificado a todo documento que aporta cero veredictos legibles. Ese cero era el síntoma exacto de un bug del parser, así que el gate iba a firmar como «no mide» a tres documentos que sí miden
metadata:
  type: feedback
---

**El caso (2026-09-29).** Se agregó un gate («MEDICIÓN QUE NO MIDE», exit 9) con este predicado: *un
documento declarado medición que aporta **cero** ids con veredicto del vocabulario cerrado está
declarado para medir y no mide nada legible.* Aritmética del rol, sin umbral calibrado — un buen
diseño en abstracto, y explícitamente pensado para no envejecer con el corpus.

**Pero el cero de ese predicado es, palabra por palabra, el síntoma de un bug abierto del parser.**
Medido en el mismo corpus: **15 filas de 199, en 5 de 16 documentos, perdían un veredicto del
vocabulario cerrado** por dos defectos de lectura. Tres de esos documentos aportaban **0 cerrados** y
**sí medían**: uno con 5 ids y evidencia por fila. Corrido antes del fix, el gate los firma como
«declarados para medir y no miden», y esa firma queda escrita en la lista de clasificación **como
motivo auditable**. El bug se convierte en veredicto de rol, y el veredicto sobrevive al fix.

## La regla

**Antes de embarcar un gate, preguntá qué OTRA causa produce su predicado.** Si alguna es un defecto
conocido del propio instrumento, el gate no está midiendo lo que dice: está midiendo el defecto. Dos
salidas, y las dos sirven:

- **Correrlo después del fix** — el orden entre arreglar y clasificar no es cosmético.
- **Partir el predicado** para que cada causa tenga su código y su mensaje: «0 cerrados **y** ningún
  token del vocabulario en ninguna celda» es rol; «0 cerrados **pero** hay tokens del vocabulario en el
  texto» es defecto de lectura. Mismo remedio que
  [[dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una]].

## Por qué es difícil de ver desde adentro

El autor del gate mide su predicado contra el corpus y encuentra exactamente los casos que esperaba
— porque el bug **produce** esos casos. **El gate parece validado por los datos, y lo que lo valida es
el defecto.** Sólo lo rompe alguien que llegó al bug por otro camino: acá entré por «un documento que
midió de verdad quedó fuera por vocabulario», que es pérdida de cobertura, no ruido.

## La dependencia de orden tiene un espejo

Arreglar el parser **sin** excluir antes a los documentos analíticos hace lo contrario: mete como
mediciones propias los veredictos **citados** de otros (una tabla `| id | COHERENTE (ajeno) |
REQUIERE_TRIAGE (mío) |` empieza a aportar el COHERENTE que sólo estaba citando). Los dos cambios son
dependientes en direcciones opuestas: **excluir primero, arreglar después.** Un fix y una
clasificación que se cruzan mal producen ruido en los dos sentidos.

Hermanas: [[el-guard-falla-abierto-en-su-caso-de-activacion]] ·
[[el-instrumento-tambien-CONDENA-no-solo-absuelve]] (el falso rojo parece prudencia) ·
[[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] · [[el-guard-que-caza-a-su-propio-autor]] ·
[[vacio-no-es-hallazgo-correr-el-control]] ·
[[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]].
