import { useState, type FormEvent } from 'react';

import { Button, PresenceOrb, Surface } from '../design-system';
import './login.css';
import { api } from '../lib/api';
import { LegalScreen, type LegalKind } from './LegalScreen';
import { useSession } from './useSession';

/**
 * BETA-4b (M6 onboarding mínimo, `contrato_planificacion-a-todos_SPRINT-beta-el-mapa.md`): alta
 * self-service — mismo look del login (`login.css` reusado, cero CSS nuevo). `POST /auth/signup`
 * (admin-mediado hoy, spec §5.1) crea user+tenant pero NO devuelve tokens (`SignupResponse`) — este
 * componente encadena `useSession().login(email, password)` con las MISMAS credenciales para
 * loguear, reusando toda la máquina de estado de sesión existente (token, `/me`, 'authed'/
 * 'no-habilitada') en vez de reimplementarla acá.
 *
 * 🔴 Reachable hoy SOLO por ruta directa (`?signup=1`, ver `App.tsx`) — el link público "Crear
 * cuenta" del login NO se expone todavía: `POST /auth/signup` no tiene invite-gate (cualquiera con
 * la URL puede autoprovisionarse un tenant), y la decisión operador #3 (modo de alta: invitación
 * directa / lista de espera) sigue sin resolver. Ver
 * `hallazgo_frontend-a-todos_BETA-4b-signup-endpoint-existe-pero-publico-y-sin-tokens.md`.
 */

type FormState = 'idle' | 'enviando' | 'error-red' | 'error-login-tras-signup';

export interface SignupScreenProps {
  /** Vuelve a `LoginScreen` — no hay router, el toggle vive en el padre (`App.tsx`). */
  onVolverALogin: () => void;
  /** Se dispara tras un signup+login exitosos, ANTES de que `useSession` pase a 'authed' —
   * `App.tsx` lo usa para marcar "recién firmado" y aterrizar en Conexiones, no en Chat. */
  onSignupExitoso: () => void;
}

export function SignupScreen({ onVolverALogin, onSignupExitoso }: SignupScreenProps) {
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  // BETA-2.a: swap de pantalla completa (mismo patrón que Login<->Signup en `App.tsx`) — sin
  // router, "abrir" ToS/Privacidad es reemplazar el form por `LegalScreen` y volver reconstruye el
  // mismo estado (email/password NO se pierden, siguen en el `useState` de este componente).
  const [legalAbierto, setLegalAbierto] = useState<LegalKind | null>(null);

  const disabled = formState === 'enviando';

  if (legalAbierto) {
    return <LegalScreen kind={legalAbierto} onVolver={() => setLegalAbierto(null)} />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormState('enviando');
    try {
      await api.signup(email, password);
    } catch {
      // 422 con email no-hallable (caso raro, ver onboarding.py) u otro error de red/servidor —
      // ambos son indistinguibles de "no pudimos crear tu cuenta" para el usuario.
      setFormState('error-red');
      return;
    }

    const result = await login(email, password);
    if (result.ok) {
      onSignupExitoso();
      return;
    }
    // El signup fue idempotente (email ya existía) pero la password no matchea la cuenta
    // ORIGINAL — `admin_create_user` no verifica password en el camino de "ya existe", así que
    // esto NO es un error de red: es "esa cuenta ya es de otra persona/sesión anterior".
    setFormState('error-login-tras-signup');
  }

  return (
    <div className="app-frame login-screen" data-testid="signup-screen">
      <div className="login-screen__inner">
        <div className="login-screen__brand">
          <div className="login-screen__brand-row">
            <PresenceOrb size={26} />
            <span className="login-screen__brand-title">Copiloto del Emprendedor</span>
          </div>
          <p className="login-screen__tagline">creá tu cuenta</p>
        </div>

        <Surface variant="card" blur className="login-screen__card">
          <form onSubmit={handleSubmit} noValidate>
            <div className="login-screen__field">
              <label htmlFor="signup-email" className="login-screen__label">
                Email
              </label>
              <input
                id="signup-email"
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
              <label htmlFor="signup-password" className="login-screen__label">
                Contraseña
              </label>
              <input
                id="signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                disabled={disabled}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="login-screen__input"
              />
            </div>

            <Button type="submit" disabled={disabled} className="login-screen__submit">
              {formState === 'enviando' ? 'Creando cuenta…' : 'Crear cuenta'}
            </Button>
          </form>

          <p className="login-screen__link-row" style={{ marginTop: 12 }}>
            Al crear tu cuenta aceptás los{' '}
            <button
              type="button"
              className="login-screen__link-hint"
              onClick={() => setLegalAbierto('tos')}
            >
              Términos y Condiciones
            </button>{' '}
            y la{' '}
            <button
              type="button"
              className="login-screen__link-hint"
              onClick={() => setLegalAbierto('privacidad')}
            >
              Política de Privacidad
            </button>
            .
          </p>

          {formState === 'error-login-tras-signup' && (
            <p role="alert" className="login-screen__alert login-screen__alert--warning">
              Ya existe una cuenta con ese email. Si es tuya, iniciá sesión con tu contraseña.
            </p>
          )}
          {formState === 'error-red' && (
            <p role="alert" className="login-screen__alert login-screen__alert--danger">
              No pudimos crear tu cuenta. Probá de nuevo en un toque.
            </p>
          )}
        </Surface>

        <div className="login-screen__links">
          <p className="login-screen__link-row">
            ¿Ya tenés cuenta?{' '}
            <button type="button" className="login-screen__link-hint" onClick={onVolverALogin}>
              Iniciá sesión.
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
