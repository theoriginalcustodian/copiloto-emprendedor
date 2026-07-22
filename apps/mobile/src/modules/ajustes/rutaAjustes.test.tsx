import { fireEvent, render, screen } from '@testing-library/react-native';

/**
 * Mock de `expo-router` — mismo criterio que `src/shell/PantallaPrincipal.test.tsx`: se mockean las
 * dos piezas que usa esta ruta, `router.push` (lo que `empujarUnaVez` termina llamando) y
 * `useFocusEffect` EJECUTANDO su callback. Lo segundo no es un detalle: ese callback es el que
 * reabre la puerta de `empujarUnaVez`, y con un `() => {}` la puerta quedaría cerrada para siempre
 * después del primer push — todos los casos siguientes darían falso negativo.
 */
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    router: { push: jest.fn(), back: jest.fn() },
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});

import { router } from 'expo-router';

import { ThemeProvider } from '../../theme/ThemeProvider';
import PantallaAjustesRoute from '../../../app/ajustes';

async function montar() {
  return render(
    <ThemeProvider>
      <PantallaAjustesRoute />
    </ThemeProvider>,
  );
}

describe('ruta /ajustes', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  /**
   * 🔴 **El bug que reportó el operador: "ninguno de los iconos de dentro de ajustes funciona, solo
   * el de facturación".**
   *
   * La ruta tenía un `if (key === 'facturacionAfip')` suelto, así que las otras seis entradas del
   * grid no hacían NADA al tocarlas: el toque llegaba, `PantallaAjustes` emitía su `key`, y esta
   * ruta la descartaba en silencio. Sin error y sin aviso — indistinguible de un gesto que no
   * registra, que es justamente adonde apuntaba la sospecha.
   *
   * El test recorre las SIETE. Con el código viejo, seis de estos siete casos fallan.
   */
  it.each([
    ['datosPersonales', '/ajustes-datos'],
    ['configuracionSistema', '/ajustes-sistema'],
    ['planesDisponibles', '/ajustes-planes'],
    ['planActual', '/ajustes-plan'],
    ['skins', '/ajustes-skins'],
    ['cuenta', '/ajustes-cuenta'],
    ['facturacionAfip', '/ajustes-afip'],
  ])('el tile %s navega a %s', async (key, ruta) => {
    await montar();

    await fireEvent.press(screen.getByTestId(`ajuste-tile-${key}`));

    expect(router.push).toHaveBeenCalledWith(ruta);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  /**
   * La otra mitad de `empujarUnaVez`: dos toques rápidos sobre el MISMO tile no pueden apilar dos
   * glass. Es el bug que ya se pagó en este repo (la app quedaba "bloqueada" al volver de una
   * función porque había dos `transparentModal` encimados).
   */
  it('un doble toque no apila dos glass', async () => {
    await montar();

    const tile = screen.getByTestId('ajuste-tile-skins');
    await fireEvent.press(tile);
    await fireEvent.press(tile);

    expect(router.push).toHaveBeenCalledTimes(1);
  });
});
