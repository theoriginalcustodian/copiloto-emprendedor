import { StyleSheet, Text, View } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';

/**
 * `PantallaInteligencia` — cascarón de Inteligencia de Negocio (ex «Métricas»).
 *
 * 🔴 Trae su propio `MarcoGlass` (2026-07-21, convergencia con documed): antes se montaba dentro de
 * `CapaFuncion`, la capa `absoluteFill` inventada por este repo que en device se comía los toques
 * (ver `coordinacion/2026-07-20_handoff_fixes-gestos-glass-mobile.md`). `CapaFuncion` se borró; el
 * chrome (vidrio, handle, ícono, título, "Volver") ahora lo aporta `MarcoGlass`, uno por pantalla.
 *
 * El ícono/título son los MISMOS que el tile de entrada en `EscritorioFunciones`
 * (`inteligencia`→`chart`): entrar por un ícono y llegar a otro desorienta.
 *
 * 🔴 **Es un cascarón A PROPÓSITO, y lo dice.** El contenido real —portada, tres gráficos y chat sobre
 * el grafo de negocio— llega en el hito 6 de su propio sprint. Un cascarón que se anuncia es honesto;
 * uno que simula funcionar es el que enseña que la app no anda.
 *
 * El contenido propio SIGUE sin fondo — `MarcoGlass` ya aporta el vidrio, un `backgroundColor` acá
 * lo dejaría opaco.
 */
export function PantallaInteligencia() {
  const tema = useTema();

  return (
    <MarcoGlass titulo="Inteligencia de Negocio" icono="chart" testID="pantalla-inteligencia">
      <View
        testID="inteligencia-contenido"
        style={[styles.contenedor, { padding: tema.espacio.lg, gap: tema.espacio.sm }]}
      >
        <Text
          testID="inteligencia-descripcion"
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22 }}
        >
          Ventas, cobros y actividad del negocio, resumidos por el copiloto.
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
