import { StyleSheet, Text, View } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';

/**
 * `PantallaRedes` — cascarón de Redes Sociales.
 *
 * 🔴 **Sin fondo propio y sin título propio, a propósito.** Esta pantalla se monta DENTRO de
 * `CapaFuncion`, que ya aporta el vidrio y el encabezado (ícono + nombre + Cerrar). Un
 * `backgroundColor` acá taparía el vidrio —dejándolo opaco justo donde el diseño quiere
 * translucidez— y un `<Text>` con el nombre lo duplicaría en pantalla.
 *
 * La regla del boundary: **la capa aporta el chrome, la pantalla aporta el contenido.**
 * Se descubrió al integrar: los cascarones nacieron como pantallas autónomas y traían las dos cosas.
 */
export function PantallaRedes() {
  const tema = useTema();

  return (
    <View
      testID="pantalla-redes"
      style={[styles.contenedor, { padding: tema.espacio.lg, gap: tema.espacio.sm }]}
    >
      <Text
        testID="redes-descripcion"
        style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22 }}
      >
        Publicar y programar contenido en Instagram y otras redes desde el chat.
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
