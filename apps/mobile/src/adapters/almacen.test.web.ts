/**
 * Spike de verificación empírica (regla raíz del framework INL: la prueba vale, la aserción no).
 *
 * El brief de la Task 4 afirma que "AsyncStorage usa `localStorage` en web" y que por eso alcanza
 * UN SOLO adaptador de almacenamiento para las dos plataformas (no hace falta un `almacen.web.ts`
 * separado). Este test NO asume eso: lo corre contra la implementación REAL de la librería.
 *
 * Corre en un proyecto Jest separado (`web` en package.json -- también cubre `http.test.web.ts`,
 * la regresión de HIGH-1 -- preset `jest-expo/web`) que:
 *   1. Usa jsdom real (`window.localStorage` real, no un mock propio).
 *   2. NO carga `jest.setup.js` -- ese archivo mockea `@react-native-async-storage/async-storage`
 *      globalmente (necesario para los tests nativos, que no tienen módulo nativo bajo Jest), y ese
 *      mock hubiera ocultado exactamente lo que este test necesita observar: si el paquete real,
 *      resuelto bajo plataforma web, entra por su build no-nativa (`AsyncStorage.js`, que sí llama a
 *      `window.localStorage`) en vez de la nativa (`AsyncStorage.native.js`).
 *
 * Control: además de leer con la propia API de AsyncStorage, se verifica cruzado contra
 * `window.localStorage` directo -- si el primer `expect` pasara por casualidad (p.ej. un mock en
 * memoria que no toque `localStorage`), el segundo lo detecta.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('AsyncStorage bajo el entorno web de Jest (jsdom, sin mock)', () => {
  const CLAVE = 'copiloto-spike-verificacion-web';

  afterEach(async () => {
    await AsyncStorage.removeItem(CLAVE);
  });

  it('escribe y lee un token, delegando en window.localStorage real', async () => {
    await AsyncStorage.setItem(CLAVE, 'token-de-prueba');

    // Control: si esto falla, AsyncStorage NO está pasando por `window.localStorage` en este
    // entorno -- el supuesto del brief sería falso y haría falta un `almacen.web.ts` dedicado.
    expect(window.localStorage.getItem(CLAVE)).toBe('token-de-prueba');

    const leido = await AsyncStorage.getItem(CLAVE);
    expect(leido).toBe('token-de-prueba');
  });

  it('borra el token y ya no queda ni en AsyncStorage ni en localStorage', async () => {
    await AsyncStorage.setItem(CLAVE, 'x');
    await AsyncStorage.removeItem(CLAVE);

    expect(await AsyncStorage.getItem(CLAVE)).toBeNull();
    expect(window.localStorage.getItem(CLAVE)).toBeNull();
  });
});
