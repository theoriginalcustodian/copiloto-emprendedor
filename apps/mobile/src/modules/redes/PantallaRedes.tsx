import { StyleSheet, Text, View } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';

/**
 * `PantallaRedes` — cascarón de Redes Sociales.
 *
 * 🔴 Trae su propio `MarcoGlass` (2026-07-21, convergencia con documed): antes se montaba dentro de
 * `CapaFuncion`, la capa `absoluteFill` inventada por este repo que en device se comía los toques
 * (ver `coordinacion/2026-07-20_handoff_fixes-gestos-glass-mobile.md`). `CapaFuncion` se borró; el
 * chrome (vidrio, handle, ícono, título, "Volver") ahora lo aporta `MarcoGlass`, uno por pantalla,
 * igual que `PantallaAjustes`/`PantallaRecientes` ya lo hacían.
 *
 * El ícono/título son los MISMOS que el tile de entrada en `EscritorioFunciones`
 * (`redes`→`chat`, "Redes Sociales"): entrar por un ícono y llegar a otro desorienta.
 *
 * El contenido propio SIGUE sin fondo — `MarcoGlass` ya aporta el vidrio, un `backgroundColor` acá
 * lo dejaría opaco justo donde el diseño quiere translucidez.
 */
export function PantallaRedes() {
  const tema = useTema();

  return (
    <MarcoGlass titulo="Redes Sociales" icono="chat" testID="pantalla-redes">
      <View
        testID="redes-contenido"
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
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
});
