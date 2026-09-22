import { useRef, useState } from 'react';

import { avisoErrorTranscripcion, transcribir, type ArchivoSubida, type ContextoTranscripcion } from '@copiloto/core';

import { MicButton } from '../chat/MicButton';
import './MicFuncion.css';

export interface MicFuncionProps {
  /** A dónde va el texto. Se llama UNA sola vez por dictado, ya transcripto. */
  onTranscripcion: (texto: string) => void;
  /** Etiqueta del formulario; viaja como `contexto` a `/transcribir` (sólo logging del lado del backend). */
  contexto: ContextoTranscripcion;
  /** El formulario está ocupado (guardando, validando). */
  disabled?: boolean;
  /** Error ya traducido a texto para el usuario; el componente NO decide la copia. */
  onError?: (mensaje: string) => void;
}

/** El nombre de archivo tiene que llevar la extensión real del mime grabado — un `.webm` puesto a un
 * blob `audio/mp4` (Safari) no rompe nada funcionalmente, pero mentir la extensión es gratis de
 * evitar (contrato K-10 §3, desacople #6). */
function nombreParaMime(mime: string): string {
  if (mime.includes('mp4')) return 'voz.mp4';
  if (mime.includes('ogg')) return 'voz.ogg';
  if (mime.includes('wav')) return 'voz.wav';
  return 'voz.webm';
}

/**
 * BL-J7 / K-10 — el mic DENTRO de un formulario (Gastos/Ingresos/Presupuestos/Clientes), fuera del
 * chat: envuelve `MicButton` (mismo gesto Pointer Events/`MediaRecorder`, sin tocarlo) pero en vez de
 * mandar el blob a `/chat/audio` (que dispara el agente), lo manda a `/transcribir` (K-10, sin
 * sesión, sin despacho) y devuelve el texto — no escribe nada, no guarda nada.
 *
 * **Contenedor propio con `position:relative`** (`.mic-funcion`, `MicFuncion.css`): `RecordingOverlay`
 * es `position:absolute; inset:0` y asume un ancestro `.composer__row`-like — acá NO estamos en el
 * composer del chat, así que este wrapper aporta esa relación de posicionamiento por su cuenta
 * (contrato K-10 §3, desacople #1). Sin este control positivo no se sabría si el overlay quedó bien
 * anclado fuera del chat.
 */
export function MicFuncion({ onTranscripcion, contexto, disabled, onError }: MicFuncionProps) {
  const [transcribiendo, setTranscribiendo] = useState(false);
  // Duración del último dictado transcripto con éxito — alimenta el chip «Por voz · Ns» (DoD FE1 #5).
  // `null` mientras no hubo ningún dictado todavía, o mientras uno nuevo está en curso.
  const [ultimaDuracionSeg, setUltimaDuracionSeg] = useState<number | null>(null);
  // Guarda contra un `onSendAudio` que dispare dos veces por el mismo dictado (no debería, pero
  // `onTranscripcion` "una sola vez por dictado" es DoD explícito — mejor una guarda barata que
  // confiar en que `MicButton` nunca cambie).
  const enViajeRef = useRef(false);
  // Instante del `pointerdown` que arrancó la grabación — mide la duración del dictado (arranque a
  // corte), no la ida y vuelta al backend. `MicButton` ya lleva un cronómetro propio para su overlay,
  // pero no lo expone: no hay que duplicar esa lógica, sólo leer el mismo instante de inicio.
  const inicioMsRef = useRef(0);

  function alIniciarGrabacion() {
    inicioMsRef.current = Date.now();
    setUltimaDuracionSeg(null);
  }

  async function alGrabar(blob: Blob) {
    if (enViajeRef.current) return;
    enViajeRef.current = true;
    setTranscribiendo(true);
    const duracionSeg = Math.max(1, Math.round((Date.now() - inicioMsRef.current) / 1000));
    try {
      const archivo: ArchivoSubida = { nombre: nombreParaMime(blob.type), mime: blob.type, datos: blob };
      const res = await transcribir(archivo, contexto);
      if (res.transcript.trim() === '') {
        onError?.('No se entendió el audio. Probá de nuevo.');
        return;
      }
      onTranscripcion(res.transcript);
      setUltimaDuracionSeg(duracionSeg);
    } catch (err) {
      onError?.(avisoErrorTranscripcion(err));
    } finally {
      enViajeRef.current = false;
      setTranscribiendo(false);
    }
  }

  return (
    <div className="mic-funcion" data-testid="mic-funcion">
      <MicButton
        onSendAudio={(blob) => void alGrabar(blob)}
        onRecordingStart={alIniciarGrabacion}
        disabled={disabled || transcribiendo}
      />
      {ultimaDuracionSeg !== null && (
        <span className="mic-funcion__chip" data-testid="mic-funcion-chip">
          Por voz · {ultimaDuracionSeg}s
        </span>
      )}
    </div>
  );
}
