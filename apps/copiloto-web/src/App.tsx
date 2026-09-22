import { debeMostrarOnboarding } from '@copiloto/core';
import { useCallback, useEffect, useState } from 'react';

import { ThemeProvider } from './design-system/ThemeProvider';
import { SessionProvider } from './auth/SessionProvider';
import { LoginScreen } from './auth/LoginScreen';
import { SignupScreen } from './auth/SignupScreen';
import { useSession } from './auth/useSession';
import { Onboarding } from './modules/onboarding';
import { EntradaDiaria, Splash } from './modules/splash';
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
 * Router raíz por estado de sesión (Task 7/22, + cliente web/desktop 2026-07-04): 'checking' o
 * recién 'authed' sin identidad mostrada todavía -> `Splash`/`EntradaDiaria` (BL-X10, ver abajo);
 * 'authed' -> `ResponsiveShell` (UN shell que bifurca por breakpoint: `<900px` -> AppShell
 * mobile con tab-bar Chat·Apps·Conexiones·Cuenta, Task 9; `>=900px` -> DesktopShell con rail
 * lateral, mismas 4 pantallas de módulo — ver `shell/ResponsiveShell.tsx`); cualquier otro estado
 * ('anon' | 'no-habilitada') -> LoginScreen (diseño final, Task 22 — reemplaza el LoginSkeleton
 * funcional-básico; ya sabe mostrar el aviso de cuenta no-habilitada leyendo la sesión compartida
 * — ver auth/LoginScreen.tsx) o `SignupScreen` (BETA-4b, ver `leerSignupDeQuery`).
 */
function AppRouter() {
  const { status, me, origenSesion } = useSession();
  const [mostrarSignup, setMostrarSignup] = useState(leerSignupDeQuery);
  // BETA-4b DoD: "conecta al menos un servicio → llega al chat activo" — recién firmado aterriza
  // en Conexiones (no Chat) para que ese paso sea lo primero que ve, sin bloquearlo (sigue
  // pudiendo navegar a Chat cuando quiera). Vive en `App` (no en `ResponsiveShell`/los shells)
  // porque debe sobrevivir al remount que dispara el cambio de `status` a 'authed'.
  const [recienFirmado, setRecienFirmado] = useState(false);
  // K-14 / BL-X8: el hilo de bienvenida (2 permisos + primer insight) se muestra UNA vez, tras el login,
  // cuando `/me` dice `onboarding_completado: false`. Se decidió montarlo acá (no en el shell): es previo
  // a la app, y `me` ya vive en la sesión. `onboardingCerrado` evita reabrirlo en esta sesión sin
  // depender de que `/me` se relea; en el próximo arranque el backend ya lo trae en `true`.
  const [onboardingCerrado, setOnboardingCerrado] = useState(false);
  // BL-X10: `checking` (arranque, sea restauración o callback OAuth) y `authed` recién llegado
  // comparten la MISMA pantalla de identidad -- así el splash de "primer ingreso" (login por
  // formulario, que nunca pasa por `checking`) y el de OAuth (que sí pasa por `checking`) arrancan
  // en el mismo instante en que `origenSesion` ya está seteado, sin cortes. Se resetea al salir de
  // `authed` (logout) para que el próximo ingreso vuelva a mostrar identidad.
  const [identidadTerminada, setIdentidadTerminada] = useState(false);
  useEffect(() => {
    if (status !== 'authed') setIdentidadTerminada(false);
  }, [status]);
  // Identidad estable entre renders -- `Splash`/`EntradaDiaria` la usan como dep de su propio
  // efecto (timer de cierre); un callback inline nuevo en cada render lo reiniciaría de más.
  const onIdentidadTerminada = useCallback(() => setIdentidadTerminada(true), []);

  if (status === 'checking' || (status === 'authed' && !identidadTerminada)) {
    return (
      <div className="app-frame" data-testid="app-shell-splash">
        {origenSesion === 'recien-autenticada' ? (
          <Splash onFin={onIdentidadTerminada} />
        ) : (
          <EntradaDiaria onFin={onIdentidadTerminada} />
        )}
      </div>
    );
  }

  if (status === 'authed') {
    if (!onboardingCerrado && debeMostrarOnboarding(me)) {
      return <Onboarding onTerminar={() => setOnboardingCerrado(true)} />;
    }
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
