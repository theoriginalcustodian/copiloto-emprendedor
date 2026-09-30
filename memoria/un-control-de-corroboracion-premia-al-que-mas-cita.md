---
name: un-control-de-corroboracion-premia-al-que-mas-cita
description: Un control de "¿lo confirma otro documento?" le da la mejor nota al documento normativo, que es justo el que hay que frenar
metadata:
  type: feedback
---

Escribí un control contra el falso progreso: «ningún id nuevo se apoya en un solo documento». Auditoría
lo rompió **sin encontrar un solo id falso**. Demostró algo peor: el control **premia exactamente al
vector de ataque**.

Un control de corroboración cruzada mide, sin decirlo, **cuánto cita** un documento. Y un documento
normativo o analítico —un dictamen, un acta, un resumen— cita casi todo el padrón *por naturaleza*.
Entonces corrobora a todos los demás y sale como **el mejor respaldado del corpus**. La propiedad que
lo vuelve sospechoso es idéntica a la que lo hace aprobar.

**Why:** un control que absuelve al único documento capaz de cerrar la cifra en falso es peor que no
tener control: entrega una garantía que no tiene, y el que la lee deja de mirar. Y no da síntoma —
nunca sale rojo, porque está apuntando al lado equivocado del fenómeno.

**How to apply:** ante un control de la forma «¿está corroborado?», preguntá **qué clase de documento
maximiza esa métrica**. Si la respuesta es «el que resume a los demás», el control está invertido.
Y antes de reemplazarlo por el que parece el correcto, medilo: el reemplazo de auditoría (cobertura
>80% ⇒ rol normativo) también falló, empate literal 29/54 entre la medición más grande y el descartado
que más cita — ver [[medir-si-un-gate-dispara-antes-de-embarcarlo]]. Dos intentos desde lados opuestos
fallando no es mala suerte: **el formato no codifica el rol**, y ningún parser recupera lo que el
documento no escribió. Lo que protege es la clasificación **declarada** más el vocabulario cerrado.
Ídem [[nada-cazaba-al-mal-clasificado-solo-al-no-clasificado]].
