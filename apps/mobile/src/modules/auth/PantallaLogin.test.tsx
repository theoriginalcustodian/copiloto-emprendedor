import { readFileSync } from 'fs';
import { join } from 'path';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.

/** Partial mock de `@copiloto/core`: reusa las clases de error REALES (`UnauthorizedError`) para que
 * el `instanceof` de `SessionProvider` siga funcionando — sólo se reemplazan `login`/`me`/
 * `ensureOauthTenant`. Mismo patrón que `session.test.tsx`. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    apiReal: {
      ...actual.apiReal,
      login: jest.fn(),
      me: jest.fn(),
      ensureOauthTenant: jest.fn(),
    },
  };
});

// Sign-in NATIVO (Credential Manager, sin browser) -- ver `oauth.test.ts` para el detalle de por qué
// se reemplazó `expo-web-browser` (BETA-4b, 2026-08-05).
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn().mockResolvedValue(true), signIn: jest.fn() },
  isSuccessResponse: (r: { type: string }) => r.type === 'success',
}));

import { apiReal as api, UnauthorizedError } from '@copiloto/core';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { almacenTokens } from '../../adapters/almacen';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaLogin } from './PantallaLogin';
import { SessionProvider } from './SessionProvider';

async function montar() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <PantallaLogin />
      </SessionProvider>
    </ThemeProvider>,
  );
}

describe('PantallaLogin', () => {
  beforeEach(async () => {
    await almacenTokens.limpiar();
    jest.mocked(api.login).mockReset();
    jest.mocked(api.me).mockReset();
    jest.mocked(api.ensureOauthTenant).mockReset();
    jest.mocked(GoogleSignin.signIn).mockReset();
    jest.mocked(GoogleSignin.hasPlayServices).mockReset().mockResolvedValue(true);
    (global as any).fetch = jest.fn();
    process.env.EXPO_PUBLIC_API_BASE = 'https://copilotoemprendedor.duckdns.org';
  });

  it('Martin 12/11: el login muestra SÓLO el nombre «Odobi», sin el isotipo', async () => {
    await montar();
    expect(screen.queryByTestId('marca')).toBeNull();
    expect(screen.queryByTestId('marca-isotipo')).toBeNull();
    expect(screen.getByTestId('login-wordmark')).toBeTruthy();
  });

  it('SM-Z4: el wordmark del login mide lo que dice `.ig-marca .w` del prototipo (leído de la fuente, no repetido)', async () => {
    const html = readFileSync(join(__dirname, '../../../../../Prototipo frontend/odobi-ui/prototipo/index.html'), 'utf8');
    const m = /\.ig-marca \.w\{[^}]*font-size:(\d+)px/.exec(html);
    // Control de ceguera: si la regla cambia de forma, el test falla acá y no pasa por vacío.
    expect(m).not.toBeNull();
    await montar();
    const wordmark = StyleSheet.flatten(screen.getByTestId('login-wordmark').props.style);
    expect(wordmark.fontSize).toBe(Number(m![1]));
  });





  it('login exitoso persiste el access_token y el refresh_token', async () => {
    jest.mocked(api.login).mockResolvedValueOnce({
      access_token: 'nuevo-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'nuevo-refresh',
      user: {},
      weak_password: null,
    });
    jest.mocked(api.me).mockResolvedValueOnce({ cliente_id: 'cli-1', email: 'emprendedor@copiloto.test', es_admin: false, mp_connected: false, composio_connected: [], legal_aceptado: false, legal_version_aceptada: null });

    await montar();

    // RNTL 14 + React 19: `fireEvent` es asíncrono acá (ver encabezado de `jest.config.js`) — sin el
    // `await` el `act()` interno no flushea antes de la siguiente interacción y la query siguiente
    // corre sobre estado viejo.
    await fireEvent.changeText(screen.getByTestId('login-email'), 'emprendedor@copiloto.test');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'secreta123');
    await fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(api.login).toHaveBeenCalledWith('emprendedor@copiloto.test', 'secreta123'));
    await waitFor(async () => expect(await almacenTokens.leerToken()).toBe('nuevo-token'));
    expect(await almacenTokens.leerRefresh()).toBe('nuevo-refresh');
    expect(screen.queryByTestId('login-alert')).toBeNull();
  });

  it('credenciales inválidas muestran un aviso legible y NO filtran el detalle crudo del backend', async () => {
    const detalleCrudo = 'invalid_grant: password mismatch for user 8f21';
    jest.mocked(api.login).mockRejectedValueOnce(new UnauthorizedError(detalleCrudo));

    await montar();

    await fireEvent.changeText(screen.getByTestId('login-email'), 'emprendedor@copiloto.test');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'mala-password');
    await fireEvent.press(screen.getByTestId('login-submit'));

    await waitFor(() => expect(screen.getByTestId('login-alert')).toBeTruthy());
    expect(screen.getByText('Ese mail y esa contraseña no coinciden. Probá de nuevo.')).toBeTruthy();
    // El detalle crudo del backend (mensaje interno de GoTrue/proveedor) nunca debe llegar a la UI.
    expect(screen.queryByText(detalleCrudo)).toBeNull();
    expect(await almacenTokens.leerToken()).toBeNull();
  });

  it('BL-X12m: sin pie y, con error, el campo de contraseña pasa a terracota', async () => {
    jest.mocked(api.login).mockRejectedValueOnce(new UnauthorizedError('x'));
    await montar();
    // Martin 12/11: el pie «Tus datos quedan guardados…» se sacó (no tenía sentido en el ingreso).
    expect(screen.queryByTestId('login-pie')).toBeNull();
    const borde = () => StyleSheet.flatten(screen.getByTestId('login-password').props.style).borderColor;
    const bordeSinError = borde();

    await fireEvent.changeText(screen.getByTestId('login-email'), 'emprendedor@copiloto.test');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'mala');
    await fireEvent.press(screen.getByTestId('login-submit'));
    await waitFor(() => expect(screen.getByTestId('login-alert')).toBeTruthy());

    // Control: el borde CAMBIA con el error (no es el mismo del reposo).
    expect(borde()).not.toBe(bordeSinError);
  });


  /** Orden de los testID en el árbol renderizado (recorrido en profundidad = orden de pantalla). */
  function ordenDeTestIds(): string[] {
    const ids: string[] = [];
    const visitar = (n: any): void => {
      if (!n || typeof n === 'string') return;
      if (Array.isArray(n)) return n.forEach(visitar);
      if (n.props?.testID) ids.push(n.props.testID);
      visitar(n.children);
    };
    visitar(screen.toJSON());
    return ids;
  }

  it('mapeo `ingresar`/`ingresar-error`: label «Mail», sin divisor «o», y el error va ENTRE los campos y los botones', async () => {
    jest.mocked(api.login).mockRejectedValueOnce(new UnauthorizedError('x'));
    await montar();
    expect(screen.getByText('Mail')).toBeTruthy();
    expect(screen.queryByText('Email')).toBeNull();
    expect(screen.queryByText('o')).toBeNull();

    await fireEvent.changeText(screen.getByTestId('login-email'), 'emprendedor@copiloto.test');
    await fireEvent.changeText(screen.getByTestId('login-password'), 'mala');
    await fireEvent.press(screen.getByTestId('login-submit'));
    await waitFor(() => expect(screen.getByTestId('login-alert')).toBeTruthy());

    const orden = ordenDeTestIds();
    const i = (id: string) => orden.indexOf(id);
    expect(i('login-password')).toBeGreaterThanOrEqual(0);
    expect(i('login-alert')).toBeGreaterThan(i('login-password'));
    expect(i('login-submit')).toBeGreaterThan(i('login-alert'));
  });

  it('BL-X12m: `emailInicial` precarga el mail (el reveal «Entrar» ya sabe quién era)', async () => {
    await render(
      <ThemeProvider>
        <SessionProvider>
          <PantallaLogin emailInicial="ana@x.com" />
        </SessionProvider>
      </ThemeProvider>,
    );
    expect(screen.getByTestId('login-email').props.value).toBe('ana@x.com');
  });

  it('campos vacíos no disparan request', async () => {
    await montar();

    // Ni un toque con los dos campos en blanco...
    await fireEvent.press(screen.getByTestId('login-submit'));
    // ...ni con sólo espacios (no es "contenido", es ausencia de contenido).
    await fireEvent.changeText(screen.getByTestId('login-email'), '   ');
    await fireEvent.changeText(screen.getByTestId('login-password'), '   ');
    await fireEvent.press(screen.getByTestId('login-submit'));

    expect(api.login).not.toHaveBeenCalled();
    expect(screen.queryByTestId('login-alert')).toBeNull();
  });

  // SM-L4 entrada 03: el campo del login se mide contra `.ig-campo` del prototipo, leído de la fuente.
  describe('campo del login vs `.ig-campo` del prototipo (SM-L4 entrada 03)', () => {
    const html = readFileSync(join(__dirname, '../../../../../Prototipo frontend/odobi-ui/prototipo/index.html'), 'utf8');
    const regla = /\.ig-campo\{[^}]*\}/.exec(html);
    const radioToken = /--r-s:(\d+)px/.exec(html);

    it('control de ceguera: las reglas del prototipo se encontraron', () => {
      expect(regla).not.toBeNull();
      expect(radioToken).not.toBeNull();
      expect(/\.ig-campo\.foco\{[^}]*box-shadow:0 0 0 (\d+)px/.exec(html)).not.toBeNull();
    });

    it('radio y padding del campo son los del mapa', async () => {
      const padding = /padding:0 (\d+)px/.exec(regla![0]);
      expect(padding).not.toBeNull();
      await montar();
      const campo = StyleSheet.flatten(screen.getByTestId('login-email').props.style);
      expect(campo.borderRadius).toBe(Number(radioToken![1]));
      expect(campo.paddingHorizontal).toBe(Number(padding![1]));
    });

    it('en foco el borde pasa a terracota profunda y aparece el halo; al salir vuelve', async () => {
      await montar();
      const antes = StyleSheet.flatten(screen.getByTestId('login-email').props.style);
      await fireEvent(screen.getByTestId('login-email'), 'focus');
      const foco = StyleSheet.flatten(screen.getByTestId('login-email').props.style);
      expect(foco.borderColor).not.toBe(antes.borderColor);
      const halo = screen.getByTestId('login-email').parent!;
      expect(StyleSheet.flatten(halo.props.style).backgroundColor).toBe('rgba(222,114,80,.16)');
      await fireEvent(screen.getByTestId('login-email'), 'blur');
      expect(StyleSheet.flatten(screen.getByTestId('login-email').props.style).borderColor).toBe(antes.borderColor);
      expect(StyleSheet.flatten(screen.getByTestId('login-email').parent!.props.style).backgroundColor).toBe('transparent');
    });
  });
});