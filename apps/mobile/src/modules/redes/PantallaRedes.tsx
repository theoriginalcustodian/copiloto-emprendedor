import { StyleSheet, Text, View } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaRedes` — Redes Sociales. Pantalla cascarón para publicar y programar contenido
 * en Instagram y otras redes desde el chat.
 *
 * Diseño: título + descripción de una línea + marca visual de "próximamente".
 */
export function PantallaRedes() {
  const tema = useTema();

  return (
    <View
      testID="pantalla-redes"
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
        Redes Sociales
      </Text>
      <Text
        testID="redes-descripcion"
        style={{
          color: tema.color.textoTenue,
          fontSize: tema.tipo.base,
        }}
      >
        Publicar y programar contenido en Instagram y otras redes desde el chat.
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
