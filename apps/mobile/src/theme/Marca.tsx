import { View } from 'react-native';

import { useTema } from './ThemeProvider';

/**
 * La marca del Copiloto: un emblema con una **onda de voz** dibujada con `View`s.
 *
 * Es identidad, no decoración: el Copiloto conversa por voz y texto, y una onda de audio lo dice sin
 * una palabra. Cero assets (no depende de una imagen que haya que empaquetar ni de una fuente de
 * íconos), cero hex (todo sale de `tema.color`, así que respeta los 5 skins activos — cada uno con su
 * propio contraste fondo/barra). Reutilizable: login + estado vacío del chat.
 *
 * `tono='acento'` (default) pinta el emblema con el color de acento — para el hero del login.
 * `tono='superficie'` lo pinta tenue — para cuando acompaña texto y no debe competir con él.
 */
interface PropsMarca {
  size?: number;
  tono?: 'acento' | 'superficie';
}

// Alturas relativas de las barras de la onda (0–1). Asimétrica a propósito: una onda perfectamente
// simétrica lee como "barras de señal", no como voz.
const ONDA = [0.34, 0.62, 1, 0.78, 0.48, 0.86, 0.4];

export function Marca({ size = 64, tono = 'acento' }: PropsMarca) {
  const tema = useTema();
  const esAcento = tono === 'acento';
  const fondo = esAcento ? tema.color.acento : tema.color.superficieAlta;
  const barra = esAcento ? tema.color.acentoTexto : tema.color.acento;

  const anchoBarra = Math.max(2, Math.round(size * 0.055));
  const gap = Math.max(2, Math.round(size * 0.045));
  const alturaMax = size * 0.5;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        backgroundColor: fondo,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap,
      }}
    >
      {ONDA.map((h, i) => (
        <View
          key={i}
          style={{
            width: anchoBarra,
            height: Math.round(alturaMax * h),
            borderRadius: anchoBarra,
            backgroundColor: barra,
          }}
        />
      ))}
    </View>
  );
}
