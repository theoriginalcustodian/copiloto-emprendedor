import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

/**
 * Mock de `expo-router`: "Completar a mano" navega vía `empujarUnaVez` (que llama `router.push`).
 * Mismo criterio que `TarjetaClientePropuesto.test.tsx`.
 */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

/** Partial mock: sólo la red. `leerFacturaPropuesta`, REAL. */
jest.mock('@copiloto/core', () => {
  const actual = jest.requireActual('@copiloto/core');
  return { ...actual, confirmarConTokenFresco: jest.fn() };
});

import { router } from 'expo-router';

import { confirmarConTokenFresco, leerFacturaPropuesta } from '@copiloto/core';

import { reabrirNavegacion } from '../../navegacion/empujarUnaVez';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { TarjetaFacturaPropuesta } from './TarjetaFacturaPropuesta';

const mockConfirmar = confirmarConTokenFresco as jest.MockedFunction<typeof confirmarConTokenFresco>;
const mockPush = router.push as jest.MockedFunction<typeof router.push>;

function propuesta(over: Record<string, unknown> = {}) {
  const p = leerFacturaPropuesta({
    kind: 'factura_propuesta',
    data: {
      factura_id: 'presu-12',
      faltantes: [],
      items: [{ descripcion: 'Service de aire', cantidad: 1, precio_unitario: 50000 }],
      cliente: { razon_social: 'Juan Pérez', cuit: '20304050607', condicion_iva: 'CF' },
      total: 50000,
      tipo_comprobante: 'C',
      ...over,
    },
  });
  if (p == null) throw new Error('la propuesta de prueba no debería ser null');
  return p;
}

async function montar(p = propuesta()) {
  return render(
    <ThemeProvider>
      <TarjetaFacturaPropuesta propuesta={p} />
    </ThemeProvider>,
  );
}

describe('TarjetaFacturaPropuesta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    reabrirNavegacion();
  });

  it('dice explícitamente que TODAVÍA no la mandó', async () => {
    await montar();

    expect(screen.getByTestId('factura-propuesta-aviso')).toHaveTextContent(
      'Esto entendí. Revisalo y tocá Emitir — todavía no la mandé.',
    );
  });

  it('muestra cliente, ítems y total', async () => {
    await montar();

    expect(screen.getByTestId('factura-propuesta-cliente')).toHaveTextContent('ClienteJuan Pérez · 20304050607');
    expect(screen.getByTestId('factura-propuesta-item-0')).toHaveTextContent('Service de aire1 × 50000');
    expect(screen.getByTestId('factura-propuesta-total')).toHaveTextContent('Total: 50000');
  });

  it('🔴 no permite editar ítems en el chat — no hay ningún input, sólo lectura + acción', async () => {
    await montar();

    expect(screen.queryByTestId('factura-propuesta-item-0-input')).toBeNull();
    expect(screen.queryByTestId('factura-propuesta-formulario')).toBeNull();
  });

  it('faltantes vacío → botón Emitir; al tocarlo, confía en `confirmarConTokenFresco`', async () => {
    mockConfirmar.mockResolvedValue({ emitida: true });
    await montar();

    expect(screen.queryByTestId('factura-propuesta-completar')).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByTestId('factura-propuesta-emitir'));
    });

    expect(mockConfirmar).toHaveBeenCalledWith('presu-12');
    await waitFor(() => expect(screen.getByTestId('factura-propuesta-emitida')).toBeTruthy());
    expect(screen.getByTestId('factura-propuesta-emitida')).toHaveTextContent('Factura emitida.');
  });

  it('🔴 `emitida:false` (no-op del backend) NO pasa a terminal — muestra el motivo y se puede reintentar', async () => {
    mockConfirmar.mockResolvedValue({
      emitida: false,
      motivo: 'los datos cambiaron, revisá el resumen antes de confirmar',
    });
    await montar();

    await act(async () => {
      fireEvent.press(screen.getByTestId('factura-propuesta-emitir'));
    });

    expect(screen.queryByTestId('factura-propuesta-emitida')).toBeNull();
    expect(screen.getByTestId('factura-propuesta-error')).toHaveTextContent(
      'los datos cambiaron, revisá el resumen antes de confirmar',
    );
    expect(screen.getByTestId('factura-propuesta-emitir')).toBeTruthy();
  });

  it('faltantes no vacío → botón "Completar a mano", sin Emitir', async () => {
    await montar(propuesta({ faltantes: ['cliente'] }));

    expect(screen.queryByTestId('factura-propuesta-emitir')).toBeNull();
    expect(screen.getByTestId('factura-propuesta-completar')).toBeTruthy();
    expect(mockConfirmar).not.toHaveBeenCalled();
  });

  it('🔴 "Completar a mano" NAVEGA de verdad, al mismo borrador — no crea uno nuevo', async () => {
    await montar(propuesta({ faltantes: ['cliente'] }));

    await act(async () => {
      fireEvent.press(screen.getByTestId('factura-propuesta-completar'));
    });

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/facturacion', params: { facturaId: 'presu-12' } });
  });
});
