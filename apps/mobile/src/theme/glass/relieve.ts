/**
 * `relieve` — las sombras proyectadas de las cards de vidrio (tiles del escritorio, filas de actividad
 * reciente). Fuente ÚNICA: si `Tile` y `Row` vuelven a llevar los valores copiados a mano, vuelven a
 * divergir — ya pasó con el marco del vidrio (ver `canonGlass.ts`).
 *
 * **Geometría del template canónico** (`App glass/DocuMed 3 …/DocuMed App.dc.html`, reglas `.dmt-w
 * .dm-tile` y `.dmt-w .dm-row`): `0 9px 18px -6px` para el tile y `0 7px 15px -6px` para la fila. El
 * color sale del token `glass.sombra` del tema, no del template (el template sólo declara la sombra
 * proyectada en el skin blanco; en los oscuros la pide el operador — 2026-07-19: *"todas deben tener
 * sombra también para lograr un efecto relieve y profundidad"*).
 *
 * 🔴 **Por qué `boxShadow` y no `elevation`.** La sombra por `elevation` de Android necesita que la
 * view tenga un fondo OPACO para calcular su outline; por eso `Tile`/`Row` llevaban
 * `backgroundColor: tema.color.fondo`, y ese fondo sólido era justamente lo que les mataba la
 * transparencia (una card de vidrio sobre un fondo opaco no es de vidrio: es una card). `boxShadow`
 * —CSS real, RN 0.76+ **con la nueva arquitectura**, que este proyecto tiene activa
 * (`app.json: newArchEnabled`)— dibuja la sombra FUERA de la caja y no exige fondo opaco: se puede
 * tener relieve y transparencia a la vez. Verificado contra
 * `react-native/Libraries/StyleSheet/StyleSheetTypes.d.ts:516` (`boxShadow`) y `:343` (`BoxShadowValue`).
 *
 * **Dos capas, como el template.** La primera es la sombra difusa (volumen); la segunda es el *contact
 * shadow* pegado al canto inferior, que es la que de verdad "despega" la card. Sobre un fondo oscuro
 * la difusa sola casi no se percibe —medido: apenas 2-10 puntos RGB bajo el borde— porque un negro
 * sobre un fondo que ya es casi negro tiene poco recorrido. El canto es lo que da el relieve.
 *
 * 📐 Medición de referencia (device SM-A217M, skin cian, fondo plano `rgb(9,26,38)`), justo debajo del
 * borde inferior de un tile: **antes `(9,26,38)` — o sea, ninguna sombra**; con `boxShadow` de una
 * capa `(7,19,28)`; con las dos capas, el canto se oscurece más y se recupera antes.
 */
import type { ViewStyle } from 'react-native';

/** Sombra del tile del escritorio (card cuadrada del grid de funciones). */
export function sombraTile(color: string): ViewStyle {
  return {
    boxShadow: [
      { offsetX: 0, offsetY: 9, blurRadius: 18, spreadDistance: -6, color },
      { offsetX: 0, offsetY: 2, blurRadius: 6, color },
    ],
  };
}

/** Sombra de la fila de actividad reciente — más chata que la del tile, como en el template. */
export function sombraFila(color: string): ViewStyle {
  return {
    boxShadow: [
      { offsetX: 0, offsetY: 7, blurRadius: 15, spreadDistance: -6, color },
      { offsetX: 0, offsetY: 2, blurRadius: 5, color },
    ],
  };
}
