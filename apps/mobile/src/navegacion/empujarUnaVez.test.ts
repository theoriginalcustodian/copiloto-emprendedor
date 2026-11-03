const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (d: unknown) => mockPush(d) } }));

import { empujarUnaVez, reabrirNavegacion } from './empujarUnaVez';

/**
 * SM-N27: dos toques al avatar abrían Ajustes DOS veces porque el destino (que también es lanzador)
 * reabría la puerta al LLEGAR. Acá se ejercita el módulo real (sin mocks de la puerta) con la secuencia
 * que produce el sistema: tap 1 → llegada del destino gana foco → tap 2 encolado.
 */
describe('empujarUnaVez — destino que también es lanzador', () => {
  beforeEach(() => {
    mockPush.mockReset();
    reabrirNavegacion(); // puerta abierta, sin ruta recordada
  });

  it('doble toque: la LLEGADA del destino no reabre y el 2º toque no apila', () => {
    empujarUnaVez('/ajustes');
    reabrirNavegacion('/ajustes'); // Ajustes monta y gana foco (llegada)
    empujarUnaVez('/ajustes'); // toque encolado desde el escritorio
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('control positivo: sin el argumento de ruta, la llegada SÍ reabre (el defecto original)', () => {
    empujarUnaVez('/ajustes');
    reabrirNavegacion();
    empujarUnaVez('/ajustes');
    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  it('el destino lanzador puede abrir su hijo, y el doble toque sobre el hijo no apila', () => {
    empujarUnaVez('/ajustes');
    reabrirNavegacion('/ajustes');
    empujarUnaVez('/ajustes-cuenta', '/ajustes');
    empujarUnaVez('/ajustes-cuenta', '/ajustes'); // segundo toque sobre el mismo tile
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(mockPush).toHaveBeenLastCalledWith('/ajustes-cuenta');
  });

  it('volver: Ajustes recupera el foco tras Cuenta → reabre y se puede abrir otro hijo', () => {
    empujarUnaVez('/ajustes');
    reabrirNavegacion('/ajustes');
    empujarUnaVez('/ajustes-cuenta', '/ajustes');
    reabrirNavegacion('/ajustes'); // vuelta de Cuenta: cerradaPor es '/ajustes-cuenta'
    empujarUnaVez('/ajustes-skins', '/ajustes');
    expect(mockPush).toHaveBeenCalledTimes(3);
  });

  it('volver al escritorio: abrir Ajustes de nuevo funciona', () => {
    empujarUnaVez('/ajustes');
    reabrirNavegacion('/ajustes');
    reabrirNavegacion(); // el escritorio recupera el foco
    empujarUnaVez('/ajustes');
    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  it('el rótulo con query y los destinos con params se comparan por pathname', () => {
    empujarUnaVez('/ajustes-soporte?funcion=soporte_tecnico');
    reabrirNavegacion('/ajustes-soporte');
    empujarUnaVez({ pathname: '/soporte-ticket', params: { ticketId: '1' } }, '/ajustes-soporte');
    expect(mockPush).toHaveBeenCalledTimes(2);
  });

  it('un lanzador ajeno no se cuela con la puerta cerrada', () => {
    empujarUnaVez('/midia');
    empujarUnaVez('/ajustes', '/gastos');
    expect(mockPush).toHaveBeenCalledTimes(1);
  });
});
