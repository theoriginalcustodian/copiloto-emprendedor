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
/**
 * 🔴 **`render` de `@testing-library/react-native` es ASÍNCRONO acá. Hay que `await`-earlo.**
 *
 * Con RNTL 14 + React 19, `render()` devuelve una **promesa**. Verificado en este proyecto:
 * `typeof r.then === 'function'`, y `Object.keys(r)` sale vacío hasta resolverla.
 *
 * Si olvidás el `await`, el test falla con:
 *
 *     `render` function has not been called
 *
 * que **no menciona el await por ningún lado** y se lee como si el componente no renderizara. Se
 * pierde un rato largo buscando en el lugar equivocado — pasó en este sprint, reescribiendo tests
 * que ya estaban bien.
 *
 * Patrón correcto:
 *
 *     async function envolver() { return render(<ThemeProvider><Pantalla /></ThemeProvider>); }
 *     it('...', async () => { await envolver(); expect(screen.getByTestId('x')).toBeTruthy(); });
 *
 * 🔴 **Y `fireEvent` TAMBIÉN es asíncrono. También hay que `await`-earlo.** Es la misma regla y el
 * mismo motivo, pero falla mucho peor: sin `await`, el `setState` del handler no se descargó todavía,
 * así que el `fireEvent` SIGUIENTE lee el estado anterior. Un tipear-y-guardar manda el formulario
 * **vacío**, y el test falla diciendo *«el componente no llamó al backend»* — que apunta al
 * componente, no al test.
 *
 * Y el efecto se ACUMULA: en una suite larga los primeros casos pasan y a partir de cierto punto
 * empiezan a fallar todos, cada uno agotando el timeout de `waitFor`. Se lee como contaminación entre
 * tests o como un componente frágil, y no es ninguna de las dos. Medido en `SeccionCatalogo.test.tsx`
 * el 2026-07-22: 8 pasaban y 4 fallaban; con `await` en cada `fireEvent`, 12/12 — sin tocar una línea
 * del componente.
 *
 * El warning *«the current testing environment is not configured to support act(...)»* que sale en
 * toda la suite es el síntoma de esto, no una molestia aparte.
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

/**
 * 🔴 **D9 (deuda de instrumento, 2026-08-12): sin esto, Jest cachea en un directorio GLOBAL de
 * máquina, compartido por TODOS los worktrees y TODAS las sesiones.**
 *
 * Verificado con `npx jest --showConfig` en dos worktrees distintos (`deuda-d9` y
 * `cards-propuesto-web`): el `cacheDirectory` por default resolvía **igual, byte a byte**, a
 * `<tmp-del-SO>/jest` en ambos — no está scopeado por `rootDir` ni por proyecto. Con 3 sesiones
 * paralelas y ~20 worktrees corriendo `apps/mobile` sobre el mismo checkout de Windows, dos
 * procesos concurrentes terminan escribiendo el mismo archivo de transform-cache (mismo paquete,
 * mismo hash de contenido) y Windows devuelve `EPERM` en la carrera — el patrón reportado por
 * backend (lote C, `avance_backend-a-todos_lote-C-C1-C2-C3-cerrado.md`): `mobile` falló con
 * `EPERM ... jest-transform-cache/.../NativeAnimatedAllowlist_...` en el gate completo, sin tocar
 * `apps/mobile/` en su diff, y pasó 731/731 aislado — el mismo discriminador que ya usa D9 (aislado
 * verde ⇒ flake, no regresión), pero acá con causa estructural identificada, no sólo discriminada.
 * **Es una clase de síntoma DISTINTA** del flake de timeout en tests de gesto que D9 viene
 * investigando (H1 contención / H2 plataforma, sin resolver) — este fix cierra la clase de carrera
 * de caché; no afirma nada sobre la clase de timeout, que sigue abierta con su propia mitigación.
 *
 * El fix es de raíz, no un retry: cada worktree cachea en su PROPIO `node_modules/.cache/jest`, así
 * que dos sesiones ya no pueden pisarse el mismo archivo aunque corran `apps/mobile` a la vez.
 */
const cacheDirectory = path.join(__dirname, 'node_modules', '.cache', 'jest');

/**
 * 🔴 **D9 (frontend, 2026-08-13): el default de Jest (5000ms) es frágil para CUALQUIER test de
 * montaje pesado bajo contención real de esta máquina — no es específico de un archivo.**
 *
 * Se venía tratando como flake puntual de 2 describes de gesto de voz (`PantallaSoporte`/
 * `ChatView`, subidos primero a 15000ms y después a 30000ms, ver los comentarios en esos archivos).
 * Experimento controlado (0/10 corridas de `mobile.sh` sin carga extra vs 2/10 con 4 procesos de
 * CPU forzados encima del basal, mismo código/plataforma) confirmó contención real como causa
 * (H1, no H2/plataforma). La re-verificación del fix puntual, bajo la MISMA carga forzada, mostró
 * el mecanismo generalizado: 3 archivos sin relación con voz (`PantallaInteligencia`,
 * `PantallaIngresos`, `PantallaPresupuestos`) fallaron con `Exceeded timeout of 5000 ms` — el
 * default sin tocar. Mismo patrón ya capturado una vez de forma oportunista en `Onda.test.tsx`
 * (lote B, 2026-08-12) y sumado a esta fila en vez de abrirse aparte.
 *
 * Fix de raíz: subir el default del proyecto, no parchear archivo por archivo cada vez que a uno
 * le toca perder la carrera. 20000ms cubre 4x el default de Jest; los 2 describes de gesto de voz
 * mantienen su override específico a 30000ms porque ESE valor ya se re-verificó bajo carga forzada
 * (10/10 limpio) y este no.
 *
 * 🔴 **Primer intento fallido, dejado como advertencia:** poner `testTimeout` DENTRO de cada
 * entrada de `projects[]` no hace nada — Jest lo acepta sin tirar error de sintaxis, pero lo
 * ignora en runtime: `testTimeout` no es una opción de `ProjectConfig`, sólo de `GlobalConfig`.
 * Se descubrió releyendo el log completo de la reverificación bajo carga (no asumiendo que "ya
 * está aplicado" porque el archivo se editó): `● Validation Warning: Unknown option "testTimeout"
 * with value 20000 was found` en las 10 corridas, y los timeouts seguían diciendo literalmente
 * "Exceeded timeout of 5000 ms" -- el default, sin tocar. Por eso va acá, a nivel raíz del
 * `module.exports`, no adentro de cada proyecto -- ahí sí es una opción válida y aplica a los dos
 * proyectos (`native`/`web`) de esta config.
 */
const testTimeout = 20000;

module.exports = {
  testTimeout,
  projects: [
    {
      displayName: 'native',
      preset: 'jest-expo',
      setupFiles: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: mapaReact,
      transformIgnorePatterns,
      cacheDirectory,
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
      cacheDirectory,
    },
  ],
};
