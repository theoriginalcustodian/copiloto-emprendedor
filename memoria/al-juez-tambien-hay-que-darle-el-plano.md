---
name: al-juez-tambien-hay-que-darle-el-plano
description: El auditor rechazó 3/3 el parche CORRECTO porque se le pedía juzgar "¿arregla la causa?" sin mostrarle la causa. La regla de realimentación localizada se había aplicado al que GENERA y no al que JUZGA — y un juez sin contexto no da error: rechaza, que parece prudencia.
metadata:
  type: project
---

# ⚖️🗺️ Al JUEZ también hay que darle el plano, no sólo al que construye

El ciclo de auto-reparación falló un caso del banco así: **3 intentos, 3 rechazos, todos al parche
correcto.** El bug era `for tipo in type(exc).__mro__` reemplazado por `for tipo in [type(exc)]` —el
"esto se puede simplificar" clásico—. El forjador produjo el arreglo bueno las tres veces. El auditor
lo rechazó las tres, con el motivo:

> *"El parche rompe el comportamiento al cambiar la lógica de herencia de categorías de errores."*

## La causa

El auditor recibía **el diff y una lista de "no romper"**, nada más. Su instrucción decía *"rechazá si
el parche no arregla la causa"* — **sin que nadie le dijera cuál era la causa.**

Con reparaciones obvias zafaba: reponer una máscara de 32 bits o un truncado a 200 se lee como
arreglo aunque no sepas qué se rompió. Con el MRO no. El "no romper" de ese caso era literalmente
*"que una subclase siga heredando la categoría de su padre"*, y el parche **toca esa misma línea**.
Leído sin la causa, restaurar el recorrido **es** cambiar la lógica de herencia.

## Por qué esto es peor que un bug normal

**Un juez sin contexto no se equivoca ruidosamente: rechaza.** Y un rechazo no se parece a un fallo,
se parece a *prudencia*. No hay excepción, no hay PR malo, no hay incidente que investigar — sólo un
ciclo que "no encontró nada reparable". Habría quedado así indefinidamente, leído como conservador y
seguro.

Y el sesgo no es aleatorio: **"reponer lógica que alguien había quitado" es la forma más común que
tiene una reparación real**, y es exactamente la que un juez sin contexto confunde con romper
comportamiento. O sea que el auditor estaba sistemáticamente sesgado contra el arreglo más frecuente.

## La regla

**La realimentación localizada —*dale el plano, no la orden*— aplica al que JUZGA igual que al que
GENERA.** En este repo la regla estaba escrita y aplicada al forjador, que recibía la salida de
pytest desde el día uno. Nadie la extendió al auditor, porque "juzgar" no se siente como una tarea
que necesite contexto: se siente como aplicar un criterio. No lo es — juzgar *si algo arregla algo*
es una pregunta sobre dos cosas, y sólo se le estaba dando una.

Al preguntarte quién necesita contexto en un pipeline, contá también **los verificadores**, no sólo
los generadores.

## El segundo hallazgo: el control tiene que mandar el mismo parámetro

Al agregar `evidencia` al camino de producción, el kill switch (`verificar_auditor`, que somete tres
parches conocidos-malos antes de operar) **seguía llamando sin evidencia**. Habría quedado
verificando una forma de llamada que ya nadie usa — [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]].

Y no era un detalle de prolijidad: mostrarle tests en rojo al auditor es **justo** lo que podría
volverlo complaciente con el parche que hace verde el test sin arreglar nada (Goodhart, el modo que
EvilGenie midió en 54%). El control sin evidencia dejaba fuera el único escenario donde ese parche es
tentador. Ahora los tres se someten **con** evidencia, y `gpt-4o` los sigue rechazando 3/3.

## Medido

| | antes | después |
|---|---|---|
| Banco de casos reales | 2/3 | **3/3** (el MRO, aceptado en el intento 2) |
| Los 3 parches congelados, `gpt-4o` real | rechazados 3/3 | **rechazados 3/3, ahora con evidencia** |
| Control positivo (¿aprueba un parche bueno?) | sí | **sí** |

Los dos lados importan: "rechaza los tres" sin el control positivo es indistinguible de "rechaza
todo" — que es exactamente lo que estaba pasando con el MRO ([[instrumentos-que-confirman-en-vez-de-verificar]]).

## Hermanas

- [[localizacion-estructurada-feedback-agentes]] — la regla madre; esto es su extensión a los jueces.
- [[el-instrumento-tambien-CONDENA-no-solo-absuelve]] — el falso rojo no choca con nada y se disfraza
  de prudencia. Acá el falso rojo era del auditor.
- [[el-forjador-no-acierta-siempre-el-gate-de-tests-no-es-opcional]] — el otro extremo del mismo ciclo.
