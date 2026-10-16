import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { deleteAsync } from 'expo-file-system/legacy';
import type { FlatList } from 'react-native-gesture-handler';

import {
  avisoErrorTranscripcion,
  formatearDuracion,
  transcribir,
  type ArchivoSubida,
  type ContextoTranscripcion,
} from '@copiloto/core';

import { Onda } from '../captura/Onda';
import { BotonVoz } from '../chat/BotonVoz';
import { ControlesFlotantes } from '../chat/ControlesFlotantes';
import { BarraSostenida, PistasGestoVoz } from '../chat/PistasVoz';
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
  /** Lo que va ANTES del mic en la fila (la foto, en Gastos). Queda siempre montado: con la grabación
   *  fijada sólo se esconde, para no perder el estado de quien lo recibe. */
  antes?: ReactNode;
  /** Lo que va DESPUÉS del mic: el botón de alta («Anotar un gasto»…). Mientras se sostiene el mic lo
   *  reemplaza la barra de grabación en su misma ranura; fijado, se esconde igual que `antes`. */
  alLado?: ReactNode;
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
 *
 * 🔴 **Es la FILA entera del dictado, no sólo el botón** (N8, relevamiento 2026-10-16). Antes era una
 * columna angosta DENTRO de la fila de la pantalla, y la barra de grabación y los controles fijados
 * crecían dentro de ella: el ancho de la columna se lo comía el reloj + «Deslizá para cancelar» y le
 * dejaba al botón de alta ~38 dp (se leía «An·o·tar·un·ga·sto»), el reloj pisaba al chevron, y al fijar
 * los controles quedaban flotando a media pantalla con una onda de ~20 dp. Ahora la fila se transforma
 * como el composer del prototipo (`.rec`, `index.html:182-201`) y del chat (`ChatView`):
 *
 *  - reposo:    `[antes] [mic] [alLado]`
 *  - sostenido: `[antes] [mic] [barra: ● 0:07 ‹ Deslizá para cancelar]` — la barra ocupa la ranura de `alLado`
 *  - fijado:    los controles ocupan TODA la fila (`antes`/`alLado` quedan escondidos, no desmontados)
 *
 * La onda y el candado flotan ENCIMA del mic (absolutos): no empujan nada. Antes, al empezar a grabar, el
 * botón bajaba ~130 dp bajo el dedo porque esas dos piezas se sumaban a su columna.
 */
export function MicFuncion({ onTranscripcion, contexto, disabled, onError, scrollRef, antes, alLado }: MicFuncionProps) {
  const tema = useTema();
  const voz = useVozComando();
  const [fijado, setFijado] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [cerca, setCerca] = useState(false);
  // Duración del último dictado transcripto con éxito — alimenta el chip «Por voz · m:ss» (DoD FE1 #5).
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

  // Igual que `ChatView`: la onda corre sólo grabando; en pausa va el texto «En pausa» (WCAG 1.4.1).
  const ondaVisible = voz.fase === 'grabando';
  const pistasVisibles = voz.fase === 'grabando' || cancelando;
  // Sostenido = el dedo sigue abajo (grabando o con la cancelación armada) y todavía no se fijó.
  const sostenido = !fijado && pistasVisibles;

  return (
    <View testID="mic-funcion" style={estilos.fila}>
      <View style={[estilos.grupo, fijado && estilos.oculto]}>
        {antes}

        <View style={estilos.columnaMic}>
          {/* Flota ENCIMA del mic (absoluta): ni la onda ni el candado cambian el alto de la fila, así que el botón
              no se mueve bajo el dedo. `elevation`: sin ella el bloque oscuro de arriba (que tiene elevación) se
              dibuja sobre esto en Android aunque venga antes en el árbol. */}
          {!fijado && (ondaVisible || pistasVisibles) && (
            <View style={estilos.sobreElMic} pointerEvents="none">
              {ondaVisible && (
                <View style={estilos.ondaFlotante}>
                  <Onda niveles={voz.niveles} />
                </View>
              )}
              {pistasVisibles && <PistasGestoVoz cancelando={cancelando} cerca={cerca} />}
            </View>
          )}

          {!fijado && (
            <BotonVoz
              onIniciar={alIniciarVoz}
              onSoltarSinFijar={onSoltarSinFijarVoz}
              onFijar={onFijarVoz}
              onCancelar={onCancelarVoz}
              onCancelando={setCancelando}
              onCerca={setCerca}
              disabled={disabled || voz.fase !== 'inactivo'}
              scrollRef={scrollRef}
            />
          )}

          {/* Chip «Por voz · m:ss» (DoD FE1 #5, BL-J7 H-17) — confirma la duración del dictado que acaba
              de rellenar el campo. Sólo aparece con el gesto en reposo: mientras graba/fijado, la Onda
              y los controles ya ocupan ese lugar. */}
          {ultimaDuracionSeg !== null && !fijado && voz.fase === 'inactivo' && (
            <Text testID="mic-funcion-chip" style={[estilos.chip, { color: tema.color.textoTenue }]}>
              {`Por voz · ${formatearDuracion(ultimaDuracionSeg)}`}
            </Text>
          )}
        </View>

        {/* G3: punto + reloj + «deslizá para cancelar» en la ranura del botón de alta, no flotando junto al mic. */}
        {sostenido ? (
          <View style={estilos.ranura}>
            <BarraSostenida segundos={voz.segundos} cancelando={cancelando} style={estilos.barraEnLaRanura} />
          </View>
        ) : (
          alLado != null && <View style={estilos.ranura}>{alLado}</View>
        )}
      </View>

      {fijado && (
        <View testID="mic-funcion-fijado" style={estilos.controles}>
          <ControlesFlotantes
            fase={voz.fase}
            segundos={voz.segundos}
            niveles={voz.niveles}
            alPausar={voz.pausar}
            alReanudar={voz.reanudar}
            alEnviar={() => void alTranscribir()}
            alEliminar={() => void voz.descartar()}
          />
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { alignSelf: 'stretch' },
  // `gap: 10`: el mismo que tenía la fila de cada pantalla (`filaConMic`), que ahora vive acá.
  grupo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // `display:'none'` y no desmontar: lo que llega por `antes`/`alLado` conserva su estado (mismo criterio
  // que el composer del chat mientras se graba, `ChatView`).
  oculto: { display: 'none' },
  // `position: 'relative'` es el default; la columna mide lo que mide el botón (+ el chip), nada más.
  columnaMic: { alignItems: 'center' },
  sobreElMic: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
    elevation: 8,
    zIndex: 8,
  },
  ondaFlotante: { width: '100%' },
  ranura: { flex: 1, minWidth: 0 },
  // Sin los 16 dp laterales ni el `paddingBottom` que alinean la barra con el composer del chat: la ranura ya
  // está dentro del margen de la fila.
  barraEnLaRanura: { paddingHorizontal: 0, paddingBottom: 0 },
  controles: { alignSelf: 'stretch' },
  chip: { fontSize: 12, marginTop: 4 },
});
