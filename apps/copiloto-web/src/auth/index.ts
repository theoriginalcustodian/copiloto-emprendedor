// Barrel del módulo de auth (Task 6/7): sesión persistida + hook de estado + pantalla de login.
export { clearToken, getToken, setToken } from './session';
export { LoginSkeleton } from './LoginSkeleton';
export {
  useSession,
  type LoginErrorKind,
  type LoginResult,
  type SessionStatus,
  type UseSessionResult,
} from './useSession';
