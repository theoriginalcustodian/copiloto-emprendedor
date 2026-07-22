---
name: encabezado-tranquilizador-se-come-la-carga-util
description: LEER al escribir la línea de arranque de un vigía, un healthcheck o un reporte de estado — un pendiente anunciado UNA vez, dentro de una línea que empieza con "OK", es un pendiente perdido.
metadata:
  type: feedback
---

Un reporte que **empieza diciendo que todo está bien** y mete la carga útil en la misma línea no se
lee: se archiva con la vista. El instrumento dijo la verdad; el formato la volvió invisible.

**El caso, 2026-07-21.** Mi vigía del buzón de coordinación arrancaba así:

```
vigia OK — filtro verificado en ambas direcciones; firma con mtime... Pendientes: <6 archivos>
```

Los seis nombres estaban ahí. Leí un renglón que empieza con **"vigia OK"** como estado de salud.
**Cuatro mensajes dirigidos a mí quedaron sin acusar durante horas**, y uno de ellos pedía consumo
explícito. Nadie los reclamó porque el vigía "ya los había anunciado".

**Por qué rinde entenderlo como formato y no como distracción.** El ojo clasifica la línea por su
primera palabra, antes de leerla entera: `OK` la marca como *estado*, y el estado no se lee, se
saltea — es lo que uno quiere que pase con 99 de cada 100 líneas de un healthcheck. La carga útil
pegada detrás hereda esa clasificación. No falla la atención: funciona demasiado bien.

**Las dos reglas que salen de esto:**

1. **Un evento por pendiente**, nunca una lista dentro de una línea de estado. Si son seis, son seis
   líneas.
2. **Re-anunciar mientras siga pendiente** (cada 20 min alcanza). Un pendiente que se anuncia una sola
   vez depende de que alguien lo haya leído *en ese instante*; re-anunciarlo lo vuelve independiente
   de la atención. Y "pendiente" hay que definirlo por lo que importa —*dirigido a mí y sin mi acuse*—
   y no por lo fácil (*"existe en la carpeta"*), que incluiría lo ya consumido y volvería el aviso
   ruido, que es como se llega a ignorarlo de nuevo.

**La pregunta que generaliza, y que vale para todo reporte de arranque:** *¿qué otro pendiente
anunciado una sola vez se perdió?* Todo instrumento que resume su cola al arrancar tiene esta forma —
un `git status` largo, un log de migraciones, el resumen de un CI.

Hermana de [[instrumentos-que-confirman-en-vez-de-verificar]] por una puerta nueva: allá el
instrumento **miente**; acá **dice la verdad y el formato la entierra**. Y del mismo día, la mitad
emisora del mismo animal: un mensaje que desbloquea a otro nace en la carpeta que nadie vigila
([[mensaje-entregado-donde-nadie-mira]]).
