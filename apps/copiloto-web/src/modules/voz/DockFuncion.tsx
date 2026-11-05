import { dejarPendiente } from '@copiloto/core';

import { DockEntrada } from '../chat/DockEntrada';

export interface DockFuncionProps {
  /** Lleva al chat principal. Lo inyecta el shell (`changeTab('chat')` / `setActiveTab('chat')`). */
  onAbrirChat: () => void;
  placeholder: string;
}

/**
 * SM-P7 — el MISMO dock del chat (`DockEntrada`: campo + mic que dicta al campo + enviar) al pie de una
 * función. Decisión del operador 2026-11-04: el campo y el mic están en todas las funciones, iguales, y
 * al enviar texto o audio **se ejecuta la acción en el chat y recién ahí se vuelve a él** (no antes).
 *
 * Por eso no escribe nada en la función: deja el texto en el buzón (`dejarPendiente`, el mismo puente
 * de BL-W9 que usa «Cómo usar la app») y cambia al chat, que lo manda al montar (`ChatScreen`,
 * `tomarPendiente`) y pinta la card correspondiente. En web la navegación es por tabs sin stack, así
 * que la acción corre al llegar al chat, no antes.
 *
 * Reemplaza a `MicFuncion` (mic suelto junto a un formulario que llenaba un campo): dos maneras de
 * dictar en la misma app era la inconsistencia que el operador pidió sacar.
 */
export function DockFuncion({ onAbrirChat, placeholder }: DockFuncionProps) {
  return (
    <DockEntrada
      testId="dock-funcion"
      placeholder={placeholder}
      ocupado={false}
      onEnviar={(texto) => {
        dejarPendiente(texto);
        onAbrirChat();
      }}
    />
  );
}
