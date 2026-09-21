import { useState, type FormEvent } from 'react';

import { cambiarContrasena, cambiarEmail } from '@copiloto/core';

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

function FormularioEmail({ onListo }: { onListo: () => void }) {
  const [nuevo, setNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [pendiente, setPendiente] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const email = nuevo.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Escribí un email válido.');
    setError(null);
    setEnviando(true);
    try {
      const res = await cambiarEmail(email);
      if (res.ok) setPendiente(email);
      else setError(res.mensaje);
    } catch {
      setError('No pudimos pedir el cambio ahora. Probá de nuevo en un rato.');
    } finally {
      setEnviando(false);
    }
  }

  if (pendiente != null) {
    return (
      <div className="account-screen__credencial" data-testid="account-email-pendiente">
        <p>Revisá tu mail para confirmar: te mandamos un enlace a {pendiente}. Hasta que confirmes, sigue valiendo el actual.</p>
        <Button variant="ghost" onClick={onListo}>Cerrar</Button>
      </div>
    );
  }

  return (
    <form className="account-screen__credencial" onSubmit={enviar} data-testid="account-email-form">
      <label>
        Email nuevo
        <input type="email" autoComplete="email" value={nuevo} onChange={(e) => setNuevo(e.target.value)} data-testid="account-email-nuevo" />
      </label>
      {error != null && (
        <p role="alert" className="account-screen__credencial-error" data-testid="account-email-error">
          {error}
        </p>
      )}
      <div className="account-screen__confirmar-salida-botones">
        <Button type="submit" disabled={enviando || nuevo.trim() === ''} data-testid="account-email-guardar">
          {enviando ? 'Enviando…' : 'Pedir el cambio'}
        </Button>
        <Button variant="ghost" type="button" onClick={onListo}>Cancelar</Button>
      </div>
    </form>
  );
}

/**
 * Filas «Cambiar contraseña» y «Cambiar email» (K-12 / BL-J11; espejo de mobile `PantallaCuenta`).
 * Con `cuentaGoogle` la fila de contraseña se OCULTA: no hay contraseña propia que cambiar y ofrecerla
 * llevaría a un error de GoTrue confuso — una fila que siempre falla enseña que la pantalla no anda.
 */
export function CambiarCredenciales({ cuentaGoogle }: { cuentaGoogle: boolean }) {
  const [abierta, setAbierta] = useState<'contrasena' | 'email' | null>(null);
  const cerrar = () => setAbierta(null);

  return (
    <div className="account-screen__list" data-testid="account-credenciales">
      {!cuentaGoogle &&
        (abierta === 'contrasena' ? (
          <FormularioContrasena onListo={cerrar} />
        ) : (
          <button type="button" className="account-screen__row" data-testid="account-cambiar-contrasena" onClick={() => setAbierta('contrasena')}>
            <span className="account-screen__row-label">Cambiar contraseña</span>
            <ChevronIcon />
          </button>
        ))}
      {abierta === 'email' ? (
        <FormularioEmail onListo={cerrar} />
      ) : (
        <button type="button" className="account-screen__row" data-testid="account-cambiar-email" onClick={() => setAbierta('email')}>
          <span className="account-screen__row-label">Cambiar email</span>
          <ChevronIcon />
        </button>
      )}
    </div>
  );
}
