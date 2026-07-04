import { ThemeProvider } from './design-system/ThemeProvider';
import { SessionProvider } from './auth/SessionProvider';
import { LoginSkeleton } from './auth/LoginSkeleton';
import { useSession } from './auth/useSession';
import { AppShell } from './shell/AppShell';

/**
 * Router raíz por estado de sesión (Task 7): 'checking' -> splash; 'authed' -> AppShell (shell
 * mobile con tab-bar Chat·Apps·Conexiones·Cuenta, Task 9 — antes montaba `ChatScreen` directo,
 * ahora el Chat es uno de los 4 tabs que el shell orquesta); cualquier otro estado
 * ('anon' | 'no-habilitada') -> LoginSkeleton (que ya sabe mostrar el aviso de cuenta
 * no-habilitada leyendo la sesión compartida — ver auth/LoginSkeleton.tsx).
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

  if (status === 'authed') return <AppShell />;
  return <LoginSkeleton />;
}

export function App() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <AppRouter />
      </SessionProvider>
    </ThemeProvider>
  );
}
