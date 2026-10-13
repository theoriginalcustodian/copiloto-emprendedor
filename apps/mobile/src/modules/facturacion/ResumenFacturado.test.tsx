import { act, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';

jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, leerPortada: jest.fn() };
});

import { leerPortada, type Portada } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { ResumenFacturado, type ResumenFacturadoHandle } from './ResumenFacturado';

const mockLeer = leerPortada as jest.MockedFunction<typeof leerPortada>;

function portada(facturado: string | null): { status: 'ok'; portada: Portada } {
  return {
    status: 'ok',
    portada: { mes: { ingresos: null, gastos: null, rentabilidad: null, facturado, cobrado: null } } as unknown as Portada,
  };
}

async function montar(ref?: React.Ref<ResumenFacturadoHandle>) {
  await render(
    <ThemeProvider>
      <ResumenFacturado ref={ref} />
    </ThemeProvider>,
  );
}

describe('ResumenFacturado (mapeo `factura`)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('muestra «Facturado este mes» con la cifra que manda el backend', async () => {
    mockLeer.mockResolvedValue(portada('120000.00'));
    await montar();
    expect(await screen.findByTestId('facturacion-resumen-rotulo')).toHaveTextContent('Facturado este mes');
    expect(screen.getByTestId('facturacion-resumen-cifra')).toHaveTextContent('$120.000,00');
  });

  it('🔴 sin portada (`no_disponible`) no pinta nada — no afirma «$0»', async () => {
    mockLeer.mockResolvedValue({ status: 'no_disponible' });
    await montar();
    await act(async () => {});
    expect(screen.queryByTestId('facturacion-resumen')).toBeNull();
  });

  it('`facturado: null` tampoco se pinta', async () => {
    mockLeer.mockResolvedValue(portada(null));
    await montar();
    await act(async () => {});
    expect(screen.queryByTestId('facturacion-resumen')).toBeNull();
  });

  it('una excepción de red no rompe la pantalla', async () => {
    mockLeer.mockRejectedValue(new Error('red'));
    await montar();
    await act(async () => {});
    expect(screen.queryByTestId('facturacion-resumen')).toBeNull();
  });

  it('`recargar` actualiza la cifra; un fallo posterior NO la borra', async () => {
    mockLeer.mockResolvedValueOnce(portada('100.00'));
    const ref = createRef<ResumenFacturadoHandle>();
    await montar(ref);
    expect(await screen.findByTestId('facturacion-resumen-cifra')).toHaveTextContent('$100,00');

    mockLeer.mockResolvedValueOnce(portada('250.00'));
    await act(async () => {
      await ref.current?.recargar();
    });
    expect(screen.getByTestId('facturacion-resumen-cifra')).toHaveTextContent('$250,00');

    mockLeer.mockResolvedValueOnce({ status: 'no_disponible' });
    await act(async () => {
      await ref.current?.recargar();
    });
    expect(screen.getByTestId('facturacion-resumen-cifra')).toHaveTextContent('$250,00');
  });
});
