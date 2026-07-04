// Barrel del módulo de auth (Task 6/7): sesión persistida + provider/hook de estado + pantalla de login.
export { clearToken, getToken, setToken } from './session';
export { LoginSkeleton } from './LoginSkeleton';
export { SessionProvider } from './SessionProvider';
export {
  useSession,
  type LoginErrorKind,
  type LoginResult,
  type SessionStatus,
  type UseSessionResult,
} from './useSession';
