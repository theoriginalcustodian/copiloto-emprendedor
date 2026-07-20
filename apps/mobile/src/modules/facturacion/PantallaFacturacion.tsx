import { StyleSheet, Text, View } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaFacturacion` — cascarón de Facturación.
 *
 * 🔴 Sin fondo ni título propios: se monta dentro de `CapaFuncion`, que ya aporta el vidrio y el
 * encabezado. Un fondo acá dejaría opaco el vidrio; un título, duplicado. La capa aporta el chrome,
 * la pantalla aporta el contenido.
 */
export function PantallaFacturacion() {
  const tema = useTema();

  return (
    <View
      testID="pantalla-facturacion"
      style={[styles.contenedor, { padding: tema.espacio.lg, gap: tema.espacio.sm }]}
    >
      <Text
        testID="facturacion-descripcion"
        style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22 }}
      >
        Emitir facturas electrónicas AFIP y compartirlas, sin salir del chat.
      </Text>
      <Text style={{ color: tema.color.acento, fontFamily: tema.fuente.mono, fontSize: 11, letterSpacing: 1.2 }}>
        PRÓXIMAMENTE
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
});
