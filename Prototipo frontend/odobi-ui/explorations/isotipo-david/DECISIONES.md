# DECISIONES — Adopción del isotipo de David

Decisión de Martin, 18/08/2026. **El isotipo de David reemplaza al monograma "la o que habla"** en toda la identidad.

Origen: mirando el prototipo, Martin señaló dos cosas para tomar — el desplazamiento hacia arriba (ya adoptado en el modelo de capas) y **el símbolo**.

## 1 · Qué se adopta

Cuatro arcos concéntricos abiertos a la izquierda, sin punto central. Archivos en el repo del producto: `docs/Imagen de marca/isotipo-odobi/` — positivo, negativo y monocromo, más los dos lockups.

**Se adopta la spec completa, no sólo el dibujo:** resguardo mínimo de 0,5 u, separación símbolo↔wordmark de 0,3 × ancho del símbolo, y el bbox real medido con `getBBox()` (18,879 × 17 u dentro de un `viewBox` 0-24). Está bien hecha y no hay motivo para rehacerla.

## 2 · La condición que se puso, y por qué

| Escala | Variante | `stroke-width` | Motivo |
|---|---|---|---|
| **≤ 24 px** | **3 arcos** — se quita el interno | **1.6** | Medido: a 16 px el arco interno (r 4,5) colapsa y se funde con el exterior. El signo pierde estructura y se lee como un paréntesis con una coma |
| **> 24 px** | **4 arcos** (geometría canónica) | **1.3** | A partir de 32-40 px los cuatro se separan y el signo se lee entero |

Se probó también una variante de **2 arcos**: pierde el carácter de ondas y deja de leerse como sonido. Descartada.

**Esto no es un capricho de implementación: es el mismo problema que ya tuvimos al revés.** El monograma anterior nació con las barras de voz *adentro* de la O y hubo que sacarlas afuera (rev. 29/07) porque a tamaño de UI el contrapunzón medía ~5 px y se empastaban. Un signo de arcos concéntricos tiene un límite de densidad, y hay que declararlo antes de que alguien lo descubra en producción.

## 3 · Qué se pierde y qué se gana

**Se pierde** el argumento más fuerte del monograma anterior: era **la O real del wordmark**, el mismo glifo, y eso daba constancia de signo entre logo y símbolo (Chaves).

**Se gana:**
- **El símbolo deja de decir el nombre y pasa a decir qué hace el producto.** Es un cambio de tesis, no un ajuste: de "la letra que te habla" a "el sonido que va y viene".
- **Deja de depender de la tipografía.** Cuando cambiamos NeueEinstellung por Plus Jakarta hubo que regenerar 24 paths del monograma porque el símbolo *era* un glifo. Con un signo dibujado, la próxima decisión tipográfica no toca la marca.
- **Está abierto a la izquierda**, así que no se lee «ojo» ni «diana» — que era el riesgo que el propio brief marcaba de entrada.
- Ya está **implementado y usado en el repo** (`BotonVoz.tsx`, a 34 px con `stroke` compensado por escala).

## 4 · Implementación

**100 % stroke, sin `fill`.** El color se hereda del contenedor por CSS (`stroke: var(--sec)` / `var(--terracota)`), así que **un solo marcado sirve para las dos pieles**. Todas las reglas `.mono-glyph{fill:…}` del sistema anterior se eliminaron: ya no hay nada relleno.

Propagado a los **11 mockups** (27 apariciones), al árbol y a la maqueta de la lámina.

**Trampa pagada (queda escrita):** el pase automático reemplazó los `<svg>` enteros y **se comió los atributos `class`**. Un solo caso lo necesitaba —`.mono-big` del estado vacío del 10— y el síntoma fue **un símbolo invisible**: sin clase no heredaba `stroke`, y el default de SVG es `none`. No falla ruidosamente, simplemente no se dibuja. Se agregó un control que recorre todos los isotipos y verifica que cada uno esté cubierto por una regla que le dé color (0 sin cubrir).

## 5 · Consecuencia pendiente

La animación **`Entrada`** de Rive (arranques 2..n) se rehace con este signo. Encaja natural: hoy son *3 ondas que se disipan alrededor de la O*, y **el isotipo ya son arcos** — la onda deja de ser un adorno alrededor de la letra y pasa a ser el propio símbolo desplegándose. También cae la nota de "geometría del isotipo del 09" del `splash-o/DECISIONES.md`, que apuntaba al monograma viejo.
