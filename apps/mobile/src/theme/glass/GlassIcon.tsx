import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { useTema } from '../ThemeProvider';
import { CATALOGO_ICONOS, type ColorGlifo, type ElementoGlifo, type NombreIconoGlass } from './icons';

interface PropsGlassIcon {
  name: NombreIconoGlass;
  size?: number;
}

/** Traduce un descriptor de glifo (dato puro) al primitivo `react-native-svg` correspondiente. Todos
 * los trazos usan `stroke-linecap`/`stroke-linejoin="round"` -- se aplica fijo, no hace falta
 * parametrizarlo (canon del diseño, ver `icons.ts`). */
function renderGlifo(el: ElementoGlifo, color: (rol: ColorGlifo | undefined) => string, key: number) {
  switch (el.tipo) {
    case 'path':
      return el.relleno ? (
        <Path key={key} d={el.d} fill={color(el.color)} stroke="none" />
      ) : (
        <Path
          key={key}
          d={el.d}
          fill="none"
          stroke={color(el.color)}
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'circulo':
      return (
        <Circle
          key={key}
          cx={el.cx}
          cy={el.cy}
          r={el.r}
          fill="none"
          stroke={color(el.color)}
          strokeWidth={1.7}
        />
      );
    case 'rect':
      return (
        <Rect
          key={key}
          x={el.x}
          y={el.y}
          width={el.w}
          height={el.h}
          rx={el.rx}
          fill="none"
          stroke={color(el.color)}
          strokeWidth={1.7}
        />
      );
    default: {
      // Exhaustividad: si `icons.ts` agrega un tipo de glifo nuevo, esto no compila hasta manejarlo acá.
      const _nunca: never = el;
      return _nunca;
    }
  }
}

/**
 * Ícono de función Odobi: SVG plano, `viewBox 0 0 24 24`, trazo `currentColor` (estructura) +
 * acento único del tema (señal) -- verbatim de `Iconos Odobi.dc.html`. Sin frost/blob/blur: ese
 * lenguaje ("glass HUD") es lo que ODOBI retira (ver el docstring de `icons.ts`).
 *
 * Geometría vive en `icons.ts`; acá sólo se resuelve el ROL de color al valor real del tema --
 * cero hex (ver `temaSinHex.test.ts`).
 */
export function GlassIcon({ name, size = 24 }: PropsGlassIcon) {
  const tema = useTema();
  const color = (rol: ColorGlifo | undefined): string => (rol === 'acento' ? tema.color.acento : tema.color.texto);

  const def = CATALOGO_ICONOS[name];

  return (
    <Svg testID={`glass-icon-${name}`} width={size} height={size} viewBox="0 0 24 24" fill="none">
      {def.elementos.map((el, i) => renderGlifo(el, color, i))}
    </Svg>
  );
}
