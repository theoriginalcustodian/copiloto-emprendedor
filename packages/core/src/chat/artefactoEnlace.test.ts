import { describe, expect, it } from 'vitest';

import { leerArtefactoEnlace } from './artefactoEnlace';

const card = (kind: string, data: unknown) => ({ kind, data }) as never;

describe('leerArtefactoEnlace', () => {
  it('calendar_event: título de data.fields.title y enlace si hay url', () => {
    expect(
      leerArtefactoEnlace(card('calendar_event', { url: 'https://cal/x', fields: { title: 'Reunión con Ana' } })),
    ).toEqual({ kind: 'calendar_event', titulo: 'Reunión con Ana', url: 'https://cal/x', etiqueta: 'Ver en Calendar' });
  });

  it('calendar_event sin url y sin título igual se lee: «Evento», sin enlace', () => {
    expect(leerArtefactoEnlace(card('calendar_event', {}))).toEqual({
      kind: 'calendar_event',
      titulo: 'Evento',
      url: null,
      etiqueta: 'Ver en Calendar',
    });
    expect(leerArtefactoEnlace(card('calendar_event', null))?.titulo).toBe('Evento');
  });

  it.each([
    ['doc', 'Abrir documento'],
    ['sheet', 'Abrir planilla'],
    ['file', 'Abrir archivo'],
    ['email_draft', 'Ver borrador'],
  ])('%s con url: rótulo %s', (kind, etiqueta) => {
    expect(leerArtefactoEnlace(card(kind, { url: 'https://g/x' }))).toEqual({
      kind,
      titulo: null,
      url: 'https://g/x',
      etiqueta,
    });
  });

  it('doc/sheet/file/email_draft SIN url no tienen acción: null', () => {
    for (const kind of ['doc', 'sheet', 'file', 'email_draft']) {
      expect(leerArtefactoEnlace(card(kind, {}))).toBeNull();
      expect(leerArtefactoEnlace(card(kind, { url: '   ' }))).toBeNull();
    }
  });

  it('otros kinds (payment_link, confirm, datos_negocio) y sin card: null', () => {
    expect(leerArtefactoEnlace(card('payment_link', { url: 'https://mpago.la/x' }))).toBeNull();
    expect(leerArtefactoEnlace(card('confirm', { url: 'https://x' }))).toBeNull();
    expect(leerArtefactoEnlace(card('datos_negocio', {}))).toBeNull();
    expect(leerArtefactoEnlace(undefined)).toBeNull();
  });

  it('un kind heredado del prototipo de Object no se confunde con un artefacto', () => {
    expect(leerArtefactoEnlace(card('toString', { url: 'https://x' }))).toBeNull();
    expect(leerArtefactoEnlace(card('constructor', { url: 'https://x' }))).toBeNull();
  });
});
