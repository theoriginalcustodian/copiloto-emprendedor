import { StatusBar, type StatusBarStyle } from 'expo-status-bar';

import { useSkin } from './ThemeProvider';
import type { NombreSkin } from './tokens';

// `Record` y no un ternario: una piel nueva no compila hasta decidir el color de sus íconos.
const ICONOS_POR_PIEL: Record<NombreSkin, StatusBarStyle> = {
  claro: 'dark',
  oscuro: 'light',
};

/**
 * SM-N10 — Íconos de la barra de estado según la piel de la APP, no la del teléfono: `style="auto"` sigue al
 * sistema, y con «Apariencia» distinta del teléfono los deja ilegibles. documed no resuelve esta barra, así que
 * acá no hay nada que portar. `expo-status-bar` sólo envuelve el `StatusBar` de `react-native`: no pide rebuild.
 */
export function BarraEstado() {
  const [skin] = useSkin();
  return <StatusBar style={ICONOS_POR_PIEL[skin]} />;
}
