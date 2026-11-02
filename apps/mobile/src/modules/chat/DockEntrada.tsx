import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { FlatList } from 'react-native-gesture-handler';

import type { ArchivoSubida, MotivoFallo, SendStatus } from '@copiloto/core';

import { Onda } from '../captura/Onda';
import { BotonVoz } from './BotonVoz';
import { Composer } from './Composer';
import { ControlesFlotantes } from './ControlesFlotantes';
import { BarraSostenida, PistasGestoVoz } from './PistasVoz';
import { useVozComando } from './useVozComando';

export interface DockEntradaProps {
  /** Sin él, la invitación del chat general (la de `Composer`). */
  placeholder?: string;
  sendStatus?: SendStatus;
  motivoFallo?: MotivoFallo | null;
  onEnviarTexto: (texto: string) => void;
  /** Lo grabado, ya cortado. Se llama UNA vez por captura, por soltar sin fijar o por «Enviar». */
  onAudio: (audio: ArchivoSubida, duracionSeg: number) => void;
  /** Permiso de micrófono denegado. Sin él, el `Alert` del chat: un toque sin efecto se lee como roto. */
  onSinPermiso?: () => void;
  onFoto?: () => void;
  semilla?: { texto: string; id: number } | null;
  disabled?: boolean;
  /** El scroll que queda encima del dock, con el que arbitra el gesto del mic. Ver `BotonVoz`. */
  scrollRef?: React.RefObject<FlatList | null>;
  /** Ver `Composer.onTocarCampo`. */
  onTocarCampo?: () => void;
}

/**
 * SM-I2 — el dock del mapa: campo + mic chico al pie (`.inputbar`, `index.html:165-173`). Extraído de lo
 * que `ChatView` y `PantallaSoporte` tenían copiado: máquina de voz, fijado, cancelar, onda y candado. El
 * botón grande que flotaba sobre la lista ya no existe (D2).
 *
 * Los tres estados de la barra, con el mic siempre en el mismo lugar (`index.html:176-180`: «el pulgar
 * nunca tiene que reubicarse entre empezar y enviar»):
 *
 *  - reposo:    `[campo] [mic]`, y con texto escrito el mic cede su lugar al avión
 *  - sostenido: `[barra: ● 0:07 ‹ Deslizá para cancelar] [mic]` — la barra reemplaza al campo a ancho completo
 *  - fijado:    los controles ocupan toda la fila; se termina por Enviar o Eliminar, nunca soltando
 *
 * La onda y el candado flotan ENCIMA del dock (absolutos): no empujan nada, así el mic no se mueve bajo el dedo.
 *
 * 🔴 **`vozRef` y los callbacks estables no son estilo.** `voz` es un objeto nuevo ~10 veces por segundo
 * mientras se graba; si los callbacks dependieran de él, el `useMemo` del gesto se invalidaría en pleno
 * vuelo. Es el bug de device de ODOBI8-C, ver `BotonVoz.tsx`.
 */
export function DockEntrada({
  placeholder,
  sendStatus = 'idle',
  motivoFallo = null,
  onEnviarTexto,
  onAudio,
  onSinPermiso,
  onFoto,
  semilla = null,
  disabled = false,
  scrollRef,
  onTocarCampo,
}: DockEntradaProps) {
  const voz = useVozComando();
  const [fijado, setFijado] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cerca, setCerca] = useState(false);

  const vozRef = useRef(voz);
  vozRef.current = voz;
  const onAudioRef = useRef(onAudio);
  onAudioRef.current = onAudio;
  const onSinPermisoRef = useRef(onSinPermiso);
  onSinPermisoRef.current = onSinPermiso;

  // Al volver a `inactivo` la puerta de `fijado` se reabre: sin esto, la SEGUNDA grabación de la sesión
  // arrancaría ya «fijada» sin que nadie haya deslizado nada.
  useEffect(() => {
    if (voz.fase === 'inactivo') setFijado(false);
  }, [voz.fase]);

  // Mide el dictado para el chip «Por voz · m:ss». No es `voz.segundos`: ese se resetea dentro de `tomar()`.
  const inicioMsRef = useRef(0);
  const alIniciarVoz = useCallback(() => {
    inicioMsRef.current = Date.now();
    void (async () => {
      const ok = await vozRef.current.iniciar();
      if (ok) return;
      if (onSinPermisoRef.current != null) onSinPermisoRef.current();
      else {
        Alert.alert(
          'Sin acceso al micrófono',
          'Activá el permiso de micrófono en Ajustes para dictarle al copiloto por voz.',
        );
      }
    })();
  }, []);

  /** Un solo lugar decide qué es «mandar el audio»: soltar sin fijar y el «Enviar» de los controles. */
  const alEnviarVoz = useCallback(async () => {
    const actual = vozRef.current;
    if (actual.fase === 'grabando' || actual.fase === 'pausado') {
      await actual.detener();
    }
    const audio = actual.tomar();
    if (audio === null) return; // no llegó a grabar nada
    onAudioRef.current(audio, Math.max(1, Math.round((Date.now() - inicioMsRef.current) / 1000)));
  }, []);

  const onSoltarSinFijarVoz = useCallback(() => void alEnviarVoz(), [alEnviarVoz]);
  const onFijarVoz = useCallback(() => setFijado(true), []);
  // BL-D2: deslizar a la izquierda / toque corto descarta lo grabado sin enviarlo.
  const onCancelarVoz = useCallback(() => void vozRef.current.descartar(), []);

  // La onda sólo corre mientras graba: en pausa la reemplaza el texto «En pausa» (WCAG 1.4.1).
  const ondaVisible = voz.fase === 'grabando';
  const pistasVisibles = voz.fase === 'grabando' || cancelando;
  const enCaptura = voz.fase !== 'inactivo';

  return (
    <View testID="dock-entrada">
      {!fijado && (ondaVisible || pistasVisibles) && (
        <View style={styles.sobreElDock} pointerEvents="none">
          {ondaVisible && (
            <View testID="onda-flotante" style={styles.ondaFlotante}>
              <Onda niveles={voz.niveles} />
            </View>
          )}
          {pistasVisibles && (
            <View style={styles.candadoSobreElMic}>
              <PistasGestoVoz cancelando={cancelando} cerca={cerca} />
            </View>
          )}
        </View>
      )}

      {fijado && (
        <ControlesFlotantes
          fase={voz.fase}
          segundos={voz.segundos}
          niveles={voz.niveles}
          alPausar={voz.pausar}
          alReanudar={voz.reanudar}
          alEnviar={() => void alEnviarVoz()}
          alEliminar={() => void voz.descartar()}
        />
      )}

      {/* Siempre montado: oculto (no desmontado) para no perder el borrador de quien eligió dictar. */}
      <View testID="dock-entrada-composer" style={fijado ? styles.oculto : undefined}>
        <Composer
          placeholder={placeholder}
          motivoFallo={motivoFallo}
          sendStatus={sendStatus}
          onSend={onEnviarTexto}
          disabled={disabled}
          onFoto={onFoto}
          semilla={semilla}
          onTocarCampo={onTocarCampo}
          enLugarDelCampo={
            enCaptura && !fijado ? (
              <BarraSostenida segundos={voz.segundos} cancelando={cancelando} style={styles.barraEnElCampo} />
            ) : null
          }
          mic={
            fijado ? null : (
              <BotonVoz
                onIniciar={alIniciarVoz}
                onSoltarSinFijar={onSoltarSinFijarVoz}
                onFijar={onFijarVoz}
                onCancelar={onCancelarVoz}
                onCancelando={setCancelando}
                onCerca={setCerca}
                disabled={disabled}
                capturando={enCaptura}
                scrollRef={scrollRef}
              />
            )
          }
        />
      </View>
    </View>
  );
}

/** Sangría de `Composer` más media diferencia entre el mic (52) y el candado (~60): quedan alineados. */
const MARGEN_CANDADO = 14;

const styles = StyleSheet.create({
  // `elevation`: sin ella, lo que tenga elevación arriba del dock se dibuja encima en Android aunque
  // venga antes en el árbol (medido en N8, `MicFuncion`).
  sobreElDock: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    gap: 8,
    elevation: 8,
    zIndex: 8,
  },
  ondaFlotante: { width: '100%', paddingHorizontal: 24 },
  candadoSobreElMic: { alignSelf: 'flex-end', marginRight: MARGEN_CANDADO },
  // Dentro de la fila del composer: ocupa el lugar del campo, sin el margen que traía como fila propia.
  barraEnElCampo: { flex: 1, alignSelf: 'auto', minWidth: 0, paddingHorizontal: 8, paddingBottom: 0 },
  // `display:'none'` y no `opacity:0`: los controles ya ocupan el lugar de la fila.
  oculto: { display: 'none' },
});
