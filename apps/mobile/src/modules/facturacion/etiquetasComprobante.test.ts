import { nombreTipoComprobante, tituloComprobante, tituloComprobanteConTotal } from './etiquetasComprobante';

/**
 * Ningún test cubría el texto de la fila de «Mis comprobantes», y por eso llegó al device diciendo
 * *«Tipo 11 · N° 18 · 100.0»*: el código interno de la AFIP y el total sin formato, en la misma
 * pantalla donde la actividad ya mostraba «$1.500,00».
 */
describe('etiquetasComprobante', () => {
  it('🔴 traduce el código de la AFIP al nombre que el emprendedor conoce', () => {
    // `11` no significa nada para quien factura. El comprobante impreso dice "Factura C".
    expect(nombreTipoComprobante(11)).toBe('Factura C');
    expect(nombreTipoComprobante(13)).toBe('Nota de crédito C');
    expect(nombreTipoComprobante(1)).toBe('Factura A');
    expect(nombreTipoComprobante(6)).toBe('Factura B');
  });

  it('🔴 un tipo desconocido muestra SU NÚMERO — no un genérico prolijo', () => {
    // El día que aparezca un tipo nuevo, el número en pantalla es lo que permite reconocerlo y
    // agregarlo. "Comprobante" a secas esconde justo el dato que haría falta para arreglarlo — y del
    // otro lado ya pasó: un `12` inexistente en el catálogo se pintó como plata que entra.
    expect(nombreTipoComprobante(99)).toBe('Comprobante tipo 99');
    expect(nombreTipoComprobante(12)).toBe('Comprobante tipo 12');
  });

  it('el título lleva punto de venta y número, como el comprobante impreso', () => {
    // El número solo no alcanza: se repite entre puntos de venta, y es lo que se compara contra el PDF.
    expect(tituloComprobante({ tipoCbte: 11, puntoVenta: 6, nro: 18 })).toBe('Factura C 6-18');
  });

  it('🔴 el total se formatea como plata, nunca crudo', () => {
    // Viaja como string decimal para no pasar por `Number`; imprimirlo tal cual delata la
    // representación interna y hace dudar de cuál de las dos vistas del mismo dato está bien.
    expect(tituloComprobanteConTotal({ tipoCbte: 11, puntoVenta: 6, nro: 18, total: '1500.0' })).toBe(
      'Factura C 6-18 · $1.500,00',
    );
    expect(tituloComprobanteConTotal({ tipoCbte: 13, puntoVenta: 6, nro: 6, total: '100.00' })).toBe(
      'Nota de crédito C 6-6 · $100,00',
    );
  });
});
