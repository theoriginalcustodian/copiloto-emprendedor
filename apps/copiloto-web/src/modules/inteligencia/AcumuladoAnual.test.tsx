import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { obtenerResumenContabilidad } = vi.hoisted(() => ({ obtenerResumenContabilidad: vi.fn() }));

vi.mock('@copiloto/core', async (orig) => ({
  ...(await orig<typeof import('@copiloto/core')>()),
  obtenerResumenContabilidad,
}));

import { AcumuladoAnual } from './AcumuladoAnual';

function resumen(tope: { porcentaje: number; semaforo: string } | null) {
  return { status: 'ok', resumen: { facturado: { periodo: '1000', doceMeses: '9500000', tope } } };
}

describe('AcumuladoAnual (BL-X2) — acumulado de 12 meses con medidor de tope', () => {
  beforeEach(() => obtenerResumenContabilidad.mockReset());

  it('muestra el acumulado de 12 meses y el % del tope con su semáforo', async () => {
    obtenerResumenContabilidad.mockResolvedValue(resumen({ porcentaje: 87, semaforo: 'amarillo' }));
    render(<AcumuladoAnual />);
    expect(await screen.findByTestId('inteligencia-acumulado-doce-meses')).toHaveTextContent(/9\.500\.000/);
    expect(screen.getByTestId('inteligencia-acumulado-tope')).toHaveTextContent('87% del tope de monotributo');
  });

  it('fail-soft: tope null → sólo el acumulado, nunca un tope', async () => {
    obtenerResumenContabilidad.mockResolvedValue(resumen(null));
    render(<AcumuladoAnual />);
    await screen.findByTestId('inteligencia-acumulado-doce-meses');
    expect(screen.queryByTestId('inteligencia-acumulado-tope')).toBeNull();
  });

  it('no_disponible o error del endpoint → no dibuja nada (no contagia a Inteligencia)', async () => {
    obtenerResumenContabilidad.mockResolvedValueOnce({ status: 'no_disponible' });
    const a = render(<AcumuladoAnual />);
    await waitFor(() => expect(obtenerResumenContabilidad).toHaveBeenCalledTimes(1));
    expect(a.container).toBeEmptyDOMElement();
    a.unmount();

    obtenerResumenContabilidad.mockRejectedValueOnce(new Error('500'));
    const b = render(<AcumuladoAnual />);
    await waitFor(() => expect(obtenerResumenContabilidad).toHaveBeenCalledTimes(2));
    expect(b.container).toBeEmptyDOMElement();
  });
});
