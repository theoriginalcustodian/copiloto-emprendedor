import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Cliente } from '@copiloto/core';

import '../../design-system/themes.css';
import { TarjetaCliente, textoComprobantes } from './TarjetaCliente';

/** BL-V18 (A12): el conteo de comprobantes viaja en el slot del monto de la lista. */
function cliente(extra: Partial<Cliente> = {}): Cliente {
  return {
    id: 7,
    nombre: 'Panadería Los Tilos',
    docTipo: 80,
    docNro: '30712345678',
    condicionIva: 1,
    domicilio: null,
    email: null,
    telefono: null,
    notas: null,
    origen: 'manual',
    creadoEn: '2026-07-22T10:00:00+00:00',
    ...extra,
  };
}

describe('TarjetaCliente — conteo de comprobantes (BL-V18)', () => {
  it('🔴 CONTROL POSITIVO: con `comprobantesCantidad` muestra el número (no el «—» de antes)', () => {
    render(<TarjetaCliente cliente={cliente({ comprobantesCantidad: 3 })} />);
    expect(screen.getByTestId('cliente-7-monto')).toHaveTextContent('3 comprobantes');
  });

  it('el 0 que declara el backend se muestra como 0, no como «—»', () => {
    render(<TarjetaCliente cliente={cliente({ comprobantesCantidad: 0 })} />);
    expect(screen.getByTestId('cliente-7-monto')).toHaveTextContent('0 comprobantes');
  });

  it('CONTROL NEGATIVO: sin el campo (listado sin BL-V18 todavía) muestra «—», nunca un 0 inventado', () => {
    render(<TarjetaCliente cliente={cliente()} />);
    expect(screen.getByTestId('cliente-7-monto')).toHaveTextContent('—');
    expect(screen.getByTestId('cliente-7-monto')).not.toHaveTextContent('0');
  });

  it('singular para 1', () => {
    expect(textoComprobantes(1)).toBe('1 comprobante');
    expect(textoComprobantes(undefined)).toBe('—');
  });
});

describe('TarjetaCliente — monto facturado y estado (C-D1)', () => {
  it('🔴 con documento y compras: pinta el importe junto al conteo, y NO el «Todavía sin comprar» de antes', () => {
    render(
      <TarjetaCliente
        cliente={cliente({ montoFacturado: '320000.00', facturasAtribuibles: true, comprobantesCantidad: 12 })}
      />,
    );
    expect(screen.getByTestId('cliente-7-monto')).toHaveTextContent('$320.000,00 · 12 comprobantes');
    // Cliente cargado a mano CON compras: antes decía «Todavía sin comprar» por ser `origen` ≠ derivado.
    expect(screen.queryByTestId('cliente-7-estado')).toBeNull();
  });

  it('`facturas_atribuibles: false` → «—» y «Sin CUIT cargado»: NUNCA un número', () => {
    render(
      <TarjetaCliente
        cliente={cliente({ montoFacturado: '0.00', facturasAtribuibles: false, comprobantesCantidad: 0 })}
      />,
    );
    expect(screen.getByTestId('cliente-7-monto')).toHaveTextContent('—');
    expect(screen.getByTestId('cliente-7-monto')).not.toHaveTextContent('$');
    expect(screen.getByTestId('cliente-7-monto')).not.toHaveTextContent('0');
    expect(screen.getByTestId('cliente-7-estado')).toHaveTextContent('Sin CUIT cargado');
  });

  it('atribuible y neto "0.00" → «Todavía sin comprar», con sus comprobantes (factura anulada + su NC)', () => {
    render(
      <TarjetaCliente
        cliente={cliente({ montoFacturado: '0.00', facturasAtribuibles: true, comprobantesCantidad: 2 })}
      />,
    );
    expect(screen.getByTestId('cliente-7-monto')).toHaveTextContent('$0,00 · 2 comprobantes');
    expect(screen.getByTestId('cliente-7-estado')).toHaveTextContent('Todavía sin comprar');
  });

  it('un cliente derivado con compras conserva «Se agregó solo»', () => {
    render(
      <TarjetaCliente
        cliente={cliente({
          origen: 'derivado',
          montoFacturado: '100.00',
          facturasAtribuibles: true,
          comprobantesCantidad: 1,
        })}
      />,
    );
    expect(screen.getByTestId('cliente-7-estado')).toHaveTextContent('Se agregó solo');
  });

  it('CONTROL NEGATIVO: backend sin el par → como antes (conteo y chip por origen), sin inventar un monto', () => {
    render(<TarjetaCliente cliente={cliente({ comprobantesCantidad: 3 })} />);
    expect(screen.getByTestId('cliente-7-monto')).toHaveTextContent('3 comprobantes');
    expect(screen.getByTestId('cliente-7-monto')).not.toHaveTextContent('$');
    expect(screen.getByTestId('cliente-7-estado')).toHaveTextContent('Todavía sin comprar');
  });

  it('un neto NEGATIVO se pinta con su signo', () => {
    render(
      <TarjetaCliente
        cliente={cliente({ montoFacturado: '-100.00', facturasAtribuibles: true, comprobantesCantidad: 1 })}
      />,
    );
    expect(screen.getByTestId('cliente-7-monto')).toHaveTextContent('-$100,00 · 1 comprobante');
  });
});
