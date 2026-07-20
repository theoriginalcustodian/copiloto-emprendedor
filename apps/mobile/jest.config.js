/**
 * Config de Jest para `copiloto-mobile`.
 *
 * Vive en un `.js` y no en la clave `jest` del `package.json` por una razón concreta: necesita
 * **resolver** dónde está React, y un JSON no puede computar nada.
 *
 * 🔴 **El problema que esto arregla.** documed declara el mapper como
 * `"^react$": "<rootDir>/node_modules/react"`. Eso asume que React vive dentro del proyecto — y
 * con npm workspaces no es cierto: npm lo **hoistea** a `node_modules/` de la raíz. Con la ruta
 * fija, jest no encontraba React y las 8 suites nativas morían con "Could not locate module react",
 * sin relación aparente con lo que testeaban.
 *
 * El mapper NO se puede simplemente borrar: existe para garantizar UNA sola copia de React en el
 * árbol. Dos copias rompen los hooks con un error indescifrable (el mismo motivo por el que
 * `metro.config.js` desactiva la búsqueda jerárquica). Lo que se arregla es de dónde sale la ruta:
 * `require.resolve` pregunta dónde está de verdad, en vez de asumir dónde debería estar.
 */
const path = require('node:path');

/** Ruta REAL de un paquete, sea que esté hoisteado a la raíz o instalado local. */
const dondeEsta = (id) => path.dirname(require.resolve(`${id}/package.json`));

const react = dondeEsta('react');
const mapaReact = {
  '^react$': react,
  '^react/jsx-runtime$': path.join(react, 'jsx-runtime'),
  '^react/jsx-dev-runtime$': path.join(react, 'jsx-dev-runtime'),
};

// Paquetes que se publican en ESM y que jest tiene que transformar igual.
const transformIgnorePatterns = [
  'node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|native-base|react-native-svg|@copiloto/core))',
];

module.exports = {
  projects: [
    {
      displayName: 'native',
      preset: 'jest-expo',
      setupFiles: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: mapaReact,
      transformIgnorePatterns,
    },
    {
      displayName: 'web',
      preset: 'jest-expo/web',
      testMatch: ['<rootDir>/src/**/*.test.web.ts'],
      moduleNameMapper: mapaReact,
      transformIgnorePatterns,
      transform: {
        '\\.[jt]sx?$': ['babel-jest', { presets: ['expo/internal/babel-preset'] }],
      },
    },
  ],
};
