import { ThemeProvider } from './design-system/ThemeProvider';
import { SessionProvider } from './auth/SessionProvider';
import { LoginScreen } from './auth/LoginScreen';
import { useSession } from './auth/useSession';
import { ResponsiveShell } from './shell/ResponsiveShell';
import { ModeProvider } from './shell/modeStore';

/**
 * Router raíz por estado de sesión (Task 7/22, + cliente web/desktop 2026-07-04): 'checking' ->
 * splash; 'authed' -> `ResponsiveShell` (UN shell que bifurca por breakpoint: `<900px` -> AppShell
 * mobile con tab-bar Chat·Apps·Conexiones·Cuenta, Task 9; `>=900px` -> DesktopShell con rail
 * lateral, mismas 4 pantallas de módulo — ver `shell/ResponsiveShell.tsx`); cualquier otro estado
 * ('anon' | 'no-habilitada') -> LoginScreen (diseño final, Task 22 — reemplaza el LoginSkeleton
 * funcional-básico; ya sabe mostrar el aviso de cuenta no-habilitada leyendo la sesión compartida
 * — ver auth/LoginScreen.tsx).
 */
function AppRouter() {
  const { status } = useSession();

  if (status === 'checking') {
    return (
      <div className="app-frame" data-testid="app-shell-splash">
        <main>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--mono)', padding: 16 }}>
            Copiloto del Emprendedor — cargando tu copiloto…
          </p>
        </main>
      </div>
    );
  }

  if (status === 'authed') return <ResponsiveShell />;
  return <LoginScreen />;
}

export function App() {
  return (
    <ThemeProvider>
      <SessionProvider>
        {/* ModeProvider (Feature addendum 2026-07-03, "modos por app"): estado GLOBAL compartido
            entre `AppsScreen` (setea el modo) y `Composer` (lo lee) — vive acá, un nivel arriba
            de `AppShell`, mismo criterio que `SessionProvider`. */}
        <ModeProvider>
          <AppRouter />
        </ModeProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
