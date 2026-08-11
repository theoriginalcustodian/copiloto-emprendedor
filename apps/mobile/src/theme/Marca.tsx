import { View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';

import { useTema } from './ThemeProvider';

/**
 * La marca del Copiloto: el isotipo Odobi (O concéntrica + 2 ondas, geometría canónica de
 * `docs/Imagen de marca/isotipo-odobi/*.svg`) sobre un badge redondeado.
 *
 * Cero assets empaquetados (los 4 trazos van inline por `react-native-svg`, no una imagen que haya
 * que bundlear), cero hex (todo sale de `tema.color`, así que respeta los 5 skins activos). Mismo
 * mecanismo `logoScale` que `modules/chat/BotonVoz.tsx` (ODOBI8 §A): el `stroke-width` se
 * predivide por la escala para que el trazo se vea igual de fino en cualquier tamaño. Reutilizable:
 * login + estado vacío del chat.
 *
 * `tono='acento'` (default) pinta el badge con el color de acento y el isotipo con `acentoTexto` —
 * para el hero del login. `tono='superficie'` invierte el par — para cuando acompaña texto y no
 * debe competir con él.
 */
interface PropsMarca {
  size?: number;
  tono?: 'acento' | 'superficie';
}

const ISOTIPO_VIEWBOX = 24;
const ISOTIPO_STROKE_BASE = 1.7;
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
  const esAcento = tono === 'acento';
  const fondo = esAcento ? tema.color.acento : tema.color.superficieAlta;
  const trazo = esAcento ? tema.color.acentoTexto : tema.color.acento;

  const isotipoTamano = size * ISOTIPO_RATIO;
  const escala = isotipoTamano / ISOTIPO_VIEWBOX;
  const strokeWidth = ISOTIPO_STROKE_BASE / escala;
  const offset = (size - isotipoTamano) / 2;

  return (
    <View
      testID="marca"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
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
