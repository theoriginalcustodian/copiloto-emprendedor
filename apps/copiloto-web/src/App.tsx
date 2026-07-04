import { ThemeProvider } from './design-system/ThemeProvider';
import { SessionProvider } from './auth/SessionProvider';
import { LoginSkeleton } from './auth/LoginSkeleton';
import { useSession } from './auth/useSession';
import { ChatSkeleton } from './modules/chat/ChatSkeleton';

/**
 * Router raíz por estado de sesión (Task 7): 'checking' -> splash; 'authed' -> ChatSkeleton;
 * cualquier otro estado ('anon' | 'no-habilitada') -> LoginSkeleton (que ya sabe mostrar el aviso
 * de cuenta no-habilitada leyendo la sesión compartida — ver auth/LoginSkeleton.tsx).
 */
function AppRouter() {
  const { status } = useSession();

  if (status === 'checking') {
    return (
      <div className="app-frame" data-testid="app-shell">
        <main>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--mono)', padding: 16 }}>
            Copiloto del Emprendedor — cargando tu copiloto…
          </p>
        </main>
      </div>
    );
  }

  if (status === 'authed') return <ChatSkeleton />;
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
