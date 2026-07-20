import { StyleSheet, Text, View } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaMetricas` — cascarón de Métricas.
 *
 * 🔴 Sin fondo ni título propios: se monta dentro de `CapaFuncion`, que ya aporta el vidrio y el
 * encabezado. Un fondo acá dejaría opaco el vidrio; un título, duplicado. La capa aporta el chrome,
 * la pantalla aporta el contenido.
 */
export function PantallaMetricas() {
  const tema = useTema();

  return (
    <View
      testID="pantalla-metricas"
      style={[styles.contenedor, { padding: tema.espacio.lg, gap: tema.espacio.sm }]}
    >
      <Text
        testID="metricas-descripcion"
        style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22 }}
      >
        Ventas, cobros y actividad del negocio, resumidos por el copiloto.
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
