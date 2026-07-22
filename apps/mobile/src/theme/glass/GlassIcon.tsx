import { useId } from 'react';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  FeGaussianBlur,
  Filter,
  G,
  Line,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import {
  ACENTO_AMBAR,
  ACENTO_CIAN,
  BLANCO,
  BORDE_ANCHO,
  BORDE_EXTRA_OPACIDAD,
  BORDE_PRINCIPAL_OPACIDAD,
  FROST_DESDE_OPACIDAD,
  FROST_HASTA_OPACIDAD,
  PALETAS_BLOB,
  VELO_OPACIDAD,
} from './iconPalette';
import { CATALOGO_ICONOS, type ColorGlifo, type ElementoGlifo, type NombreIconoGlass } from './icons';

interface PropsGlassIcon {
  name: NombreIconoGlass;
  size?: number;
}

/** Resuelve el rol de color del glifo (`icons.ts`, sin hex) al valor real (`iconPalette.ts`). Único
 * punto de la app donde un `ColorGlifo` se convierte en color -- ver `temaSinHex.test.ts`. */
const COLOR_POR_ROL: Record<ColorGlifo, string> = {
  blanco: BLANCO,
  acentoCian: ACENTO_CIAN,
  acentoAmbar: ACENTO_AMBAR,
};

/** Traduce un descriptor de glifo (dato puro) al primitivo `react-native-svg` correspondiente. Todos
 * los trazos del source usan `stroke-linecap="round"` -- se aplica fijo, no hace falta parametrizarlo. */
function renderGlifo(el: ElementoGlifo, key: number) {
  const color = COLOR_POR_ROL[el.color];
  const opacidad = el.opacidad ?? 1;
  switch (el.tipo) {
    case 'linea':
      return (
        <Line
          key={key}
          x1={el.x1}
          y1={el.y1}
          x2={el.x2}
          y2={el.y2}
          stroke={color}
          strokeWidth={el.ancho}
          strokeLinecap="round"
          opacity={opacidad}
        />
      );
    case 'circulo':
      return el.relleno ? (
        <Circle key={key} cx={el.cx} cy={el.cy} r={el.r} fill={color} opacity={opacidad} />
      ) : (
        <Circle
          key={key}
          cx={el.cx}
          cy={el.cy}
          r={el.r}
          fill="none"
          stroke={color}
          strokeWidth={el.ancho}
          opacity={opacidad}
        />
      );
    case 'rect':
      return (
        <Rect key={key} x={el.x} y={el.y} width={el.w} height={el.h} rx={el.rx} fill={color} opacity={opacidad} />
      );
    case 'path':
      return el.relleno ? (
        <Path key={key} d={el.d} fill={color} opacity={opacidad} />
      ) : (
        <Path
          key={key}
          d={el.d}
          fill="none"
          stroke={color}
          strokeWidth={el.ancho}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={opacidad}
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
 * Icono "glass": base de cristal esmerilado (frost) + blobs radiales de color que brillan a través +
 * velo lechoso + borde de luz + glifo. Port 1:1 de `glass-icons-v2.js` (prototipo de diseño, ver
 * `App glass/DocuMed 2 — Skin Z-Depth HUD (exploración)/`) a primitivos `react-native-svg`.
 *
 * Este componente es PURO layout/renderer -- geometría vive en `icons.ts`, color en `iconPalette.ts`.
 * Cero hex acá (ver `temaSinHex.test.ts`).
 *
 * Aproximaciones vs. el source web -- ninguna verificada visualmente on-device todavía:
 * - El source aplica `filter:drop-shadow(...)` al `<svg>` completo (sombra de todo el icono). RN-SVG
 *   no tiene equivalente a un CSS `filter` sobre el elemento raíz -- se OMITE; el frost + el borde de
 *   luz ya dan la sensación de profundidad sin la sombra proyectada.
 * - El blur de los blobs (`feGaussianBlur stdDeviation="6"` en el source) se porta con `<Filter>` +
 *   `<FeGaussianBlur>` de `react-native-svg` (API tipada y soportada por la librería) -- pendiente de
 *   confirmar que se ve bien en el dispositivo real; si el blur no renderiza o da artefactos, la
 *   `<G filter=...>` es el único punto a tocar (se puede reemplazar por opacidad reducida en los blobs).
 */
export function GlassIcon({ name, size = 72 }: PropsGlassIcon) {
  // `useId()` devuelve algo como ":r0:" -- los `:` son válidos en un fragment-id de SVG, pero se
  // sanean igual (costo cero) para no depender de esa sutileza en ningún renderer (nativo o web).
  const base = useId().replace(/:/g, '');
  const clipId = `${base}clip`;
  const frostId = `${base}frost`;
  const blurId = `${base}blur`;

  const def = CATALOGO_ICONOS[name];

  return (
    <Svg testID={`glass-icon-${name}`} width={size} height={size} viewBox="0 0 100 100" fill="none">
      <Defs>
        <ClipPath id={clipId}>
          <Path d={def.shape} />
          {def.extra ? <Path d={def.extra} /> : null}
        </ClipPath>

        <LinearGradient id={frostId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={BLANCO} stopOpacity={FROST_DESDE_OPACIDAD} />
          <Stop offset="1" stopColor={BLANCO} stopOpacity={FROST_HASTA_OPACIDAD} />
        </LinearGradient>

        {/* aprox de blur(feGaussianBlur stdDeviation=6) -- ver docstring del componente */}
        <Filter id={blurId} x="-40%" y="-40%" width="180%" height="180%">
          <FeGaussianBlur stdDeviation={6} />
        </Filter>

        {def.blobs.map((blob, i) => {
          const [desde, hasta] = PALETAS_BLOB[blob.paleta];
          return (
            <RadialGradient key={i} id={`${base}blob${i}`} cx="35%" cy="30%" r="75%">
              <Stop offset="0" stopColor={desde} />
              <Stop offset="1" stopColor={hasta} />
            </RadialGradient>
          );
        })}
      </Defs>

      <G clipPath={`url(#${clipId})`}>
        <Path d={def.shape} fill={`url(#${frostId})`} />
        {def.extra ? <Path d={def.extra} fill={`url(#${frostId})`} /> : null}

        <G filter={`url(#${blurId})`}>
          {def.blobs.map((blob, i) => (
            <Circle key={i} cx={blob.cx} cy={blob.cy} r={blob.r} fill={`url(#${base}blob${i})`} />
          ))}
        </G>

        <Path d={def.shape} fill={BLANCO} fillOpacity={VELO_OPACIDAD} />
      </G>

      <Path d={def.shape} fill="none" stroke={BLANCO} strokeOpacity={BORDE_PRINCIPAL_OPACIDAD} strokeWidth={BORDE_ANCHO} />
      {def.extra ? (
        <Path d={def.extra} fill="none" stroke={BLANCO} strokeOpacity={BORDE_EXTRA_OPACIDAD} strokeWidth={BORDE_ANCHO} />
      ) : null}

      {def.glifo.map((el, i) => renderGlifo(el, i))}
    </Svg>
  );
}
