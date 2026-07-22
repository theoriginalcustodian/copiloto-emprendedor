import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AlmacenClave, AlmacenTokens } from '@copiloto/core';

/**
 * Almacén clave-valor, async. Un solo adaptador para las dos plataformas: AsyncStorage usa
 * `localStorage` en web (verificado empíricamente en `almacen.test.web.ts` -- no se asume, ver esa
 * verificación para la evidencia). Best-effort: si el almacenamiento falla (cuota, modo privado), se
 * degrada en silencio en vez de tirar la app abajo — perder una preferencia no puede romper la sesión.
 *
 * Nace en la Task 3 (el `ThemeProvider` lo usa para persistir el skin elegido); la Task 4 suma acá
 * `almacenTokens` para los tokens de sesión; la Task 7 la reusa para persistir sesión/historial del
 * chat (`modules/chat/useChat.ts`). Un solo puerto, tres consumidores.
 *
 * `AlmacenClave` se IMPORTA de `@copiloto/core` (no se redeclara acá) — hallazgo de la Task 6: esta
 * interfaz nació acá antes de que el core tuviera un módulo `chat`, y quedó duplicada (misma forma,
 * dos declaraciones) cuando `packages/core/src/chat/ports.ts` la sumó. Una sola fuente de verdad.
 */
export const almacenClave: AlmacenClave = {
  async leer(clave) {
    try {
      return await AsyncStorage.getItem(clave);
    } catch {
      return null;
    }
  },
  async guardar(clave, valor) {
    try {
      await AsyncStorage.setItem(clave, valor);
    } catch {
      // Best-effort: ver docstring de AlmacenClave — una preferencia perdida no puede romper la sesión.
    }
  },
  async borrar(clave) {
    try {
      await AsyncStorage.removeItem(clave);
    } catch {
      // Best-effort: ver docstring de AlmacenClave.
    }
  },
};

// MISMAS keys que la PWA: un usuario que ya tenía sesión en la web no la pierde.
const CLAVE_TOKEN = 'copiloto-token';
const CLAVE_REFRESH = 'copiloto-refresh';

/**
 * `AlmacenTokens` (ADR-010) para React Native/web -- reusa `almacenClave` de arriba en vez de
 * duplicar el try/catch best-effort: el core no le pregunta a la plataforma si el almacenamiento
 * pudo fallar, así que la degradación silenciosa vive UNA sola vez, acá arriba.
 */
export const almacenTokens: AlmacenTokens = {
  leerToken: () => almacenClave.leer(CLAVE_TOKEN),
  guardarToken: (token) => almacenClave.guardar(CLAVE_TOKEN, token),
  leerRefresh: () => almacenClave.leer(CLAVE_REFRESH),
  guardarRefresh: (token) => almacenClave.guardar(CLAVE_REFRESH, token),
  async limpiar() {
    await almacenClave.borrar(CLAVE_TOKEN);
    await almacenClave.borrar(CLAVE_REFRESH);
  },
};
