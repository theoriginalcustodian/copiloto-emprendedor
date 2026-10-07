import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { configurarApi, type AlmacenTokens, type HttpPort, type RespuestaHttp } from '@copiloto/core';

import { PantallaAfipSetup } from './PantallaAfipSetup';

/**
 * BL-C6 (K-02), mitad web. Se ejercita el camino REAL: `HttpPort` fake -> `guardarPerfil` de core (que
 * mapea el `409 cuit_no_vinculado` a `ErrorValidacionFiscal`) -> componente. Si el mapeo del 409 se
 * revierte, este test se pone rojo; mockear `guardarPerfil` lo taparía.
 */

const CUIT = '20111222339';
const MENSAJE = 'Ese CUIT no está vinculado a tu clave fiscal.';

function respuesta(status: number, body: unknown): RespuestaHttp {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const tokens: AlmacenTokens = {
  async leerToken() {
    return 'tok-123';
  },
  async guardarToken() {},
  async leerRefresh() {
    return null;
  },
  async guardarRefresh() {},
  async limpiar() {},
};

describe('PantallaAfipSetup — 409 cuit_no_vinculado (K-02, BL-C6)', () => {
  beforeEach(() => {
    const http: HttpPort = {
      async enviar(p) {
        if (p.metodo === 'POST' && p.path === '/afip/perfil') {
          return respuesta(409, { detail: { codigo: 'cuit_no_vinculado', mensaje: MENSAJE } });
        }
        return respuesta(404, {}); // estado/perfil no disponibles: el formulario arranca vacío y editable.
      },
    };
    configurarApi({ http, tokens });
  });

  it('pinta el mensaje del backend sobre el campo CUIT y deja el formulario editable', async () => {
    render(<PantallaAfipSetup />);

    fireEvent.change(await screen.findByTestId('afip-perfil-cuit'), { target: { value: CUIT } });
    fireEvent.click(screen.getByTestId('afip-perfil-guardar'));

    expect(await screen.findByTestId('afip-perfil-cuit-error')).toHaveTextContent(MENSAJE);
    // No se re-bloquea: el usuario puede corregir el CUIT y reintentar.
    expect(screen.getByTestId('afip-perfil-cuit')).toBeInTheDocument();
    expect(screen.queryByTestId('afip-perfil-cuit-fijo')).toBeNull();
  });
});

/**
 * BL-V27, mitad web. Una vez que `guardarPerfil` confirma (200), el CUIT queda bloqueado -- y desde
 * el 2026-09-22 el bloqueo NO tiene control para deshacerlo: es una decisión con implicancia fiscal,
 * no una preferencia de UI. El chip "Bloqueado" reemplaza al botón "Cambiar" que existía antes.
 */
describe('PantallaAfipSetup — CUIT vinculado queda bloqueado sin salida (BL-V27)', () => {
  const CUIT_OK = '20111222339';
  const CUIT_OK_FORMATEADO = '20-11122233-9';

  beforeEach(() => {
    const http: HttpPort = {
      async enviar(p) {
        if (p.metodo === 'POST' && p.path === '/afip/perfil') {
          return respuesta(200, { ok: true });
        }
        return respuesta(404, {}); // estado/perfil no disponibles fuera de este caso puntual.
      },
    };
    configurarApi({ http, tokens });
  });

  it('tras guardar el perfil, muestra el chip "Bloqueado" y ningún control para cambiar el CUIT', async () => {
    render(<PantallaAfipSetup />);

    fireEvent.change(await screen.findByTestId('afip-perfil-cuit'), { target: { value: CUIT_OK } });
    fireEvent.click(screen.getByTestId('afip-perfil-guardar'));

    expect(await screen.findByTestId('afip-perfil-cuit-fijo')).toHaveTextContent(CUIT_OK_FORMATEADO);
    expect(screen.getByTestId('afip-perfil-cuit-bloqueado')).toHaveTextContent('Bloqueado');
    expect(screen.queryByTestId('afip-perfil-cuit-cambiar')).toBeNull();
    expect(screen.queryByTestId('afip-perfil-cuit')).toBeNull();
  });
});

/**
 * DRIVECERO (#812, confirmado por planificación 2026-10-06): un tenant nuevo no puede conectar Drive,
 * así que las ramas del bloque 4 no pueden mandarlo a «conectar en Apps». Control NEGATIVO: si alguien
 * reintroduce el texto viejo, la aserción de ausencia se pone roja.
 */
describe('PantallaAfipSetup — copia en Drive sin salida hacia Apps (DRIVECERO)', () => {
  const TEXTO_VIEJO = /Conectalo en Apps|conectado en Apps/;

  function montarConEstado(driveConectado: 'true' | 'false' | 'ausente') {
    const http: HttpPort = {
      async enviar(p) {
        if (p.metodo === 'GET' && p.path.startsWith('/afip/estado')) {
          const drive =
            driveConectado === 'ausente' ? {} : { drive_conectado: driveConectado === 'true' };
          return respuesta(200, { cuit: CUIT, conectado: false, ...drive });
        }
        if (p.metodo === 'POST' && p.path === '/afip/ajustes') {
          return respuesta(200, { ok: true, guardar_en_drive: true });
        }
        return respuesta(404, {});
      },
    };
    configurarApi({ http, tokens });
  }

  // DRIVETOGGLE: sin Drive conectado el toggle no es interactivo. Antes de esta regla el usuario
  // podía activar una copia que la beta no puede escribir.
  it('drive desconectado: el toggle queda apagado y no interactivo, sin mandar a conectar en Apps', async () => {
    montarConEstado('false');
    render(<PantallaAfipSetup />);

    const toggle = await screen.findByTestId('afip-drive-toggle');
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveValue('no');
    expect(screen.queryByText(TEXTO_VIEJO)).toBeNull();
  });

  it('drive sin verificar (null): el toggle tampoco se puede activar', async () => {
    montarConEstado('ausente');
    render(<PantallaAfipSetup />);

    expect(await screen.findByTestId('afip-drive-toggle')).toBeDisabled();
    expect(screen.queryByText(TEXTO_VIEJO)).toBeNull();
  });

  // Control positivo: con Drive conectado el mismo toggle SÍ se habilita. Sin este caso, un toggle
  // deshabilitado en todos los estados pasaría el test anterior.
  it('drive conectado: el toggle queda habilitado (control positivo)', async () => {
    montarConEstado('true');
    render(<PantallaAfipSetup />);

    expect(await screen.findByTestId('afip-drive-toggle')).toBeEnabled();
  });
});
