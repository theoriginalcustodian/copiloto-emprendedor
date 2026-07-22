/**
 * `CampoNumero` — `CampoTexto` con teclado numérico, para importes de facturación.
 *
 * 🔴 **El valor es STRING de punta a punta. Prohibido `parseFloat`/`Number()` acá adentro.** Estos
 * campos cargan importes (precio unitario, ingresos brutos) que el backend de AFIP recibe y devuelve
 * como string -- son centavos, no un `Number` de JS. Convertir de ida pierde precisión de punto
 * flotante (`0.1 + 0.2 !== 0.3`) y de vuelta obliga a reformatear con reglas de miles/decimales que ya
 * resuelve el backend fiscal. La única disciplina de este componente es FILTRAR lo que no es numérico
 * mientras se tipea -- nunca aritmetizar. Dos calculadoras de importes (la app y AFIP) es exactamente
 * el bug que el plan de facturación (`docs/copiloto-emprendedor/2026-07-21-diseno...`) evita del lado
 * de los totales; este campo lo evita del lado del input.
 */
import { CampoTexto, type CampoTextoProps } from './CampoTexto';

export type CampoNumeroProps = Omit<
  CampoTextoProps,
  'keyboardType' | 'multiline' | 'autoCapitalize' | 'secureTextEntry' | 'autoCorrect' | 'textContentType'
>;

/** Conserva dígitos y, como mucho, UN separador decimal (`.` o `,`) -- el resto de los separadores que
 *  se tipeen después se descartan sin tocar los dígitos que ya estaban. Nunca produce/consume `number`. */
function filtrarNumerico(texto: string): string {
  const limpio = texto.replace(/[^0-9.,]/g, '');
  const indiceSeparador = limpio.search(/[.,]/);
  if (indiceSeparador === -1) return limpio;
  const conUnSeparador = limpio.slice(0, indiceSeparador + 1) + limpio.slice(indiceSeparador + 1).replace(/[.,]/g, '');
  return conUnSeparador;
}

export function CampoNumero({ onChange, testID = 'campo-numero', ...resto }: CampoNumeroProps) {
  return (
    <CampoTexto
      {...resto}
      testID={testID}
      keyboardType="decimal-pad"
      onChange={(texto) => onChange(filtrarNumerico(texto))}
    />
  );
}
