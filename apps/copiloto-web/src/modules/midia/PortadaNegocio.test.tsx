import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Portada } from '@copiloto/core';

import { PortadaNegocio } from './PortadaNegocio';

const base = (caja: Partial<Portada['caja']>): Portada => ({
  caja: { saldo: '286000.00', moneda: 'ARS', fechaCorte: null, variacionPct: null, ...caja },
  mes: { ingresos: '300000.00', gastos: '14000.00', rentabilidad: null, facturado: null, cobrado: null },
  serieMensual: [],
  mejoresClientes: [],
  porCobrar: { total: null, vencido: null },
});

describe('PortadaNegocio — fecha de corte y variación (K-03, BL-J2/BL-J3)', () => {
  it('pinta «Al 19 de agosto · −18% vs mes anterior» en un solo chip', () => {
    render(<PortadaNegocio portada={base({ fechaCorte: '2026-08-19', variacionPct: '-18.0' })} />);
    expect(screen.getByTestId('midia-portada-chip')).toHaveTextContent(
      'Al 19 de agosto · −18% vs mes anterior',
    );
  });

  it('variación null (un solo mes de historia): sólo la fecha, sin «0%» ni «—»', () => {
    render(<PortadaNegocio portada={base({ fechaCorte: '2026-08-19', variacionPct: null })} />);
    const chip = screen.getByTestId('midia-portada-chip');
    expect(chip).toHaveTextContent('Al 19 de agosto');
    expect(chip).not.toHaveTextContent('%');
  });

  it('backend viejo (sin ninguno de los dos campos): no hay chip', () => {
    render(<PortadaNegocio portada={base({})} />);
    expect(screen.queryByTestId('midia-portada-chip')).not.toBeInTheDocument();
    expect(screen.getByTestId('midia-portada-caja')).toBeInTheDocument();
  });
});
