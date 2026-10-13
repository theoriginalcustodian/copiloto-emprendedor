import { describe, expect, it } from 'vitest';

import type { ReplyCard } from '../api/types';
import type { ChatMessage } from './chatMachine';
import { conexionPendienteDelHilo, etiquetaCondicion, leerRequiereConexion } from './requiereConexion';

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
      alcance: [
        { texto: 'Leer mails', condicion: 'ninguna' },
        { texto: 'Enviar mails', condicion: 'ninguna' },
      ],
      pendiente: null,
      connectPath: '/composio/connect?service=gmail',
    });
  });

  it('un card de otro tipo, vacío o sin connect_path NO dispara el sheet', () => {
    expect(leerRequiereConexion(undefined)).toBeNull();
    expect(leerRequiereConexion(null)).toBeNull();
    expect(leerRequiereConexion({ kind: 'confirm', service: 'gmail', label: 'Gmail' })).toBeNull();
    expect(leerRequiereConexion({ kind: 'requiere_conexion', service: 'gmail' })).toBeNull();
    expect(leerRequiereConexion({ kind: 'requiere_conexion', connect_path: '/x' } as ReplyCard)).toBeNull();
  });

  it('tolera alcance ausente o con basura (lista vacía, no revienta)', () => {
    const c = leerRequiereConexion({ kind: 'requiere_conexion', service: 'gmail', connect_path: '/x', alcance: [1, '', 'Buscar'] } as never);
    expect(c?.alcance).toEqual([{ texto: 'Buscar', condicion: 'ninguna' }]);
    expect(leerRequiereConexion({ kind: 'requiere_conexion', service: 'gmail', connect_path: '/x' } as ReplyCard)?.alcance).toEqual([]);
  });
});

// PROTO4DEPS §A — `alcance` pasa de `string[]` a `[{texto, condicion}]`. Producción emite la forma
// vieja HOY, así que las dos tienen que leerse: si no, la hoja de consentimiento queda SIN filas y sin error.
describe('leerRequiereConexion — alcance en las dos formas', () => {
  const card = (alcance: unknown) =>
    leerRequiereConexion({ kind: 'requiere_conexion', service: 'mercadopago', connect_path: '/x', alcance } as never);

  it('forma vieja (string[], lo que emite producción hoy): cada texto con condicion «ninguna»', () => {
    expect(card(['Generar link de cobro'])?.alcance).toEqual([{ texto: 'Generar link de cobro', condicion: 'ninguna' }]);
  });

  it('forma nueva ([{texto, condicion}]): conserva el texto y la condicion', () => {
    expect(
      card([
        { texto: 'Leer tus cobros y movimientos', condicion: 'solo_lectura' },
        { texto: 'Armar links de cobro cuando vos confirmás', condicion: 'requiere_ok' },
      ])?.alcance,
    ).toEqual([
      { texto: 'Leer tus cobros y movimientos', condicion: 'solo_lectura' },
      { texto: 'Armar links de cobro cuando vos confirmás', condicion: 'requiere_ok' },
    ]);
  });

  it('mezcla (un backend a medio migrar): lee las dos en la misma lista, en orden', () => {
    expect(card(['Leer mails', { texto: 'Enviar mails', condicion: 'requiere_ok' }, '', { condicion: 'solo_lectura' }])?.alcance).toEqual([
      { texto: 'Leer mails', condicion: 'ninguna' },
      { texto: 'Enviar mails', condicion: 'requiere_ok' },
    ]);
  });

  it('una condicion DESCONOCIDA no tira: cae a «ninguna» (sin insignia), como un tipo ajeno en rutaDeDestino', () => {
    expect(card([{ texto: 'Borrar todo', condicion: 'solo_escritura' }])?.alcance).toEqual([{ texto: 'Borrar todo', condicion: 'ninguna' }]);
    expect(card([{ texto: 'X', condicion: 42 }])?.alcance).toEqual([{ texto: 'X', condicion: 'ninguna' }]);
  });

  it('la etiqueta la pinta la app: dos insignias y «ninguna» no lleva', () => {
    expect(etiquetaCondicion('solo_lectura')).toBe('Solo lectura');
    expect(etiquetaCondicion('requiere_ok')).toBe('Nunca sin tu OK');
    expect(etiquetaCondicion('ninguna')).toBeNull();
  });
});

// PROTO4DEPS §B — `pendiente: {texto}` es del TURNO y opcional. El caso VACÍO va primero: es el de prod hoy.
describe('leerRequiereConexion — pendiente', () => {
  const base = { kind: 'requiere_conexion', service: 'mercadopago', connect_path: '/x' };

  it('ausente → null (la hoja se ve como hoy)', () => {
    expect(leerRequiereConexion(base as never)?.pendiente).toBeNull();
  });

  it('presente → el texto', () => {
    expect(leerRequiereConexion({ ...base, pendiente: { texto: 'cuánto entró esta semana' } } as never)?.pendiente).toBe('cuánto entró esta semana');
  });

  it('basura (string suelto, objeto sin texto, texto vacío) → null, no revienta', () => {
    for (const pendiente of ['cuánto entró', {}, { texto: '   ' }, { texto: 7 }, null]) {
      expect(leerRequiereConexion({ ...base, pendiente } as never)?.pendiente).toBeNull();
    }
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
