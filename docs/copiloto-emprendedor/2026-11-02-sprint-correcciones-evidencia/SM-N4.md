# SM-N4: el rectángulo claro dentro de las cards

Evidencia de device: `RF8T318RN9T`, usuario canónico, 2026-11-02, 18:18-18:32. Bundle de Metro local con este cambio.

## Control del instrumento (DoD 1)

**Nadie miró la pantalla física para esta ficha.** Trabajo por `adb` y no puedo ver el teléfono, así que la mirada a ojo que pide el DoD queda sin hacer. Lo que sí medí:

- `dumpsys SurfaceFlinger --list` da una sola capa de la app, sin `SurfaceView`. `screencap` lee ese mismo buffer, así que no tiene otra capa que aplanar mal.
- El rectángulo estaba corrido según el desplazamiento de la sombra. En `Row`, 53 px de margen arriba y 13 abajo. Un error de composición no seguiría esa geometría.
- Con el primer cambio, el rectángulo desapareció de `Tile` y siguió en `Row`, que todavía no estaba tocado.

Por eso lo traté como un defecto real y no como un artefacto de la captura. Es una inferencia y no sustituye la mirada: por eso la ficha queda en `DOD-PARCIAL`.

## Las dos causas (DoD 2)

| Síntoma | Capa | Causa | Arreglo |
|---|---|---|---|
| Rectángulo claro dentro de la card | Sombra | `shadowColor` y `elevation` se ven a través de una superficie sin fondo opaco | `sombraVidrio`, con `boxShadow`, que sólo pinta fuera de la caja. Es lo que usa documed en `theme/glass/relieve.ts` |
| Esquinas rectas que se salen del borde | Recorte del padre | El `Pressable` de RNGH usa `ButtonViewGroup`, con `clipChildren = false` (`RNGestureHandlerButtonViewManager.kt:233`), y el gradiente no se recorta | `capaVidrio` en `Tile`, una vista que recorta el gradiente |

`Row` usa el `Pressable` de React Native y sólo necesitó el cambio de sombra.

## Dos errores que encontré en el camino

- **La sombra sin spread se cortaba en recto.** En «Actividad reciente» el `ScrollView` la cortaba a los costados de la lista. El DoD del sprint Odobi §2.4 pide spread `-12` en el nivel 1, y `boxShadow` sí puede aplicarlo, así que entró como token.
- **Una captura limpia que no probaba nada.** La primera versión de `capaVidrio` usaba `StyleSheet.absoluteFillObject`, que no existe en esta versión. La capa quedó sin tamaño y el gradiente no se pintaba: la card se veía limpia porque no tenía vidrio. Lo cazó el typecheck de `scripts/ci/mobile.sh`. Las capturas de abajo son posteriores a ese arreglo, y en ellas el gradiente se ve.

## Antes y después (DoD 3)

**Antes:** `SM-H6-1-factura-emitida-con-cliente-y-mail.webp` y `SM-H5-2-recibo-con-importe-y-pendiente.webp`.

**Después:**

- `SM-N4-1-chat-claro-despues.webp`
- `SM-N4-2-chat-oscuro-despues.webp`
- `SM-N4-3-funciones-claro-despues.webp`
- `SM-N4-4-funciones-oscuro-despues.webp`

Sobre `SM-N4-1`, el perfil de color a la altura de «No lo anotamos» sólo tiene los escalones del borde de la card (x=32 a 36); después sigue el gradiente, sin un segundo escalón.

El toque sobre `Tile` sigue funcionando: abrió Facturación. Esa prueba es anterior al último arreglo de la capa, que lleva `pointerEvents="none"` igual que antes.

## Alcance

`Tile` y `Row` se usan en toda la app, así que cambian todas sus cards y filas. Revisé en device el chat, Funciones y Mi día; el resto de las pantallas no las recorrí.

## No es de esta ficha

En Funciones, el rótulo se parte como «Presupuesto / s» en este teléfono. Ya pasaba antes de este cambio y va aparte al buzón.
