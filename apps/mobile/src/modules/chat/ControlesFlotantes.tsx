import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import type { FaseVoz } from './useVozComando';
import { BotonDescartar, BotonGhost, BotonPrimario, filaControles } from '../captura/HudGrabacion';

export interface ControlesFlotantesProps {
  fase: FaseVoz;
  alPausar: () => void;
  alReanudar: () => void;
  /** Corta (si todavía graba) y envía, en un solo toque. Ver `alEnviarVoz` en `ChatView`. */
  alEnviar: () => void;
  alEliminar: () => void;
}

/**
 * Los controles de la grabación FIJADA: `Pausar`/`Reanudar` · `Enviar` · `Eliminar`, **flotantes,
 * sin glass** — contrato `dictado-por-voz-sin-glass...` §1/§3. Reemplaza a `GlassGrabacionCopiloto`
 * (eliminado): mismos botones (`BotonGhost`/`BotonPrimario`/`BotonDescartar`, de
 * `modules/captura/HudGrabacion.tsx` — no se reinventan), pero SIN el `MarcoGlass`/`HudGrabacion` que
 * los envolvía, y SIN cronómetro (el contrato lo saca explícitamente: el único feedback es la onda).
 *
 * Se monta sólo cuando la grabación está `fijado` (deslizada hacia arriba) — `ChatView` es quien
 * decide cuándo, este componente es presentación pura sobre `fase`.
 *
 * 🔴 **Sin `Pausar` en `listo`.** Con `fase === 'listo'` el grabador ya se cortó (transitorio: sólo
 * ocurre un instante mientras `alEnviarVoz` corta y manda) — no hay nada que pausar, sólo Enviar o
 * Eliminar, igual que el HUD que reemplaza.
 */
export function ControlesFlotantes({ fase, alPausar, alReanudar, alEnviar, alEliminar }: ControlesFlotantesProps) {
  const grabando = fase === 'grabando';
  const pausado = fase === 'pausado';

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} style={styles.contenedor}>
      <View style={styles.fila}>
        {grabando && <BotonGhost id="voz-pausar" texto="Pausar" onPress={alPausar} />}
        {pausado && <BotonGhost id="voz-reanudar" texto="Reanudar" onPress={alReanudar} />}
        <BotonPrimario id="voz-enviar" texto="Enviar" icono onPress={alEnviar} />
      </View>
      <BotonDescartar id="voz-eliminar" texto="Eliminar" onPress={alEliminar} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  contenedor: { gap: 12, paddingHorizontal: 16, paddingBottom: 8, alignItems: 'center' },
  fila: { ...filaControles, alignSelf: 'stretch' },
});
