import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { despacharAudioAlChat, despacharTextoAlChat } from '../../navegacion/despachoAlChat';
import { borrarArchivoLocal } from './borrarArchivoLocal';
import { useTema } from '../../theme/ThemeProvider';
import { DockFuncion } from './DockFuncion';

export interface DockAlChatProps {
  /** Telemetría de `/transcribir` (sólo logging del backend). Hoy el audio va crudo al chat y no se usa. */
  contexto: 'factura' | 'bi';
  /** Sólo UI, nunca viaja al backend. Se conserva en la firma: lo pasan las pantallas. */
  origen: string;
  placeholder: string;
  onError?: (mensaje: string) => void;
}

const CHAT_NO_LISTO = 'El chat todavía no está listo. Probá de nuevo en un momento.';

/**
 * SM-J1 + SM-P5/P10 — el dock de las funciones SIN formulario que prellenar (Facturación, Inteligencia). Es `DockFuncion`
 * con otro destino: lo escrito o dictado se MANDA al chat y recién DESPUÉS se vuelve a él, que llega con la card en
 * camino (decisión del operador, 2026-11-04: «cuando se ingresa texto o se envía un audio se vuelve al chat luego de la
 * acción… pero no antes»). El mic manda el audio, igual que en cualquier función; no se transcribe acá.
 *
 * El despacho vive en `despachoAlChat.ts`: el chat sigue montado debajo de este glass. Si no hay chat listo NO se
 * navega y se avisa — navegar sin haber mandado era perder el mensaje en silencio.
 *
 * ⚠️ Antes (SM-J1) el texto se SEMBRABA en el composer para que el emprendedor lo revisara. Ya no: la card HITL del chat
 * sigue siendo el único gate de una emisión; mandar el mensaje no emite nada.
 */
export function DockAlChat({ contexto, origen: _origen, placeholder, onError }: DockAlChatProps) {
  const tema = useTema();
  // El aviso se dice ACÁ además de avisarle a la pantalla: ninguna pasa `onError` hoy y «no se mandó» no puede ser mudo.
  const [aviso, setAviso] = useState<string | null>(null);
  const decir = (mensaje: string) => {
    setAviso(mensaje);
    onError?.(mensaje);
  };
  return (
    <>
      {aviso != null && (
        <Text
          testID="dock-alchat-aviso"
          accessibilityLiveRegion="polite"
          style={{ color: tema.color.textoTenue, fontSize: tema.tipo.chico, paddingHorizontal: 18, paddingBottom: 4 }}
        >
          {aviso}
        </Text>
      )}
      <DockFuncion
        contexto={contexto}
        placeholder={placeholder}
        onError={decir}
        onTexto={(texto) => {
          if (!despacharTextoAlChat(texto)) {
            decir(CHAT_NO_LISTO);
            return;
          }
          router.back();
        }}
        onAudioCrudo={(audio, duracionSeg) => {
          if (!despacharAudioAlChat(audio, duracionSeg)) {
            decir(CHAT_NO_LISTO);
            void borrarArchivoLocal(audio);
            return;
          }
          router.back();
        }}
      />
    </>
  );
}