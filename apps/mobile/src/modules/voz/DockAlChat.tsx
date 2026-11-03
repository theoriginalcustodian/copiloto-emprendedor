import { router } from 'expo-router';

import { dejarAvisoParaElChat } from '../../navegacion/avisoParaElChat';
import { DockFuncion } from './DockFuncion';

export interface DockAlChatProps {
  /** Telemetría de `/transcribir` (sólo logging del backend). */
  contexto: 'factura' | 'bi';
  /** Para el chip del chat: «Desde Facturación». Sólo UI, nunca viaja al backend. */
  origen: string;
  placeholder: string;
  onError?: (mensaje: string) => void;
}

/**
 * SM-J1 — el dock de las funciones SIN formulario que prellenar (Facturación, Inteligencia). Es `DockFuncion` con otro
 * `onTexto`: lo escrito o dictado se SIEMBRA en el composer del chat y se vuelve a él. Nunca envía ni emite nada acá:
 * en Facturación la card HITL del chat sigue siendo el único gate de una emisión (irreversible), y en Inteligencia el
 * texto es una pregunta sobre los datos. El emprendedor lo revisa y lo manda (o no).
 */
export function DockAlChat({ contexto, origen, placeholder, onError }: DockAlChatProps) {
  return (
    <DockFuncion
      contexto={contexto}
      placeholder={placeholder}
      onError={onError}
      onTexto={(texto) => {
        dejarAvisoParaElChat({ tarjetaId: `funcion:${contexto}`, texto, contexto: origen });
        router.back();
      }}
    />
  );
}
