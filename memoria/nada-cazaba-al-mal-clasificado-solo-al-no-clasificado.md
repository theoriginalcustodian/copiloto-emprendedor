---
name: nada-cazaba-al-mal-clasificado-solo-al-no-clasificado
description: Un gate que exige que todo esté declarado no verifica que lo declarado sea cierto — y la declaración falsa es la puerta
metadata:
  type: feedback
---

El contador exigía que **todo** documento del corpus estuviera clasificado: o mide, o no mide, y sin
clasificar aborta con exit 8. Parecía cerrado. No lo estaba: **nada verificaba que un documento puesto
en la lista de mediciones mereciera estar ahí.** Una clasificación *errónea* pasaba callada, y es el
único camino por el que un documento analítico entra al corpus como medición.

Medido: `BLOQUE-A` estaba declarado medición desde el 23/09 y es analítico —auditoría misma lo llama
«misma clase que mi dictamen»—. Ningún gate podía verlo.

**Why:** exigir una declaración y validar una declaración son cosas distintas, y la primera se siente
como la segunda. El hueco vive **en el par**: el gate de completitud da la sensación de cobertura total
y tapa que no hay gate de corrección.

**How to apply:** por cada gate que exija «esto tiene que estar declarado», preguntá **qué pasa si se
declara mal**. Si la respuesta es «nada», falta el gate hermano. El discriminante que sirve no es un
umbral calibrado sino la **aritmética del rol**: una medición declarada que aporta CERO veredictos
legibles está declarada para medir y no mide — eso no envejece con el corpus. Ídem
[[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]] y
[[un-control-de-corroboracion-premia-al-que-mas-cita]].
