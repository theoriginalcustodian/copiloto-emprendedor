import { render, screen } from '@testing-library/react-native';

import type { Presupuesto } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { TarjetaPresupuesto } from './TarjetaPresupuesto';

function pres(over: Partial<Presupuesto> = {}): Presupuesto {
  return {
    id: 5, numero: 12, fecha: '2026-10-01T12:00:00Z', concepto: 'Tablero', total: '145000.00',
    cantidadItems: 1, receptor: { nombre: 'Fernández', docTipo: 99, docNro: '0', contacto: '' },
    facturado: false, reemplazadoPor: null, estado: null, sinRespuesta: null, docLink: null,
    ...over,
  } as Presupuesto;
}

async function montar(p: Presupuesto) {
  await render(
    <ThemeProvider>
      <TarjetaPresupuesto presupuesto={p} onPress={() => {}} />
    </ThemeProvider>,
  );
}

describe('TarjetaPresupuesto — estado de la fila (mapeo `presu`)', () => {
  it('aceptado muestra «Aceptado»', async () => {
    await montar(pres({ estado: 'aprobado' }));
    expect(screen.getByTestId('presupuesto-card-5-estado')).toHaveTextContent('Aceptado');
  });

  it('sin respuesta dice «Se enfría · N días» con los días de la fecha', async () => {
    const hace31 = new Date(Date.now() - 31 * 86_400_000 - 3_600_000).toISOString();
    await montar(pres({ estado: 'pendiente', sinRespuesta: true, fecha: hace31 }));
    expect(screen.getByTestId('presupuesto-card-5-estado')).toHaveTextContent('Se enfría · 31 días');
  });

  it('control negativo: sin `estado` del backend NO se dibuja ninguna etiqueta', async () => {
    await montar(pres({ estado: null }));
    expect(screen.queryByTestId('presupuesto-card-5-estado')).toBeNull();
  });
});
