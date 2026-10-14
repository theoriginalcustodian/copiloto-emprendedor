import { describe, expect, it } from 'vitest';

import { ApiError } from './errors';
import { TEXTO_ANULACION_FALLO, textoDeFalloDeAnulacion } from './anulacionFallo';

describe('textoDeFalloDeAnulacion', () => {
  it('prefiere el `motivo` del 409 de confirmar', () => {
    const err = new ApiError(409, 'conflict', 'otro', { motivo: 'La anulación ya quedó fallida', motivo_codigo: 'x' });
    expect(textoDeFalloDeAnulacion(err)).toBe('La anulación ya quedó fallida');
  });
  it('sin motivo, el detail del backend', () => {
    expect(textoDeFalloDeAnulacion(new ApiError(400, 'bad', 'CAE vencido', {}))).toBe('CAE vencido');
  });
  it('un ApiError sin nada legible, o un error cualquiera, da el texto genérico (nunca vacío)', () => {
    expect(textoDeFalloDeAnulacion(new ApiError(500, 'boom'))).toBe(TEXTO_ANULACION_FALLO);
    expect(textoDeFalloDeAnulacion(new Error('network'))).toBe(TEXTO_ANULACION_FALLO);
    expect(textoDeFalloDeAnulacion(undefined)).toBe(TEXTO_ANULACION_FALLO);
    expect(textoDeFalloDeAnulacion(new ApiError(409, 'c', '  ', { motivo: '   ' }))).toBe(TEXTO_ANULACION_FALLO);
  });
});
