#!/usr/bin/env node
/**
 * S2 — Clasifica el staging de documed y emite el manifest que consumen los sub-agentes.
 *
 * Por qué script y no sub-agente: construir el grafo de imports es parseo determinista.
 * Un LLM leyendo 250 archivos para decir "este importa a aquel" quema contexto y además
 * puede equivocarse; una regex sobre `from '...'` no.
 *
 * Emite `_staging/manifest.json` con, por archivo:
 *   path · loc · imports[] (locales, resueltos) · importedBy[] · categoria · wave · terminos
 *
 * `terminos` cuenta ocurrencias de vocabulario clínico. NO es decoración: decide si la
 * sustitución de nomenclatura (wave B3) la puede hacer Haiku (patrón fijo, alto volumen)
 * o necesita Sonnet (concordancia de género en español: "la paciente" → "el cliente").
 * La decisión sale del número, no de la intuición.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve, sep } from 'node:path';

const STAGING = process.env.STAGING_DIR ?? '_staging/documed';
const OUT = join(STAGING, 'manifest.json');

/**
 * Reglas de categoría por prefijo de path. El ORDEN importa: gana la primera que matchea,
 * así que lo más específico va arriba. Derivado del plan §2.
 *
 *   agnostico → se porta tal cual, sin traducción de dominio
 *   adaptar   → misma forma, otro contenido (tiles, tipos de artefacto, cliente≠paciente)
 *   descartar → clínico puro o persistencia de audio que este producto no necesita (D6)
 */
const REGLAS = [
  // --- descartar: persistencia de audio. Sobrevive SÓLO el grabador (plan §2, D6).
  [/^apps\/mobile\/src\/adapters\/audio\/(almacen|indice|hasher|guardia|registroProteccion)/, 'descartar', 'D6: sin retención de audio'],
  [/^apps\/mobile\/src\/adapters\/artefactos\//, 'descartar', 'D6: sin almacén local de artefactos'],
  [/^apps\/mobile\/src\/modules\/(artefactos|proteccion|bloqueo)\//, 'descartar', 'D6: cadena de custodia clínica'],
  [/^apps\/mobile\/src\/modules\/captura\/(PanelEnmienda|Reproductor|AvisoHuerfanos|GateTranscripcion|PantallaGrabacion)/, 'descartar', 'D6: no hay audio que revisar ni reproducir'],
  [/^apps\/mobile\/app\/spike-/, 'descartar', 'spikes de documed, no del copiloto'],
  [/^apps\/mobile\/modules\/proteccion-interrupciones\//, 'descartar', 'D6: módulo nativo Kotlin para proteger grabaciones largas'],

  // 🔴 El grabador NO es agnóstico pese a vivir en `adapters/audio/`. Está construido para
  // captura clínica larga (interrupciones, huérfanos, chunking, reanudación). Acá el caso
  // es dictar un mensaje corto y mandarlo a Groq: se porta la interfaz, no las 892 LOC.
  // Clasificarlo `agnostico` haría que un agente lo copie entero "porque estaba en la lista".
  [/^apps\/mobile\/src\/adapters\/audio\/grabador\./, 'adaptar', 'D6: sólo captura corta, no consulta larga'],

  // --- descartar: clínico puro.
  [/^apps\/mobile\/src\/modules\/(historias|documentos)\//, 'descartar', 'dominio clínico'],
  [/^apps\/mobile\/app\/(historias|nota|consulta|documento|pacientes)\.tsx$/, 'descartar', 'ruta clínica'],

  // --- adaptar: misma forma, otro contenido.
  [/^apps\/mobile\/src\/modules\/pacientes\//, 'adaptar', 'D7: pacientes → clientes'],
  [/^apps\/mobile\/src\/modules\/escritorio\//, 'adaptar', 'tiles: 6 funciones del copiloto'],
  [/^apps\/mobile\/src\/modules\/(recientes|chat|ajustes|apps)\//, 'adaptar', 'contenido del emprendedor'],
  [/^apps\/mobile\/src\/modules\/captura\//, 'adaptar', 'D6: sólo BotonVoz + Onda'],
  [/^apps\/mobile\/app\//, 'adaptar', 'rutas del copiloto'],

  // --- agnostico: la cáscara. Es lo que vinimos a buscar.
  [/^apps\/mobile\/src\/theme\//, 'agnostico', 'capa glass + tokens + skins'],
  [/^apps\/mobile\/src\/shell\//, 'agnostico', 'panel deslizable'],
  [/^apps\/mobile\/src\/(adapters|rutas|guardias)\//, 'agnostico', 'infraestructura'],
  [/^apps\/mobile\/src\/modules\/auth\//, 'agnostico', 'sesión'],
  // 🔴 `packages/core` NO es agnóstico en bloque — esa fue la primera lectura y era gruesa.
  // Buena parte es la maquinaria de captura clínica larga que D6 descarta. Se clasifica por
  // archivo, no por carpeta: una carpeta "agnóstica" con 1300 LOC de dominio adentro es
  // exactamente cómo se cuela lo que dijimos que no íbamos a portar.
  [/^packages\/core\/src\/audio\/(panelMachine|purgador|proteccionDurable)/, 'descartar', 'D6: captura larga, pausa/reanudación, huérfanos'],
  [/^packages\/core\/src\/audio\/nivel/, 'agnostico', 'nivel de señal — lo necesita la Onda'],
  [/^packages\/core\/src\/audio\/(ports|types)/, 'adaptar', 'D6: de 5 puertos queda 1 (grabador)'],
  [/^packages\/core\/src\/artefactos\/bloqueo/, 'descartar', 'D6: bloqueo por pendiente clínico'],
  [/^packages\/core\/src\/artefactos\//, 'adaptar', 'tipos del emprendedor'],
  [/^packages\/core\/src\/api\/clinical/, 'descartar', 'endpoints clínicos'],
  [/^packages\/core\/src\/api\/pacientes/, 'adaptar', 'D7: pacientes → clientes'],
  [/^packages\/core\/src\/api\/actividad/, 'agnostico', 'D8: es el backend de Recientes'],

  [/^packages\/core\//, 'agnostico', 'núcleo hexagonal'],

  // --- config y assets: se regeneran para el copiloto, no se copian.
  [/^apps\/mobile\/assets\//, 'adaptar', 'assets: marca del copiloto, no de documed'],
  [/^apps\/mobile\/(package|app|eas|tsconfig)\.json$/, 'adaptar', 'config del proyecto nuevo'],
  [/^apps\/mobile\/(babel|metro)\.config\.js$/, 'agnostico', 'toolchain, sin dominio'],
  [/^apps\/mobile\/jest\.setup\.js$/, 'agnostico', 'setup de tests'],
  [/^apps\/mobile\/(\.gitignore|README\.md)$/, 'adaptar', 'texto propio'],
  [/^apps\/mobile\/src\/core\.test\.ts$/, 'agnostico', 'test del núcleo'],
];

/** Qué wave toca cada categoría (plan §10.3). */
const WAVE = { agnostico: 'B2/A3', adaptar: 'D1/D2/E1/E2', descartar: '—' };

/** Vocabulario clínico a sustituir. `genero` marca los que arrastran concordancia. */
const TERMINOS = [
  { re: /\bpacientes?\b/gi, key: 'paciente', genero: true },  // "la paciente" → "el cliente"
  { re: /\bcl[ií]nic[oa]s?\b/gi, key: 'clinico', genero: true },
  { re: /\bconsultas?\b/gi, key: 'consulta', genero: false },
  { re: /\bm[eé]dic[oa]s?\b/gi, key: 'medico', genero: true },
  { re: /\bhistorias?\b/gi, key: 'historia', genero: false },
  { re: /\bdocumed\b/gi, key: 'documed', genero: false },
  { re: /\bdiagn[oó]stic[oa]s?\b/gi, key: 'diagnostico', genero: true },
];

/** Artículos/determinantes que preceden a un término con género → riesgo de concordancia. */
const ANTES_CON_GENERO = /\b(la|las|una|unas|esta|estas|aquella|aquellas|dicha|dichas)\s+$/i;

const EXT_CODIGO = new Set(['.ts', '.tsx', '.js', '.jsx']);

function listar(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git') continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) listar(p, acc);
    else acc.push(p);
  }
  return acc;
}

const norm = (p) => relative(STAGING, p).split(sep).join('/');

function categorizar(rel) {
  for (const [re, cat, motivo] of REGLAS) if (re.test(rel)) return { categoria: cat, motivo };
  return { categoria: 'sin-clasificar', motivo: 'ninguna regla matcheó — revisar a mano' };
}

/** Imports locales (relativos) — se resuelven a path del staging para cruzar con el manifest. */
function importsLocales(src, rel) {
  const out = new Set();
  const re = /(?:from|import)\s+['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    out.add(resolve('/' + dirname(rel), m[1]).slice(1).split(sep).join('/'));
  }
  return [...out];
}

/**
 * Imports de paquete (no relativos). Alimentan el `package.json` que genera S4.
 *
 * 🔴 Por qué se recolectan en vez de copiar la lista de deps de documed: copiarla arrastra
 * dependencias de features que descartamos (D6) y, peor, puede omitir una que sí usamos si
 * documed la tenía transitiva. Las deps salen de lo que el código PORTADO importa de verdad.
 */
function importsPaquete(src) {
  const out = new Set();
  // El specifier tiene que ser un nombre de paquete VÁLIDO. Sin este anclaje, el regex
  // matchea comillas dentro de literales de regex y devuelve basura tipo `[^` o `\.\`.
  // Mínimo 2 caracteres: un specifier de 1 letra siempre es un literal de regex mal capturado
  // (ej. `from 'y'` dentro del propio candado que parsea imports), nunca un paquete real.
  const re = /(?:from|import|require\()\s*['"](@?[a-z0-9][\w.-]+(?:\/[\w.-]+)*)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const spec = m[1];
    if (spec.startsWith('node:') || BUILTINS.has(spec)) continue;
    // `@scope/name/sub` → `@scope/name` · `name/sub` → `name`
    const partes = spec.split('/');
    out.add(spec.startsWith('@') ? partes.slice(0, 2).join('/') : partes[0]);
  }
  return [...out];
}

/** Builtins de Node — no son deps a instalar. */
const BUILTINS = new Set(['fs', 'path', 'os', 'url', 'util', 'crypto', 'child_process', 'events', 'stream']);

/**
 * 🔴 Deps que el build/runtime EXIGE aunque ningún archivo las importe.
 *
 * Derivar las deps sólo de los `import` deja afuera todo lo que entra por config plugin,
 * por peer dependency o por el entry de expo-router. El build rompe y el error no apunta
 * a la causa. Cada una va con su motivo — una lista sin motivos se vuelve intocable.
 */
const RUNTIME_REQUERIDAS = {
  'expo-dev-client': 'D3: el APK es dev-client, no Expo Go',
  'expo-constants': 'lo usa expo-router internamente',
  'expo-linking': 'deep-links (auth nativa, F5)',
  'expo-font': 'config plugin declarado en app.json',
  'expo-splash-screen': 'config plugin declarado en app.json',
  'expo-status-bar': 'chrome del shell',
  'react-native-screens': 'peer de expo-router',
  'react-native-worklets': 'peer de reanimated 4',
  'react-dom': 'peer de react-native-web (target web de jest)',
  'react-native-web': 'preset jest-expo/web',
  'expo-blur': 'lo usa CristalVidrio para el efecto glass',
};

/** Tooling: no se importa desde `src/`, pero sin esto no hay build ni tests. */
const DEV_REQUERIDAS = {
  typescript: 'compilador',
  jest: 'runner de apps/mobile',
  'jest-expo': 'preset RN de jest',
  vitest: 'runner de packages/core (distinto al de mobile, a propósito: core es TS puro)',
  '@types/jest': 'tipos',
  '@types/node': 'tipos',
  '@types/react': 'tipos',
};

function contarTerminos(src) {
  const conteo = {};
  let ambiguos = 0;
  for (const { re, key, genero } of TERMINOS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(src))) {
      conteo[key] = (conteo[key] ?? 0) + 1;
      // Un término con género precedido de determinante femenino NO es sustitución
      // mecánica: cambiar la palabra sin cambiar el artículo deja "la cliente".
      if (genero && ANTES_CON_GENERO.test(src.slice(Math.max(0, m.index - 12), m.index))) ambiguos++;
    }
  }
  return { conteo, ambiguos };
}

// ---------------------------------------------------------------------------

// El propio manifest vive en el staging: se excluye o se clasificaría a sí mismo.
const archivos = listar(STAGING).filter((p) => {
  const r = norm(p);
  return !r.startsWith('.') && r !== 'manifest.json';
});
const registro = new Map();

for (const abs of archivos) {
  const rel = norm(abs);
  const ext = rel.slice(rel.lastIndexOf('.'));
  const esCodigo = EXT_CODIGO.has(ext);
  const src = esCodigo ? readFileSync(abs, 'utf8') : '';
  const { categoria, motivo } = categorizar(rel);
  const { conteo, ambiguos } = esCodigo ? contarTerminos(src) : { conteo: {}, ambiguos: 0 };

  registro.set(rel, {
    path: rel,
    ext,
    loc: esCodigo ? src.split('\n').length : 0,
    esTest: /\.test\.[tj]sx?$/.test(rel),
    categoria,
    motivo,
    wave: WAVE[categoria] ?? '?',
    imports: esCodigo ? importsLocales(src, rel) : [],
    paquetes: esCodigo ? importsPaquete(src) : [],
    importedBy: [],
    terminos: conteo,
    terminosAmbiguos: ambiguos,
  });
}

// Grafo inverso. El import viene sin extensión, así que se prueban los sufijos posibles.
for (const [rel, info] of registro) {
  for (const imp of info.imports) {
    for (const cand of [imp, `${imp}.ts`, `${imp}.tsx`, `${imp}/index.ts`, `${imp}/index.tsx`]) {
      if (registro.has(cand)) { registro.get(cand).importedBy.push(rel); break; }
    }
  }
}

const todos = [...registro.values()];
const porCategoria = (c) => todos.filter((f) => f.categoria === c);

/**
 * 🔴 El chequeo que importa: un archivo `agnostico` que importa uno `descartar` NO es
 * agnóstico — arrastra dominio por la puerta de atrás. Se reporta para resolverlo ANTES
 * de portar, no cuando el build rompa.
 */
const fugas = [];
for (const f of todos) {
  if (f.categoria !== 'agnostico') continue;
  for (const imp of f.imports) {
    for (const cand of [imp, `${imp}.ts`, `${imp}.tsx`, `${imp}/index.ts`, `${imp}/index.tsx`]) {
      const dep = registro.get(cand);
      if (dep && dep.categoria === 'descartar') fugas.push({ de: f.path, a: dep.path });
    }
  }
}

const ambiguosTotal = todos.reduce((a, f) => a + f.terminosAmbiguos, 0);
const terminosTotal = todos.reduce((a, f) => a + Object.values(f.terminos).reduce((x, y) => x + y, 0), 0);

/**
 * Deps que necesita el port = unión de los paquetes que importan los archivos que SÍ viajan
 * (agnóstico + adaptar). Lo que sólo importaban los descartados no entra: esa es la diferencia
 * entre heredar el `package.json` de documed y derivarlo.
 */
const viajan = todos.filter((f) => f.categoria === 'agnostico' || f.categoria === 'adaptar');
const depsImportadas = [...new Set(viajan.flatMap((f) => f.paquetes))];
const depsNecesarias = [...new Set([...depsImportadas, ...Object.keys(RUNTIME_REQUERIDAS)])]
  .filter((p) => p !== '@documed/core')      // se reemplaza por el core propio del copiloto
  .filter((p) => !(p in DEV_REQUERIDAS))     // los importan los .test.* → son dev, no runtime
  .sort();
const depsSoloDescartados = [...new Set(
  todos.filter((f) => f.categoria === 'descartar').flatMap((f) => f.paquetes)
)].filter((p) => !depsNecesarias.includes(p)).sort();

const manifest = {
  generadoPor: 'S2-classify-port.mjs',
  staging: STAGING,
  sha: readFileSync(join(STAGING, '.extracted-sha'), 'utf8').trim(),
  deps: {
    necesarias: depsNecesarias,
    dev: Object.keys(DEV_REQUERIDAS).sort(),
    soloDescartados: depsSoloDescartados,
    motivosRuntime: RUNTIME_REQUERIDAS,
    motivosDev: DEV_REQUERIDAS,
  },
  resumen: {
    total: todos.length,
    codigo: todos.filter((f) => EXT_CODIGO.has(f.ext)).length,
    tests: todos.filter((f) => f.esTest).length,
    agnostico: porCategoria('agnostico').length,
    adaptar: porCategoria('adaptar').length,
    descartar: porCategoria('descartar').length,
    sinClasificar: porCategoria('sin-clasificar').length,
    locAgnostico: porCategoria('agnostico').reduce((a, f) => a + f.loc, 0),
    terminosClinicos: terminosTotal,
    terminosAmbiguos: ambiguosTotal,
  },
  // Fugas de dominio: agnóstico que depende de descartado. Bloquea el port limpio.
  fugasDeDominio: fugas,
  archivos: todos.sort((a, b) => a.path.localeCompare(b.path)),
};

writeFileSync(OUT, JSON.stringify(manifest, null, 2));

const r = manifest.resumen;
console.log(`[S2] manifest → ${OUT}`);
console.log(`[S2] ${r.total} archivos (${r.codigo} código, ${r.tests} tests) @ ${manifest.sha.slice(0, 12)}`);
console.log(`[S2]   agnóstico ....... ${r.agnostico}  (${r.locAgnostico} LOC) → se porta tal cual`);
console.log(`[S2]   adaptar ......... ${r.adaptar}`);
console.log(`[S2]   descartar ....... ${r.descartar}`);
console.log(`[S2]   sin clasificar .. ${r.sinClasificar}${r.sinClasificar ? '  ⚠️ revisar' : ''}`);
console.log(`[S2] términos clínicos: ${r.terminosClinicos} · con concordancia ambigua: ${r.terminosAmbiguos}`);
console.log(`[S2] fugas de dominio (agnóstico→descartado): ${fugas.length}${fugas.length ? '  ⚠️ resolver antes de portar' : ''}`);
