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
