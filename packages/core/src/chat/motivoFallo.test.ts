import { describe, expect, it } from 'vitest';

import { ApiError, UnauthorizedError } from '../api/errors';
import type { MotivoFallo } from './chatMachine';
import { motivoDeError, textoDeMotivo } from './motivoFallo';

describe('motivoDeError', () => {
  it('un 422 es "no se entendió el audio", NO un fallo de envío', () => {
    // 🔴 El caso que originó todo esto: el envío SALIÓ BIEN y el STT no entendió nada. Tratarlo como
    // fallo de envío manda al usuario a revisar la conexión mientras el problema está en el micrófono.
    expect(motivoDeError(new ApiError(422, 'no se entendió el audio'))).toBe('audio_no_entendido');
  });

  it('un 401 es sesión vencida — reintentar lo mismo no puede funcionar', () => {
    expect(motivoDeError(new UnauthorizedError('token vencido'))).toBe('sesion_vencida');
  });

  it('un 413 dice que el audio es muy largo, no que falló la red', () => {
    expect(motivoDeError(new ApiError(413, 'audio demasiado grande'))).toBe('audio_muy_grande');
  });

  it('un 5xx es del servidor', () => {
    expect(motivoDeError(new ApiError(502, 'bad gateway'))).toBe('servidor');
    expect(motivoDeError(new ApiError(500, 'boom'))).toBe('servidor');
  });

  it('🔴 lo que NO es un ApiError es "red" — es el único caso con evidencia de que no hubo respuesta', () => {
    expect(motivoDeError(new TypeError('Network request failed'))).toBe('red');
    expect(motivoDeError('algo raro')).toBe('red');
  });

  it('🔴 un status desconocido cae en "servidor", NUNCA en "red"', () => {
    // Afirmar "revisá tu conexión" ante un error del que sólo sabemos que tuvo respuesta HTTP sería
    // inventar una causa: hubo servidor, contestó. Mandarlo a mirar el WiFi le hace perder el tiempo.
    expect(motivoDeError(new ApiError(418, 'tetera'))).toBe('servidor');
  });

  it('🔴 500 con diferido:true (ítem 2.5 DLQ) es "servidor_diferido", no "servidor"', () => {
    // El caso que motiva el contrato: la activity falló transitorio, el trauma YA quedó en la DLQ
    // pendiente de reintento, y reintentar a mano acá DUPLICA un efecto (cobro/gasto).
    const err = new ApiError(500, 'error interno del servidor', undefined, {
      detail: 'error interno del servidor',
      codigo: 'a3f9c1e2',
      diferido: true,
    });
    expect(motivoDeError(err)).toBe('servidor_diferido');
  });

  it('🔴 control negativo — diferido:false o ausente sigue siendo "servidor" (sin cambios)', () => {
    const conFalse = new ApiError(500, 'boom', undefined, { codigo: 'x', diferido: false });
    const sinCampo = new ApiError(500, 'boom', undefined, { codigo: 'x' });
    expect(motivoDeError(conFalse)).toBe('servidor');
    expect(motivoDeError(sinCampo)).toBe('servidor');
  });

  it('diferido:true en un status que NO es 500 no dispara servidor_diferido — el contrato lo fija a 500', () => {
    const err = new ApiError(409, 'conflicto', undefined, { diferido: true });
    expect(motivoDeError(err)).toBe('servidor');
  });
});

describe('textoDeMotivo', () => {
  it('🔴 NO dice "no pudimos enviar" en los casos donde el mensaje SÍ se envió', () => {
    // La invariante de honestidad de este módulo. Un 422 y un 413 llegaron al servidor: afirmar lo
    // contrario es falso y desvía el diagnóstico.
    for (const motivo of ['audio_no_entendido', 'audio_muy_grande'] as const) {
      expect(textoDeMotivo(motivo).toLowerCase()).not.toContain('no pudimos enviar');
    }
  });

  it('cada motivo dice qué hacer, no sólo qué pasó', () => {
    // Un aviso que sólo describe el fallo deja al usuario adivinando. Cada texto nombra una acción.
    // 🔴 `servidor_diferido` queda AFUERA a propósito: su acción es "ninguna" — es el único motivo
    // donde decirle al usuario qué hacer sería decirle que reintente, y eso es justo lo prohibido.
    const acciones = [/probá|revisá|grabá|volvé/i];
    const todos: MotivoFallo[] = [
      'red',
      'audio_no_entendido',
      'audio_muy_grande',
      'sesion_vencida',
      'servidor',
    ];
    for (const motivo of todos) {
      expect(acciones.some((re) => re.test(textoDeMotivo(motivo)))).toBe(true);
    }
  });

  it('🔴 "servidor_diferido" NO invita a reintentar — es lo único vinculante del contrato', () => {
    const texto = textoDeMotivo('servidor_diferido').toLowerCase();
    expect(texto).not.toMatch(/probá de nuevo|reintentá|volvé a intentar/);
    expect(texto).toContain('no hace falta que lo repitas');
    expect(textoDeMotivo('servidor_diferido')).not.toBe(textoDeMotivo('servidor'));
  });

  it('el de audio manda al micrófono y el de sesión a volver a entrar — no son intercambiables', () => {
    expect(textoDeMotivo('audio_no_entendido')).toMatch(/micrófono/i);
    expect(textoDeMotivo('sesion_vencida')).toMatch(/sesión|entrar/i);
    expect(textoDeMotivo('audio_no_entendido')).not.toBe(textoDeMotivo('servidor'));
  });
});
