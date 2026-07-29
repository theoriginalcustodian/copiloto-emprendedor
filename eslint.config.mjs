// G2.3 del frente de manejo de errores. Antes de esto: CERO linters en todo el repo (ni ESLint, ni
// ruff, ni flake8) — sólo `tsc --strict`. Un `catch {}` vacío entraba sin que nada lo mirara.
//
// Alcance deliberadamente CHICO y sin type-checking: las tres reglas de abajo son las que atacan
// directo el modo de fallo de este frente (errores que se tragan en silencio), y ninguna necesita
// type-aware linting. Meter el linting con tipos multiplica el tiempo de CI y obliga a un tsconfig
// por paquete; se puede sumar después, con su propio ítem.
//
// La regla que gobierna esto: un gate que tarda mucho o grita de más se termina desactivando. Es
// preferible un gate chico que corre siempre a uno exhaustivo que alguien apaga en tres semanas.
//
// ⚠️ ESTADO (2026-07-28): el linter corre y las reglas de este frente están activas, pero el job de
// lint TODAVÍA NO se agregó al CI. Motivo medido: quedan 12 hallazgos que NO son errores de código —
// 8 `import/no-unresolved` y 3 `react-hooks/exhaustive-deps` son directivas `eslint-disable` de una
// config anterior que referencian plugins no instalados (`Definition for rule was not found`), más
// 1 `no-unused-vars` real. Meter el job así lo dejaría ROJO desde el día uno, y un CI que nace en
// rojo enseña a ignorarlo — exactamente el fallo que este archivo viene a evitar.
// Cierre pendiente (ítem chico, con dueño): instalar `eslint-plugin-import` y
// `eslint-plugin-react-hooks`, arreglar el `no-unused-vars`, y recién ahí sumar el job al workflow.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // No se lintea lo generado ni lo ajeno. `motor/` queda afuera a propósito: es el motor
    // vendorizado en fork duro, y su estilo se sincroniza aparte.
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.expo/**',
      '**/coverage/**',
      'motor/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // ── Las tres de este frente ────────────────────────────────────────────────────────────
      // Un bloque vacío es la forma canónica de tragarse un error. Se permite en `catch` SÓLO si
      // lleva un comentario que explique por qué (`allowEmptyCatch: false` + el comentario hace
      // que la regla no dispare cuando hay una razón escrita).
      'no-empty': ['error', { allowEmptyCatch: false }],
      // ⚠️ `require-await` se PROBÓ y se descartó (2026-07-28): marcó 8 errores en `afip.ts` y
      // `mock.ts` que NO son bugs — son funciones `async` sin `await` porque devuelven una promesa
      // **por contrato** de la API cliente, aunque internamente no esperen nada. Un gate que grita
      // en el caso normal enseña a desactivarlo entero
      // ([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]), así que se prefiere no tenerlo
      // a tenerlo apagado con un `// eslint-disable` en cada sitio.
      // Lo que SÍ haría falta es `@typescript-eslint/no-floating-promises` (promesa sin `await` ni
      // `.catch()` = error perdido en el void), pero exige type-aware linting: tsconfig por paquete
      // y CI bastante más lento. Queda como ítem propio, no colado acá.
      // ── Ruido que no aporta en este repo ──────────────────────────────────────────────────
      // `any` se usa a propósito en los bordes (payloads de LLM, respuestas de APIs externas);
      // marcarlo como error obligaría a tipar lo que por definición es desconocido.
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // En los tests importa que corran y que sean legibles, no la pureza del tipado.
    files: ['**/*.test.{ts,tsx}', '**/*.test.web.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      // `require()` dentro de un test es idiomático en jest/RN: se usa para importar DESPUÉS de
      // haber montado un mock, que es justo lo que un `import` estático no permite. Los 20 casos
      // del repo son todos así. Marcarlos sería ruido puro sobre código correcto.
      '@typescript-eslint/no-require-imports': 'off',
      // Un binding sin usar en un test suele ser un helper de setup; no vale un CI rojo.
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
);
