import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockContrasena = vi.fn();
vi.mock('@copiloto/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@copiloto/core')>()),
  cambiarContrasena: (...a: unknown[]) => mockContrasena(...a),
}));

import { CambiarCredenciales } from './CambiarCredenciales';

const escribir = (id: string, v: string) => fireEvent.change(screen.getByTestId(id), { target: { value: v } });

describe('CambiarCredenciales (K-12 / BL-J11)', () => {
  beforeEach(() => {
    mockContrasena.mockReset();
  });

  it('cuenta de Google: no se renderiza nada (ni fila de contraseña ni de email)', () => {
    render(<CambiarCredenciales cuentaGoogle />);
    expect(screen.queryByTestId('account-credenciales')).not.toBeInTheDocument();
  });

  // [DIFERIDO_CIERRE_B] la fila «Cambiar email» no se monta hasta que haya SMTP real: un 200 sin mail
  // sería un éxito falso (planificación, K-12 opción b).
  it('la fila «Cambiar email» NO existe', () => {
    render(<CambiarCredenciales cuentaGoogle={false} />);
    expect(screen.getByTestId('account-cambiar-contrasena')).toBeInTheDocument();
    expect(screen.queryByTestId('account-cambiar-email')).not.toBeInTheDocument();
  });

  it('contraseña actual incorrecta: error inline con el mensaje del backend', async () => {
    mockContrasena.mockResolvedValue({ ok: false, codigo: 'contrasena_actual_incorrecta', mensaje: 'La contraseña actual no coincide.' });
    render(<CambiarCredenciales cuentaGoogle={false} />);
    fireEvent.click(screen.getByTestId('account-cambiar-contrasena'));
    escribir('account-contrasena-actual', 'mala');
    escribir('account-contrasena-nueva', 'nueva-larga');
    escribir('account-contrasena-repetida', 'nueva-larga');
    fireEvent.click(screen.getByTestId('account-contrasena-guardar'));
    expect(await screen.findByTestId('account-contrasena-error')).toHaveTextContent('La contraseña actual no coincide.');
    expect(mockContrasena).toHaveBeenCalledWith('mala', 'nueva-larga');
  });

  it('las dos nuevas no coinciden: no va a la red', async () => {
    render(<CambiarCredenciales cuentaGoogle={false} />);
    fireEvent.click(screen.getByTestId('account-cambiar-contrasena'));
    escribir('account-contrasena-actual', 'a');
    escribir('account-contrasena-nueva', 'nueva-larga');
    escribir('account-contrasena-repetida', 'otra-cosa');
    fireEvent.click(screen.getByTestId('account-contrasena-guardar'));
    expect(await screen.findByTestId('account-contrasena-error')).toHaveTextContent('no coinciden');
    expect(mockContrasena).not.toHaveBeenCalled();
  });
});
