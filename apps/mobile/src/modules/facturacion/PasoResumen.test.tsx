import { fireEvent, render, screen } from '@testing-library/react-native';

import type { EstadoFacturaResp } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PasoResumen } from './PasoResumen';

/**
 * El resumen es **el único lugar donde se puede evitar el error caro de este flujo**: emitir un
 * comprobante fiscal real creyendo que se está probando. Lo pidió explícitamente la sesión de backend
 * (`coordinacion/2026-07-21_respuesta_backend-a-frontend-afip.md` §3) y lo vivieron en producción.
 *
 * Estos tests fijan las tres reglas que lo hacen cumplir, y las tres son de COPY, no de lógica — que es
 * justo la clase de cosa que se rompe en un refactor sin que nadie note nada.
 */

const ESTADO_LISTO: EstadoFacturaResp = {
  estado: 'esperando_confirmacion',
  faltantes: [],
  items: [{ descripcion: 'Consultoría', cantidad: '1', precioUnitario: '1000.00', subtotal: '1000.00' }],
  total: '1000.00',
  tokenConfirmacion: '1:1000.00:99:0',
  resultado: null,
  pdf: null,
  drive: null,
  motivo: null,
  motivoCodigo: null,
  terminado: false,
};

function montar(ambiente: 'dev' | 'prod' | null) {
  return render(
    <ThemeProvider>
      <PasoResumen
        estado={ESTADO_LISTO}
        ambiente={ambiente}
        datosVenta={null}
        cliente={null}
        onConfirmar={async () => ({ emitida: true, estado: ESTADO_LISTO })}
        onCancelar={async () => {}}
        onEditar={() => {}}
      />
    </ThemeProvider>,
  );
}

describe('PasoResumen — el ambiente, que es la defensa contra emitir en producción sin querer', () => {
  it('en producción el botón dice "Emitir factura real", no "Confirmar"', async () => {
    await montar('prod');

    // La etiqueta del botón es lo ÚLTIMO que se lee antes de apretarlo — y lo único que se lee de
    // verdad. "Confirmar y emitir" no distingue una prueba de un comprobante fiscal.
    expect(screen.getByText('Emitir factura real')).toBeTruthy();
    expect(screen.queryByText('Confirmar y emitir')).toBeNull();
  });

  it('en producción el aviso nombra que el comprobante es REAL y que anularlo emite una NC', async () => {
    await montar('prod');

    const aviso = screen.getByTestId('facturacion-paso-resumen-ambiente-prod');
    expect(aviso.props.children).toContain('REAL');
    expect(aviso.props.children).toContain('nota de crédito');
  });

  it('en homologación avisa que es una prueba sin efecto fiscal', async () => {
    await montar('dev');

    expect(screen.getByTestId('facturacion-paso-resumen-ambiente-dev')).toBeTruthy();
    expect(screen.getByText('Confirmar y emitir')).toBeTruthy();
  });

  /**
   * 🔴 El caso más importante de los cuatro. Ante el dato ausente, la tentación es asumir homologación
   * ("la opción segura") — y esa suposición ES el error caro: alguien mirando un cartel que dice
   * "prueba" mientras emite un comprobante fiscal real. La pantalla tiene que admitir que no sabe.
   */
  it('sin ambiente confirmado NO asume homologación: lo dice', async () => {
    await montar(null);

    const aviso = screen.getByTestId('facturacion-paso-resumen-ambiente-desconocido');
    expect(aviso.props.children).toContain('No pudimos confirmar');
    // Y no se pinta como si fuera una prueba inocua.
    expect(screen.queryByTestId('facturacion-paso-resumen-ambiente-dev')).toBeNull();
  });

  it('los tres botones del gate HITL están presentes', async () => {
    await montar('dev');

    expect(screen.getByTestId('facturacion-paso-resumen-confirmar')).toBeTruthy();
    expect(screen.getByTestId('facturacion-paso-resumen-cancelar')).toBeTruthy();
    expect(screen.getByTestId('facturacion-paso-resumen-editar')).toBeTruthy();
  });

  it('"Editar y confirmar" ofrece volver a cualquiera de los 3 pasos, sin rehacer el resto', async () => {
    await montar('dev');

    await fireEvent.press(screen.getByTestId('facturacion-paso-resumen-editar'));

    expect(screen.getByTestId('facturacion-paso-resumen-editar-datos-venta')).toBeTruthy();
    expect(screen.getByTestId('facturacion-paso-resumen-editar-items')).toBeTruthy();
    expect(screen.getByTestId('facturacion-paso-resumen-editar-cliente')).toBeTruthy();
  });
});
