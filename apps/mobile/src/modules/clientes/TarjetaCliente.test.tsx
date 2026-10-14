// Jest (jest-expo) — describe/it/expect/jest son globales, no se importan de vitest.

/**
 * `TarjetaCliente` (mobile) — la columna del monto de C-D1 y el subtítulo con la condición IVA.
 *
 * Las reglas viven en el core y tienen su test ahí; ESTE test cuida que la tarjeta las CONSUMA: el
 * 2026-10-13 la mobile no pintaba nada de esto (`montoFacturado|facturacionDeCliente` en `apps/mobile/src`
 * → 0 hits) mientras la web sí, y el core verde no lo veía.
 */
import { render, screen } from '@testing-library/react-native';

import type { Cliente } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { TarjetaCliente } from './TarjetaCliente';

function cliente(over: Partial<Cliente> = {}): Cliente {
  return {
    id: 1,
    nombre: 'Panadería del barrio',
    docTipo: 80,
    docNro: '20123456789',
    condicionIva: 1,
    domicilio: null,
    email: null,
    telefono: null,
    notas: null,
    origen: 'derivado',
    creadoEn: '2026-10-01T00:00:00Z',
    ...over,
  };
}

async function montar(c: Cliente) {
  await render(
    <ThemeProvider>
      <TarjetaCliente cliente={c} />
    </ThemeProvider>,
  );
}

describe('TarjetaCliente — columna del monto (C-D1)', () => {
  it('con documento y compras: «$importe · N comprobantes», y un derivado con compras no lleva chip de estado', async () => {
    await montar(cliente({ facturasAtribuibles: true, montoFacturado: '320000.00', comprobantesCantidad: 3 }));
    expect(screen.getByTestId('cliente-1-monto')).toHaveTextContent('$320.000,00 · 3 comprobantes');
    expect(screen.queryByTestId('cliente-1-estado')).toBeNull();
  });

  it('🔴 sin documento: «—» + «Sin CUIT cargado», NUNCA un número aunque el wire traiga "0.00"', async () => {
    await montar(cliente({ docNro: null, docTipo: null, facturasAtribuibles: false, montoFacturado: '0.00' }));
    expect(screen.getByTestId('cliente-1-monto')).toHaveTextContent('—');
    expect(screen.getByTestId('cliente-1-monto')).not.toHaveTextContent('$');
    expect(screen.getByTestId('cliente-1-estado')).toHaveTextContent('Sin CUIT cargado');
  });

  it('con documento y neto cero: «Todavía sin comprar» (es una medición, no el «—» de «no se sabe»)', async () => {
    await montar(cliente({ facturasAtribuibles: true, montoFacturado: '0.00', comprobantesCantidad: 0 }));
    expect(screen.getByTestId('cliente-1-estado')).toHaveTextContent('Todavía sin comprar');
  });

  it('🔴 el backend no declaró el par (versión anterior): cae al conteo, y sin conteo a «—» — nunca un cero inventado', async () => {
    await montar(cliente({ comprobantesCantidad: 2 }));
    expect(screen.getByTestId('cliente-1-monto')).toHaveTextContent('2 comprobantes');
    expect(screen.getByTestId('cliente-1-monto')).not.toHaveTextContent('$');
    // Y no se DEDUCE «Todavía sin comprar» de un listado que no midió nada.
    expect(screen.queryByTestId('cliente-1-estado')).toBeNull();
  });

  it('📝 «Se agregó solo» no se pinta (el derivado es el default); un cargado a mano sí conserva su marca de origen', async () => {
    await montar(cliente({ origen: 'manual', facturasAtribuibles: true, montoFacturado: '100.00', comprobantesCantidad: 1 }));
    expect(screen.queryByText('Se agregó solo')).toBeNull();
    expect(screen.getByTestId('cliente-1-origen')).toBeTruthy();
  });
});

describe('TarjetaCliente — subtítulo', () => {
  it('con documento trae la condición IVA, como el prototipo', async () => {
    await montar(cliente());
    expect(screen.getByTestId('cliente-1-sub')).toHaveTextContent('CUIT 20123456789 · Resp. Inscripto');
  });

  it('🔴 sin documento cae al primer dato que identifique (dos homónimos no quedan idénticos)', async () => {
    await montar(cliente({ docNro: null, docTipo: null, condicionIva: null, telefono: '11 5555-1234', email: 'a@b.c' }));
    expect(screen.getByTestId('cliente-1-sub')).toHaveTextContent('11 5555-1234');
  });
});
