import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { elevacion } from '../../theme/BloqueCifra';
import { conAlfa } from '../../theme/glass/conAlfa';
import { PRESS_FADE, pressableStyle } from '../../theme/glass/presion';
import { useTema } from '../../theme/ThemeProvider';

/**
 * El molde de las sub-pantallas de Ajustes (Martin 15/11), el mismo que el resto de las funciones: el título de
 * la sección AFUERA y arriba en display, y debajo UNA tarjeta blanca con sus filas separadas por una línea
 * fina. Reemplaza a las filas de vidrio sueltas (`Row`), que dejaban cada dato en su propia caja con borde.
 */
export interface GrupoFilasProps extends PropsWithChildren {
  rotulo?: string;
  /** Una línea chica debajo de la tarjeta: el porqué de algo que está adentro. */
  nota?: string;
  testID?: string;
  rotuloTestID?: string;
  notaTestID?: string;
}

export function GrupoFilas({ rotulo, nota, testID, rotuloTestID, notaTestID, children }: GrupoFilasProps) {
  const tema = useTema();
  return (
    <View style={styles.grupo}>
      {rotulo != null && (
        <Text
          testID={rotuloTestID}
          accessibilityRole="header"
          style={{ color: tema.color.texto, fontFamily: tema.fuente.display, fontSize: tema.tipo.grande, paddingHorizontal: 4 }}
        >
          {rotulo}
        </Text>
      )}
      <View testID={testID} style={[styles.tarjeta, elevacion(tema.color.sombra), { backgroundColor: tema.color.superficie }]}>
        {children}
      </View>
      {nota != null && (
        <Text testID={notaTestID} style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, lineHeight: 18, paddingHorizontal: 4 }}>
          {nota}
        </Text>
      )}
    </View>
  );
}

export interface FilaGrupoProps extends PropsWithChildren {
  /** La primera fila de la tarjeta no lleva línea arriba. */
  primera?: boolean;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
}

export function FilaGrupo({ primera = false, onPress, testID, accessibilityLabel, children }: FilaGrupoProps) {
  const tema = useTema();
  const borde = primera ? null : { borderTopWidth: 1, borderTopColor: conAlfa(tema.color.texto, 0.12) };
  if (onPress == null) {
    return (
      <View testID={testID} accessibilityLabel={accessibilityLabel} style={[styles.fila, borde]}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={pressableStyle([styles.fila, borde], PRESS_FADE)}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grupo: { gap: 10 },
  tarjeta: { borderRadius: 22, paddingHorizontal: 16 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 14 },
});
