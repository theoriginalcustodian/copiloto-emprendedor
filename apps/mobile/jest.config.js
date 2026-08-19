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
 * 🔴 **D9 (frontend, act. 2026-08-19): el timeout global NO es la causa del flake. Medido.**
 *
 * Lo que decia este bloque antes -- "el default de 5000ms es fragil para CUALQUIER test de montaje
 * pesado bajo contencion real, no es especifico de un archivo" -- quedo **REFUTADO por medicion
 * directa**. Experimento del 2026-08-19 sobre `origin/main`, worktree aislado, 20 cores, log
 * completo de cada corrida a archivo (nunca pipeado por `tail`):
 *
 *   | Condicion                                | Resultado                                     |
 *   |------------------------------------------|-----------------------------------------------|
 *   | basal sin carga                          | 744/745 verde, 76s                            |
 *   | carga 4 procesos, config real            | 0/10 rojas                                    |
 *   | carga 40 procesos, `--testTimeout=5000`  | 741/745 pasan -- el default "fragil" ALCANZA  |
 *   | carga 40 procesos, config real           | **3/5 rojas**                                 |
 *
 * En las corridas rojas: **22 timeouts, TODOS de 30000 ms -- cero de 20000**. Ningun test que
 * dependa del `testTimeout` global fallo nunca, en ninguna condicion, ni siquiera forzado a 5000ms
 * bajo la carga mas alta. Los 3 archivos que este comentario citaba como prueba de que el problema
 * era general (`PantallaInteligencia`, `PantallaIngresos`, `PantallaPresupuestos`) **no fallaron ni
 * una vez** con 10x la carga del experimento original.
 *
 * **La falla esta localizada en 2 suites de 83**, siempre las mismas: `ChatView.test.tsx` y
 * `PantallaSoporte.test.tsx`, las dos de gesto de voz. Su override de 30000ms ya no las salva: ES
 * el valor que se excede. Duracion de la suite completa: 42-47s cuando pasa; 82 / 138 / 160s cuando
 * falla. Bimodal, no degradacion gradual.
 *
 * 🔴 **Para el proximo que toque esto: subir el timeout dejo de ser una mitigacion.** Ya se
 * subio 5000 -> 15000 -> 30000 y el flake sigue. La causa esta ADENTRO de esas dos suites, no en el
 * presupuesto de tiempo que se les da.
 *
 * `testTimeout = 20000` se CONSERVA pero sin evidencia que lo respalde: el experimento solo ejercio
 * contencion de **CPU**, y la contencion original descrita (3 sesiones + ~20 worktrees) incluia I/O
 * y memoria. Estos datos no lo justifican ni lo refutan; se deja por precaucion, no por medicion.
 *
 * Evidencia completa y scripts reproducibles:
 * `docs/copiloto-emprendedor/Auditorias/2026-08-19-D9-el-timeout-global-no-era-la-causa.md`
 *
 * 🔴 **Advertencia que sigue vigente (2026-08-13):** poner `testTimeout` DENTRO de cada
 * entrada de `projects[]` no hace nada. Jest lo acepta sin error de sintaxis y lo ignora en runtime
 * -- no es opcion de `ProjectConfig`, solo de `GlobalConfig`. Se manifiesta como
 * `Validation Warning: Unknown option "testTimeout"` y los tests siguen en el default. Re-verificado
 * el 2026-08-19 con `--showConfig`: en la raiz da `globalConfig.testTimeout = 20000`; movido adentro
 * de `projects[]` da `None` + el warning. Por eso va a nivel raiz del `module.exports`.
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
