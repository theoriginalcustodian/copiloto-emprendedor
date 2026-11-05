import { DockEntrada, type AvisoDock } from '../chat/DockEntrada';
import type { SendStatusSoporte } from './useChatSoporte';

export interface ComposerSoporteProps {
  sendStatus: SendStatusSoporte;
  onSend: (text: string) => void;
}

function avisoDe(sendStatus: SendStatusSoporte): AvisoDock | null {
  switch (sendStatus) {
    case 'sending':
      return { texto: 'Enviando…', alerta: false };
    case 'waiting':
      return { texto: 'Pensando… · Podés cerrar la app, te sigo respondiendo.', alerta: false };
    case 'timeout':
      return { texto: 'Está tardando más de lo normal. Podés esperar o volver a intentar.', alerta: true };
    case 'error':
      return { texto: 'No pudimos enviar tu mensaje. Probá de nuevo.', alerta: true };
    default:
      return null;
  }
}

/**
 * Composer del chat de SOPORTE. Antes duplicaba el JSX del de negocio; ahora ambos son `DockEntrada`
 * (SM-P7) y acá sólo cambia el placeholder y los textos de estado. Sin cámara ni adjuntos en web
 * (SM-P8 c: no aplica).
 */
export function ComposerSoporte({ sendStatus, onSend }: ComposerSoporteProps) {
  return (
    <DockEntrada
      testId="composer-soporte"
      placeholder="Contanos qué necesitás…"
      ocupado={sendStatus === 'sending'}
      aviso={avisoDe(sendStatus)}
      onEnviar={onSend}
    />
  );
}
