import { act, render, renderHook, screen, waitFor } from '@testing-library/react-native';

// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.

/**
 * CTA5 en mobile — **la mitad que vive de este lado de la costura**.
 *
 * Acá fue donde el defecto se vio: el operador tocó «Enviar» en Feedback con la sesión ya caducada y
 * leyó `missing or malformed Authorization header`, sin ningún camino de vuelta al login. El core ya
 * había borrado los tokens; lo que faltaba era que alguien se enterara.
 *
 * **Qué cubre cada test, para que el reparto no quede implícito:** el eslabón «un 401 que mata la
 * sesión dispara el aviso» es del cliente HTTP del core y está probado en
 * `packages/core/src/api/sesion.test.ts` (8 tests: los dos controles negativos —el 401 del login
 * `auth:false` y un 403 NO avisan— más la tormenta de 401 concurrentes, que tiene que producir **un
 * solo** aviso). Lo que ningún test cubría hasta acá es lo de abajo: que el
 * `SessionProvider` de mobile reaccione a ese aviso y que la pantalla lo muestre. Por eso estos tests
 * disparan `notificarSesionExpirada()` REAL —no un mock— sobre el registro REAL del core.
 *
 * Cada test dice qué revertir para verlo en rojo.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    apiReal: { ...actual.apiReal, login: jest.fn(), me: jest.fn(), ensureOauthTenant: jest.fn() },
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn().mockResolvedValue(true), signIn: jest.fn() },
  isSuccessResponse: (r: { type: string }) => r.type === 'success',
}));

import {
  apiReal as api,
  marcarSesionViva,
  MENSAJE_SESION_EXPIRADA,
  notificarSesionExpirada,
} from '@copiloto/core';

import { almacenTokens } from '../../adapters/almacen';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaLogin } from './PantallaLogin';
import { SessionProvider } from './SessionProvider';
import { useSession } from './useSession';

// Mismas formas que `session.test.tsx` — `MeResponse` es `{cliente_id, email}` y nada más.
const ME = { cliente_id: 'cli-1', email: 'e2e-device@copiloto.test' };
const LOGIN_OK = {
  access_token: 'tok',
  token_type: 'bearer',
  expires_in: 3600,
  refresh_token: 'rt',
  user: {},
};

async function montar() {
  return render(
    <ThemeProvider>
      <SessionProvider>
        <PantallaLogin />
      </SessionProvider>
    </ThemeProvider>,
  );
}

describe('CTA5 mobile — la sesión que se cae sola avisa en castellano', () => {
  beforeEach(async () => {
    await almacenTokens.limpiar();
    // 🔴 El candado de «una muerte, un aviso» es estado de MÓDULO: sin rearmarlo, el primer test que
    // dispara deja mudos a los siguientes y los controles pasarían por el candado, no por lo que dicen
    // medir.
    marcarSesionViva();
    jest.mocked(api.login).mockReset();
    jest.mocked(api.me).mockReset();
  });

  it('EL QUE IMPORTA: el aviso del core aparece en la pantalla de login', async () => {
    // Revertí la suscripción `alExpirarSesion` del provider, o el bloque que lo renderiza en
    // `PantallaLogin`, y esto se pone rojo: la app vuelve al login MUDA, que es el defecto original.
    await montar();
    expect(screen.queryByTestId('login-aviso-sesion')).toBeNull(); // antes del aviso, nada

    await act(async () => {
      notificarSesionExpirada();
    });

    expect(screen.getByTestId('login-aviso-sesion')).toHaveTextContent(MENSAJE_SESION_EXPIRADA);
  });

  it('control: arranque anónimo normal → login SIN aviso', async () => {
    // Sin este control, el de arriba pasaría igual con una pantalla que muestre el aviso siempre —
    // y todo emprendedor que abre la app por primera vez leería que «su sesión expiró».
    await montar();

    expect(screen.queryByTestId('login-aviso-sesion')).toBeNull();
    expect(api.me).not.toHaveBeenCalled();
  });

  it('el aviso se BORRA al entrar de nuevo — se prueba en el estado, no en la pantalla', async () => {
    // Por qué en el estado y no con un `press`: en la pantalla el aviso también se esconde porque
    // `estadoEfectivo` deja de ser `'idle'` al enviar el formulario, así que un test de UI daría
    // verde IGUAL con el `setAvisoSesion(undefined)` borrado — mediría la condición de render, no la
    // limpieza. Y el caso que la limpieza cubre es posterior: entrar bien, salir a mano y volver al
    // login con un «tu sesión expiró» viejo pegado, hablando de una sesión que ya no existe.
    //
    // Revertí el `setAvisoSesion(undefined)` del `login` y esto se pone rojo.
    jest.mocked(api.login).mockResolvedValue(LOGIN_OK);
    jest.mocked(api.me).mockResolvedValue(ME);

    // `await renderHook` — mismo patrón que `session.test.tsx`: en RNTL 14 + React 19 el render
    // inicial es asíncrono y sin el `await` las aserciones corren contra estado sin flushear.
    const { result } = await renderHook(() => useSession(), { wrapper: SessionProvider });
    await waitFor(() => expect(result.current.estado).toBe('anon'));

    await act(async () => {
      notificarSesionExpirada();
    });
    expect(result.current.avisoSesion).toBe(MENSAJE_SESION_EXPIRADA);

    await act(async () => {
      await result.current.login('e2e-device@copiloto.test', 'x');
    });

    expect(result.current.estado).toBe('autenticado');
    expect(result.current.avisoSesion).toBeUndefined();
  });
});
