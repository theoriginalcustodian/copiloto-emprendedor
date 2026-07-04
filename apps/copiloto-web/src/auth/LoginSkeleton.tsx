import { useState, type CSSProperties, type FormEvent } from 'react';

import { Button, Surface } from '../design-system';
import { useSession } from './useSession';

/**
 * Login funcional (Task 6) — in-theme básico con primitivos, NO el diseño final (eso es de otra
 * fase). Cubre los 5 estados: idle, enviando, error-credenciales (401), no-habilitada (403),
 * error-red. También cubre el caso "ya tenía token pero /me devolvió 403" leyendo `status`
 * directo de `useSession` (no hace falta una pantalla aparte para eso).
 */

type FormState = 'idle' | 'enviando' | 'error-credenciales' | 'no-habilitada' | 'error-red';

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  marginTop: 6,
  marginBottom: 16,
  borderRadius: 10,
  border: '1px solid var(--cancel-border, rgba(150, 150, 180, 0.3))',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
};

const alertStyle: CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 13,
  marginTop: 16,
};

export function LoginSkeleton() {
  const { status, login } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');

  // El aviso de "no habilitada" puede venir de un submit propio o de detectarlo al montar
  // (token viejo + /me 403) — lo que haya pasado más recientemente gana.
  const effectiveState: FormState =
    formState !== 'idle' ? formState : status === 'no-habilitada' ? 'no-habilitada' : 'idle';

  const disabled = formState === 'enviando';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormState('enviando');
    const result = await login(email, password);
    if (result.ok) return; // useSession pasa a 'authed' -> App re-renderiza a ChatSkeleton.
    if (result.error === 'credenciales') setFormState('error-credenciales');
    else if (result.error === 'no-habilitada') setFormState('no-habilitada');
    else setFormState('error-red');
  }

  return (
    <div className="app-frame" data-testid="login-skeleton">
      <div style={{ padding: 16 }}>
        <Surface variant="card" style={{ padding: '24px 20px' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 6 }}>
            Copiloto del Emprendedor
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', color: 'var(--mono)', fontSize: 13, marginBottom: 20 }}>
            Entrá con tu cuenta para arrancar.
          </p>
          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="login-email" style={{ fontSize: 13 }}>
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
              style={inputStyle}
            />
            <label htmlFor="login-password" style={{ fontSize: 13 }}>
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
              style={inputStyle}
            />
            <Button type="submit" disabled={disabled} style={{ width: '100%' }}>
              {formState === 'enviando' ? 'Entrando…' : 'Entrar'}
            </Button>
          </form>
          {effectiveState === 'error-credenciales' && (
            <p role="alert" style={alertStyle}>
              Email o contraseña incorrectos. Probá de nuevo.
            </p>
          )}
          {effectiveState === 'no-habilitada' && (
            <p role="alert" style={alertStyle}>
              Tu cuenta todavía no está habilitada. Escribinos para activarla.
            </p>
          )}
          {effectiveState === 'error-red' && (
            <p role="alert" style={alertStyle}>
              No pudimos conectarnos. Probá de nuevo en un toque.
            </p>
          )}
        </Surface>
      </div>
    </div>
  );
}
