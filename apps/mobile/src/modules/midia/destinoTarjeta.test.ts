import { hrefDeRuta, rutaDeDestino } from './destinoTarjeta';

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

  describe('comprobante (facturas impagas y CAE por vencer)', () => {
    it('🔴 id que NO es un entero → null: `/facturacion` lo trataría como «borrador nuevo»', () => {
      for (const id of ['A-0034', '', ' 412', '412 ', '4.12', '-3', '412;DROP', 'presupuesto:7']) {
        expect(rutaDeDestino({ tipo: 'comprobante', id, connectPath: null })).toBeNull();
      }
      expect(rutaDeDestino({ tipo: 'comprobante', id: null, connectPath: null })).toBeNull();
    });

    it('id de fila → ese comprobante', () => {
      expect(rutaDeDestino({ tipo: 'comprobante', id: '412', connectPath: null })).toEqual({
        tipo: 'comprobante',
        comprobanteId: '412',
      });
    });
  });

  describe('certificado', () => {
    it('lleva a AFIP con o sin id (la pantalla es una hoja sin parámetros)', () => {
      expect(rutaDeDestino({ tipo: 'certificado', id: '20123456786:produccion', connectPath: null })).toEqual({ tipo: 'certificado' });
      expect(rutaDeDestino({ tipo: 'certificado', id: null, connectPath: null })).toEqual({ tipo: 'certificado' });
    });
  });

  describe('huecos declarados: el backend los emite y esta app todavía no tiene dónde abrirlos', () => {
    it('🔴 presupuesto → null (espera `avisoAlChat` de frontend1; cuando llegue, este test cambia)', () => {
      expect(rutaDeDestino({ tipo: 'presupuesto', id: '412', connectPath: null })).toBeNull();
    });

    it('🔴 trabajo → null: no hay pantalla de detalle de un trabajo (`eslabon:ref`)', () => {
      expect(rutaDeDestino({ tipo: 'trabajo', id: 'presupuesto:7', connectPath: null })).toBeNull();
      expect(rutaDeDestino({ tipo: 'trabajo', id: null, connectPath: null })).toBeNull();
    });
  });

  it('null / undefined → null', () => {
    expect(rutaDeDestino(null)).toBeNull();
    expect(rutaDeDestino(undefined)).toBeNull();
  });
});

describe('hrefDeRuta — la única tabla ruta→pantalla de Mi día', () => {
  it('conexion → /apps?servicio=', () => {
    expect(hrefDeRuta({ tipo: 'conexion', servicio: 'gmail' })).toEqual({ pathname: '/apps', params: { servicio: 'gmail' } });
  });

  it('comprobante → /facturacion?comprobanteId= (NO `facturaId`: es otro espacio de ids)', () => {
    expect(hrefDeRuta({ tipo: 'comprobante', comprobanteId: '412' })).toEqual({
      pathname: '/facturacion',
      params: { comprobanteId: '412' },
    });
  });

  it('certificado → /ajustes-afip', () => {
    expect(hrefDeRuta({ tipo: 'certificado' })).toBe('/ajustes-afip');
  });
});
