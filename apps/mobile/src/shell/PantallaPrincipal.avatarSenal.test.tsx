/**
 * SM-N28 — control de la SEÑAL: al sacar el avatar de Mi día, el punto de "conexión caída" tiene que seguir
 * encendiendo en el avatar que queda (el del escritorio). El cálculo vive en Mi día y viaja por
 * `onConexionCaida` → `avisa` del escritorio; un barrido que se llevara ese estado junto con el avatar
 * apagaría el punto en OTRA pantalla. Sin este caso, "se ve bien" no distingue señal viva de señal apagada.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

const mockCatalogo = jest.fn();
jest.mock('@copiloto/core', () => ({
  ...jest.requireActual('@copiloto/core'),
  listarCatalogo: (...a: unknown[]) => mockCatalogo(...a),
}));

jest.mock('../modules/auth/useSession', () => ({
  useSession: () => ({ me: { cliente_id: 'cli-senal-test', email: 'usuario@copiloto.test' } }),
}));

import { ThemeProvider } from '../theme/ThemeProvider';
import { PantallaPrincipal } from './PantallaPrincipal';

function montar() {
  return render(
    <ThemeProvider>
      <PantallaPrincipal />
    </ThemeProvider>,
  );
}

describe('PantallaPrincipal — la señal de conexión caída llega al único avatar', () => {
  it('con un servicio caído, el punto enciende en el avatar del escritorio', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [{ key: 'gmail', estado: 'caido' }] });
    await montar();

    await waitFor(() => expect(screen.getByTestId('escritorio-avatar-punto')).toBeTruthy());
    expect(screen.queryByTestId('avatar-cuenta')).toBeNull();
  });

  it('control negativo: con todo conectado el punto NO está (no es un punto fijo)', async () => {
    mockCatalogo.mockResolvedValue({ status: 'ok', servicios: [{ key: 'gmail', estado: 'conectado' }] });
    await montar();

    await waitFor(() => expect(mockCatalogo).toHaveBeenCalled());
    expect(screen.queryByTestId('escritorio-avatar-punto')).toBeNull();
  });
});
