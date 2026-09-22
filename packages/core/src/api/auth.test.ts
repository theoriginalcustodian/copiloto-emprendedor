import { beforeEach, describe, expect, it } from 'vitest';

import { cambiarContrasena, cambiarEmail } from './auth';
import { configurarApi } from './config';
import type { HttpPort, PeticionHttp, RespuestaHttp } from './http';
import type { AlmacenTokens } from './tokens';

const respuesta = (status: number, body: unknown): RespuestaHttp => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const tokens: AlmacenTokens = {
  async leerToken() { return 'tok'; },
  async guardarToken() {},
  async leerRefresh() { return null; },
  async guardarRefresh() {},
  async limpiar() {},
};

describe('cambiar credenciales (K-12 / BL-J11)', () => {
  let peticiones: PeticionHttp[];
  let responder: (p: PeticionHttp) => RespuestaHttp;

  beforeEach(() => {
    peticiones = [];
    responder = () => respuesta(200, { ok: true });
    const http: HttpPort = { async enviar(p) { peticiones.push(p); return responder(p); } };
    configurarApi({ http, tokens });
  });

  it('cambiarContrasena: manda actual + nueva y devuelve ok', async () => {
    const res = await cambiarContrasena('vieja', 'nueva-larga');
    expect(res).toEqual({ ok: true, confirmacionPendiente: false });
    expect(peticiones[0]?.path).toBe('/auth/cambiar-contrasena');
    expect(peticiones[0]?.cuerpoJson).toEqual({ contrasena_actual: 'vieja', contrasena_nueva: 'nueva-larga' });
  });

  it('actual incorrecta (401 con detail.codigo): valor con el mensaje del backend, no lanza', async () => {
    responder = () => respuesta(401, { detail: { codigo: 'contrasena_actual_incorrecta', mensaje: 'La contraseña actual no coincide.' } });
    expect(await cambiarContrasena('x', 'nueva-larga')).toEqual({
      ok: false,
      codigo: 'contrasena_actual_incorrecta',
      mensaje: 'La contraseña actual no coincide.',
    });
  });

  it('política (422) y mail en uso (409) también vuelven como valor', async () => {
    responder = () => respuesta(422, { detail: { codigo: 'contrasena_invalida', mensaje: 'Muy corta.' } });
    expect(await cambiarContrasena('a', 'b')).toMatchObject({ ok: false, codigo: 'contrasena_invalida', mensaje: 'Muy corta.' });
    responder = () => respuesta(409, { detail: { codigo: 'email_ya_registrado', mensaje: 'Ese email ya está en uso.' } });
    expect(await cambiarEmail('a@b.com')).toMatchObject({ ok: false, codigo: 'email_ya_registrado' });
  });

  it('cuenta sin email (400 con detail.codigo, A2/K-12): mensaje propio, no el genérico', async () => {
    responder = () => respuesta(400, { detail: { codigo: 'cuenta_sin_email', mensaje: 'Esta cuenta no tiene un email asociado.' } });
    expect(await cambiarContrasena('vieja', 'nueva-larga')).toEqual({
      ok: false,
      codigo: 'cuenta_sin_email',
      mensaje: 'Esta cuenta no tiene un email asociado.',
    });
  });

  it('cambiarEmail: 200 confirmacion_pendiente', async () => {
    responder = () => respuesta(200, { ok: true, confirmacion_pendiente: true });
    expect(await cambiarEmail('nueva@direccion.com')).toEqual({ ok: true, confirmacionPendiente: true });
    expect(peticiones[0]?.path).toBe('/auth/cambiar-email');
  });

  it('un 500 sigue lanzando (no se disfraza de error de formulario)', async () => {
    responder = () => respuesta(500, {});
    await expect(cambiarEmail('a@b.com')).rejects.toThrow();
  });
});
