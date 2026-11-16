import { StyleSheet, Text } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Svg, { Path } from 'react-native-svg';

import { COLOR_SOBRE_WHATSAPP, COLOR_WHATSAPP, GLIFO_WHATSAPP } from '../modules/apps/logosMarca';
import { pressableStyle } from './glass/presion';
import { useTema } from './ThemeProvider';

/**
 * «Compartilo por WhatsApp» (Martin 14/11): con el verde y el glifo de WhatsApp, texto e ícono en blanco. Es el
 * único botón de la app que no sale de la paleta, a propósito: se reconoce por la marca antes de leerlo.
 *
 * Abre la hoja de compartir del teléfono —Odobi no manda por WhatsApp ni necesita el número del cliente—; qué
 * comparte lo decide quien lo usa.
 */
export interface BotonWhatsAppProps {
  onPress: () => void;
  etiqueta?: string;
  testID?: string;
}

export function BotonWhatsApp({ onPress, etiqueta = 'Compartilo por WhatsApp', testID }: BotonWhatsAppProps) {
  const tema = useTema();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      onPress={onPress}
      style={pressableStyle([estilos.boton, { backgroundColor: COLOR_WHATSAPP }])}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Path d={GLIFO_WHATSAPP} fill={COLOR_SOBRE_WHATSAPP} />
      </Svg>
      <Text numberOfLines={1} style={{ color: COLOR_SOBRE_WHATSAPP, fontFamily: tema.fuente.uiMedium, fontSize: 15 }}>
        {etiqueta}
      </Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  boton: {
    minHeight: 44,
    borderRadius: 999,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
