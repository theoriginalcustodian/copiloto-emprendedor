# Un `Falta:` que dice «no se puede medir» describe los INSTRUMENTOS del día, no el defecto

**Medido el 2026-11-03.** `SM-I7` estaba trabada con un motivo bueno y bien escrito: la captura del
sheet de permisos **no era posible**, porque el sheet vive en el onboarding
(`Guard -> debeMostrarOnboarding(me)`), la cuenta canónica ya lo pasó, y no había forma de volver a
verlo sin resetear la canónica — que es la cuenta del operador.

Era **cierto con la canónica**. En cuanto backend provisionó una tenencia de prueba, frontend1 lo
capturó a las **15:04** sin tocar una línea de la app. Lo mismo pasó el mismo día con `SM-J3`,
`SM-K5` y `SM-K6`: cuatro fichas desbloqueadas por un instrumento nuevo, no por código.

## Por qué cuesta verlo

Un `Falta:` bien fundado **se lee como una propiedad del defecto** («esto no se puede medir») cuando
en realidad describe el **estado del instrumental del día** («esto no se puede medir *con lo que
tengo*»). La diferencia es invisible en el texto, porque el motivo citado sigue siendo verdadero:
la canónica sigue habiendo pasado el onboarding. Lo que cambió fue que apareció otra cuenta.

Y nadie lo re-evalúa solo: el `Falta:` se escribió una vez, y la ficha queda parada hasta que alguien
vuelve a leerla **preguntando otra cosa**.

## La norma

**Cuando entra un instrumento nuevo —una tenencia de prueba, un device, un endpoint, un permiso—
re-leer los `Falta:` que decían «imposible» ANTES de buscar trabajo nuevo.** Es la lectura más
barata del sprint y el 2026-11-03 destrabó cuatro fichas en una pasada.

Y al escribir un `Falta:` de este tipo, nombrar **cuál instrumento falta**, no sólo que falta: «no se
puede con la canónica porque ya pasó el onboarding» envejece bien; «no se puede capturar» envejece
como un hecho permanente.

Relacionado: [[un-disparador-cumplido-no-avisa-a-nadie]] ·
[[el-workaround-que-usas-de-rutina-deja-de-parecerte-informacion]] ·
[[una-espera-sin-disparador-nombrable-es-paralisis]]
