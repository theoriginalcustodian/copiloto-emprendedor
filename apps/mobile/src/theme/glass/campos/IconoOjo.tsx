/**
 * `IconoOjo` — el control de "ver lo que escribo" del campo de clave.
 *
 * No sale del `CATALOGO_ICONOS` de `GlassIcon` a propósito: ese catálogo son los glifos de las
 * funciones del escritorio, dibujados a 100×100 con esmerilado y sombra para verse como piezas de
 * vidrio. Acá hace falta lo contrario — una línea fina de 22px dentro de un campo, del color del
 * texto. Meterlo en aquel catálogo mezclaría dos cosas que no comparten ni tamaño ni tratamiento.
 *
 * `stroke` sale SIEMPRE del tema (regla cero-hex): el ícono se lee igual en los temas claro y oscuro.
 */
import Svg, { Circle, Line, Path } from 'react-native-svg';

const GROSOR = 1.6;

export interface IconoOjoProps {
  /** `true` = el texto se está viendo → ojo abierto. `false` = oculto → ojo tachado. */
  visible: boolean;
  color: string;
  size?: number;
  testID?: string;
}

export function IconoOjo({ visible, color, size = 22, testID }: IconoOjoProps) {
  return (
    <Svg testID={testID} width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M1.8 12S5.4 5.8 12 5.8 22.2 12 22.2 12 18.6 18.2 12 18.2 1.8 12 1.8 12Z"
        stroke={color}
        strokeWidth={GROSOR}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="3.1" stroke={color} strokeWidth={GROSOR} />
      {/* La barra cruzada marca el estado ACTUAL (oculto), no la acción del toque. Es la convención
          que usan los teclados y los gestores de contraseñas: el ojo tachado significa "no se ve". */}
      {!visible && (
        <Line x1="4.2" y1="19.8" x2="19.8" y2="4.2" stroke={color} strokeWidth={GROSOR} strokeLinecap="round" />
      )}
    </Svg>
  );
}
