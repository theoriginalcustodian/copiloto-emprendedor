/**
 * `PantallaComoHablarle` — la guía de uso.
 *
 * **Lo que se fija acá no es que la pantalla se dibuje: es que NO INVENTE.** Esta pantalla existe
 * porque la versión escrita a mano ya había nacido prometiendo una tool que no existe. Un test que
 * sólo mire el happy path la dejaría volver a hacerlo — por eso los casos que importan son los de
 * ausencia: sin endpoint, sin capacidades, sin fechas.
 *
 * ⚠️ Todo `fireEvent` va con `await` — ver el docstring de `jest.config.js`.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, leerCapacidades: jest.fn() };
});

import { render, screen, waitFor } from '@testing-library/react-native';

import { leerCapacidades } from '@copiloto/core';

import { PantallaComoHablarle } from './PantallaComoHablarle';
import { ThemeProvider } from '../../theme/ThemeProvider';

const leerMock = leerCapacidades as jest.MockedFunction<typeof leerCapacidades>;

const GUIA = {
  capacidades: [
    { tool: 'registrar_gasto', rotulo: 'Gastos', ejemplos: ['pagué 15 mil de mercadería'] },
    { tool: 'registrar_ingreso', rotulo: 'Ingresos', ejemplos: ['me pagaron 85 mil'] },
  ],
  fechas: { entiendo: ['hoy', 'ayer'], siNoEsta: 'Para cualquier otro día, tocá la fecha en la tarjeta.' },
};

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaComoHablarle />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  leerMock.mockResolvedValue({ status: 'ok', guia: GUIA });
});

describe('PantallaComoHablarle — lo que muestra', () => {
  it('pinta cada capacidad con sus frases, entre comillas', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('como-hablarle-registrar_gasto')).toBeTruthy());
    expect(screen.getByText('«pagué 15 mil de mercadería»')).toBeTruthy();
    expect(screen.getByText('«me pagaron 85 mil»')).toBeTruthy();
  });

  it('🔴 dice que son EJEMPLOS, no comandos', async () => {
    // Si el emprendedor cree que tiene que decir las frases exactas, la guía empeoró el producto que
    // viene a explicar: el copiloto entiende lenguaje natural.
    await montar();

    await waitFor(() => expect(screen.getByText(/no fórmulas/i)).toBeTruthy());
  });

  it('las fechas salen de la misma tabla medida, con su salida para las que no entiende', async () => {
    await montar();

    await waitFor(() => expect(screen.getByTestId('como-hablarle-fechas')).toBeTruthy());
    expect(screen.getByText('«hoy» · «ayer»')).toBeTruthy();
    expect(screen.getByTestId('como-hablarle-fechas-si-no-esta')).toBeTruthy();
  });
});

describe('PantallaComoHablarle — lo que NO inventa', () => {
  it('🔴 sin el endpoint desplegado lo DICE, y no muestra ninguna frase', async () => {
    // El caso que da nombre a la pantalla: una lista de respaldo hardcodeada sería reintroducir, una
    // capa más abajo, el bug que este endpoint vino a matar — y encima invisible, porque se vería
    // igual de bien mientras enseña a decir cosas que fallan.
    leerMock.mockResolvedValue({ status: 'no_disponible' });

    await montar();

    await waitFor(() => expect(screen.getByTestId('como-hablarle-no-disponible')).toBeTruthy());
    expect(screen.queryByTestId('como-hablarle-lista')).toBeNull();
    expect(screen.queryByText(/pagué 15 mil/)).toBeNull();
  });

  it('🔴 con CERO capacidades lo dice — y NO se disfraza de «no disponible»', async () => {
    // Son cosas distintas: acá el endpoint contestó y dice que hoy no hay ninguna tool viva.
    // Mostrarlo como «no pudimos traer la guía» ocultaría una poda demasiado agresiva justo cuando
    // hay que verla.
    leerMock.mockResolvedValue({ status: 'ok', guia: { capacidades: [], fechas: { entiendo: [], siNoEsta: null } } });

    await montar();

    await waitFor(() => expect(screen.getByTestId('como-hablarle-vacio')).toBeTruthy());
    expect(screen.queryByTestId('como-hablarle-no-disponible')).toBeNull();
  });

  it('🔴 sin fechas publicadas NO se dibuja la sección — ni un renglón vacío', async () => {
    // Un encabezado «Fechas» sin nada debajo se lee como una función rota, no como «todavía no».
    leerMock.mockResolvedValue({
      status: 'ok',
      guia: { capacidades: GUIA.capacidades, fechas: { entiendo: [], siNoEsta: null } },
    });

    await montar();

    await waitFor(() => expect(screen.getByTestId('como-hablarle-registrar_gasto')).toBeTruthy());
    expect(screen.queryByTestId('como-hablarle-fechas')).toBeNull();
  });

  it('🔴 CONTROL — el buscador de frases sabe decir que NO', async () => {
    // Sin esto, los `queryByText` de arriba pasarían igual con un buscador que nunca encuentra nada.
    await montar();

    await waitFor(() => expect(screen.getByText('«me pagaron 85 mil»')).toBeTruthy());
    expect(screen.queryByText('«facturale 80 mil a la panadería»')).toBeNull();
  });
});
