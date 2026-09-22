// jest-eperm-reintentable.mjs — ¿el rojo de jest es SÓLO el EPERM de la caché de transformación?
//
// En Windows, con la caché de jest fría y varios workers, dos procesos se pisan al abrir o renombrar
// el mismo archivo de `node_modules/.cache/jest/jest-transform-cache-*`: la suite muere con
// «Test suite failed to run · jest: failed to read cache file … EPERM: operation not permitted» sin
// haber ejecutado una sola aserción. Pasó dos veces el 2026-09-22 (60a6999a, b4c46a85) en worktrees
// recién creados; con la caché ya caliente, el re-run da verde.
//
// Este clasificador decide si un rojo es ESO y nada más. Lee el JSON de `jest --json --outputFile`:
//   - exit 0 + imprime (uno por línea) los archivos de las suites a re-correr, si TODAS las suites
//     rojas murieron antes de correr con la firma EPERM de la caché y NINGUNA aserción falló;
//   - exit 1 en cualquier otro caso: una aserción roja, un timeout (es una aserción roja: puede ser
//     un await colgado de verdad), una suite que no carga por otra causa, o ninguna suite roja.
// Ante la duda, NO se reintenta: reintentar un rojo real lo convierte en verde falso.
//
// Uso: node scripts/ci/jest-eperm-reintentable.mjs <resultado.json> [<raíz para rutas relativas>]
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';

const [archivo, raiz = process.cwd()] = process.argv.slice(2);
if (!archivo) {
  console.error('uso: jest-eperm-reintentable.mjs <resultado.json> [raíz]');
  process.exit(2);
}

let res;
try {
  res = JSON.parse(readFileSync(archivo, 'utf8'));
} catch (e) {
  console.error(`jest-eperm-reintentable: no pude leer ${archivo}: ${e.message}`);
  process.exit(1);
}

const esEpermDeCache = (msg) =>
  /EPERM: operation not permitted/.test(msg) && /jest-transform-cache|[\\/]\.cache[\\/]jest[\\/]/.test(msg);

const suites = Array.isArray(res.testResults) ? res.testResults : [];
const rojas = suites.filter((s) => s.status === 'failed');
const asercionesRojas = suites.some((s) => (s.assertionResults ?? []).some((a) => a.status === 'failed'));

if (rojas.length === 0 || asercionesRojas || (res.numFailedTests ?? 0) > 0) process.exit(1);
if (!rojas.every((s) => esEpermDeCache(String(s.message ?? '')))) process.exit(1);

const archivos = [...new Set(rojas.map((s) => relative(raiz, s.name).split('\\').join('/')))];
process.stdout.write(archivos.join('\n') + '\n');
