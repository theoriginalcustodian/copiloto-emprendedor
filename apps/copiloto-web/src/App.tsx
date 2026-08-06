import { useState } from 'react';

import { ThemeProvider } from './design-system/ThemeProvider';
import { SessionProvider } from './auth/SessionProvider';
import { LoginScreen } from './auth/LoginScreen';
import { SignupScreen } from './auth/SignupScreen';
import { useSession } from './auth/useSession';
import { ResponsiveShell } from './shell/ResponsiveShell';
import { ModeProvider } from './shell/modeStore';

/** BETA-4b: `SignupScreen` es reachable SOLO por `?signup=1` — sin link público desde
 * `LoginScreen` todavía (`POST /auth/signup` no tiene invite-gate, decisión operador #3 sin
 * resolver, ver `hallazgo_frontend-a-todos_BETA-4b-signup-endpoint-existe-pero-publico...md`).
 * Leído UNA vez al montar: navegar entre login/signup adentro de la sesión usa el toggle interno
 * de `AppRouter`, no vuelve a leer la URL. */
function leerSignupDeQuery(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('signup') === '1';
}

/**
 * Router raíz por estado de sesión (Task 7/22, + cliente web/desktop 2026-07-04): 'checking' ->
 * splash; 'authed' -> `ResponsiveShell` (UN shell que bifurca por breakpoint: `<900px` -> AppShell
 * mobile con tab-bar Chat·Apps·Conexiones·Cuenta, Task 9; `>=900px` -> DesktopShell con rail
 * lateral, mismas 4 pantallas de módulo — ver `shell/ResponsiveShell.tsx`); cualquier otro estado
 * ('anon' | 'no-habilitada') -> LoginScreen (diseño final, Task 22 — reemplaza el LoginSkeleton
 * funcional-básico; ya sabe mostrar el aviso de cuenta no-habilitada leyendo la sesión compartida
 * — ver auth/LoginScreen.tsx) o `SignupScreen` (BETA-4b, ver `leerSignupDeQuery`).
 */
function AppRouter() {
  const { status } = useSession();
  const [mostrarSignup, setMostrarSignup] = useState(leerSignupDeQuery);
  // BETA-4b DoD: "conecta al menos un servicio → llega al chat activo" — recién firmado aterriza
  // en Conexiones (no Chat) para que ese paso sea lo primero que ve, sin bloquearlo (sigue
  // pudiendo navegar a Chat cuando quiera). Vive en `App` (no en `ResponsiveShell`/los shells)
  // porque debe sobrevivir al remount que dispara el cambio de `status` a 'authed'.
  const [recienFirmado, setRecienFirmado] = useState(false);

  if (status === 'checking') {
    return (
      <div className="app-frame" data-testid="app-shell-splash">
        <main>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--mono)', padding: 16 }}>
            Odobi — cargando tu copiloto…
          </p>
        </main>
      </div>
    );
  }

  if (status === 'authed') {
    return <ResponsiveShell initialTab={recienFirmado ? 'connections' : undefined} />;
  }

  if (mostrarSignup) {
    return (
      <SignupScreen
        onVolverALogin={() => setMostrarSignup(false)}
        onSignupExitoso={() => setRecienFirmado(true)}
      />
    );
  }
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
