import Svg, { Path } from 'react-native-svg';

import { GLIFOS } from './glifos';

/** `GLIFOS` es un objeto plano: `GLIFOS['toString']` existe. Sólo cuentan las claves propias. */
export function existeGlifo(nombre: string | undefined): nombre is string {
  return nombre != null && Object.prototype.hasOwnProperty.call(GLIFOS, nombre) && GLIFOS[nombre]!.capas.length > 0;
}

export interface GlifoProps {
  /** La clave del ícono en `glifos.ts`. */
  nombre: string;
  size: number;
  color: string;
  testID?: string;
  /** El control que lo contiene ya lleva el nombre: el dibujo se oculta a los lectores de pantalla. */
  decorativo?: boolean;
}

/**
 * Un ícono del set, de un solo color. Es el único lugar que sabe dibujarlos: cada set trae su `viewBox` y su
 * manera (relleno o trazo), y eso sale de los datos. Un nombre que no existe no dibuja nada.
 */
export function Glifo({ nombre, size, color, testID, decorativo }: GlifoProps) {
  const glifo = existeGlifo(nombre) ? GLIFOS[nombre] : undefined;
  if (glifo == null) return null;
  return (
    <Svg
      testID={testID}
      width={size}
      height={size}
      viewBox={glifo.viewBox}
      fill="none"
      accessibilityElementsHidden={decorativo}
      importantForAccessibility={decorativo === true ? 'no-hide-descendants' : undefined}
    >
      {glifo.capas.map((c, i) => (
        <Path
          key={i}
          d={c.d}
          fill={c.relleno === true ? color : 'none'}
          stroke={c.trazo != null ? color : 'none'}
          strokeWidth={c.trazo}
          strokeLinecap={c.punta ?? 'round'}
          strokeLinejoin={c.union ?? 'round'}
        />
      ))}
    </Svg>
  );
}
