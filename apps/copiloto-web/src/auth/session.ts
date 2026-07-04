/**
 * Persistencia del token de sesión (Task 6). Puro, sin React — `useSession` es el único
 * consumidor "con estado"; `lib/api/client.ts` lo usa directo para inyectar el Bearer.
 */

const STORAGE_KEY = 'copiloto-token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // localStorage puede tirar (modo privado / cuota) — tratar como "sin sesión", nunca romper.
    return null;
  }
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Persistencia best-effort.
  }
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Persistencia best-effort.
  }
}
