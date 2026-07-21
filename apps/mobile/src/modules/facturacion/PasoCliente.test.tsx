import { fireEvent, render, screen } from '@testing-library/react-native';

import type { EstadoFacturaResp } from '@copiloto/core';

import { ThemeProvider } from '../../theme/ThemeProvider';
import { PasoCliente } from './PasoCliente';

/**
 * 🔴 **El defecto que estos tests impiden, cazado en device el 2026-07-21.**
 *
 * Esta pantalla exigía documento **Y** nombre **Y** domicilio siempre. Con eso, el caso más común de
 * todos —una venta a consumidor final— dejaba el flujo **trabado**: el botón "Continuar" quedaba
 * deshabilitado en silencio, sin error y sin decir qué faltaba. El control por HTTP con los mismos
 * datos pasó a `esperando_confirmacion` sin chistar, así que la regla de más estaba en la app.
 *
 * El contrato real es `afip_rules.validar_receptor`: con `tipo_doc = 99` no se exige nada; con
 * cualquier otro, sólo el número de documento. `nombre` y `domicilio` no son obligatorios nunca.
 */

const ESTADO: EstadoFacturaResp = {
  estado: 'items_ok',
  faltantes: [],
  items: [],
  total: '1500.00',
  tokenConfirmacion: null,
  resultado: null,
  pdf: null,
  drive: null,
  motivo: null,
  motivoCodigo: null,
  terminado: false,
};

async function montar(onGuardar = jest.fn().mockResolvedValue(undefined)) {
  const utils = await render(
    <ThemeProvider>
      <PasoCliente estado={ESTADO} onGuardar={onGuardar} />
    </ThemeProvider>,
  );
  return { ...utils, onGuardar };
}

/**
 * Elige una opción por su `testID`, no por su texto: "Consumidor Final" existe en los DOS selectores
 * (condición IVA y tipo de documento), así que buscar por texto es ambiguo — y además ata el test al
 * copy, que puede cambiar sin que cambie el comportamiento.
 */
const P = 'facturacion-paso-cliente';
async function elegirCondicionIva(valor: string) {
  await fireEvent.press(screen.getByTestId(`${P}-condicion-iva-opcion-${valor}`));
}
async function elegirTipoDoc(valor: string) {
  await fireEvent.press(screen.getByTestId(`${P}-tipo-doc-opcion-${valor}`));
}

describe('PasoCliente — qué campos son realmente obligatorios', () => {
  it('consumidor final: continúa SIN documento, nombre ni domicilio', async () => {
    const { onGuardar } = await montar();

    await elegirCondicionIva('5'); // consumidor final
    await elegirTipoDoc('99'); // consumidor final -> nada más es obligatorio

    await fireEvent.press(screen.getByTestId('facturacion-paso-cliente-continuar'));

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ tipoDoc: 99, nroDoc: '', nombre: '', domicilio: '' }),
    );
  });

  it('con DNI el documento SÍ es obligatorio: sin él no continúa', async () => {
    const { onGuardar } = await montar();

    await elegirCondicionIva('1');
    await elegirTipoDoc('96'); // DNI

    await fireEvent.press(screen.getByTestId('facturacion-paso-cliente-continuar'));

    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('con DNI y documento cargado, continúa', async () => {
    const { onGuardar } = await montar();

    await elegirCondicionIva('1');
    await elegirTipoDoc('96'); // DNI
    await fireEvent.changeText(screen.getByTestId('facturacion-paso-cliente-nro-doc-input'), '30111222');

    await fireEvent.press(screen.getByTestId('facturacion-paso-cliente-continuar'));

    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ tipoDoc: 96, nroDoc: '30111222' }));
  });

  /**
   * La otra mitad del arreglo: no alcanza con dejar de exigir de más, hay que DECIR qué se exige. Un
   * botón deshabilitado sin explicación es indistinguible de una función rota.
   */
  it('la etiqueta del documento dice si es opcional, según el tipo elegido', async () => {
    await montar();

    await elegirTipoDoc('99');
    expect(screen.getByText('Número de documento (opcional)')).toBeTruthy();

    await elegirTipoDoc('80'); // CUIT
    expect(screen.getByText('Número de documento')).toBeTruthy();
  });

  it('nombre y domicilio se ofrecen como opcionales', async () => {
    await montar();

    expect(screen.getByText('Nombre / Razón social (opcional)')).toBeTruthy();
    expect(screen.getByText('Domicilio (opcional)')).toBeTruthy();
  });
});
