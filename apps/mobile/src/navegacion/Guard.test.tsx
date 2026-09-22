import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

/**
 * `Guard` (K-14 / BL-X8 resto, ANEXO 2026-09-22): único punto de montaje del onboarding conversacional
 * en mobile. Este test cubre SÓLO el cableado (`flag false → onboarding` / `flag true → app`), no el
 * contenido del hilo — eso ya lo cubre `src/modules/onboarding/PantallaOnboarding.test.tsx`. Por eso
 * `PantallaOnboarding` se mockea acá: un stub liviano que expone un botón `onTerminar`.
 *
 * 🔴 Vive en `src/`, no en `app/`: `app/` es el árbol de rutas de expo-router y un `*.test.tsx` ahí
 * adentro entra al bundle como pantalla y tumba la app en device (ver `appSoloRutas.test.ts`, incidente
 * 2026-07-21). El import cruza a `../../app/_layout`, el archivo no.
 */
jest.mock('expo-router', () => ({ usePathname: () => '/' }));

const mockUseSession = jest.fn();
jest.mock('../modules/auth', () => {
  const { Text } = require('react-native');
  return {
    useSession: () => mockUseSession(),
    EntradaSesion: () => <Text>entrada-sesion</Text>,
    SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

jest.mock('../modules/splash/EntradaDiaria', () => {
  const { Text } = require('react-native');
  return { EntradaDiaria: () => <Text testID="entrada-diaria">entrada-diaria</Text> };
});

jest.mock('../modules/onboarding', () => {
  const { Pressable, Text } = require('react-native');
  return {
    PantallaOnboarding: ({ onTerminar }: { onTerminar: () => void }) => (
      <Pressable testID="onboarding-stub-terminar" onPress={onTerminar}>
        <Text>onboarding-stub</Text>
      </Pressable>
    ),
  };
});

import { Guard } from '../../app/_layout';

async function montar() {
  return render(
    <Guard>
      <Text testID="app-children">app-real</Text>
    </Guard>,
  );
}

describe('Guard (app/_layout.tsx) — único punto de montaje del onboarding en mobile', () => {
  beforeEach(() => {
    mockUseSession.mockReset();
  });

  it('verificando: muestra EntradaDiaria, no el onboarding ni la app', async () => {
    mockUseSession.mockReturnValue({ estado: 'verificando', me: null });
    await montar();
    expect(screen.getByTestId('entrada-diaria')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-stub-terminar')).toBeNull();
    expect(screen.queryByTestId('app-children')).toBeNull();
  });

  it('anon: muestra EntradaSesion, no el onboarding ni la app', async () => {
    mockUseSession.mockReturnValue({ estado: 'anon', me: null });
    await montar();
    expect(screen.getByText('entrada-sesion')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-stub-terminar')).toBeNull();
    expect(screen.queryByTestId('app-children')).toBeNull();
  });

  it('autenticado + onboarding_completado=false → onboarding, no la app', async () => {
    mockUseSession.mockReturnValue({ estado: 'autenticado', me: { onboarding_completado: false } });
    await montar();
    expect(screen.getByTestId('onboarding-stub-terminar')).toBeTruthy();
    expect(screen.queryByTestId('app-children')).toBeNull();
  });

  it('autenticado + onboarding_completado=true → la app, no el onboarding', async () => {
    mockUseSession.mockReturnValue({ estado: 'autenticado', me: { onboarding_completado: true } });
    await montar();
    expect(screen.getByTestId('app-children')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-stub-terminar')).toBeNull();
  });

  it('autenticado + sin `me` (undefined) → la app, no el onboarding (no se muestra por ausencia de dato)', async () => {
    mockUseSession.mockReturnValue({ estado: 'autenticado', me: null });
    await montar();
    expect(screen.getByTestId('app-children')).toBeTruthy();
    expect(screen.queryByTestId('onboarding-stub-terminar')).toBeNull();
  });

  it('cerrar el onboarding («Entrar»/«Después») revela la app en el mismo arranque, sin esperar a que el backend refresque `me`', async () => {
    mockUseSession.mockReturnValue({ estado: 'autenticado', me: { onboarding_completado: false } });
    await montar();
    fireEvent.press(screen.getByTestId('onboarding-stub-terminar'));
    await waitFor(() => expect(screen.getByTestId('app-children')).toBeTruthy());
    expect(screen.queryByTestId('onboarding-stub-terminar')).toBeNull();
  });
});
