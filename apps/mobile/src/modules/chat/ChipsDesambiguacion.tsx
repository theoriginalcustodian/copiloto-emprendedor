import type { ReplyChoice } from '@copiloto/core';

import { FilaBotones } from '../../theme/glass/campos';

export interface ChipsDesambiguacionProps {
  choices: ReplyChoice[];
  /** `value` es el token técnico que viaja al backend; `label` es lo que el usuario vio y tocó. */
  onSelect: (value: string, label: string) => void;
  /** La pregunta ya se respondió (llegó otro mensaje después): se ven, no se pueden volver a mandar. */
  deshabilitado?: boolean;
  testID?: string;
}

/**
 * `ChipsDesambiguacion` — las opciones de un `choices` de 3+ (o de cualquier par que NO sea
 * confirmar/cancelar) cuando el copiloto pregunta «¿cuál de estas?» (SM-D1, #1017). Gemela mobile de
 * `DisambiguationChips` (web): un botón por opción, y la elección vuelve como callback con el `label`
 * como texto visible (BL-D4: la burbuja del usuario nunca pinta el `value` técnico).
 *
 * 🔴 **Sin esto el emprendedor veía la pregunta y ningún lugar donde contestarla**: el texto llegaba y
 * los `choices` se descartaban en silencio (`FilaMensaje` sólo entendía el par confirmar/cancelar).
 *
 * `deshabilitado` lo decide la lista, derivado de la posición del mensaje y no de un estado local: un
 * `useState` de «ya elegí» se pierde al remontar la fila (la `FlatList` virtualiza) y volvería a dejar
 * mandar la misma elección dos veces.
 */
export function ChipsDesambiguacion({
  choices,
  onSelect,
  deshabilitado = false,
  testID = 'chips-desambiguacion',
}: ChipsDesambiguacionProps) {
  return (
    <FilaBotones
      testID={testID}
      botones={choices.map((choice, i) => ({
        etiqueta: choice.label,
        onPress: () => onSelect(choice.value, choice.label),
        variante: 'secundario' as const,
        deshabilitado,
        testID: `${testID}-opcion-${i}`,
      }))}
    />
  );
}
