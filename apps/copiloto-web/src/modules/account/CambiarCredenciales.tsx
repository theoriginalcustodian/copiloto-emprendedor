import { useState, type FormEvent } from 'react';

import { cambiarContrasena } from '@copiloto/core';

import { Button } from '../../design-system';

/** Largo mínimo de la política de GoTrue; el backend es quien decide (`contrasena_invalida`), esto
 *  sólo evita ir a la red por un caso que ya se sabe inválido. */
const MIN_CONTRASENA = 6;

function ChevronIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="var(--label)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FormularioContrasena({ onListo }: { onListo: () => void }) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (nueva.length < MIN_CONTRASENA) return setError(`La contraseña nueva necesita al menos ${MIN_CONTRASENA} caracteres.`);
    if (nueva !== repetida) return setError('Las dos contraseñas nuevas no coinciden.');
    setError(null);
    setEnviando(true);
    try {
      const res = await cambiarContrasena(actual, nueva);
      if (res.ok) {
        setHecho(true);
        setActual('');
        setNueva('');
        setRepetida('');
      } else {
        setError(res.mensaje);
      }
    } catch {
      setError('No pudimos cambiarla ahora. Probá de nuevo en un rato.');
    } finally {
      setEnviando(false);
    }
  }

  if (hecho) {
    return (
      <div className="account-screen__credencial" data-testid="account-contrasena-ok">
        <p>Listo, cambiaste tu contraseña.</p>
        <Button variant="ghost" onClick={onListo}>Cerrar</Button>
      </div>
    );
  }

  return (
    <form className="account-screen__credencial" onSubmit={enviar} data-testid="account-contrasena-form">
      <label>
        Contraseña actual
        <input type="password" autoComplete="current-password" value={actual} onChange={(e) => setActual(e.target.value)} data-testid="account-contrasena-actual" />
      </label>
      <label>
        Contraseña nueva
        <input type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} data-testid="account-contrasena-nueva" />
      </label>
      <label>
        Repetí la contraseña nueva
        <input type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} data-testid="account-contrasena-repetida" />
      </label>
      {error != null && (
        <p role="alert" className="account-screen__credencial-error" data-testid="account-contrasena-error">
          {error}
        </p>
      )}
      <div className="account-screen__confirmar-salida-botones">
        <Button type="submit" disabled={enviando || actual === ''} data-testid="account-contrasena-guardar">
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
        <Button variant="ghost" type="button" onClick={onListo}>Cancelar</Button>
      </div>
    </form>
  );
}

/**
 * Fila «Cambiar contraseña» (K-12 / BL-J11; espejo de mobile `PantallaCuenta`). Con `cuentaGoogle` NO se
 * renderiza nada: no hay contraseña propia que cambiar y ofrecerla llevaría a un error de GoTrue
 * confuso — una fila que siempre falla enseña que la pantalla no anda.
 *
// [DIFERIDO_CIERRE_B] fila «Cambiar email»: el backend ya la soporta (POST /auth/cambiar-email,
// PR #559); falta SMTP real + ruta /auth/v1/verify en Caddy. Dueño: operador. Revisar en Cierre B.
// No se monta: el backend respondería 200 y la UI diría «revisá tu mail» sin que llegue nada — un
// éxito falso es más caro que un error (planificación, respuesta K-12 opción b).
 */
export function CambiarCredenciales({ cuentaGoogle }: { cuentaGoogle: boolean }) {
  const [abierta, setAbierta] = useState(false);
  if (cuentaGoogle) return null;

  return (
    <div className="account-screen__list" data-testid="account-credenciales">
      {abierta ? (
        <FormularioContrasena onListo={() => setAbierta(false)} />
      ) : (
        <button type="button" className="account-screen__row" data-testid="account-cambiar-contrasena" onClick={() => setAbierta(true)}>
          <span className="account-screen__row-label">Cambiar contraseña</span>
          <ChevronIcon />
        </button>
      )}
    </div>
  );
}
