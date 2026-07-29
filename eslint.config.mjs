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
// ✅ ESTADO (2026-07-29): **el job de lint ya está en el CI**. Entró recién cuando el linter quedó en
// 0 errores, no antes: los 12 hallazgos que había eran 11 directivas `eslint-disable` huérfanas de una
// config anterior (se registran sus plugins y pasan a AVISO) y 1 import muerto real (eliminado).
// Meterlo antes lo habría dejado rojo desde el día uno, y un CI que nace en rojo enseña a ignorarlo —
// exactamente el fallo que este archivo viene a evitar.
import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // Las directivas `eslint-disable` que ya no suprimen nada se reportan como AVISO, no como error.
    // El repo arrastra 11 de una config anterior (archivos `*NoHexLiterals.test.ts` de otra sesión):
    // son basura inofensiva, y romper el CI por ellas enseñaría a ignorar el CI — el fallo que este
    // archivo entero viene a evitar. Como aviso quedan a la vista para limpiarlas al pasar por ahí.
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
  },
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
    // Estos dos plugins NO se declaran por sus reglas: se declaran porque el repo ya tiene comentarios
    // `eslint-disable import/no-unresolved` y `react-hooks/exhaustive-deps` de una config anterior, y
    // ESLint 9 marca como ERROR toda directiva que apunte a una regla desconocida. Sin registrarlos,
    // el linter reportaba 11 hallazgos que no eran errores de código, sino referencias huérfanas.
    files: ['**/*.{ts,tsx}'],
    plugins: { import: importPlugin, 'react-hooks': reactHooks },
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
