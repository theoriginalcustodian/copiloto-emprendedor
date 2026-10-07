import { describe, expect, it } from 'vitest';
import type { MeResponse } from './types';
import { CLAVES_DECLARADAS, RAMA_CON_CLAIMS, RAMA_SIN_CLAIMS } from './me.contrato';

const REQUERIDAS: ReadonlyArray<keyof MeResponse> = [
  'cliente_id',
  'es_admin',
  'mp_connected',
  'composio_connected',
  'legal_aceptado',
  'legal_version_aceptada',
];

function clavesNoDeclaradas(payload: object): string[] {
  return Object.keys(payload).filter((k) => !(k in CLAVES_DECLARADAS));
}

describe('contrato GET /me', () => {
  const ramas: Array<[string, MeResponse]> = [
    ['con claims', RAMA_CON_CLAIMS],
    ['sin claims', RAMA_SIN_CLAIMS],
  ];

  it.each(ramas)('la rama %s no manda campos fuera del tipo', (_nombre, payload) => {
    expect(clavesNoDeclaradas(payload)).toEqual([]);
  });

  it.each(ramas)('la rama %s trae todos los campos requeridos', (_nombre, payload) => {
    for (const k of REQUERIDAS) expect(payload).toHaveProperty(k);
  });

  it('control: un campo que el backend agregue sin declarar se detecta', () => {
    expect(clavesNoDeclaradas({ ...RAMA_CON_CLAIMS, campo_nuevo: 1 })).toEqual(['campo_nuevo']);
  });
});
