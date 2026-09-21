import { describe, expect, it } from 'vitest';

import type { ChatMessage } from './chatMachine';
import { conexionPendienteDelHilo, leerRequiereConexion } from './requiereConexion';

const CARD = {
  kind: 'requiere_conexion',
  service: 'gmail',
  label: 'Gmail',
  alcance: ['Leer mails', 'Enviar mails'],
  connect_path: '/composio/connect?service=gmail',
} as const;

const user = (id: string, text: string): ChatMessage => ({ id, role: 'user', text });
const asistente = (id: string, card?: ChatMessage['card']): ChatMessage => ({ id, role: 'assistant', text: 'Para eso necesito que conectes Gmail primero.', card });

describe('leerRequiereConexion', () => {
  it('lee la card completa', () => {
    expect(leerRequiereConexion(CARD)).toEqual({
      service: 'gmail',
      label: 'Gmail',
      alcance: ['Leer mails', 'Enviar mails'],
      connectPath: '/composio/connect?service=gmail',
    });
  });

  it('un card de otro tipo, vacío o sin connect_path NO dispara el sheet', () => {
    expect(leerRequiereConexion(undefined)).toBeNull();
    expect(leerRequiereConexion(null)).toBeNull();
    expect(leerRequiereConexion({ kind: 'confirm', service: 'gmail', label: 'Gmail' })).toBeNull();
    expect(leerRequiereConexion({ kind: 'requiere_conexion', service: 'gmail' })).toBeNull();
    expect(leerRequiereConexion({ kind: 'requiere_conexion', connect_path: '/x' })).toBeNull();
  });

  it('tolera alcance ausente o con basura (lista vacía, no revienta)', () => {
    const c = leerRequiereConexion({ kind: 'requiere_conexion', service: 'gmail', connect_path: '/x', alcance: [1, '', 'Buscar'] } as never);
    expect(c?.alcance).toEqual(['Buscar']);
    expect(leerRequiereConexion({ kind: 'requiere_conexion', service: 'gmail', connect_path: '/x' })?.alcance).toEqual([]);
  });
});

describe('conexionPendienteDelHilo', () => {
  it('devuelve el gate con el último pedido del usuario como texto original', () => {
    const p = conexionPendienteDelHilo([user('1', 'hola'), user('2', 'mandale un mail a Juan'), asistente('3', CARD)], new Set());
    expect(p?.mensajeId).toBe('3');
    expect(p?.textoOriginal).toBe('mandale un mail a Juan');
    expect(p?.conexion.service).toBe('gmail');
  });

  it('«Ahora no»: un mensaje descartado no reabre el sheet', () => {
    expect(conexionPendienteDelHilo([user('1', 'x'), asistente('3', CARD)], new Set(['3']))).toBeNull();
  });

  it('si el usuario ya siguió hablando, el gate quedó viejo', () => {
    expect(conexionPendienteDelHilo([user('1', 'x'), asistente('3', CARD), user('4', 'mejor otra cosa')], new Set())).toBeNull();
  });

  it('una respuesta sin card (o con otra) no dispara nada', () => {
    expect(conexionPendienteDelHilo([user('1', 'x'), asistente('2')], new Set())).toBeNull();
    expect(conexionPendienteDelHilo([], new Set())).toBeNull();
  });
});

describe('conexionEstablecida', () => {
  it('sólo es true si el catálogo re-consultado dice conectado; toda falla es false', async () => {
    const { vi } = await import('vitest');
    const cat = await import('../api/catalogo');
    const spy = vi.spyOn(cat, 'listarCatalogo');
    const { conexionEstablecida } = await import('./requiereConexion');

    spy.mockResolvedValueOnce({ status: 'ok', servicios: [{ key: 'gmail', conectado: true }] } as never);
    expect(await conexionEstablecida('gmail')).toBe(true);
    spy.mockResolvedValueOnce({ status: 'ok', servicios: [{ key: 'gmail', conectado: false }] } as never);
    expect(await conexionEstablecida('gmail')).toBe(false);
    spy.mockResolvedValueOnce({ status: 'no_disponible' } as never);
    expect(await conexionEstablecida('gmail')).toBe(false);
    spy.mockRejectedValueOnce(new Error('red'));
    expect(await conexionEstablecida('gmail')).toBe(false);
    spy.mockRestore();
  });
});
