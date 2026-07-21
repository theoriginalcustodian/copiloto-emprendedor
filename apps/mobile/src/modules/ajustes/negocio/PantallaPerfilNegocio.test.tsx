import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/**
 * Partial mock de `@copiloto/core`: sólo se reemplazan las 2 funciones de red de `perfilNegocio.ts`.
 *
 * 🔴 **`ApiError` se conserva REAL (`...actual`) y no es un detalle.** El componente hace
 * `e instanceof ApiError` para decidir si muestra el `detail` del backend o un mensaje genérico; una
 * clase falsa declarada en este archivo rompe ese chequeo con `TypeError: Right-hand side of
 * 'instanceof' is not an object` — la factory de `jest.mock` se ejecuta al primer `require`, antes
 * de que la `class` del test salga de su zona muerta temporal. Probado: así fallaba.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, leerPerfilNegocio: jest.fn(), guardarPerfilNegocio: jest.fn() };
});

import { ApiError, guardarPerfilNegocio, leerPerfilNegocio } from '@copiloto/core';

import { ThemeProvider } from '../../../theme/ThemeProvider';
import { PantallaPerfilNegocio } from './PantallaPerfilNegocio';

const mockLeer = leerPerfilNegocio as jest.MockedFunction<typeof leerPerfilNegocio>;
const mockGuardar = guardarPerfilNegocio as jest.MockedFunction<typeof guardarPerfilNegocio>;

const PERFIL = {
  queVende: 'Instalaciones eléctricas',
  aQuien: 'ambos' as const,
  nombreComercial: 'Electricidad Pérez',
  horarioAtencion: 'Lunes a viernes de 8 a 17',
  formalidad: 'cercano' as const,
  largoRespuesta: 'breve' as const,
  nombreCopiloto: 'Copi',
  actualizadoEn: '2026-07-21T22:14:03.120Z',
};

// `async` + `await`: `render()` es una promesa con RNTL 14 + React 19 (ver `jest.config.js`).
async function montar() {
  return render(
    <ThemeProvider>
      <PantallaPerfilNegocio />
    </ThemeProvider>,
  );
}

describe('PantallaPerfilNegocio', () => {
  beforeEach(() => {
    mockLeer.mockReset();
    mockGuardar.mockReset();
    mockLeer.mockResolvedValue({ status: 'ok', perfil: PERFIL });
    mockGuardar.mockResolvedValue({ status: 'ok', perfil: PERFIL });
  });

  it('precarga los campos con el perfil guardado', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('perfil-negocio-seccion-negocio')).toBeTruthy());
    expect(screen.getByTestId('perfil-negocio-que-vende-input').props.value).toBe('Instalaciones eléctricas');
  });

  /**
   * 🔴 El caso MÁS común el primer día. Un cartel de error acá le diría al emprendedor que algo se
   * rompió cuando lo único que pasa es que todavía no completó nada — y lo mandaría a reintentar
   * algo que no tiene nada que reintentar.
   */
  it('perfil:null pinta el formulario vacío, NO un error', async () => {
    mockLeer.mockResolvedValue({ status: 'ok', perfil: null });

    await montar();

    await waitFor(() => expect(screen.getByTestId('perfil-negocio-seccion-negocio')).toBeTruthy());
    expect(screen.queryByTestId('perfil-negocio-error')).toBeNull();
    expect(screen.queryByTestId('perfil-negocio-no-disponible')).toBeNull();
  });

  it('cuando el endpoint no está desplegado lo dice, sin ofrecer reintentar', async () => {
    mockLeer.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('perfil-negocio-no-disponible')).toBeTruthy());
    expect(screen.queryByTestId('perfil-negocio-seccion-negocio')).toBeNull();
  });

  /**
   * 🔴 El invariante que justifica que el POST sea parcial. Si "Guardar" de Personalidad mandara
   * también los campos del negocio, pisaría con lo que haya en pantalla —que puede ser viejo— lo
   * que el usuario cambió en otro dispositivo. Este test es rojo si alguien "simplifica" mandando
   * el objeto entero desde cualquiera de los dos botones.
   */
  it('cada sección manda SÓLO sus claves', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('perfil-negocio-seccion-negocio')).toBeTruthy());

    fireEvent.press(screen.getByTestId('perfil-negocio-guardar-personalidad'));
    await waitFor(() => expect(mockGuardar).toHaveBeenCalled());

    expect(mockGuardar).toHaveBeenCalledWith({
      formalidad: 'cercano',
      largoRespuesta: 'breve',
      nombreCopiloto: 'Copi',
    });
    const enviado = mockGuardar.mock.calls[0][0] as Record<string, unknown>;
    expect(enviado).not.toHaveProperty('queVende');
    expect(enviado).not.toHaveProperty('nombreComercial');
  });

  it('el botón de Negocio manda sólo los campos del negocio', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('perfil-negocio-seccion-negocio')).toBeTruthy());

    fireEvent.press(screen.getByTestId('perfil-negocio-guardar-negocio'));
    await waitFor(() => expect(mockGuardar).toHaveBeenCalled());

    const enviado = mockGuardar.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(enviado).sort()).toEqual(['aQuien', 'horarioAtencion', 'nombreComercial', 'queVende']);
  });

  it('muestra el detail del 400 en vez de un error genérico', async () => {
    // "No se pudo guardar" deja al usuario adivinando cuál de los siete campos toca corregir.
    mockGuardar.mockRejectedValue(new ApiError(400, 'que_vende supera los 500 caracteres', 'que_vende supera los 500 caracteres'));

    await montar();
    await waitFor(() => expect(screen.getByTestId('perfil-negocio-seccion-negocio')).toBeTruthy());
    fireEvent.press(screen.getByTestId('perfil-negocio-guardar-negocio'));

    await waitFor(() =>
      expect(screen.getByTestId('perfil-negocio-error-guardado')).toHaveTextContent('supera los 500', {
        exact: false,
      }),
    );
  });

  it('re-siembra los campos con el perfil que devuelve el POST', async () => {
    // El backend devuelve el perfil COMPLETO: si otro dispositivo cambió la otra sección, este es el
    // momento en que aparece. Dar por hecho que quedó lo que había en pantalla lo escondería.
    mockGuardar.mockResolvedValue({
      status: 'ok',
      perfil: { ...PERFIL, nombreComercial: 'Electricidad Pérez S.R.L.' },
    });

    await montar();
    await waitFor(() => expect(screen.getByTestId('perfil-negocio-seccion-negocio')).toBeTruthy());
    fireEvent.press(screen.getByTestId('perfil-negocio-guardar-personalidad'));

    await waitFor(() =>
      expect(screen.getByTestId('perfil-negocio-nombre-comercial-input').props.value).toContain('S.R.L.'),
    );
  });

  it('editar un campo borra el "Listo, lo guardamos" anterior', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('perfil-negocio-seccion-negocio')).toBeTruthy());
    fireEvent.press(screen.getByTestId('perfil-negocio-guardar-negocio'));
    await waitFor(() => expect(screen.getByTestId('perfil-negocio-guardado')).toBeTruthy());

    fireEvent.changeText(screen.getByTestId('perfil-negocio-nombre-comercial-input'), 'Otro nombre');

    // Dejarlo en pantalla mientras se edita diría que lo que se está viendo ya está a salvo.
    await waitFor(() => expect(screen.queryByTestId('perfil-negocio-guardado')).toBeNull());
  });
});
