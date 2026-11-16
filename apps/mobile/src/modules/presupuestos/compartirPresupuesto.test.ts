import { Share } from 'react-native';

import type { Presupuesto } from '@copiloto/core';

import { compartirPresupuesto, textoPresupuesto } from './compartirPresupuesto';

function presupuesto(over: Partial<Presupuesto> = {}): Presupuesto {
  return {
    id: 7,
    numero: 12,
    concepto: 'Instalación eléctrica',
    receptor: { nombre: 'Juan Pérez', docTipo: 99, docNro: '', contacto: '' },
    items: [
      { orden: 1, descripcion: 'Mano de obra', cantidad: '1', precioUnitario: '30000.00', codigo: '' },
      { orden: 2, descripcion: 'Materiales', cantidad: '2', precioUnitario: '7500.00', codigo: '' },
    ],
    cantidadItems: 2,
    total: '45000.00',
    docLink: null,
    ...over,
  } as Presupuesto;
}

describe('textoPresupuesto', () => {
  it('arma número, concepto, cliente, cada ítem y el total del backend', () => {
    expect(textoPresupuesto(presupuesto())).toBe(
      [
        'Presupuesto N° 12 — Instalación eléctrica',
        'Para: Juan Pérez',
        '',
        '• Mano de obra — 1 × $30.000',
        '• Materiales — 2 × $7.500',
        '',
        'Total: $45.000',
      ].join('\n'),
    );
  });

  it('sin ítems (el listado no los trae) los omite, no los inventa', () => {
    const texto = textoPresupuesto(presupuesto({ items: [] }));
    expect(texto).not.toMatch(/•/);
    expect(texto).toMatch(/Total: \$45\.000/);
  });
});

describe('compartirPresupuesto', () => {
  beforeEach(() => jest.restoreAllMocks());

  it('sin documento de Google comparte el TEXTO del presupuesto', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await compartirPresupuesto(presupuesto());
    expect(share).toHaveBeenCalledWith({ message: textoPresupuesto(presupuesto()) });
  });

  it('con documento comparte su link, no el texto', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    await compartirPresupuesto(presupuesto({ docLink: 'https://docs.google.com/document/d/abc/edit' }));
    expect(share).toHaveBeenCalledWith({
      message: 'Presupuesto N° 12 — Instalación eléctrica\nhttps://docs.google.com/document/d/abc/edit',
    });
  });
});
