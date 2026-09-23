import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { deleteAsync } from 'expo-file-system/legacy';
import type { FlatList } from 'react-native-gesture-handler';

import { avisoErrorTranscripcion, transcribir, type ArchivoSubida, type ContextoTranscripcion } from '@copiloto/core';

import { Onda } from '../captura/Onda';
import { AvisoCancelar } from '../chat/AvisoCancelar';
import { BotonVoz } from '../chat/BotonVoz';
import { ControlesFlotantes } from '../chat/ControlesFlotantes';
import { useVozComando } from '../chat/useVozComando';
import { useTema } from '../../theme/ThemeProvider';

export interface MicFuncionProps {
  /** A dónde va el texto. Se llama UNA sola vez por dictado, ya transcripto. */
  onTranscripcion: (texto: string) => void;
  /** Etiqueta del formulario; viaja como `contexto` a `/transcribir` (sólo logging del lado del backend). */
  contexto: ContextoTranscripcion;
  /** El formulario está ocupado (guardando, validando). */
  disabled?: boolean;
  /** Error ya traducido a texto para el usuario; el componente NO decide la copia. */
  onError?: (mensaje: string) => void;
  /** Opcional — sin él, `BotonVoz` arbitra sin ningún scroll (contrato K-10 §3, desacople #2). */
  scrollRef?: React.RefObject<FlatList | null>;
}

/** Best-effort, mismo criterio que `borrarArchivoLocal` de `useChat.ts` (política D6, cero
 * retención): nunca lanza, `datos` sólo se borra si es una URI de archivo (string) — en web sería un
 * `Blob` y este componente ni se monta ahí. */
async function borrarArchivoLocal(archivo: ArchivoSubida): Promise<void> {
  if (typeof archivo.datos !== 'string') return;
  try {
    await deleteAsync(archivo.datos, { idempotent: true });
  } catch {
    // best-effort — ver docstring.
  }
}

/**
 * BL-J7 / K-10 — el mic DENTRO de un formulario (Gastos/Ingresos/Presupuestos/Clientes), fuera del
 * chat. Envuelve `BotonVoz` + `useVozComando` (mismo gesto/máquina que `ChatView`, sin reescribirlos)
 * pero en vez de `enviarAudio` (que dispara `/chat/audio` y el agente), llama `transcribir` (K-10,
 * sin sesión, sin despacho) y devuelve el texto — no escribe nada, no guarda nada.
 *
 * Trae adentro lo que en `ChatView` vivía afuera (contrato K-10 §3, desacoples #3/#4): el estado
 * `fijado` y el `vozRef` — espejo síncrono de `voz` para que el `useMemo` del gesto de `BotonVoz` no
 * se invalide ~10 Hz mientras graba (bug de device ya pagado, ver `BotonVoz.tsx`). Quien monta este
 * componente no re-implementa nada de esto.
 */
export function MicFuncion({ onTranscripcion, contexto, disabled, onError, scrollRef }: MicFuncionProps) {
  const tema = useTema();
  const voz = useVozComando();
  const [fijado, setFijado] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  // Duración del último dictado transcripto con éxito — alimenta el chip «Por voz · Ns» (DoD FE1 #5).
  // `null` mientras no hubo ningún dictado todavía, o mientras uno nuevo está en curso.
  const [ultimaDuracionSeg, setUltimaDuracionSeg] = useState<number | null>(null);
  // Instante en que arrancó el gesto (mismo criterio que `MicFuncion` web): medido acá en vez de
  // leer `voz.segundos` porque ese estado se resetea a 0 dentro de `tomar()` antes de que el efecto
  // de este componente pueda leerlo — más simple medir el propio arranque a corte.
  const inicioMsRef = useRef(0);

  const vozRef = useRef(voz);
  vozRef.current = voz;

  useEffect(() => {
    if (voz.fase === 'inactivo') setFijado(false);
  }, [voz.fase]);

  const alIniciarVoz = () => {
    inicioMsRef.current = Date.now();
    setUltimaDuracionSeg(null);
    void (async () => {
      const ok = await vozRef.current.iniciar();
      if (!ok) onError?.('Activá el permiso de micrófono en Ajustes para dictar por voz.');
    })();
  };

  /** Corta (si graba/pausa), transcribe y borra el archivo local SIEMPRE (D6) — mismo camino para
   * "soltar sin fijar" y para el botón "Enviar" de los controles flotantes. */
  const alTranscribir = async () => {
    const actual = vozRef.current;
    if (actual.fase === 'grabando' || actual.fase === 'pausado') {
      await actual.detener();
    }
    const audio = actual.tomar();
    if (audio === null) return; // no llegó a grabar nada
    const duracionSeg = Math.max(1, Math.round((Date.now() - inicioMsRef.current) / 1000));
    try {
      const res = await transcribir(audio, contexto);
      const texto = res.transcript.trim();
      if (texto === '') {
        onError?.('No se entendió el audio. Probá de nuevo.');
        return;
      }
      onTranscripcion(texto);
      setUltimaDuracionSeg(duracionSeg);
    } catch (err) {
      onError?.(avisoErrorTranscripcion(err));
    } finally {
      await borrarArchivoLocal(audio);
    }
  };

  const onSoltarSinFijarVoz = () => void alTranscribir();
  const onFijarVoz = () => setFijado(true);
  const onCancelarVoz = () => void voz.descartar();

  const ondaVisible = voz.fase === 'grabando' || voz.fase === 'pausado';

  return (
    <View testID="mic-funcion" style={estilos.contenedor}>
      {!fijado && (
        <View style={estilos.overlayVoz}>
          {ondaVisible && (
            <View style={estilos.ondaFlotante} pointerEvents="none">
              <Onda niveles={voz.niveles} />
            </View>
          )}
          {cancelando && <AvisoCancelar />}
          <BotonVoz
            onIniciar={alIniciarVoz}
            onSoltarSinFijar={onSoltarSinFijarVoz}
            onFijar={onFijarVoz}
            onCancelar={onCancelarVoz}
            onCancelando={setCancelando}
            disabled={disabled || voz.fase !== 'inactivo'}
            scrollRef={scrollRef}
          />
        </View>
      )}

      {fijado && (
        <View testID="mic-funcion-fijado" style={estilos.overlayVoz}>
          {ondaVisible && (
            <View style={estilos.ondaFlotante} pointerEvents="none">
              <Onda niveles={voz.niveles} />
            </View>
          )}
          <ControlesFlotantes
            fase={voz.fase}
            alPausar={voz.pausar}
            alReanudar={voz.reanudar}
            alEnviar={() => void alTranscribir()}
            alEliminar={() => void voz.descartar()}
          />
        </View>
      )}

      {/* Chip «Por voz · Ns» (DoD FE1 #5, BL-J7 H-17) — confirma la duración del dictado que acaba
          de rellenar el campo. Sólo aparece con el gesto en reposo: mientras graba/fijado, la Onda
          y los controles ya ocupan ese lugar. */}
      {ultimaDuracionSeg !== null && !fijado && voz.fase === 'inactivo' && (
        <Text testID="mic-funcion-chip" style={[estilos.chip, { color: tema.color.textoTenue }]}>
          Por voz · {ultimaDuracionSeg}s
        </Text>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  contenedor: { alignItems: 'center' },
  overlayVoz: { alignItems: 'center', gap: 8 },
  chip: { fontSize: 12, marginTop: 4 },
  ondaFlotante: { width: '100%', paddingHorizontal: 24 },
});
