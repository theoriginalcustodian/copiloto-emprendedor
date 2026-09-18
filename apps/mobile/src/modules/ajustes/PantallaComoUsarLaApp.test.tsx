import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: jest.fn(),
}));

/** Partial mock: sólo la red. El resto de `@copiloto/core`, real. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, leerCapacidades: jest.fn() };
});

import { router } from 'expo-router';

import { leerCapacidades } from '@copiloto/core';

import { tomarPendiente } from '../chat/mensajePendiente';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { PantallaComoUsarLaApp, TEMAS_AYUDA } from './PantallaComoUsarLaApp';

const mockCapacidades = leerCapacidades as jest.MockedFunction<typeof leerCapacidades>;

const GUIA = {
  status: 'ok' as const,
  guia: {
    capacidades: [{ tool: 'anotar_gasto', rotulo: 'Gastos', ejemplos: ['gasté 15 lucas en nafta'] }],
    fechas: { entiendo: ['ayer', 'el martes'], siNoEsta: 'Si no la entiendo, te la pregunto.' },
  },
};

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaComoUsarLaApp />
    </ThemeProvider>,
  );
}

describe('PantallaComoUsarLaApp — la fusión de la guía y el «cómo uso la app» (Ola 5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tomarPendiente(); // deja el buzón vacío entre tests
    mockCapacidades.mockResolvedValue(GUIA);
  });

  it('muestra los cinco temas del prototipo, numerados y en orden', async () => {
    await montar();
    expect(TEMAS_AYUDA).toHaveLength(5);
    TEMAS_AYUDA.forEach((t, i) => {
      // Regex y no string: este matcher compara el texto COMPLETO del nodo, y la fila trae además
      // el número y el detalle.
      expect(screen.getByTestId(`como-usar-tema-${i}`)).toHaveTextContent(new RegExp(t.titulo));
    });
  });

  it('🔴 tocar un tema deja la pregunta para el CHAT PRINCIPAL y cierra el glass', async () => {
    // El puente de la Decisión C: no se abre un chat de ayuda propio. Dos hilos que saben cosas
    // distintas del mismo negocio obligan a recordar en cuál preguntaste.
    await montar();

    fireEvent.press(screen.getByTestId('como-usar-tema-0'));

    expect(tomarPendiente()).toBe(TEMAS_AYUDA[0]!.pregunta);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.push).not.toHaveBeenCalled();
  });

  it('lo que entra al chat es una PREGUNTA, no el título del tema', async () => {
    // Un título nombra un asunto («Cargar un gasto hablando»); si eso entrara al hilo, la
    // conversación arrancaría torcida.
    TEMAS_AYUDA.forEach((t) => {
      expect(t.pregunta).toMatch(/\?$/);
      expect(t.pregunta).not.toBe(t.titulo);
    });
  });

  it('trae los ejemplos de `GET /capacidades`, no escritos a mano', async () => {
    await montar();
    await waitFor(() => expect(screen.getByTestId('como-usar-anotar_gasto')).toBeTruthy());
    expect(screen.getByTestId('como-usar-anotar_gasto')).toHaveTextContent(/gasté 15 lucas en nafta/);
    expect(screen.getByTestId('como-usar-fechas')).toHaveTextContent(/ayer/);
  });

  it('🔴 si la guía no está disponible, los TEMAS siguen ahí', async () => {
    // Son dos fuentes independientes: los temas son del producto, los ejemplos del contrato. Que se
    // caiga una no puede llevarse la otra.
    mockCapacidades.mockResolvedValue({ status: 'no_disponible' });
    await montar();

    await waitFor(() => expect(screen.getByTestId('como-usar-no-disponible')).toBeTruthy());
    expect(screen.getByTestId('como-usar-tema-0')).toBeTruthy();
    expect(screen.getByTestId('como-usar-pie')).toBeTruthy();
  });
});
