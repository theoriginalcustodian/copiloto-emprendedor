/**
 * «Creá tu cuenta» (flujo «Entrada a Odobi», Martin 12/11): alta con mail + contraseña vía `registrar`.
 * ⚠️ Todo `fireEvent`/`render` va con `await` (RNTL 14).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { MINIMO_CONTRASENA, PantallaRegistro } from './PantallaRegistro';
import { SessionContext, type UseSessionResult } from './useSession';

function sesion(over: Partial<UseSessionResult> = {}): UseSessionResult {
  return {
    estado: 'anon',
    me: null,
    primeraVez: true,
    login: jest.fn(),
    loginConGoogle: jest.fn(),
    registrar: jest.fn(),
    logout: jest.fn(),
    ...over,
  };
}

const onIrAIngreso = jest.fn();
const onVolver = jest.fn();

async function montar(valor: UseSessionResult, emailInicial = '') {
  return render(
    <ThemeProvider>
      <SessionContext.Provider value={valor}>
        <PantallaRegistro emailInicial={emailInicial} onIrAIngreso={onIrAIngreso} onVolver={onVolver} />
      </SessionContext.Provider>
    </ThemeProvider>,
  );
}

async function completar(email: string, password: string) {
  await fireEvent.changeText(screen.getByTestId('registro-email'), email);
  await fireEvent.changeText(screen.getByTestId('registro-password'), password);
}

describe('PantallaRegistro', () => {
  beforeEach(() => {
    onIrAIngreso.mockReset();
    onVolver.mockReset();
  });

  it('el botón no dispara el alta hasta que el mail es válido y la contraseña llega al mínimo', async () => {
    const registrar = jest.fn();
    await montar(sesion({ registrar }));
    await completar('ana@x.com', 'a'.repeat(MINIMO_CONTRASENA - 1));
    expect(screen.getByTestId('registro-regla').props.children[0]).toBe('·');
    await fireEvent.press(screen.getByTestId('registro-submit'));
    expect(registrar).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('registro-password'), 'a'.repeat(MINIMO_CONTRASENA));
    expect(screen.getByTestId('registro-regla').props.children[0]).toBe('✓');
  });

  it('con datos válidos llama a `registrar` con el mail sin espacios', async () => {
    const registrar = jest.fn().mockResolvedValue({ ok: true });
    await montar(sesion({ registrar }));
    await completar('  ana@x.com ', 'contraseña1');
    await fireEvent.press(screen.getByTestId('registro-submit'));
    await waitFor(() => expect(registrar).toHaveBeenCalledWith('ana@x.com', 'contraseña1'));
    expect(screen.queryByTestId('registro-alerta')).toBeNull();
  });

  it('si el mail ya tiene cuenta ofrece entrar con ese mail', async () => {
    const registrar = jest.fn().mockResolvedValue({ ok: false, error: 'credenciales' });
    await montar(sesion({ registrar }));
    await completar('ana@x.com', 'contraseña1');
    await fireEvent.press(screen.getByTestId('registro-submit'));
    await waitFor(() => expect(screen.getByTestId('registro-alerta')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('registro-ir-ingreso-existente'));
    expect(onIrAIngreso).toHaveBeenCalledWith('ana@x.com');
  });

  it('un alta rechazada muestra el mensaje legible; un corte de red, el aviso de conexión', async () => {
    const registrar = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'credenciales', mensaje: 'No pudimos crear la cuenta.' })
      .mockResolvedValueOnce({ ok: false, error: 'red' });
    await montar(sesion({ registrar }));
    await completar('ana@x.com', 'contraseña1');
    await fireEvent.press(screen.getByTestId('registro-submit'));
    await waitFor(() => expect(screen.getByTestId('registro-alerta').props.children).toBe('No pudimos crear la cuenta.'));
    await fireEvent.press(screen.getByTestId('registro-submit'));
    await waitFor(() => expect(screen.getByTestId('registro-alerta').props.children).toMatch(/No pudimos conectarnos/));
  });

  it('«Ya tengo cuenta» y «Otras formas de entrar» devuelven el control', async () => {
    await montar(sesion(), 'ana@x.com');
    expect(screen.getByTestId('registro-email').props.value).toBe('ana@x.com');
    await fireEvent.press(screen.getByTestId('registro-ir-ingreso'));
    expect(onIrAIngreso).toHaveBeenCalledWith('ana@x.com');
    await fireEvent.press(screen.getByTestId('registro-volver'));
    expect(onVolver).toHaveBeenCalledTimes(1);
  });
});
