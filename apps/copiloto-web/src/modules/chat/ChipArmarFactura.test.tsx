import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../../design-system/themes.css';
import { ChipArmarFactura } from './ChipArmarFactura';
import { MessageList } from './MessageList';

const facturar = vi.hoisted(() => vi.fn());
vi.mock('@copiloto/core', async (orig) => ({
  ...(await orig<typeof import('@copiloto/core')>()),
  facturarPresupuesto: facturar,
}));

const sug = { presupuestoId: 7, texto: '¿Te armo la factura?' };

describe('ChipArmarFactura', () => {
  beforeEach(() => facturar.mockReset());

  it('el chip arma el borrador del presupuesto y navega al gate de factura', async () => {
    facturar.mockResolvedValue({ status: 'ok', facturaId: 'f-9', borradorNuevo: true });
    const onFacturar = vi.fn();
    render(<ChipArmarFactura sugerencia={sug} onFacturar={onFacturar} />);
    fireEvent.click(screen.getByText('¿Te armo la factura?'));
    await waitFor(() => expect(onFacturar).toHaveBeenCalledWith('f-9'));
    expect(facturar).toHaveBeenCalledWith(7);
  });

  it('si no se puede, avisa y NO navega', async () => {
    facturar.mockResolvedValue({ status: 'falta_perfil_fiscal' });
    const onFacturar = vi.fn();
    render(<ChipArmarFactura sugerencia={sug} onFacturar={onFacturar} />);
    fireEvent.click(screen.getByText('¿Te armo la factura?'));
    expect(await screen.findByTestId('chip-armar-factura-aviso')).toHaveTextContent(/datos fiscales/);
    expect(onFacturar).not.toHaveBeenCalled();
  });

  it('sin `onFacturar` no se ofrece', () => {
    render(<ChipArmarFactura sugerencia={sug} />);
    expect(screen.queryByTestId('chip-armar-factura')).toBeNull();
  });
});

describe('MessageList con sugerencia_armar_factura', () => {
  it('pinta el chip bajo el texto; un kind desconocido no pinta nada', () => {
    const mk = (kind: string) => [
      { id: 'a1', role: 'assistant' as const, text: 'Listo, presupuesto creado.', card: { kind, presupuesto_id: 7 } },
    ];
    const { unmount } = render(<MessageList messages={mk('sugerencia_armar_factura')} onChoice={vi.fn()} onFacturar={vi.fn()} />);
    expect(screen.getByTestId('chip-armar-factura')).toBeInTheDocument();
    unmount();
    render(<MessageList messages={mk('kind_futuro')} onChoice={vi.fn()} onFacturar={vi.fn()} />);
    expect(screen.queryByTestId('chip-armar-factura')).toBeNull();
    expect(screen.getByText('Listo, presupuesto creado.')).toBeInTheDocument();
  });
});
