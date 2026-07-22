import { PantallaPrincipal } from '../src/shell/PantallaPrincipal';

/**
 * Ruta raíz — el escritorio + la conversación. Delgada a propósito: la pantalla real vive en
 * `src/shell/PantallaPrincipal.tsx`, igual que `ajustes.tsx`/`recientes.tsx` delegan en
 * `src/modules/*` en documed. `app/` es el árbol de RUTAS de expo-router, no donde vive el código.
 *
 * 🔴 **Esto no es prolijidad: es lo que arregló un bundle roto.** `expo-router` arma el árbol con un
 * `require.context` sobre `app/`, así que TODO lo que caiga acá entra al bundle de la app. Mientras
 * el shell y su test vivieron en `app/`, ese `require.context` levantaba `index.test.tsx` →
 * `@testing-library/react-native` → `require('console')`, y el bundle moría con *"the native React
 * runtime does not include the Node standard library"* — un mensaje que no nombra a los tests ni a
 * expo-router, y que se lee como si faltara un polyfill.
 *
 * Regla que se deriva: **en `app/` sólo van rutas.** Ningún test, ningún helper. documed no tiene un
 * solo `*.test.*` bajo `app/` — no era casualidad.
 */
export default function IndexRoute() {
  return <PantallaPrincipal />;
}
