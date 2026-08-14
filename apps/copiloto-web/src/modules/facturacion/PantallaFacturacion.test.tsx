import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Partial mock: sólo la red — mismo arnés que `ClientesScreen.test.tsx`/`TarjetaClientePropuesto.test.tsx`. */
vi.mock('@copiloto/core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@copiloto/core')>();
  return {
    ...original,
    agregarItem: vi.fn(),
    cancelarFactura: vi.fn(),
    confirmarConTokenFresco: vi.fn(),
    crearFactura: vi.fn(),
    estadoAfip: vi.fn(),
    esperarEcoDelSignal: vi.fn(),
    esperarEstadoEstable: vi.fn(),
    estadoFactura: vi.fn(),
    quitarItem: vi.fn(),
    setCliente: vi.fn(),
    setDatosVenta: vi.fn(),
  };
});

import {
  crearFactura,
  estadoAfip,
  esperarEstadoEstable,
  type EstadoAfip,
  type EstadoFacturaResp,
} from '@copiloto/core';

import { PantallaFacturacion } from './PantallaFacturacion';

const mockCrearFactura = vi.mocked(crearFactura);
const mockEstadoAfip = vi.mocked(estadoAfip);
const mockEsperarEstadoEstable = vi.mocked(esperarEstadoEstable);

function estadoMock(over: Partial<EstadoFacturaResp> = {}): EstadoFacturaResp {
  return {
    estado: 'borrador',
    faltantes: [],
    items: [],
    total: '0.00',
    tokenConfirmacion: null,
    resultado: null,
    pdf: null,
    drive: null,
    receptor: null,
    datosVenta: null,
    motivo: null,
    motivoCodigo: null,
    terminado: false,
    ...over,
  };
}

function estadoAfipMock(over: Partial<EstadoAfip> = {}): { status: 'ok' } & EstadoAfip {
  return {
    status: 'ok',
    cuit: '20111111112',
    conectado: true,
    wsAutorizados: ['wsfe'],
    perfilCompleto: true,
    puedeFacturar: true,
    ambiente: 'dev',
    onboarding: null,
    ...over,
  };
}

/**
 * 🔴 **El gap real que encontró la pasada de device de D12** (misma historia que el test hermano de
 * `apps/mobile`): `estadoFacturaActual` es un eco del backend, pero `clienteLocal` es un eco LOCAL que
 * sólo `guardarClienteYActualizar` alimentaba -- si el borrador llega de afuera (`facturaIdInicial`, p.
 * ej. "Facturar desde presupuesto") con `receptor` ya cargado, `PasoResumen` mostraba "no tenemos el
 * detalle del cliente" aunque el dato estuviera ahí, viajando en `EstadoFacturaResp.receptor`.
 *
 * Sin archivo de test propio hasta ahora en este árbol -- este es el primero, con el arnés mínimo para
 * el camino "adoptar un borrador externo" (`facturaIdInicial`), que es el que exhibe el gap.
 */
describe('PantallaFacturacion (web) — adoptar un borrador ya creado (facturaIdInicial)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEstadoAfip.mockResolvedValue(estadoAfipMock());
    mockCrearFactura.mockResolvedValue({ status: 'ok', ok: true, facturaId: 'factura-1' });
  });

  it('NO crea un borrador nuevo', async () => {
    mockEsperarEstadoEstable.mockResolvedValue({ convergio: true, estado: estadoMock() });

    render(<PantallaFacturacion facturaIdInicial="presu-12" />);

    await waitFor(() => expect(mockEsperarEstadoEstable).toHaveBeenCalledWith('presu-12'));
    expect(mockCrearFactura).not.toHaveBeenCalled();
  });

  it('con receptor ya cargado en el borrador -- siembra clienteLocal, PasoResumen lo muestra sin pedirlo de nuevo', async () => {
    mockEsperarEstadoEstable.mockResolvedValue({
      convergio: true,
      estado: estadoMock({
        estado: 'esperando_confirmacion',
        items: [{ descripcion: 'Mano de obra', cantidad: '1', precioUnitario: '30000.00', subtotal: '30000.00' }],
        total: '30000.00',
        tokenConfirmacion: 'tok-confirmar',
        receptor: {
          condicionIva: 1,
          tipoDoc: 80,
          nroDoc: '20111111112',
          nombre: 'Doña Repuestos SRL',
          domicilio: 'Av. Siempre Viva 742',
        },
      }),
    });

    render(<PantallaFacturacion facturaIdInicial="presu-12" />);

    await waitFor(() => expect(screen.getByText(/Doña Repuestos SRL/)).toBeInTheDocument());
    expect(screen.queryByTestId('facturacion-paso-resumen-cliente-no-disponible')).not.toBeInTheDocument();
    expect(mockCrearFactura).not.toHaveBeenCalled();
  });

  it('sin receptor en el borrador -- PasoResumen sigue mostrando "no disponible" (control diferencial)', async () => {
    mockEsperarEstadoEstable.mockResolvedValue({
      convergio: true,
      estado: estadoMock({
        estado: 'esperando_confirmacion',
        items: [{ descripcion: 'Mano de obra', cantidad: '1', precioUnitario: '30000.00', subtotal: '30000.00' }],
        total: '30000.00',
        tokenConfirmacion: 'tok-confirmar',
      }),
    });

    render(<PantallaFacturacion facturaIdInicial="presu-12" />);

    await waitFor(() =>
      expect(screen.getByTestId('facturacion-paso-resumen-cliente-no-disponible')).toBeInTheDocument(),
    );
  });
});
