import { View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { useTema } from './ThemeProvider';

/**
 * La marca del Copiloto: el isotipo Odobi (O concéntrica + 2 ondas, geometría canónica de
 * `docs/Imagen de marca/isotipo-odobi/*.svg`) sobre un badge redondeado.
 *
 * Cero assets empaquetados (los 4 trazos van inline por `react-native-svg`, no una imagen que haya
 * que bundlear), cero hex (todo sale de `tema.color`, así que respeta los 5 skins activos). Mismo
 * mecanismo de escala que `modules/chat/BotonVoz.tsx`: el `stroke-width` va en unidades del viewBox
 * (24) DENTRO del `<G scale>`, así que el grosor en pantalla es proporcional al tamaño (a 96 px,
 * 1,3 × 4 = 5,2 px, igual que `prototipo/index.html:1876`). Reutilizable: login + estado vacío del chat.
 *
 * `tono='acento'` (default) pinta el badge con el color de acento y el isotipo con `acentoTexto`.
 * **NO es el login**: la placa de terracota plena del 28/07 se eliminó (`mockups/01-onboarding/index.html:187`,
 * «dos momentos de marca seguidos gastaban el permiso dos veces»); el login usa `tono='desnudo'`
 * (símbolo sin badge, terracota, `prototipo/index.html:2571`). `tono='superficie'` invierte el par — para cuando acompaña texto y no
 * debe competir con él. `tono='tinta'` usa el par del bloque de máximo contraste (negro tostado con
 * el signo en crema, invertido en la piel oscura): es el **avatar de Soporte**, donde la marca
 * identifica de qué producto es el chat sin pedir el permiso de color que pide el acento.
 */
interface PropsMarca {
  /** Lado de la caja. En `desnudo` es el del isotipo mismo (no hay badge que lo contenga). */
  size?: number;
  tono?: 'acento' | 'superficie' | 'tinta' | 'desnudo';
}

const ISOTIPO_VIEWBOX = 24;
/**
 * 1.3 es el grosor del sistema (`odobi-ui`): el isotipo se dibuja igual en la app, en el prototipo y
 * en las piezas de marca. Mobile lo tenía en 1.7 y engordaba el signo.
 *
 * 🔴 **PLANO, un solo valor, EN UNIDADES DEL VIEWBOX.** El `LEEME` del sistema define 1.6 en chico /
 * 1.3 en grande; Martin cerró el plano el 2026-09-18 con un solo valor.
 * ⚠️ Antes se predividía por la escala (`1.3 / escala`) creyendo que eso mantenía el trazo
 * "ópticamente igual": dentro de `<G scale(escala)>` la división se CANCELA y el trazo quedaba en
 * 1,3 px ABSOLUTOS a cualquier tamaño (4× más fino que el prototipo a 96 px). Mantener el px
 * absoluto ES el defecto: un isotipo de 24 y uno de 96 no eran el mismo signo escalado.
 * Control correcto: `modules/splash/EntradaDiaria.tsx` (`strokeWidth={1.3}` sin predividir).
 */
const ISOTIPO_STROKE_BASE = 1.3;
const ISOTIPO_TRAZOS = [
  'M11 3.5a8.5 8.5 0 1 0 0 17',
  'M11 7.5a4.5 4.5 0 1 0 0 9',
  'M16.5 8.8a4.8 4.8 0 0 1 0 6.4',
  'M19.5 6.5a9 9 0 0 1 0 11',
];

// Proporción heredada de BotonVoz.tsx (34/80): mismo lenguaje visual del isotipo dentro de un badge.
const ISOTIPO_RATIO = 34 / 80;

export function Marca({ size = 64, tono = 'acento' }: PropsMarca) {
  const tema = useTema();
  const desnudo = tono === 'desnudo';
  const fondo = desnudo
    ? 'transparent'
    : tono === 'acento'
      ? tema.color.acento
      : tono === 'tinta'
        ? tema.color.bloque
        : tema.color.superficieAlta;
  const trazo =
    tono === 'acento' ? tema.color.acentoTexto : tono === 'tinta' ? tema.color.bloqueTexto : tema.color.acento;

  // `desnudo` = el isotipo SIN badge, como el estado vacío del chat del prototipo (`index.html:1876`,
  // `<svg width="96">` con `stroke:var(--terracota)`): el `size` es el del signo, no el de un tile.
  const isotipoTamano = desnudo ? size : size * ISOTIPO_RATIO;
  const escala = isotipoTamano / ISOTIPO_VIEWBOX;
  // Unidades del viewBox: el `scale(escala)` del <G> lo multiplica (NO predividir, se cancelaría).
  const strokeWidth = ISOTIPO_STROKE_BASE;
  const offset = (size - isotipoTamano) / 2;

  return (
    <View
      testID="marca"
      style={{
        width: size,
        height: size,
        // Círculo completo en `tinta` (es un avatar, y los avatares son redondos); esquinas
        // redondeadas en los otros dos, que son el badge de la marca.
        borderRadius: tono === 'tinta' ? size / 2 : Math.round(size * 0.3),
        backgroundColor: fondo,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg testID="marca-isotipo" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G transform={`translate(${offset} ${offset}) scale(${escala})`}>
          {ISOTIPO_TRAZOS.map((d, i) => (
            <Path
              key={i}
              testID={`marca-isotipo-trazo-${i + 1}`}
              d={d}
              stroke={trazo}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
        </G>
      </Svg>
    </View>
  );
}
