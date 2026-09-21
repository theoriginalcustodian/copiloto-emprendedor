import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockContrasena = vi.fn();
const mockEmail = vi.fn();
vi.mock('@copiloto/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@copiloto/core')>()),
  cambiarContrasena: (...a: unknown[]) => mockContrasena(...a),
  cambiarEmail: (...a: unknown[]) => mockEmail(...a),
}));

import { CambiarCredenciales } from './CambiarCredenciales';

const escribir = (id: string, v: string) => fireEvent.change(screen.getByTestId(id), { target: { value: v } });

describe('CambiarCredenciales (K-12 / BL-J11)', () => {
  beforeEach(() => {
    mockContrasena.mockReset();
    mockEmail.mockReset();
  });

  it('cuenta de Google: la fila de contraseña NO se renderiza; la de email sí', () => {
    render(<CambiarCredenciales cuentaGoogle />);
    expect(screen.queryByTestId('account-cambiar-contrasena')).not.toBeInTheDocument();
    expect(screen.getByTestId('account-cambiar-email')).toBeInTheDocument();
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

  it('cambio de email 200: muestra «revisá tu mail para confirmar»', async () => {
    mockEmail.mockResolvedValue({ ok: true, confirmacionPendiente: true });
    render(<CambiarCredenciales cuentaGoogle={false} />);
    fireEvent.click(screen.getByTestId('account-cambiar-email'));
    escribir('account-email-nuevo', 'nueva@direccion.com');
    fireEvent.click(screen.getByTestId('account-email-guardar'));
    await waitFor(() => expect(screen.getByTestId('account-email-pendiente')).toHaveTextContent('Revisá tu mail para confirmar'));
  });

  it('email ya en uso (409): error inline', async () => {
    mockEmail.mockResolvedValue({ ok: false, codigo: 'email_ya_registrado', mensaje: 'Ese email ya está en uso.' });
    render(<CambiarCredenciales cuentaGoogle={false} />);
    fireEvent.click(screen.getByTestId('account-cambiar-email'));
    escribir('account-email-nuevo', 'x@y.com');
    fireEvent.click(screen.getByTestId('account-email-guardar'));
    expect(await screen.findByTestId('account-email-error')).toHaveTextContent('Ese email ya está en uso.');
  });
});
