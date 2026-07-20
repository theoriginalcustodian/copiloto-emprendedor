import { StyleSheet, Text, View } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaMetricas` — Métricas. Pantalla cascarón para ver ventas, cobros y actividad
 * del negocio, resumidos por el copiloto.
 *
 * Diseño: título + descripción de una línea + marca visual de "próximamente".
 */
export function PantallaMetricas() {
  const tema = useTema();

  return (
    <View
      testID="pantalla-metricas"
      style={[
        styles.contenedor,
        {
          backgroundColor: tema.color.fondo,
          padding: tema.espacio.lg,
          gap: tema.espacio.md,
        },
      ]}
    >
      <Text
        style={[
          styles.titulo,
          {
            color: tema.color.texto,
            fontSize: tema.tipo.titulo,
          },
        ]}
      >
        Métricas
      </Text>
      <Text
        testID="metricas-descripcion"
        style={{
          color: tema.color.textoTenue,
          fontSize: tema.tipo.base,
        }}
      >
        Ventas, cobros y actividad del negocio, resumidos por el copiloto.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
  },
  titulo: {
    fontWeight: '700',
  },
});
