import { StyleSheet, Text, View } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaFacturacion` — Facturación. Pantalla cascarón para emitir facturas electrónicas
 * AFIP y compartirlas, sin salir del chat.
 *
 * Diseño: título + descripción de una línea + marca visual de "próximamente".
 */
export function PantallaFacturacion() {
  const tema = useTema();

  return (
    <View
      testID="pantalla-facturacion"
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
        Facturación
      </Text>
      <Text
        testID="facturacion-descripcion"
        style={{
          color: tema.color.textoTenue,
          fontSize: tema.tipo.base,
        }}
      >
        Emitir facturas electrónicas AFIP y compartirlas, sin salir del chat.
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
