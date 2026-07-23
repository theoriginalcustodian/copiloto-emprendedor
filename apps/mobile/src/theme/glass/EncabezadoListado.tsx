import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { useTema } from '../ThemeProvider';
import { PRESS_FADE } from './presion';

/**
 * `EncabezadoListado` — el rótulo de un listado, **tapeable → entra a su función** (`addendum_mi-dia`
 * §3). Reemplaza al texto chico y muerto ("ACTIVIDAD RECIENTE") por un encabezado accionable con una
 * flecha que comunica "esto se toca para entrar".
 *
 * 🔴 **Tipografía = el token del LABEL DE TILE, no inventada.** El addendum es explícito: *"la misma
 * letra/tamaño que la palabra de 'función' del glass principal — los labels de los tiles del escritorio
 * son la referencia exacta, reusá ese token tipográfico, no inventes tamaño"*. Por eso `uiSemibold` al
 * tamaño del label del tile (`EscritorioFunciones.labelTile`), y NO un tamaño de header inventado — más
 * grande que el mono chico anterior, con la misma letra que los tiles.
 *
 * 🔴 **La flecha (chevron `›`) es la afordancia, no decoración.** El operador dejó la forma abierta
 * ("no sé si la flecha u otra cosa"); el chevron es el mismo glifo que ya usa la solapa "hay más a la
 * derecha" del grid (`EscritorioFunciones`), así que no introduce un símbolo nuevo. Sólo aparece si el
 * encabezado ES tapeable — un `›` sin destino mentiría igual que una fila que se toca y no hace nada.
 *
 * Reusable a propósito: lo consumen el centro del principal y, cuando exista, cada título de función del
 * panel del swipe-left — un solo componente para que los dos lean igual.
 */

export interface EncabezadoListadoProps {
  titulo: string;
  /** Ausente = no tapeable: se muestra el título sin flecha ni rol de botón. */
  onPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}

/** El tamaño del label del tile (`EscritorioFunciones.labelTile.fontSize`). Un solo número, acá, para
 *  que el día que cambie el token del tile este encabezado lo siga sin re-inventarlo. */
const TAM_LABEL_TILE = 11.5;

export function EncabezadoListado({ titulo, onPress, style, testID }: EncabezadoListadoProps) {
  const tema = useTema();
  const tapeable = onPress != null;

  return (
    <Pressable
      testID={testID}
      accessibilityRole={tapeable ? 'button' : undefined}
      // El nombre del control dice que se ENTRA, no sólo el título — para el lector de pantalla un
      // encabezado tapeable y un texto muerto no pueden llamarse igual.
      accessibilityLabel={tapeable ? `${titulo}, entrar` : titulo}
      onPress={onPress}
      disabled={!tapeable}
      style={({ pressed }) => [styles.raiz, pressed && tapeable ? PRESS_FADE : null, style]}
    >
      <Text style={[styles.titulo, { color: tema.color.texto, fontFamily: tema.fuente.uiSemibold }]}>
        {titulo}
      </Text>
      {tapeable && (
        <Text
          testID={testID != null ? `${testID}-flecha` : undefined}
          style={[styles.flecha, { color: tema.color.acento }]}
        >
          ›
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  raiz: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titulo: { fontSize: TAM_LABEL_TILE },
  flecha: { fontSize: 16, lineHeight: 16, marginTop: -1 },
});
