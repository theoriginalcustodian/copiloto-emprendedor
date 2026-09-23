import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), back: jest.fn() } }));
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, facturarPresupuesto: jest.fn() };
});

import { router } from 'expo-router';

import { facturarPresupuesto, type ChatMessage } from '@copiloto/core';

import { reabrirNavegacion } from '../../navegacion/empujarUnaVez';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { ChipArmarFactura } from './ChipArmarFactura';
import { ListaMensajes } from './ListaMensajes';

const mockFacturar = facturarPresupuesto as jest.MockedFunction<typeof facturarPresupuesto>;
const mockPush = router.push as jest.MockedFunction<typeof router.push>;
const sug = { presupuestoId: 7, texto: '¿Te armo la factura?' };

async function montar(ui: React.ReactElement) {
  await render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('ChipArmarFactura', () => {
  beforeEach(() => {
    mockFacturar.mockReset();
    mockPush.mockReset();
    reabrirNavegacion();
  });

  it('arma el borrador y navega al gate de factura con ese facturaId', async () => {
    mockFacturar.mockResolvedValue({ status: 'ok', facturaId: 'f-9', borradorNuevo: true });
    await montar(<ChipArmarFactura sugerencia={sug} />);
    await fireEvent.press(screen.getByTestId('chip-armar-factura-boton'));
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/facturacion', params: { facturaId: 'f-9' } }),
    );
    expect(mockFacturar).toHaveBeenCalledWith(7);
  });

  it('si no se puede, avisa y NO navega', async () => {
    mockFacturar.mockResolvedValue({ status: 'falta_perfil_fiscal' });
    await montar(<ChipArmarFactura sugerencia={sug} />);
    await fireEvent.press(screen.getByTestId('chip-armar-factura-boton'));
    await waitFor(() => expect(screen.getByTestId('chip-armar-factura-aviso')).toBeTruthy());
    expect(mockPush).not.toHaveBeenCalled();
  });

  const msg = (kind: string): ChatMessage[] => [
    { id: 'a1', role: 'assistant', text: 'Listo, presupuesto creado.', card: { kind, presupuesto_id: 7 } } as ChatMessage,
  ];

  it('ListaMensajes: pinta el chip con la card', async () => {
    await montar(<ListaMensajes messages={msg('sugerencia_armar_factura')} onChoice={jest.fn()} />);
    expect(screen.getByTestId('chip-armar-factura')).toBeTruthy();
  });

  it('control negativo: un kind desconocido no pinta el chip y conserva el texto', async () => {
    await montar(<ListaMensajes messages={msg('kind_futuro')} onChoice={jest.fn()} />);
    expect(screen.queryByTestId('chip-armar-factura')).toBeNull();
    expect(screen.getByText('Listo, presupuesto creado.')).toBeTruthy();
  });
});
