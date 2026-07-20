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

// 3. Sin la búsqueda jerárquica, Metro no puede levantar una copia distinta de React desde un
//    `node_modules` anidado. Dos Reacts en el bundle rompen los hooks con un error indescifrable.
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
