import { StyleSheet, Text, View } from 'react-native';

import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import type { NombreIconoGlass } from '../../theme/glass/icons';
import { useTema } from '../../theme/ThemeProvider';

export interface PantallaAndamiajeProps {
  titulo: string;
  /** Mismo glifo que el tile de entrada en el grid de Ajustes -- ver docstring de `MarcoGlass`. */
  icono: NombreIconoGlass;
  /** Qué va a vivir acá y por qué todavía no. Texto explícito, nunca un dato de mentira -- ver
   * docstring del módulo. */
  mensaje: string;
  testID?: string;
}

/**
 * Andamiaje HONESTO para las pantallas de Ajustes que todavía no tienen una fuente de datos real
 * (Datos personales, Planes disponibles, Plan actual): *"si no sabés qué va, poné un vacío
 * explícito"*. Un placeholder que PARECE datos reales (un plan inventado, un precio de mentira) es
 * peor que uno que se declara placeholder: el primero puede terminar citado como si fuera cierto.
 *
 * Un solo componente para las 3 pantallas (en vez de triplicar el mismo JSX) -- lo único que cambia
 * entre ellas es texto, no comportamiento. Estructura + navegación las trae `MarcoGlass` (título,
 * ícono, gesto de volver); acá sólo va el estado vacío que dice EXACTAMENTE qué falta, en vez de
 * simular contenido.
 */
export function PantallaAndamiaje({ titulo, icono, mensaje, testID }: PantallaAndamiajeProps) {
  const tema = useTema();

  return (
    <MarcoGlass titulo={titulo} icono={icono} testID={testID}>
      <View style={[styles.contenedor, { padding: tema.espacio.md, gap: tema.espacio.sm }]}>
        <Text
          testID="andamiaje-vacio"
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.base }}
        >
          {mensaje}
        </Text>
      </View>
    </MarcoGlass>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1 },
});
