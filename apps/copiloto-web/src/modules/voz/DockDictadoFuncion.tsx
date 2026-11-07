import type { DestinoDictado } from '@copiloto/core';

import { DockEntrada } from '../chat/DockEntrada';
import type { DictadoFuncion } from './useDictadoFuncion';

export interface DockDictadoFuncionProps<D extends DestinoDictado> {
  dictado: DictadoFuncion<D>;
  placeholder: string;
}

/**
 * ORDEN NUEVA 2026-11-06 (SM-P19, mitad A) — el MISMO dock del chat (`DockEntrada`: campo + mic que
 * dicta al campo + enviar) al pie de una función, pero lo escrito o dictado **se prellena en la
 * propia función** (`useDictadoFuncion`) y NO viaja al chat ni depende de él. Reemplaza a
 * `DockFuncion` (SM-P14/SM-P7), que dejaba el texto como pendiente y cambiaba de tab: con el chat
 * sin hidratar el pedido se perdía (`CHAT_NO_LISTO`).
 *
 * La pregunta del copiloto (dictado incompleto) y el aviso del degradado se muestran en el dock:
 * contestar la pregunta es seguir el mismo hilo.
 */
export function DockDictadoFuncion<D extends DestinoDictado>({ dictado, placeholder }: DockDictadoFuncionProps<D>) {
  return (
    <DockEntrada
      testId="dock-funcion"
      placeholder={placeholder}
      ocupado={dictado.ocupado}
      aviso={
        dictado.pregunta != null
          ? { texto: dictado.pregunta, alerta: false }
          : dictado.aviso != null
            ? { texto: dictado.aviso, alerta: true }
            : null
      }
      onEnviar={(texto) => void dictado.dictar(texto)}
    />
  );
}
