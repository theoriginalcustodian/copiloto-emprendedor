import { StyleSheet, Text, View } from 'react-native';

import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { Row } from '../../theme/glass/Row';
import { useTema } from '../../theme/ThemeProvider';

/**
 * Pantalla "Configuración del sistema" -- andamiaje honesto, MENOS un detalle: reserva explícitamente
 * el lugar de "No molestar".
 *
 * 🔴 **"No molestar" NO se implementa acá a propósito.** Muta un ajuste GLOBAL del teléfono
 * (`expo-notifications`/`DoNotDisturbAccessPermission` en Android, o el equivalente iOS) y necesita un
 * restaurador ante crash de la app -- si el copiloto lo prende y crashea antes de apagarlo, el
 * teléfono del emprendedor queda en silencio sin que nadie lo haya decidido. Eso es MAYOR (muta
 * estado FUERA del sandbox de la app) y se resuelve en otra tarea. Esta fila es sólo el lugar
 * reservado: sin `onPress`, no dispara nada -- un placeholder que pareciera funcionar (con un toggle
 * que no hace nada, o peor, que sólo cambia visualmente) sería un dato inventado, aplicado a una
 * acción en vez de a un dato.
 */
export function PantallaConfiguracionSistema() {
  const tema = useTema();

  return (
    <MarcoGlass titulo="Configuración del sistema" icono="settings" testID="pantalla-configuracion-sistema">
      <View style={[styles.contenedor, { padding: tema.espacio.md, gap: tema.espacio.md }]}>
        <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}>
          Acá van a vivir los ajustes generales de la app. Todavía no hay ninguno implementado más que
          el lugar reservado de abajo.
        </Text>

        {/* Sin `onPress`: fila inerte a propósito -- ver docstring del módulo. */}
        <Row testID="config-no-molestar" accessibilityLabel="No molestar (pendiente)">
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: tema.color.texto, fontSize: tema.tipo.base, fontFamily: tema.fuente.uiSemibold }}>
              No molestar
            </Text>
            <Text style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico }}>
              Pendiente -- muta un ajuste del sistema operativo, se implementa en otra tarea.
            </Text>
          </View>
          <Text
            testID="config-no-molestar-badge"
            style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, fontFamily: tema.fuente.uiSemibold }}
          >
            Pendiente
          </Text>
        </Row>
      </View>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
});
