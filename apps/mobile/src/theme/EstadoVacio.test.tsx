import { render, screen, waitFor } from '@testing-library/react-native';

import { almacenClave } from '../adapters/almacen';
import { DIAS_PARA_RETIRAR_EXPLICACION, EstadoVacio } from './EstadoVacio';
import { ThemeProvider } from './ThemeProvider';

jest.mock('../adapters/almacen', () => ({
  almacenClave: { leer: jest.fn(), guardar: jest.fn(), borrar: jest.fn() },
}));

const leer = almacenClave.leer as jest.MockedFunction<typeof almacenClave.leer>;

function montar(props: Partial<Parameters<typeof EstadoVacio>[0]> = {}) {
  return render(
    <ThemeProvider>
      <EstadoVacio testID="vacio" titulo="Nada urgente por hoy" {...props} />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  leer.mockResolvedValue(null);
});

describe('EstadoVacio', () => {
  it('la taza es opt-in: sin `ilustracion` no se dibuja', async () => {
    await montar();
    expect(screen.queryByTestId('vacio-taza')).toBeNull();
  });

  /**
   * 🔴 La regla que separa `vacio` de `bi-vacio` en el mapa: la taza celebra el vacío BUENO de una
   * pantalla entera. En el vacío de una sección («todavía no vendiste») celebrar sería raro.
   */
  it('con `ilustracion` dibuja la taza', async () => {
    await montar({ ilustracion: true });
    await waitFor(() => expect(screen.getByTestId('vacio-taza')).toBeTruthy());
  });

  it('las primeras veces explica', async () => {
    await montar({ cuerpo: 'Cuando el copiloto detecte algo, aparece acá.' });
    await waitFor(() => expect(screen.getByTestId('vacio-cuerpo')).toBeTruthy());
  });

  it('🔴 después de N días DISTINTOS la explicación se retira sola', async () => {
    const dias = Array.from({ length: DIAS_PARA_RETIRAR_EXPLICACION }, (_, i) => `2026-09-0${i + 1}`);
    leer.mockResolvedValue(JSON.stringify(dias));

    await montar({ cuerpo: 'Cuando el copiloto detecte algo, aparece acá.' });

    await waitFor(() => expect(screen.getByTestId('vacio-titulo')).toBeTruthy());
    expect(screen.queryByTestId('vacio-cuerpo')).toBeNull();
  });

  /** Se cuentan días, no visitas: diez entradas en una mañana son un día. */
  it('volver el mismo día no gasta una de las veces', async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    leer.mockResolvedValue(JSON.stringify([hoy]));

    await montar({ cuerpo: 'explicación' });

    await waitFor(() => expect(screen.getByTestId('vacio-cuerpo')).toBeTruthy());
    expect(almacenClave.guardar).not.toHaveBeenCalled();
  });

  /**
   * Si el almacenamiento devuelve basura, la explicación se muestra igual: el default menos malo es
   * explicar de más.
   *
   * ⚠️ Se prueba con contenido CORRUPTO y no con una promesa rechazada. Un rechazo viaja por la cola
   * de `act` de React y jest lo reporta como fallo del test aunque el componente lo capture — el
   * `catch` del componente cubre las dos vías, así que esto ejercita la misma garantía sin pelear
   * con el entorno de test.
   */
  it('con el almacenamiento corrupto explica igual', async () => {
    leer.mockResolvedValue('{ esto no es json');
    await montar({ cuerpo: 'explicación' });
    await waitFor(() => expect(screen.getByTestId('vacio-cuerpo')).toBeTruthy());
  });
});
