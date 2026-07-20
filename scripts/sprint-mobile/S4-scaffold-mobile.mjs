#!/usr/bin/env node
/**
 * S4 — Genera el andamiaje de `apps/mobile` + `packages/core` + workspaces en la raíz.
 *
 * Por qué script: es boilerplate determinista, y sobre todo es **idempotente** — se puede
 * re-correr sin miedo. Un agente generando esto a mano produce drift entre corridas.
 *
 * Las deps salen del manifest de S2 (derivadas del código que viaja + las que el build exige),
 * NO de copiar el `package.json` de documed.
 *
 * 🔴 Regla de deps nativas: incluir lo que el plan dice que vamos a necesitar, aunque todavía
 * no lo importe nadie. Agregar una dep nativa después cuesta un rebuild de EAS (10-40 min de
 * cola); incluirla de más cuesta unos KB en el APK. La asimetría es obvia y la decisión es
 * deliberada, no descuido — cada caso va anotado abajo.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const STAGING = process.env.STAGING_DIR ?? '_staging/documed';
const manifest = JSON.parse(readFileSync(join(STAGING, 'manifest.json'), 'utf8'));
const pjDocumed = JSON.parse(readFileSync(join(STAGING, 'apps/mobile/package.json'), 'utf8'));

const APP = {
  nombre: 'Copiloto',
  slug: 'copiloto-emprendedor',
  scheme: 'copiloto',
  paquete: 'app.copiloto.emprendedor',
  owner: '341lin',
  scopeNpm: '@copiloto',
};

/**
 * Nativas que el análisis de imports NO marca todavía, pero el plan sí. Se incluyen ahora
 * para no pagar un rebuild cuando la fase correspondiente llegue.
 */
const NATIVAS_ANTICIPADAS = {
  '@op-engineering/op-sqlite': 'D8: caché local de actividad para Recientes (F7)',
  'react-native-audio-api': 'F6: captura de dictado. Si expo-audio alcanza, se poda después',
};

let escritos = 0, saltados = 0;

function escribir(rel, contenido) {
  if (existsSync(rel)) { console.log(`[S4]   = ${rel} (ya existe, no se pisa)`); saltados++; return; }
  mkdirSync(dirname(rel), { recursive: true });
  writeFileSync(rel, typeof contenido === 'string' ? contenido : JSON.stringify(contenido, null, 2) + '\n');
  console.log(`[S4]   + ${rel}`);
  escritos++;
}

const pjCore = JSON.parse(readFileSync(join(STAGING, 'packages/core/package.json'), 'utf8'));

/**
 * Toma la versión pinneada de documed. Nada de `latest` (regla 4 del CLAUDE.md del repo).
 * Busca en mobile y en core: `vitest`/`typescript` sólo están declarados en core.
 */
function version(dep) {
  const v = pjDocumed.dependencies?.[dep] ?? pjDocumed.devDependencies?.[dep]
    ?? pjCore.dependencies?.[dep] ?? pjCore.devDependencies?.[dep];
  if (!v) throw new Error(`[S4] sin versión pinneada para '${dep}' — no se inventa un rango`);
  return v;
}

const deps = {};
for (const d of [...manifest.deps.necesarias, ...Object.keys(NATIVAS_ANTICIPADAS)].sort()) {
  if (d === 'expo-document-picker') continue; // sólo lo usaba ingesta documental (descartada)
  deps[d] = version(d);
}
deps[`${APP.scopeNpm}/core`] = '*';

const devDeps = {};
for (const d of manifest.deps.dev.sort()) {
  devDeps[d] = version(d);
}

// --- raíz -------------------------------------------------------------------
console.log('[S4] raíz del workspace');
escribir('package.json', {
  name: 'copiloto-emprendedor',
  private: true,
  workspaces: ['apps/mobile', 'packages/*'],
  scripts: {
    'mobile:start': 'npm -w copiloto-mobile run start',
    'mobile:test': 'npm -w copiloto-mobile run test',
    'core:test': `npm -w ${APP.scopeNpm}/core run test`,
    typecheck: `npm -w ${APP.scopeNpm}/core run typecheck && npm -w copiloto-mobile run typecheck`,
  },
});

// --- packages/core ----------------------------------------------------------
console.log('[S4] packages/core');
escribir('packages/core/package.json', {
  name: `${APP.scopeNpm}/core`,
  version: '0.1.0',
  private: true,
  type: 'module',
  main: './src/index.ts',
  types: './src/index.ts',
  exports: { '.': './src/index.ts', './chat': './src/chat/index.ts', './api': './src/api/index.ts' },
  scripts: { test: 'vitest run', typecheck: 'tsc --noEmit' },
  devDependencies: { typescript: version('typescript'), vitest: version('vitest') },
});

escribir('packages/core/tsconfig.json', {
  // `lib: ES2022` + `types: []` es el candado del núcleo: sin DOM ni Node en el compilador,
  // importar `window`/`fetch`/`localStorage` acá no compila. Lo impide tsc, no el code review.
  compilerOptions: {
    target: 'ES2022', lib: ['ES2022'], module: 'ESNext', moduleResolution: 'bundler', types: [],
    strict: true, noUnusedLocals: true, noUnusedParameters: true, noFallthroughCasesInSwitch: true,
    noUncheckedIndexedAccess: true, verbatimModuleSyntax: true, isolatedModules: true,
    noEmit: true, skipLibCheck: true,
  },
  include: ['src'],
  exclude: ['src/**/*.test.ts'],
});

// --- apps/mobile ------------------------------------------------------------
console.log('[S4] apps/mobile');
escribir('apps/mobile/package.json', {
  name: 'copiloto-mobile',
  version: '0.1.0',
  main: 'expo-router/entry',
  private: true,
  dependencies: deps,
  devDependencies: devDeps,
  scripts: {
    start: 'expo start --dev-client', android: 'expo start --android',
    web: 'expo start --web', test: 'jest', typecheck: 'tsc --noEmit',
  },
  jest: pjDocumed.jest && JSON.parse(
    JSON.stringify(pjDocumed.jest).replaceAll('@documed/core', `${APP.scopeNpm}/core`)
  ),
});

escribir('apps/mobile/app.json', {
  expo: {
    name: APP.nombre, slug: APP.slug, scheme: APP.scheme, version: '0.1.0',
    orientation: 'portrait', icon: './assets/icon.png',
    userInterfaceStyle: 'automatic', newArchEnabled: true,
    android: {
      package: APP.paquete,
      predictiveBackGestureEnabled: false,
      // 🔴 Sólo RECORD_AUDIO. documed pide FOREGROUND_SERVICE_MICROPHONE + UIBackgroundModes
      // porque graba consultas largas que deben sobrevivir a que la pantalla se apague. Acá el
      // dictado es un mensaje corto en primer plano (D6): pedir permisos que no se usan es
      // fricción en el primer arranque y superficie de ataque de más.
      permissions: ['android.permission.RECORD_AUDIO'],
    },
    web: { bundler: 'metro', output: 'single' },
    owner: APP.owner,
    // Sin `extra.eas.projectId`: lo escribe `eas init` al crear el proyecto (D5, cuenta compartida).
    plugins: ['expo-router', 'expo-audio', 'expo-sharing', 'expo-splash-screen', 'expo-font', 'expo-navigation-bar'],
  },
});

escribir('apps/mobile/eas.json', {
  cli: { version: '>= 5.0.0', appVersionSource: 'remote' },
  build: {
    // D3: sin stores. `development` es el único perfil que este sprint usa.
    development: { developmentClient: true, distribution: 'internal', android: { buildType: 'apk' } },
    preview: { distribution: 'internal', android: { buildType: 'apk' } },
  },
});

escribir('apps/mobile/tsconfig.json', {
  extends: 'expo/tsconfig.base',
  compilerOptions: {
    strict: true,
    types: ['jest', 'node'],
    // ⚠️ EL ORDEN IMPORTA — heredado de un bug ya pagado en documed. `tsc` prueba los sufijos
    // en orden y se queda con el primero que resuelve, para CUALQUIER módulo incluidos los de
    // node_modules. Con `.web` primero, un paquete que publica variante web resolvía a sus tipos
    // de navegador aun en código que sólo corre en el teléfono, y el typecheck negaba APIs que
    // en Android existen. Con `""` primero, cada paquete resuelve su entrada nativa y el fallback
    // por plataforma sigue funcionando para nuestros archivos.
    moduleSuffixes: ['', '.native', '.ios', '.android', '.web'],
  },
});

escribir('apps/mobile/babel.config.js', `// Reanimated 4 requiere el plugin de worklets y DEBE ir último en \`plugins\`. Sin él, los
// worklets (gestos + animaciones del panel de vidrio) corren en el hilo JS y el drag tironea —
// exactamente lo que el spike de F2 va a medir en el SM-A217M.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
`);

escribir('apps/mobile/metro.config.js', `// Metro en monorepo: sin esto, \`${APP.scopeNpm}/core\` (que vive en \`packages/core\`, fuera de este
// proyecto) no se resuelve ni se re-bundlea al editarlo. Configuración canónica de Expo para workspaces.
const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Metro observa TODO el workspace: al tocar \`packages/core\`, el bundle se rehace.
config.watchFolders = [workspaceRoot];

// 2. Resuelve módulos desde el proyecto Y desde la raíz (npm workspaces hoistea al root).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Sin la búsqueda jerárquica, Metro no puede levantar una copia distinta de React desde un
//    \`node_modules\` anidado. Dos Reacts en el bundle rompen los hooks con un error indescifrable.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
`);

console.log(`[S4] OK — ${escritos} escritos, ${saltados} preservados`);
console.log(`[S4] deps runtime: ${Object.keys(deps).length} · dev: ${Object.keys(devDeps).length}`);
for (const [d, motivo] of Object.entries(NATIVAS_ANTICIPADAS)) console.log(`[S4]   anticipada: ${d} — ${motivo}`);
