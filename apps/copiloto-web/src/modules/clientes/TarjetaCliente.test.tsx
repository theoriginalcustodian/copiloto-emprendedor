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
