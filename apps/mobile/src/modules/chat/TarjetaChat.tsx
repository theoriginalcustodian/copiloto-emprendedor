import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { elevacion } from '../../theme/BloqueCifra';
import { useTema } from '../../theme/ThemeProvider';

/**
 * La superficie de una card del hilo (Martin 14/11): blanca, sin borde, con la elevación suave del sistema
 * (`CLAUDE.md` §5) — la misma de las casillas de «Tus funciones». Reemplaza al `Tile` de vidrio en el chat, que
 * traía borde, degradé y una sombra marcada: con varias cards seguidas el hilo se leía como una pila de cajas.
 */
export function TarjetaChat({
  children,
  testID,
  style,
}: PropsWithChildren<{ testID?: string; /** Lo propio de una card: el borde de alerta del gate irreversible. */ style?: StyleProp<ViewStyle> }>) {
  const tema = useTema();
  return (
    <View
      testID={testID}
      style={[estilos.raiz, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }, style]}
    >
      {children}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { borderRadius: 22, paddingVertical: 18, paddingHorizontal: 18 },
});
