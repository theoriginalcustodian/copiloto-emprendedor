/**
 * `DetallePresupuesto` — el desenlace del presupuesto: **ganado, perdido, o no sé**.
 *
 * Lo que se fija acá es que las **tres categorías no se mezclen**. Contar los no-marcados como
 * rechazos miente sobre la tasa de conversión, y una vez que el número miente el emprendedor deja de
 * mirar la pantalla para siempre.
 */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return {
    ...actual,
    obtenerPresupuesto: jest.fn(),
    facturarPresupuesto: jest.fn(),
    cambiarEstadoPresupuesto: jest.fn(),
  };
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { cambiarEstadoPresupuesto, facturarPresupuesto, obtenerPresupuesto, type Presupuesto } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { DetallePresupuesto } from './DetallePresupuesto';

const obtenerMock = obtenerPresupuesto as jest.MockedFunction<typeof obtenerPresupuesto>;
const facturarMock = facturarPresupuesto as jest.MockedFunction<typeof facturarPresupuesto>;
const cambiarMock = cambiarEstadoPresupuesto as jest.MockedFunction<typeof cambiarEstadoPresupuesto>;

function presupuesto(over: Partial<Presupuesto> = {}): Presupuesto {
  return {
    id: 3,
    numero: 12,
    concepto: 'Pintura del local',
    fecha: '2026-07-20',
    total: '50000.00',
    items: [],
    receptor: { nombre: 'Panadería', docTipo: null, docNro: '', condicionIva: null, domicilio: '', contacto: '' },
    docLink: null,
    facturado: false,
    facturaId: null,
    reemplazaA: null,
    reemplazadoPor: null,
    estado: 'pendiente',
    estadoActualizadoEn: null,
    sinRespuesta: false,
    ...over,
  } as Presupuesto;
}

async function montar(p: Presupuesto, onEstadoCambiado = jest.fn()) {
  return render(
    <ThemeProvider>
      <DetallePresupuesto
        presupuesto={p}
        onCerrar={() => {}}
        onFacturar={() => {}}
        onCorregir={() => {}}
        onEstadoCambiado={onEstadoCambiado}
      />
    </ThemeProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  obtenerMock.mockResolvedValue({ status: 'no_disponible' });
  facturarMock.mockResolvedValue({ status: 'no_disponible' });
  cambiarMock.mockResolvedValue({ status: 'ok', presupuesto: presupuesto({ estado: 'desestimado' }) });
});

describe('DetallePresupuesto — el estado', () => {
  it('el estado se ve SIEMPRE, incluso sin que nadie lo haya tocado', async () => {
    await montar(presupuesto({ estado: 'pendiente' }));

    await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-estado')).toBeTruthy());
    expect(screen.getByTestId('detalle-presupuesto-estado').props.children).toBe('Todavía sin respuesta');
  });

  it('🔴 «sin respuesta» es un MATIZ de pendiente, no una cuarta categoría', async () => {
    // Si se pintara como estado propio, la suma de las categorías dejaría de dar el total.
    await montar(presupuesto({ estado: 'pendiente', sinRespuesta: true }));

    await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-sin-respuesta')).toBeTruthy());
    // Y el estado SIGUE diciendo pendiente.
    expect(screen.getByTestId('detalle-presupuesto-estado').props.children).toBe('Todavía sin respuesta');
  });

  it('🔴 `estado` en null NO se pinta como pendiente', async () => {
    // "El backend no lo mandó" y "nadie contestó todavía" son cosas distintas, y sólo una es un hecho
    // sobre el negocio del emprendedor.
    await montar(presupuesto({ estado: null }));

    await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-estado-desconocido')).toBeTruthy());
    expect(screen.queryByTestId('detalle-presupuesto-estado')).toBeNull();
  });

  it('«No me lo tomaron» manda desestimado y avisa a la lista de atrás', async () => {
    const aviso = jest.fn();
    await montar(presupuesto({ estado: 'pendiente' }), aviso);
    await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-desestimar')).toBeTruthy());

    fireEvent.press(screen.getByTestId('detalle-presupuesto-desestimar'));

    await waitFor(() => expect(cambiarMock).toHaveBeenCalledWith(3, 'desestimado'));
    // Sin el aviso, cerrar el detalle dejaría el listado con el estado anterior — idéntico a que la
    // acción no hubiera surtido efecto, y el emprendedor la repite.
    await waitFor(() => expect(aviso).toHaveBeenCalled());
  });

  it('🔴 sobre uno ya desestimado no se ofrece volver a marcarlo', async () => {
    // El backend no acepta volver atrás: un botón que sólo puede fallar es peor que ninguno.
    await montar(presupuesto({ estado: 'desestimado' }));

    await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-estado')).toBeTruthy());
    expect(screen.queryByTestId('detalle-presupuesto-desestimar')).toBeNull();
  });

  it('🔴 no existe botón de «me lo aprobaron» — aprobado sale de Facturar', async () => {
    // Un estado que hay que acordarse de marcar envejece hasta que miente.
    await montar(presupuesto({ estado: 'pendiente' }));

    await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-estado')).toBeTruthy());
    expect(screen.queryByText(/me lo aprobaron|aprobar/i)).toBeNull();
  });

  it('la transición prohibida muestra la explicación del backend, no un genérico', async () => {
    cambiarMock.mockResolvedValue({ status: 'transicion_invalida', motivo: 'volver a pendiente borra información' });
    await montar(presupuesto({ estado: 'aprobado' }));
    await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-desestimar')).toBeTruthy());

    fireEvent.press(screen.getByTestId('detalle-presupuesto-desestimar'));

    await waitFor(() =>
      expect(screen.getByTestId('detalle-presupuesto-motivo-estado').props.children).toBe(
        'volver a pendiente borra información',
      ),
    );
  });

  it('🔴 facturar un desestimado NO dice «falta tu CUIT» ni deja el botón colgado', async () => {
    // El tercer 409. Antes caía en `falta_perfil_fiscal` (mandando a Ajustes por nada) y, sin la rama,
    // el botón se quedaba en «Preparando…» para siempre.
    facturarMock.mockResolvedValue({
      status: 'estado_incompatible',
      estado: 'desestimado',
      motivo: 'el presupuesto está desestimado: no se puede facturar sin revisarlo',
    });
    await montar(presupuesto({ estado: 'desestimado' }));
    await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-facturar')).toBeTruthy());

    fireEvent.press(screen.getByTestId('detalle-presupuesto-facturar'));

    await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-estado-incompatible')).toBeTruthy());
    expect(screen.queryByTestId('detalle-presupuesto-falta-perfil')).toBeNull();
  });
});
