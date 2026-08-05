import { useState, type FormEvent } from 'react';

import { Button, PresenceOrb, Surface } from '../design-system';
import './login.css';
import { googleAuthUrl } from './oauth';
import { useSession } from './useSession';

/**
 * Login final in-theme (Task 22, EXTRACT §5 desviación #9 — no había mockup, diseño construido
 * desde la spec `docs/copiloto-emprendedor/2026-07-03-cliente-web-mobile-design-handoff.md` sobre
 * los tokens/primitivos reales del sistema). Reemplaza `LoginSkeleton` (mismo comportamiento —
 * 5 estados vía `useSession().login` — diseño final).
 */

type FormState = 'idle' | 'enviando' | 'error-credenciales' | 'no-habilitada' | 'error-red';

export function LoginScreen() {
  const { status, login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');

  // Botón "Entrar con Google": solo si el build trae `VITE_AUTH_URL` (vhost público de auth). En dev/mock
  // o builds sin Google, `googleAuthUrl()` devuelve null → no se renderiza (feature-flag por build).
  const googleUrl = googleAuthUrl();

  // El aviso de "no habilitada" puede venir de un submit propio o de detectarlo al montar (token
  // viejo + /me 403) — lo que haya pasado más recientemente gana (mismo criterio que LoginSkeleton).
  const effectiveState: FormState =
    formState !== 'idle' ? formState : status === 'no-habilitada' ? 'no-habilitada' : 'idle';

  const disabled = formState === 'enviando';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormState('enviando');
    const result = await login(email, password);
    if (result.ok) {
      // PWA install prompt (Fase 6, Task 23): el prompt de instalación se dispara tras el primer
      // éxito TANGIBLE (no acá). Punto de enganche futuro: un `onLoginSuccess()` acá, o un
      // listener en el AppShell tras el primer render autenticado — decisión de Task 23, no de
      // este Task. `useSession` ya pasa a 'authed' y `App` re-renderiza a `AppShell`.
      return;
    }
    if (result.error === 'credenciales') setFormState('error-credenciales');
    else if (result.error === 'no-habilitada') setFormState('no-habilitada');
    else setFormState('error-red');
  }

  return (
    <div className="app-frame login-screen" data-testid="login-screen">
      <div className="login-screen__inner">
        <div className="login-screen__brand">
          <div className="login-screen__brand-row">
            <PresenceOrb size={26} />
            <span className="login-screen__brand-title">Odobi</span>
          </div>
          <p className="login-screen__tagline">tu copiloto de ia · en línea · durable</p>
        </div>

        <Surface variant="card" blur className="login-screen__card">
          <form onSubmit={handleSubmit} noValidate>
            <div className="login-screen__field">
              <label htmlFor="login-email" className="login-screen__label">
                Email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={disabled}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="login-screen__input"
              />
            </div>

            <div className="login-screen__field">
              <label htmlFor="login-password" className="login-screen__label">
                Contraseña
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={disabled}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="login-screen__input"
              />
            </div>

            <Button type="submit" disabled={disabled} className="login-screen__submit">
              {formState === 'enviando' ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>

          {effectiveState === 'error-credenciales' && (
            <p role="alert" className="login-screen__alert login-screen__alert--danger">
              Email o contraseña incorrectos. Probá de nuevo.
            </p>
          )}
          {effectiveState === 'no-habilitada' && (
            <p role="alert" className="login-screen__alert login-screen__alert--warning">
              Tu cuenta todavía no está habilitada. Escribinos para activarla.
            </p>
          )}
          {effectiveState === 'error-red' && (
            <p role="alert" className="login-screen__alert login-screen__alert--danger">
              No pudimos conectarnos. Probá de nuevo en un toque.
            </p>
          )}

          {googleUrl && (
            <>
              <div className="login-screen__divider" role="separator">
                <span>o</span>
              </div>
              <a href={googleUrl} className="login-screen__google" data-testid="login-google">
                Entrar con Google
              </a>
            </>
          )}
        </Surface>

        <div className="login-screen__links">
          <p className="login-screen__link-row">
            ¿Olvidaste tu contraseña? <span className="login-screen__link-hint">Escribinos.</span>
          </p>
          <p className="login-screen__link-row">
            ¿No tenés cuenta? <span className="login-screen__link-hint">Escribinos.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
