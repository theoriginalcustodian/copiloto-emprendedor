/**
 * CTA5 — **la sesión murió y nadie se enteró**.
 *
 * Origen: el operador tocó «Enviar» en Feedback desde su teléfono y leyó
 * `missing or malformed Authorization header`. El 401 era correcto (sesión vieja); lo roto era lo que
 * la app hacía con él — el cliente ya había limpiado los tokens, pero la app seguía **mostrándose
 * logueada**, sin camino de vuelta al login salvo adivinarlo.
 *
 * Estos tests recorren la costura ENTERA y con el camino de producción: `fetch` → el cliente HTTP
 * real de la web (`lib/api/client.ts`, la copia propia, no el core) → `notificarSesionExpirada` →
 * `SessionProvider` → el texto en la pantalla. Mockear el cliente probaría el provider contra un
 * doble y dejaría el eslabón que falló sin cubrir
 * ([[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]]).
 *
 * Cada test dice qué revertir para verlo en ROJO: «deslogueado» se parece demasiado a un estado
 * legítimo, y un test verde que no distingue las dos cosas no prueba nada.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { marcarSesionViva } from '@copiloto/core';

import { ApiError, apiClient } from '../lib/api/client';
import { LoginScreen } from './LoginScreen';
import { getRefreshToken, setRefreshToken } from './session';
import { SessionProvider } from './SessionProvider';

function respuesta(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) } as Response;
}

/** El texto crudo que el backend manda en el 401 y que el usuario NO puede terminar leyendo. */
const DETALLE_CRUDO = 'missing or malformed Authorization header';

function montarLogin() {
  return render(
    <SessionProvider>
      <LoginScreen />
    </SessionProvider>,
  );
}

describe('CTA5 — una sesión que se cae sola termina en el login, en castellano', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // 🔴 El candado de "una muerte, un aviso" es estado de MÓDULO. Sin rearmarlo acá, el primer test
    // que dispara una muerte deja mudos a los siguientes — y los controles negativos («no avisa»)
    // pasarían por el candado, no por el discriminador que dicen medir. Verde sin significado.
    marcarSesionViva();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('EL QUE IMPORTA: refresh muerto → aviso en castellano en la pantalla de login', async () => {
    // Revertí el `notificarSesionExpirada()` de `client.ts` (o la suscripción del provider) y esto
    // se pone rojo: la app queda en el login pero MUDA, que es el defecto original visto de frente.
    setRefreshToken('rt-muerto');
    // `/me` sale sin Bearer (no hay access token) porque la renovación previa falló → 401 definitivo.
    fetchMock
      .mockResolvedValueOnce(respuesta(401, { detail: 'refresh token not found' })) // /auth/refresh
      .mockResolvedValueOnce(respuesta(401, { detail: DETALLE_CRUDO })); // /me

    montarLogin();

    expect(await screen.findByText('Tu sesión expiró. Entrá de nuevo.')).toBeInTheDocument();
    // El punto 2 del contrato: el string interno del backend no se muestra NUNCA.
    expect(screen.queryByText(DETALLE_CRUDO)).not.toBeInTheDocument();
    // Y la sesión quedó realmente borrada, no sólo anunciada.
    expect(getRefreshToken()).toBeNull();
  });

  it('control: arranque anónimo normal → login SIN aviso', async () => {
    // Sin este control, el test de arriba pasaría igual con un provider que muestre el aviso siempre
    // — y todo visitante que nunca se logueó leería «tu sesión expiró», que es falso y alarmante.
    montarLogin();

    await waitFor(() => expect(screen.getByTestId('login-screen')).toBeInTheDocument());
    expect(screen.queryByText('Tu sesión expiró. Entrá de nuevo.')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('control: un 401 SIN sesión propia (credenciales mal tipeadas) no avisa nada', async () => {
    // `POST /auth/login` va con `auth:false`: no hay sesión que haya muerto, hay una que nunca
    // existió. Si el aviso se disparara acá, el usuario que erra la contraseña leería que «su sesión
    // expiró» — el discriminador `sesionMuerta` es justamente lo que separa los dos casos.
    fetchMock.mockResolvedValueOnce(respuesta(401, { detail: 'Invalid login credentials' }));

    montarLogin();
    await waitFor(() => expect(screen.getByTestId('login-screen')).toBeInTheDocument());

    await expect(
      apiClient.post('/auth/login', { email: 'a@b.c', password: 'mal' }, { auth: false }),
    ).rejects.toThrow();

    expect(screen.queryByText('Tu sesión expiró. Entrá de nuevo.')).not.toBeInTheDocument();
  });

  it('control: un 422 real sigue mostrando el `detail` del backend — eso estaba bien y no se toca', async () => {
    // El contrato lo pide explícito: el `detail` crudo se silencia SÓLO en el 401. En un 422 el
    // backend manda castellano útil («feedback demasiado largo (máx 2000 caracteres)») y la pantalla
    // lo tiene que seguir mostrando tal cual.
    setRefreshToken('rt-vivo');
    fetchMock
      .mockResolvedValueOnce(respuesta(200, { access_token: 'tok', refresh_token: 'rt2' }))
      .mockResolvedValueOnce(respuesta(422, { detail: 'feedback demasiado largo (máx 2000 caracteres)' }));

    const error = await apiClient.post('/feedback', { texto: 'x' }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).detail).toBe('feedback demasiado largo (máx 2000 caracteres)');
    // Y la sesión sigue viva: un 422 no desloguea a nadie.
    expect(getRefreshToken()).toBe('rt2');
  });
});
