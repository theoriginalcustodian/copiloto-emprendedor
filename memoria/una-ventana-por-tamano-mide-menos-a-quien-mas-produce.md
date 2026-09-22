---
name: una-ventana-por-tamano-mide-menos-a-quien-mas-produce
description: "Muestrear el final de un log que crece para decidir una propiedad ESTABLE invierte al vigilante: el más activo es el primero en volverse invisible."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d2c6cf49-8897-4e01-b0d9-03381d7b73f2
  modified: 2026-08-12T20:33:41.319Z
---

Si un instrumento decide una propiedad **estable** (identidad, rol, dueño) leyendo una **ventana por
tamaño** del final de un log que crece, la cobertura queda **invertida**: la marca que fija esa
propiedad llega temprano y va quedando atrás, así que **cuanto más produce el sujeto, antes deja de
verse**. El vigilante pierde primero justo al que más falta hace ver.

**Why:** el 2026-08-12 `etiqueta_transcript` (`scripts/no-ocio-check.sh`) rotulaba cada sesión con
`tail -c 400000`, buscando el prompt del cron —que es quien *asigna* la identidad, y por eso el
script lo prefería sobre la autodeclaración y sobre la conducta, las dos con falsos positivos ya
documentados. Medido sobre los transcripts vivos:

```
backend        128 MB   ventana 0/0/0    entero 217/5/5
frontend        23 MB   ventana 0/0/0    entero   8/381/6
planificación   36 MB   ventana 4/5/20   entero  15/14/1165
```

**Las dos sesiones vigiladas estaban sin rotular al mismo tiempo**, a minutos de un dead-man falso
—exactamente el incidente del 2026-07-24 ("backend muerto 8½h" mientras escribía código) que ese
script existe para no repetir. Y **el ahorro que justificaba la ventana no existía**: `grep` sobre
24 MB tarda **25 ms**, con los transcripts de más de 4 h ya descartados aguas arriba. Se pagó
ceguera por una optimización que no medía nada.

Lo que lo destapó no fue el rótulo sino una línea suelta del propio script —`⚠️ transcript(s)
vivo(s) SIN rotular`, que por diseño no se silencia— cruzada contra un hecho de filesystem: el
contrato que esa sesión "muerta" había movido a `en-curso/` hacía 9 minutos.

**How to apply:** antes de aceptar una ventana en un instrumento, preguntá si lo que busca es
**estable o reciente**. Reciente (conducta, actividad, carga) → ventana correcta. Estable (identidad,
dueño, rol, versión) → **archivo entero**, y sólo achicá con un costo *medido*, no supuesto. Señal de
alarma barata: si la cobertura del instrumento depende del **volumen** del sujeto, el sujeto puede
apagarlo produciendo. Familia de
[[instrumentos-que-confirman-en-vez-de-verificar]] y
[[el-watchdog-que-solo-ve-al-que-llega-tarde-nunca-al-que-no-vino]]; corolario práctico de
[[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]].
