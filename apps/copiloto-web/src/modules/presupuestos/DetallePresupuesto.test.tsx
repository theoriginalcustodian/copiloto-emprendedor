import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { obtenerPresupuesto } = vi.hoisted(() => ({ obtenerPresupuesto: vi.fn() }));

vi.mock('@copiloto/core', async (orig) => ({
  ...(await orig<typeof import('@copiloto/core')>()),
  obtenerPresupuesto,
}));

import type { Presupuesto } from '@copiloto/core';

import { DetallePresupuesto } from './DetallePresupuesto';

function presupuesto(over: Partial<Presupuesto> = {}): Presupuesto {
  return {
    id: 3,
    numero: 12,
    concepto: 'Pintura del local',
    fecha: '2026-07-20',
    total: '50000.00',
    items: [],
    receptor: { nombre: 'Panadería', docTipo: null, docNro: '', condicionIva: null, domicilio: '', contacto: 'p@x.com' },
    docLink: 'https://docs.google.com/d/1',
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

function montar(sugerencia?: { docLink: string } | null) {
  return render(
    <DetallePresupuesto
      presupuesto={presupuesto()}
      onCerrar={() => {}}
      onFacturar={() => {}}
      onCorregir={() => {}}
      sugerenciaMandarPorMail={sugerencia}
    />,
  );
}

// K-07: «Mandalo por mail» se ofrece sólo si el backend lo sugirió al guardar (hay Doc que mandar).
describe('DetallePresupuesto — «Mandalo por mail» (K-07)', () => {
  beforeEach(() => {
    obtenerPresupuesto.mockReset();
    obtenerPresupuesto.mockResolvedValue({ status: 'no_disponible' });
  });

  it('con la sugerencia: aparece el botón junto a «Ver en Google Docs»', async () => {
    montar({ docLink: 'https://docs.google.com/d/1' });
    await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-ver-doc')).toBeTruthy());
    expect(screen.getByTestId('detalle-presupuesto-mandar-por-mail')).toBeTruthy();
  });

  it('sin la sugerencia: no aparece nada nuevo (compatibilidad visual)', async () => {
    montar();
    await waitFor(() => expect(screen.getByTestId('detalle-presupuesto-ver-doc')).toBeTruthy());
    expect(screen.queryByTestId('detalle-presupuesto-mandar-por-mail')).toBeNull();
  });
});
