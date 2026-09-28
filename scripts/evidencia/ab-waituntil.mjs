// A/B del `waitUntil` de `page.goto` contra el prototipo. Read-only.
//
// Hipótesis a falsar: el 40-60% de fallos de `#s-<id>.on` NO es del prototipo ni de la espera del
// selector, sino del `waitUntil: 'networkidle'` del `goto` (sonda-tasa-desktop.mjs:28 y
// criterio3-matriz.mjs:151). El observador de montaje, que usa `domcontentloaded`, midió 24/24 con
// la marca puesta a 82-126 ms y cero `pageerror`: el prototipo monta siempre.
//
// `networkidle` exige 500 ms sin tráfico. Si el prototipo nunca los da, el `goto` agota su timeout
// y el selector nunca llega a esperarse — pero un `catch` silencioso lo reporta como «no apareció
// el selector», que es la causa equivocada. Por eso acá el error se IMPRIME, no se cuenta: el
// mensaje es el dato. `catch {}` es «el pipe se come el exit code» en otra forma.
import { chromium } from './pwa-lib.mjs';

const BASE = `http://localhost:${process.env.PROTO_PORT ?? '8123'}/prototipo`;
const IDS = (process.env.SOLO_IDS || 'apar,soporte,esc,comousar').split(',');
const N = Number(process.env.N ?? 4);
const MODOS = ['networkidle', 'domcontentloaded'];
const VIEWPORTS = { '390': { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const sel = (id) => (id === 'esc' ? '#midia[style*="translateY"]' : `#s-${id}.on`);

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const res = {};
try {
  for (const modo of MODOS) {
    for (const [vpN, viewport] of Object.entries(VIEWPORTS)) {
      for (const id of IDS) {
        const clave = `${modo.padEnd(18)} ${id} @${vpN}`;
        let ok = 0; const errores = [];
        for (let i = 0; i < N; i++) {
          const page = await browser.newPage({ viewport });
          try {
            // timeout corto y EXPLÍCITO: si `networkidle` no llega, quiero el fallo en 8 s, no en 30.
            await page.goto(`${BASE}/?ver=${id}`, { waitUntil: modo, timeout: 8000 });
            await page.waitForSelector(sel(id), { timeout: 5000 });
            ok++;
          } catch (e) {
            // QUÉ falló, no sólo que falló: el primer renglón distingue goto de waitForSelector.
            errores.push(String(e.message).split('\n')[0].slice(0, 90));
          } finally {
            await page.close();
          }
        }
        res[clave] = { ok, de: N, errores };
        console.log(`${clave}  ${ok}/${N}${errores.length ? '  ← ' + errores[0] : ''}`);
      }
    }
  }
} finally {
  await browser.close();
}

const tot = (modo) => Object.entries(res).filter(([k]) => k.startsWith(modo))
  .reduce((a, [, v]) => ({ ok: a.ok + v.ok, de: a.de + v.de }), { ok: 0, de: 0 });
console.log('\n=== veredicto ===');
const ni = tot('networkidle'), dcl = tot('domcontentloaded');
console.log(`  networkidle:       ${ni.ok}/${ni.de}`);
console.log(`  domcontentloaded:  ${dcl.ok}/${dcl.de}`);
// El control está en las DOS direcciones: no alcanza con que domcontentloaded ande, networkidle
// tiene que fallar. Si los dos salen 100%, la causa es otra y este A/B no la encontró.
if (dcl.ok === dcl.de && ni.ok < ni.de) {
  console.log('  → CAUSA AISLADA: el `waitUntil` es la variable. Arreglo: `domcontentloaded` en');
  console.log('    criterio3-matriz.mjs:151 y sonda-tasa-desktop.mjs:28. El prototipo no se toca.');
} else if (dcl.ok === dcl.de && ni.ok === ni.de) {
  console.log('  → NO REPRODUCE: los dos modos al 100%. El fallo de B1 no es del waitUntil; puede');
  console.log('    ser contención con otra corrida. NO cambiar nada por este resultado.');
} else {
  console.log('  → domcontentloaded TAMBIÉN falla: la causa no es el waitUntil. Leer los mensajes.');
}
