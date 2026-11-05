import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text } from 'react-native';

import {
  avisoErrorTranscripcion,
  formatearDuracion,
  transcribir,
  type ArchivoSubida,
  type ContextoTranscripcion,
} from '@copiloto/core';

import { DockEntrada } from '../chat/DockEntrada';
import { DockSobreContenido } from '../../theme/glass/DockSobreContenido';
import { useTema } from '../../theme/ThemeProvider';
import { borrarArchivoLocal } from './borrarArchivoLocal';

/** Cómo llegó el texto: el camino es el mismo, pero el `origen` de lo guardado no. */
export type ViaTexto = 'escrito' | 'dictado';

export interface DockFuncionProps {
  /** Lo que escribió o dictó, ya transcripto: las dos entradas caen en el MISMO camino. */
  onTexto: (texto: string, via: ViaTexto) => void;
  /** Viaja como `contexto` a `/transcribir` (sólo logging del lado del backend). */
  contexto: ContextoTranscripcion;
  placeholder: string;
  disabled?: boolean;
  /** Error ya traducido a texto para el usuario; el componente NO decide la copia. */
  onError?: (mensaje: string) => void;
  /** Si se pasa, el audio NO se transcribe acá: se entrega tal cual (lo manda otro, p. ej. el chat — `DockAlChat`). */
  onAudioCrudo?: (audio: ArchivoSubida, duracionSeg: number) => void;
}

/**
 * SM-I2 — `DockEntrada` al pie de una función (Gastos; SM-J1 suma las otras). Como `MicFuncion`, transcribe
 * con `transcribir` (K-10: sin sesión, sin despacho) en vez de mandarle el audio al agente: no escribe ni
 * guarda nada, devuelve el texto.
 *
 * `KeyboardAvoidingView` envuelve SÓLO al dock: sube con el teclado y le achica el lugar al scroll de arriba,
 * que ya maneja su propio teclado (`ScrollFormulario`).
 */
export function DockFuncion({ onTexto, contexto, placeholder, disabled, onError, onAudioCrudo }: DockFuncionProps) {
  const tema = useTema();
  // Duración del último dictado transcripto: alimenta el chip «Por voz · m:ss» (DoD FE1 #5).
  const [ultimaDuracionSeg, setUltimaDuracionSeg] = useState<number | null>(null);

  async function alAudio(audio: ArchivoSubida, duracionSeg: number) {
    if (onAudioCrudo != null) {
      onAudioCrudo(audio, duracionSeg);
      return;
    }
    setUltimaDuracionSeg(null);
    try {
      const res = await transcribir(audio, contexto);
      const texto = res.transcript.trim();
      if (texto === '') {
        onError?.('No se entendió el audio. Probá de nuevo.');
        return;
      }
      setUltimaDuracionSeg(duracionSeg);
      onTexto(texto, 'dictado');
    } catch (err) {
      onError?.(avisoErrorTranscripcion(err));
    } finally {
      await borrarArchivoLocal(audio);
    }
  }

  return (
    <KeyboardAvoidingView testID="dock-funcion" behavior="padding">
      <DockSobreContenido>
      {ultimaDuracionSeg !== null && (
        <Text testID="dock-funcion-chip" style={[styles.chip, { color: tema.color.textoTenue }]}>
          {`Por voz · ${formatearDuracion(ultimaDuracionSeg)}`}
        </Text>
      )}
      <DockEntrada
        placeholder={placeholder}
        onEnviarTexto={(texto) => onTexto(texto, 'escrito')}
        onAudio={(audio, duracionSeg) => void alAudio(audio, duracionSeg)}
        onSinPermiso={() => onError?.('Activá el permiso de micrófono en Ajustes para dictar por voz.')}
        disabled={disabled}
      />
      </DockSobreContenido>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chip: { fontSize: 12, alignSelf: 'flex-end', paddingHorizontal: 18 },
});
