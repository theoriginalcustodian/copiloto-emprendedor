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

/**
 * Paquetes publicados en ESM que jest tiene que transformar igual.
 *
 * 🔴 `standard-navigation` está en esta lista por un motivo concreto: `expo-router` lo arrastra, y
 * el primer test que importe algo que a su vez importe `router` revienta con
 * `SyntaxError: Cannot use import statement outside a module`. El error no menciona a expo-router
 * por ningún lado, así que se lee como un problema del archivo que lo disparó.
 *
 * Al portar esta config desde documed transcribí la lista y **omití `standard-navigation` y
 * `@sentry/react-native`**. La consecuencia: un agente que trabajaba en `modules/ajustes` se topó
 * con el error, lo diagnosticó bien, y lo rodeó con `jest.mock('expo-router')` en 5 archivos de
 * test — un workaround correcto para él (la config estaba fuera de su ownership) pero que existía
 * sólo por mi error de transcripción. Restaurada la lista, esos 5 mocks se pueden retirar.
 *
 * La lección para el próximo que la toque: esta lista NO es decorativa ni "un patrón largo que
 * copiás". Cada entrada es un paquete que rompió el build de tests alguna vez.
 */
const transformIgnorePatterns = [
  'node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|standard-navigation|@copiloto/core))',
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
