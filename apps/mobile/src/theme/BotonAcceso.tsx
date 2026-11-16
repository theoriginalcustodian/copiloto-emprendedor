import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { elevacion } from './BloqueCifra';
import { Glifo } from './glass/Glifo';
import { pressableStyle } from './glass/presion';
import { useTema } from './ThemeProvider';

/**
 * `BotonAcceso` — una de las vías de alta que NO son la voz (Martin 14/11).
 *
 * En Gastos hay tres formas de cargar: decirlo, sacarle una foto al ticket y anotarlo a mano. La primera es
 * el gesto del producto y vive en el dock, con el micrófono en terracota. Las otras dos van acá, **parejas
 * entre sí y más calladas que el micrófono**: tarjeta blanca, texto negro, ícono en el acento de tinta. Antes
 * eran un chip chico («Ticket») contra un botón terracota lleno («Anotar un gasto»): el botón de anotar a mano
 * le ganaba en peso al micrófono, que es justo lo que el producto quiere enseñar, y la foto casi no se veía.
 */
/** El ícono de «anotar a mano», el mismo en todas las funciones. */
export function IconoLapiz({ color }: { color: string }) {
  return (
    <Glifo nombre="pen" size={18} color={color} />
  );
}

export interface BotonAccesoProps {
  icono: ReactNode;
  etiqueta: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function BotonAcceso({ icono, etiqueta, onPress, disabled = false, accessibilityLabel, testID }: BotonAccesoProps) {
  const tema = useTema();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? etiqueta}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={pressableStyle([
        styles.boton,
        elevacion(tema.color.sombra),
        { backgroundColor: tema.color.superficie, opacity: disabled ? 0.5 : 1 },
      ])}
    >
      {icono}
      <Text
        numberOfLines={1}
        style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.uiMedium }}
      >
        {etiqueta}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 52 de alto: por encima de los 44 de zona tocable, y más bajo que una casilla para no competir con la cifra.
  boton: {
    height: 52,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
