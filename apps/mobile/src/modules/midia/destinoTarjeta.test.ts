import { rutaDeDestino } from './destinoTarjeta';

describe('rutaDeDestino (H5b)', () => {
  it('conexion con id → la ruta de esa conexión', () => {
    expect(rutaDeDestino({ tipo: 'conexion', id: 'gmail', connectPath: '/composio/connect?service=gmail' })).toEqual({
      tipo: 'conexion',
      servicio: 'gmail',
    });
  });

  it('conexion sin id → null (cae a Ajustes)', () => {
    expect(rutaDeDestino({ tipo: 'conexion', id: null, connectPath: null })).toBeNull();
  });

  it('🔴 tipo inventado → null, nunca lanza', () => {
    expect(rutaDeDestino({ tipo: 'lo-que-sea', id: 'gmail', connectPath: null })).toBeNull();
  });

  it('null / undefined → null', () => {
    expect(rutaDeDestino(null)).toBeNull();
    expect(rutaDeDestino(undefined)).toBeNull();
  });
});
