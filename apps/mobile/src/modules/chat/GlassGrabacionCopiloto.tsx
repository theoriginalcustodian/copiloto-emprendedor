import { StyleSheet } from 'react-native';
import Animated, { SlideInDown, SlideOutDown } from 'react-native-reanimated';

import { MarcoGlass } from '../../theme/glass/MarcoGlass';
import { BotonDescartar, BotonGhost, BotonPrimario, HudGrabacion, filaControles } from '../captura/HudGrabacion';
import type { FaseVoz } from './useVozComando';

/**
 * El glass de grabación del copiloto. Port ADAPTADO de `GlassGrabacionCopiloto.tsx` de documed: la
 * misma superficie (`MarcoGlass desnudo` -> vidrio `takeover`), mismo encabezado, mismo cronómetro,
 * misma onda, mismos botones (`HudGrabacion`, ahora en `./HudGrabacion` porque este repo no tiene
 * panel clínico con el que compartirla).
 *
 * 🔴 **Sin gesto de anclaje, y no es un recorte -- es que la premisa no existe acá.** El origen tenía
 * un botón de "mantener apretado, deslizar para fijar" (estilo WhatsApp) porque nació para permitir
 * consultas de 40 minutos sin sostener el dedo todo ese tiempo. Este sprint (D6) fijó el alcance a
 * dictado CORTO: `BotonVoz` es un toque simple que abre este HUD ya en `grabando`, y de ahí en más el
 * ciclo de vida entero (pausar/reanudar/enviar/descartar) lo manejan los botones del HUD, nunca el
 * dedo sostenido. No hay "soltar para terminar" que distinguir, así que tampoco hay `anclado` que
 * recibir -- ver el docstring de `BotonVoz.tsx` para el resto de esa decisión.
 *
 * **Botones: Pausar/Reanudar + Enviar, sin "Detener"** (mismo criterio que documed, 2026-07-20):
 * Enviar corta la grabación si hace falta y manda en un solo toque (`alEnviarVoz` en `ChatView`).
 * Pausar sigue siendo la forma de parar y poder seguir; Descartar, la única de perder el audio.
 *
 * **Por qué el subtítulo dice "Copiloto".** No hay cliente/paciente al que atribuirle nada acá: lo
 * grabado va al chat del emprendedor, no a un registro de negocio.
 *
 * **Sin salida por gesto ni "Volver"** (`desnudo`): se sale por Enviar o Descartar, y sólo por ahí --
 * mismo motivo que documed: una captura viva no puede tener una salida que la abandone sin decisión.
 */
export interface GlassGrabacionCopilotoProps {
  fase: FaseVoz;
  segundos: number;
  niveles: number[];
  alPausar: () => void;
  alReanudar: () => void;
  /** Corta (si todavía graba) y envía, en un solo toque. Ver `alEnviarVoz` en `ChatView`. */
  alEnviar: () => void;
  alDescartar: () => void;
}

export function GlassGrabacionCopiloto({
  fase,
  segundos,
  niveles,
  alPausar,
  alReanudar,
  alEnviar,
  alDescartar,
}: GlassGrabacionCopilotoProps) {
  const grabando = fase === 'grabando';
  const pausado = fase === 'pausado';
  const listo = fase === 'listo';

  const etiqueta = listo ? 'Grabación lista' : pausado ? 'En pausa' : 'Grabando…';

  return (
    <Animated.View
      entering={SlideInDown.duration(320)}
      exiting={SlideOutDown.duration(240)}
      style={StyleSheet.absoluteFill}
      testID="glass-grabacion-copiloto"
    >
      <MarcoGlass titulo="Copiloto" icono="mic" desnudo testID="copiloto-cristal">
        <HudGrabacion
          testID="hud-copiloto"
          etiqueta={etiqueta}
          activo={grabando}
          segundos={segundos}
          niveles={niveles}
          contexto="Copiloto"
        >
          {/* Pausar/Reanudar a la izquierda; Enviar SIEMPRE a la derecha (grabando, pausado y listo).
              En `listo` Enviar va solo, a lo ancho. */}
          {grabando && (
            <Animated.View style={styles.fila}>
              <BotonGhost id="copiloto-pausar" texto="Pausar" onPress={alPausar} />
              <BotonPrimario id="copiloto-enviar" texto="Enviar" icono onPress={alEnviar} />
            </Animated.View>
          )}

          {pausado && (
            <Animated.View style={styles.fila}>
              <BotonGhost id="copiloto-reanudar" texto="Reanudar" onPress={alReanudar} />
              <BotonPrimario id="copiloto-enviar-pausado" texto="Enviar" icono onPress={alEnviar} />
            </Animated.View>
          )}

          {listo && <BotonPrimario id="copiloto-enviar-listo" texto="Enviar" icono onPress={alEnviar} />}

          <BotonDescartar id="copiloto-descartar" onPress={alDescartar} />
        </HudGrabacion>
      </MarcoGlass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fila: { ...filaControles },
});
