// Barrel del módulo de auth (Task 6/7/22): sesión persistida + provider/hook de estado + pantalla
// de login (diseño final, Task 22 — reemplaza el LoginSkeleton funcional-básico).
export { clearToken, getToken, setToken } from './session';
export { LoginScreen } from './LoginScreen';
export { SessionProvider } from './SessionProvider';
export {
  useSession,
  type LoginErrorKind,
  type LoginResult,
  type SessionStatus,
  type UseSessionResult,
} from './useSession';
