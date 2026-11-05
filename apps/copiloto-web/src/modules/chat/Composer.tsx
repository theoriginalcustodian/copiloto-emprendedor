import { DockEntrada, type AvisoDock } from './DockEntrada';
import type { SendStatus } from './useChat';

export interface ComposerProps {
  sendStatus: SendStatus;
  onSend: (text: string) => void;
}

/** Indicador de `sendStatus` (procesando/pensando/tardando/error) + copy de durabilidad en `waiting`. */
function avisoDe(sendStatus: SendStatus): AvisoDock | null {
  switch (sendStatus) {
    case 'sending':
      return { texto: 'Procesando…', alerta: false };
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
 * Composer del chat de negocio: sólo aporta lo que lo distingue (placeholder, estados de envío). El
 * dock en sí — campo, mic que dicta al campo, enviar, apariencia flotante — es `DockEntrada`, el mismo
 * que usa `ComposerSoporte` (SM-P7). Enter envía, Shift+Enter salta línea, vacío no envía.
 */
export function Composer({ sendStatus, onSend }: ComposerProps) {
  return (
    <DockEntrada
      testId="composer"
      placeholder="Escribí, o hablá…"
      ocupado={sendStatus === 'sending'}
      aviso={avisoDe(sendStatus)}
      onEnviar={onSend}
    />
  );
}
