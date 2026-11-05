/**
 * `DockSobreContenido` — el envoltorio del dock de una FUNCIÓN, para que se vea como el del chat (SM-P5).
 *
 * El chat y Mi día montan el dock flotante: el contenido corre por DEBAJO del scrim y se difumina. Las funciones lo
 * montaban en flujo, bajo el scroll, sobre una franja lisa de `fondo`: es lo que el operador leía como «fondo de color
 * alrededor del campo». Acá el dock sigue en flujo (el scroll de arriba no cambia, su teclado tampoco) pero sube
 * `ALTO_SOLAPE` px sobre el borde inferior del scroll, y el MISMO `ScrimDock` del chat va de fondo: el final del
 * contenido pasa bajo el degradé.
 *
 * Un solo lugar: el valor del solape y el scrim se definen acá y los consumen `DockFuncion` y Soporte.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScrimDock } from './ScrimDock';

/** Cuánto del scroll queda bajo el scrim. Mismo orden que `ALTO_SCRIM_ARRIBA` del chat. */
export const ALTO_SOLAPE = 28;

export function DockSobreContenido({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View testID={testID} pointerEvents="box-none" style={styles.caja}>
      <ScrimDock testID={testID === undefined ? undefined : `${testID}-scrim`} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { marginTop: -ALTO_SOLAPE, paddingTop: ALTO_SOLAPE },
});