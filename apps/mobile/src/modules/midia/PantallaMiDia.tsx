import { StyleSheet, Text, View } from 'react-native';

import { useTema } from '../../theme/ThemeProvider';
import { MarcoGlass } from '../../theme/glass/MarcoGlass';

/**
 * `PantallaMiDia` — cascarón de «Mi día».
 *
 * 🔴 **Es un cascarón A PROPÓSITO, y lo dice en pantalla.** El contenido real —el Kanban de la mañana
 * y el detector proactivo que lo llena— llega en el hito 7 de su sprint, con contrato propio.
 *
 * Un tile que abre una pantalla **en blanco** le enseña al emprendedor que hay funciones que no andan,
 * y esa lección después se la aplica a las que sí andan: es la misma familia del catálogo de papel de
 * Apps. Un cascarón que **se anuncia** no tiene ese costo — dice qué va a ser y no simula nada.
 *
 * Módulo propio desde el día 0 en vez de reusar `PantallaAndamiaje` de Ajustes: esto va a crecer hasta
 * ser una función entera, y su lugar en el repo ya es éste. El ícono/título son los MISMOS que el tile
 * de entrada (`midia`→`clock`) — entrar por un glifo y llegar a otro desorienta.
 */
export function PantallaMiDia() {
  const tema = useTema();

  return (
    <MarcoGlass titulo="Mi día" icono="clock" testID="pantalla-midia">
      <View
        testID="midia-contenido"
        style={[styles.contenedor, { padding: tema.espacio.lg, gap: tema.espacio.sm }]}
      >
        <Text
          testID="midia-descripcion"
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base, lineHeight: 22 }}
        >
          Lo que tenés que hacer hoy, en tarjetas: presupuestos por seguir, facturas por cobrar y lo
          que el copiloto detecte solo.
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
