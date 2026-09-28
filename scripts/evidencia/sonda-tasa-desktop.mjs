// ¿Las subpantallas `#s-*.on` del prototipo fallan a desktop de forma DETERMINISTA o INTERMITENTE?
//
// Por qué la tasa y no un caso: en la corrida de B1 faltó `proto-desktop` en `apar` y `soporte`,
// pero `cuenta` y `comousar` —las mismas `#s-*.on`— salieron bien. Un solo intento no distingue
// «este id está roto a desktop» de «todos fallan a veces». La primera conclusión manda a arreglar
// el prototipo; la segunda, a arreglar la espera. Ya me equivoqué una vez en esta misma sesión por
// juzgar un intermitente con una sola pasada.
//
// Read-only contra el prototipo local.
import { chromium } from './pwa-lib.mjs';

const BASE = `http://localhost:${process.env.PROTO_PORT ?? '8123'}/prototipo`;
const IDS = ['apar', 'soporte', 'cuenta', 'comousar'];
const N = Number(process.env.N ?? 5);
const VIEWPORTS = { '390': { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const tasa = {};
try {
  for (const [nombre, viewport] of Object.entries(VIEWPORTS)) {
    for (const id of IDS) {
      let ok = 0;
      const demoras = [];
      for (let i = 0; i < N; i++) {
        const page = await browser.newPage({ viewport });
        try {
          await page.goto(`${BASE}/?ver=${id}`, { waitUntil: 'networkidle' });
          const t0 = Date.now();
          await page.waitForSelector(`#s-${id}.on`, { timeout: 10000 });
          demoras.push(Date.now() - t0);
          ok++;
        } catch {
          /* cuenta como fallo */
        } finally {
          await page.close();
        }
      }
      tasa[`${id} @${nombre}`] = { ok, de: N, ms: demoras };
    }
  }
} finally {
  await browser.close();
}

console.log(`\n=== tasa de aparición de #s-<id>.on (${N} intentos cada uno) ===`);
for (const [k, v] of Object.entries(tasa)) {
  const pct = ((v.ok / v.de) * 100).toFixed(0);
  const ms = v.ms.length ? `  ms: ${v.ms.join(', ')}` : '';
  console.log(`  ${k.padEnd(22)} ${v.ok}/${v.de}  (${pct}%)${ms}`);
}
const fallos = Object.entries(tasa).filter(([, v]) => v.ok < v.de);
const totales = Object.entries(tasa).filter(([, v]) => v.ok === 0);
console.log('');
if (totales.length) console.log(`DETERMINISTA (0/${N}): ${totales.map(([k]) => k).join(', ')} — el prototipo no lo monta`);
if (fallos.length && !totales.length) console.log(`INTERMITENTE: ${fallos.map(([k]) => k).join(', ')} — es la espera, no el prototipo`);
if (!fallos.length) console.log(`TODOS ${N}/${N} — el fallo de B1 no se reproduce: revisar contención con la otra corrida`);
