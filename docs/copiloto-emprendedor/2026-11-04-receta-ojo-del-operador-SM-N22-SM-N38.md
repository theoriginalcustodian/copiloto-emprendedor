# Receta — el ojo del operador para SM-N22 y SM-N38 (criterio binario escrito ANTES de mirar)

> **Dueño de la receta:** manejo-de-errores · **Quién la ejecuta:** el OPERADOR, con su teléfono.
> **Paso 6 del orden de la pasada**
> (`2026-11-04-ORDEN-DE-LA-PASADA-DE-DEVICE-indice-unico-y-las-7-huerfanas.md`).
> **Por qué existe:** estas dos fichas no esperan una captura sino un dictamen. Si el criterio se decide
> con el teléfono en la mano, se desliza a impresión, y la pasada no acredita nada. Por eso acá cada
> pregunta tiene un **SÍ** y un **NO** redactados de antemano, y sólo esas dos respuestas valen. Si la
> respuesta honesta es «más o menos», eso es **NO**, y se anota qué se vio.

## Paso 0 — que el teléfono corra el código correcto (sin esto, NO se mira nada)

Las dos fichas ya cayeron una vez por lo mismo: **el device no corre `main`, corre lo que Metro sirve**.
En SM-N22 el operador vio el defecto porque su bundle era viejo, y tenía razón.

- [ ] Metro sirve un checkout que **contiene** `80f4e2ee` (N22) **y** `b9a4404c` (N38). Se verifica con
      `git merge-base --is-ancestor 80f4e2ee HEAD && git merge-base --is-ancestor b9a4404c HEAD`
      corrido en el checkout que Metro sirve, no en otro.
- [ ] La app se relanzó **después** de levantar ese Metro (bundle bajado de nuevo).
- [ ] La pantalla es **Mi día**, con el panel de la conversación **abajo** (colapsado). Ninguna otra
      pantalla acredita estas fichas.

Si cualquiera de los tres no se cumple: **no se dictamina**. Se arregla el paso 0 y se vuelve a empezar.

**Al lado del teléfono:** la imagen del mapa de Mi día
(`Prototipo frontend/odobi-ui/mapa-pantallas/index.html`, vista Mi día), que es la referencia que el
operador usó para reportar las dos.

> ⚠️ **Hay DOS asas en esta pantalla.** Arriba, al abrir el escritorio, aparece una segunda asa
> («Subí para volver a Mi día», y≈83-91 px). **Las dos preguntas son sobre la de ABAJO**, la que está
> pegada al campo «Escribí, o hablá…». Mirar la de arriba describiendo la de abajo fue la causa del
> reporte confundido de N22.

## SM-N22 — ¿el tirador está ARRIBA del campo de texto?

**Pregunta única:** con el panel abajo, en Mi día, ¿la barrita de arrastre está **inmediatamente
encima** del campo «Escribí, o hablá…»?

| Respuesta | Qué tiene que ver exactamente el operador |
|---|---|
| **SÍ** | De arriba hacia abajo, en el borde inferior de la pantalla: **barrita → campo de texto**. Entre la barrita y el campo no hay ningún otro elemento. Debajo del campo no hay ninguna barrita. |
| **NO** | La barrita está **debajo** del campo, o hay otro elemento (card, botón, texto) entre la barrita y el campo, o no se ve ninguna barrita abajo. |

**Lo que NO se juzga acá:** la distancia exacta en px entre la barrita y el campo (el DoD pide el
**orden**, no la separación) ni el tamaño de la barrita (eso es N38).

## SM-N38 — ¿el tirador es una línea sola y el campo va sin fondo?

Son los puntos 1 y 6 del DoD. **Dos preguntas, y las dos tienen que dar SÍ.**

**N38-a · la tira del asa**

| Respuesta | Qué tiene que ver exactamente el operador |
|---|---|
| **SÍ** | Encima del campo hay **sólo una barrita horizontal corta**, sin ninguna palabra. En particular **no** aparece «Escribile a Odobi» ni ningún otro texto junto a la barrita. La barrita ocupa una franja fina, del mismo orden que la del mapa: no una franja alta. |
| **NO** | Hay **cualquier texto** junto a la barrita, o la zona del asa es una franja alta (como la de antes, 105 px reales medidos), visiblemente más gruesa que la del mapa. |

**N38-b · el campo y el botón sin fondo**

| Respuesta | Qué tiene que ver exactamente el operador |
|---|---|
| **SÍ** | El contenido de Mi día (la card siguiente de «Para hoy») se ve **por detrás** del campo y del botón del micrófono. No hay una franja de color de ancho completo detrás del campo, ni un corte horizontal duro que corte la card. |
| **NO** | Detrás del campo hay una **franja de ancho completo** (un fondo propio), o la card de «Para hoy» se corta en una **línea horizontal neta** a la altura del campo. |

**Condición para que N38-b se pueda contestar:** tiene que haber contenido detrás. Si «Para hoy» está
vacío y no hay nada que pueda verse a través del campo, la pregunta **no se puede contestar**. Eso no es
SÍ: se anota «sin contenido detrás» y se repite con la cuenta canónica, que tiene cards.

## Cómo se registra

Una línea por pregunta, sin adjetivos:

```
SM-N22   SÍ|NO   <qué vio, en una frase si es NO>
SM-N38-a SÍ|NO   <ídem>
SM-N38-b SÍ|NO|SIN-CONTENIDO   <ídem>
bundle: <sha que sirve Metro> · fecha/hora local · cuenta
```

Con **SÍ** en las tres, quien tenga la evidencia marca las dos fichas con `sprint-estado.py --marcar`, y
en el `Cierre:` va esta línea, textual. Con un solo **NO**, la ficha sigue en `DOD-PARCIAL` y el
`Falta:` se reescribe con lo que el operador vio. **No** se reinterpreta como «casi».

## Por qué estos criterios y no otros

- **Se puede contestar sin regla.** Cada SÍ y cada NO es una relación de orden o de presencia (arriba o
  abajo, hay texto o no, hay corte o no), no una medida. Un juicio de ojo es confiable para lo
  primero y no lo es para lo segundo.
- **Cada NO nombra el defecto que la ficha ya pagó**: la barrita debajo del campo (N22), el texto
  «Escribile a Odobi» y la franja de 105 px (N38-a), la franja con canto duro que cortaba la card a
  y=1427 (N38-b). Si el defecto vuelve, cae en un NO escrito, no en una impresión.
- **El paso 0 es obligatorio** porque es el único modo de falla que ya se dio en las dos fichas.
