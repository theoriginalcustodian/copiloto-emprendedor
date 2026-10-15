import { useEffect, type ComponentType } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type AnimatedProps,
} from 'react-native-reanimated';
import Svg, { Path, type PathProps } from 'react-native-svg';

import { useTema } from '../../theme/ThemeProvider';
import { fotogramaOnda, type ArcoOnda } from './ondaEntrada';

// `pathLength` es un atributo SVG estándar (draw-on vía `strokeDasharray`/`strokeDashoffset`
// normalizados) que react-native-svg SOPORTA en runtime pero no declara en `PathProps` -- se
// extiende acá, no se castea a `any` (mantiene el resto de los props chequeados).
const AnimatedPath = Animated.createAnimatedComponent(Path) as ComponentType<
  AnimatedProps<PathProps> & { pathLength?: number }
>;

const SIGNO = 132;
const ENTRADA_TOTAL_MS = 1500;
const EASE_ENTRADA = Easing.bezier(0.2, 0.8, 0.2, 1);

/** Mismos 4 trazos que `theme/Marca.tsx` (isotipo canónico, viewBox 24) -- ver
 * `explorations/isotipo-david/entrada.html`. Los dos primeros se DIBUJAN (draw-on vía
 * `pathLength`/`strokeDashoffset`); las dos ondas replican `@keyframes onda` del prototipo
 * (`index.html:1171`): funden opacidad Y se desplazan/escalan en X (`ondaEntrada.ts`). */
const ARCOS = [
  { d: 'M11 3.5a8.5 8.5 0 1 0 0 17', duracion: 420, delay: 0 },
  { d: 'M11 7.5a4.5 4.5 0 1 0 0 9', duracion: 340, delay: 140 },
];
const ONDAS: { arco: ArcoOnda; duracion: number; delay: number }[] = [
  { arco: { x: 16.5, y: 8.8, r: 4.8, dy: 6.4 }, duracion: 460, delay: 300 }, // 'M16.5 8.8a4.8 4.8 0 0 1 0 6.4'
  { arco: { x: 19.5, y: 6.5, r: 9, dy: 11 }, duracion: 460, delay: 420 }, // 'M19.5 6.5a9 9 0 0 1 0 11'
];

function Trazo({
  d,
  duracion,
  delay,
  reducido,
  color,
  testID,
}: {
  d: string;
  duracion: number;
  delay: number;
  reducido: boolean;
  color: string;
  testID: string;
}) {
  const dashoffset = useSharedValue(reducido ? 0 : 100);
  useEffect(() => {
    if (reducido) return;
    dashoffset.value = withDelay(delay, withTiming(0, { duration: duracion, easing: EASE_ENTRADA }));
  }, []);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: dashoffset.value }));
  return (
    <AnimatedPath
      testID={testID}
      d={d}
      pathLength={100}
      strokeDasharray={100}
      animatedProps={animatedProps}
      stroke={color}
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

function Onda({
  arco,
  duracion,
  delay,
  reducido,
  color,
  testID,
}: {
  arco: ArcoOnda;
  duracion: number;
  delay: number;
  reducido: boolean;
  color: string;
  testID: string;
}) {
  // Con «reducir movimiento» la onda nace en su estado final (progreso 1): sin fundido ni desplazamiento.
  const progreso = useSharedValue(reducido ? 1 : 0);
  useEffect(() => {
    if (reducido) return;
    progreso.value = withDelay(delay, withTiming(1, { duration: duracion, easing: EASE_ENTRADA }));
  }, []);
  const animatedProps = useAnimatedProps(() => fotogramaOnda(progreso.value, arco));
  return (
    <AnimatedPath
      testID={testID}
      animatedProps={animatedProps}
      stroke={color}
      strokeWidth={1.3}
      strokeLinecap="round"
      fill="none"
    />
  );
}

/**
 * BL-X10 — entrada diaria (arranques 2..n, token restaurado): el isotipo dibujándose cubre la
 * latencia de `/me` en `Guard` (`_layout.tsx`) mientras `estado==='verificando'`. NO es el splash
 * de identidad (ese vive en el reveal de primer ingreso, `modules/auth/RevealEntrada.tsx`) --
 * duración total PROVISIONAL (~1,5 s), a ajustar contra la carga real de "Mi día".
 */
export function EntradaDiaria({ onFin }: { onFin: () => void }) {
  const tema = useTema();
  const reducido = useReducedMotion();

  useEffect(() => {
    const ms = reducido ? 0 : ENTRADA_TOTAL_MS;
    const t = setTimeout(onFin, ms);
    return () => clearTimeout(t);
  }, [reducido, onFin]);

  // `#entrada{background:var(--blanco)}` (prototipo `index.html:1154`, `2438`): blanco PURO, no el crema
  // del lienzo. `glass.on` ES `--odobi-blanco` (`tokens.ts`, «blanco puro, no el crema»). El prototipo
  // sólo tiene piel clara: en las oscuras un blanco fijo sería un fogonazo de 1,5 s, así que ahí manda
  // el lienzo del tema. DEVICE15 midió el crema como DESVÍO en la piel clara.
  const fondo = tema.glass.esLight ? tema.glass.on : tema.color.fondo;

  return (
    <View
      testID="entrada-diaria"
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: fondo }}
    >
      <Svg width={SIGNO} height={SIGNO} viewBox="0 0 24 24">
        {ARCOS.map((a, i) => (
          <Trazo key={a.d} {...a} reducido={reducido} color={tema.color.acento} testID={`entrada-diaria-trazo-${i + 1}`} />
        ))}
        {ONDAS.map((o, i) => (
          <Onda key={o.arco.x} {...o} reducido={reducido} color={tema.color.acento} testID={`entrada-diaria-onda-${i + 1}`} />
        ))}
      </Svg>
    </View>
  );
}
