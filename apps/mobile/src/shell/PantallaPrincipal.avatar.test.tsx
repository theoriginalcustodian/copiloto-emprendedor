/**
 * SM-I5: las dos capas muestran la misma inicial, salida del perfil real. Se monta el shell y no cada pantalla
 * por separado porque lo que puede romperse es el cable: una capa sin la prop vuelve al glifo y nada más avisa.
 */
import { render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn() },
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

jest.mock('@copiloto/core', () => ({
  ...jest.requireActual('@copiloto/core'),
  leerPerfilNegocio: jest.fn(async () => ({ status: 'ok', perfil: { nombreComercial: 'Mostrador' } })),
}));

jest.mock('../modules/auth/useSession', () => ({
  useSession: () => ({ me: { cliente_id: 'cli-avatar-test', email: 'usuario@copiloto.test' } }),
}));

import { ThemeProvider } from '../theme/ThemeProvider';
import { PantallaPrincipal } from './PantallaPrincipal';

describe('PantallaPrincipal — la inicial del avatar', () => {
  it('Mi día y el escritorio muestran la inicial del nombre comercial', async () => {
    await render(
      <ThemeProvider>
        <PantallaPrincipal />
      </ThemeProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('avatar-cuenta-inicial')).toHaveTextContent('M'));
    expect(screen.getByTestId('escritorio-avatar-inicial')).toHaveTextContent('M');
  });
});
