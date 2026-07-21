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

module.exports = config;
