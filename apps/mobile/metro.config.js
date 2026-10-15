// Metro en monorepo: sin esto, `@copiloto/core` (que vive en `packages/core`, fuera de este
// proyecto) no se resuelve ni se re-bundlea al editarlo. Configuración canónica de Expo para workspaces.
const path = require('node:path');

const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Metro observa TODO el workspace: al tocar `packages/core`, el bundle se rehace.
config.watchFolders = [workspaceRoot];

// 2. Resuelve módulos desde el proyecto Y desde la raíz (npm workspaces hoistea al root).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. `disableHierarchicalLookup` se deja en el DEFAULT de expo/metro-config (false). Ponerlo en
//    `true` —como estaba— rompía la resolución de un módulo del core init de RN con esta estructura
//    de node_modules: el bundle petaba en `setUpDefaultReactNativeEnvironment` con
//    "Cannot read property 'default' of undefined" + "Global was not installed", ANTES de correr una
//    sola línea de la app. Lo diagnosticó `expo-doctor` ("disableHierarchicalLookup mismatch,
//    expected false"). El default de Expo ya maneja bien el monorepo vía `nodeModulesPaths`.

// 4. `@copiloto/core` se FIJA al `packages/core` de ESTE workspace (no al que resuelva `node_modules`).
//    En un git worktree `node_modules` es una junction al del checkout compartido, cuyo core puede estar
//    atrasado: el bundle compilaba OTRO core que el sha del worktree y nada lo avisaba (medido 2026-10-15,
//    frontend2). Las rutas salen del `exports` del propio package.json: cero tabla paralela.
const corePkg = require('../../packages/core/package.json');
const coreDir = path.resolve(workspaceRoot, 'packages/core');
const resolverPrevio = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === corePkg.name || moduleName.startsWith(`${corePkg.name}/`)) {
    const subpath = `.${moduleName.slice(corePkg.name.length)}`;
    const destino = corePkg.exports[subpath];
    if (destino) return { type: 'sourceFile', filePath: path.resolve(coreDir, destino) };
  }
  return (resolverPrevio ?? context.resolveRequest)(context, moduleName, platform);
};

// 5. Con la junction, el realpath de `node_modules` cae FUERA de `watchFolders` y Metro no ve sus archivos
//    (`UnableToResolve expo-router/entry`). Se lo observa sólo cuando es ajeno al workspace.
const nodeModulesReal = require('node:fs').realpathSync(path.resolve(workspaceRoot, 'node_modules'));
if (!nodeModulesReal.startsWith(workspaceRoot)) config.watchFolders.push(nodeModulesReal);

module.exports = config;
