---
name: medir-obliga-a-reportar-y-el-reporte-entra-al-corpus-medido
description: El reporte de una medición vuelve a entrar al universo que mide — clasificarlo es una tasa por reporte, no una deuda que se termina de pagar
metadata:
  type: project
---

Cuando el corpus que medís es **el mismo lugar donde reportás la medición**, no hay forma de informar
el resultado sin contaminar la entrada. Medido el 2026-10-05: publiqué dos mensajes al buzón con el
cruce de veredictos del criterio 3 —tablas de «quién aportó el lado `COHERENTE`» y «cuántos veredictos
distintos tiene cada id», insertadas por script desde el JSON— y el gate del propio contador salió
`exit 8`: *«2 documentos producen veredictos del criterio y no están clasificados»*. Eran mis dos
reportes.

**Por qué no es una anécdota:** no hay manera de informar un cruce de veredictos sin nombrar los
veredictos cruzados. Así que la clasificación a mano **no es una deuda que se termine de pagar: es una
tasa por cada reporte**, y crece con la cantidad de mediciones. El registro ya iba por la tercera forma
de la misma clase — un contrato que ENSEÑA el formato y para enseñarlo emite un veredicto real, una
respuesta que CITA el fixture del defecto, y ahora el reporte que PUBLICA la medición.

**Lo que NO se hace, y es la parte con filo:** una exención por patrón del tipo «lo que emite
planificación no es medición». Sería fail-open sobre el rol que más documentos escribe, y es la forma
exacta de [[exencion-sin-autoridad]] — una regla amplia que nadie vuelve a medir. Preferible la tasa
visible: el gate grita, se clasifica, y el costo queda contado donde se ve.

**El arreglo de raíz no es clasificar mejor: es que el parser exija la CABECERA.** Hoy el brazo `tabla`
lee cualquier tabla con algo que parezca un veredicto, y ni un code fence lo detiene — por eso una cita
es indistinguible de una medición. Mientras eso no se pague, cada reporte paga la tasa.

**Cómo se reconoce en otro sistema:** preguntá *¿el artefacto que publica el resultado cae dentro del
universo que el instrumento recorre?* Si la respuesta es sí, el instrumento se va a medir a sí mismo, y
el síntoma no va a ser un error sino **una cifra que sube sin que nadie haya medido nada nuevo**.

Relacionadas: [[nada-cazaba-al-mal-clasificado-solo-al-no-clasificado]] ·
[[si-el-formato-no-codifica-el-rol-ningun-parser-lo-recupera]] ·
[[el-instrumento-fabrica-una-referencia-que-no-existe]]
