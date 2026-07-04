import { AppShell } from './AppShell';
import { DesktopShell } from './DesktopShell';
import { useBreakpoint } from './useBreakpoint';

/**
 * Switch responsive único (DESIGN-SYSTEM-EXTRACT-WEB.md §6, recomendación #3): UN árbol, un hook
 * (`useBreakpoint`) decide qué shell montar — `< 900px` -> `AppShell` (mobile, tab-bar); `>= 900px`
 * -> `DesktopShell` (rail). Ambos consumen las MISMAS pantallas de módulo (`modules/{chat,apps,
 * connections,account}`), cero lógica de negocio duplicada.
 *
 * `ThemeProvider`/`SessionProvider`/`ModeProvider` viven un nivel arriba (App.tsx) — este
 * componente es SOLO el switch de layout, ambos shells comparten la misma sesión/tema/modo sin
 * remontarlos al cruzar el breakpoint.
 */
export function ResponsiveShell() {
  const breakpoint = useBreakpoint();
  return breakpoint === 'desktop' ? <DesktopShell /> : <AppShell />;
}
