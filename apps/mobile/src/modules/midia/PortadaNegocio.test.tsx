import { render, screen } from '@testing-library/react-native';

import type { Portada } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PortadaNegocio } from './PortadaNegocio';

const base = (caja: Partial<Portada['caja']>): Portada => ({
  caja: { saldo: '286000.00', moneda: 'ARS', fechaCorte: null, variacionPct: null, incompleta: false, ...caja },
  mes: { ingresos: '300000.00', gastos: '14000.00', rentabilidad: null, facturado: null, cobrado: null },
  serieMensual: [],
  mejoresClientes: [],
  porCobrar: { total: null, vencido: null },
});

async function montar(portada: Portada) {
  return render(
    <ThemeProvider>
      <PortadaNegocio portada={portada} />
    </ThemeProvider>,
  );
}

describe('PortadaNegocio — fecha de corte y variación (K-03, BL-J2/BL-J3)', () => {
  it('pinta «Al 19 de agosto · −18% vs mes anterior» en un solo chip', async () => {
    await montar(base({ fechaCorte: '2026-08-19', variacionPct: '-18.0' }));
    expect(screen.getByTestId('midia-portada-chip')).toHaveTextContent(
      'Al 19 de agosto · −18% vs mes anterior',
    );
  });

  it('variación null (un solo mes de historia): sólo la fecha, sin «0%» ni «—»', async () => {
    await montar(base({ fechaCorte: '2026-08-19', variacionPct: null, incompleta: false }));
    const chip = screen.getByTestId('midia-portada-chip');
    expect(chip).toHaveTextContent('Al 19 de agosto');
    expect(chip).not.toHaveTextContent('%');
  });

  it('backend viejo (sin ninguno de los dos campos): no hay chip', async () => {
    await montar(base({}));
    expect(screen.queryByTestId('midia-portada-chip')).toBeNull();
    expect(screen.getByTestId('midia-portada-cifra')).toBeTruthy();
  });
});

describe('PortadaNegocio — incompleta (K-09 / BL-J4)', () => {
  it('con una conexión caída: dice qué falta y NO dibuja la variación', async () => {
    await montar(base({ fechaCorte: '2026-08-19', variacionPct: '-18.0', incompleta: true }));
    expect(screen.getByTestId('midia-portada-incompleta')).toHaveTextContent(/faltan los cobros de hoy/);
    expect(screen.getByTestId('midia-portada-chip')).not.toHaveTextContent('%');
  });
  it('completa: no hay aviso', async () => {
    await montar(base({}));
    expect(screen.queryByTestId('midia-portada-incompleta')).toBeNull();
  });
});
