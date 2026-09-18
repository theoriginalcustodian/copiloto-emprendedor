import Svg, { Path } from 'react-native-svg';

import { useTema } from '../ThemeProvider';
import { ICONO_DEL_SISTEMA } from './mapaIconos';
import { PHOSPHOR, VIEWBOX_PHOSPHOR } from './phosphor';
import type { NombreIconoGlass } from './icons';

interface PropsGlassIcon {
  name: NombreIconoGlass;
  size?: number;
}

/** Traduce un descriptor de glifo (dato puro) al primitivo `react-native-svg` correspondiente. Todos
 * los trazos usan `stroke-linecap`/`stroke-linejoin="round"` -- se aplica fijo, no hace falta
 * parametrizarlo (canon del diseño, ver `icons.ts`). */
/**
 * Ícono de función Odobi — **Phosphor Regular del sistema** (`odobi-ui/assets/iconos/`).
 *
 * 🔴 **Es `fill`, no `stroke`.** Phosphor viene outlineado: el color se hereda y el grosor NO se
 * ajusta. Antes acá se dibujaban trazos propios de 24×24 con un detalle en acento; eso era un
 * tercer set, ni el del sistema ni el anterior. Los glifos del sistema son de **un solo color**,
 * así que el detalle en acento desaparece — es consecuencia buscada, no una pérdida: el acento
 * es señal (≤10%), y un ícono que siempre lo lleva deja de señalar nada.
 *
 * `viewBox` 0 0 256 256, el nativo de Phosphor. Qué glifo le toca a cada pantalla vive en
 * `mapaIconos.ts`, extraído del prototipo.
 */
export function GlassIcon({ name, size = 24 }: PropsGlassIcon) {
  const tema = useTema();
  const glifos = PHOSPHOR[ICONO_DEL_SISTEMA[name]] ?? [];

  return (
    <Svg testID={`glass-icon-${name}`} width={size} height={size} viewBox={VIEWBOX_PHOSPHOR} fill="none">
      {glifos.map((d, i) => (
        <Path key={i} d={d} fill={tema.color.texto} stroke="none" />
      ))}
    </Svg>
  );
}
