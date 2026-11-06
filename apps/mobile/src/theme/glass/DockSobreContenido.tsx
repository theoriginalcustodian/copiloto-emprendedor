/**
 * `DockSobreContenido` — el envoltorio del dock de una FUNCIÓN, para que se vea como el del chat (SM-P5).
 *
 * El chat y Mi día montan el dock flotante: el contenido corre por DEBAJO del campo y se difumina bajo el scrim. Las
 * funciones lo montaban en flujo, bajo el scroll: el contenido terminaba justo encima del campo y debajo quedaba una
 * franja lisa de `fondo` — lo que el operador lee como «fondo alrededor del campo, que corta la card».
 *
 * Acá el dock sigue en flujo (el teclado y el layout de la pantalla no cambian) pero su huella es CERO: `marginTop`
 * negativo igual a su alto medido. El scroll de arriba llega hasta el borde inferior de la pantalla y la lista pasa
 * por debajo de TODO el dock (campo incluido), igual que en el chat. El `ScrimDock` es el mismo.
 *
 * Un solo lugar: lo consumen `DockFuncion` y Soporte. Cada pantalla debe dejar `paddingBottom` en su scroll para que
 * el último ítem pueda subir por encima del dock.
 */
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ScrimDock } from './ScrimDock';

/** Cuánto del contenido queda bajo el scrim ARRIBA del campo. Mismo orden que `ALTO_SCRIM_ARRIBA` del chat. */
export const ALTO_SOLAPE = 28;

export function DockSobreContenido({ children, testID }: { children: ReactNode; testID?: string }) {
  // Alto medido de la caja (solape + campo + avisos): la huella en el flujo es cero → el scroll de arriba llena la pantalla.
  const [alto, setAlto] = useState(0);
  return (
    <View
      testID={testID}
      pointerEvents="box-none"
      style={[styles.caja, { marginTop: -(alto > 0 ? alto : ALTO_SOLAPE) }]}
      onLayout={(e) => setAlto(Math.round(e.nativeEvent.layout.height))}
    >
      <ScrimDock testID={testID === undefined ? undefined : `${testID}-scrim`} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  caja: { paddingTop: ALTO_SOLAPE },
});
