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
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 10000);
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
          await page.waitForSelector(`#s-${id}.on`, { timeout: TIMEOUT_MS });
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
if (fallos.length && !totales.length) {
  // Clasificar el PATRÓN es una cosa; atribuir la CAUSA es otra, y este script las confundía.
  // Su veredicto decía «INTERMITENTE ⇒ es la espera» — una causa escrita ANTES de ver las demoras,
  // y que las demoras de la primera corrida refutaron: los éxitos salieron a 19-104 ms contra un
  // timeout de 10 s. Un timeout mal elegido produce éxitos CERCA del límite; si el más lento de
  // todos entra en el 10% del presupuesto, el fallo es BINARIO —o monta al instante, o no monta— y
  // subir el timeout no cambia nada. La regla de decisión ahora sale de los datos, no del texto.
  const demorasOk = Object.values(tasa).flatMap((v) => v.ms);
  const peor = demorasOk.length ? Math.max(...demorasOk) : null;
  const umbral = TIMEOUT_MS * 0.5;   // la mitad del presupuesto: margen generoso para «llegó justo»
  console.log(`INTERMITENTE: ${fallos.map(([k]) => k).join(', ')}`);
  if (peor === null) {
    console.log(`  CAUSA NO ATRIBUIBLE: ningún intento salió bien, no hay demoras que comparar.`);
  } else if (peor >= umbral) {
    console.log(`  CAUSA: LA ESPERA. El éxito más lento tardó ${peor} ms contra un timeout de ${TIMEOUT_MS} ms`);
    console.log(`  (≥ ${umbral} ms, o sea que roza el presupuesto) → subir el timeout o cambiar el selector.`);
  } else {
    console.log(`  CAUSA: NO ES LA ESPERA. El éxito más lento tardó ${peor} ms contra un timeout de ${TIMEOUT_MS} ms`);
    console.log(`  (< ${umbral} ms) → los que aparecen aparecen al instante y los que no, agotan el timeout entero:`);
    console.log(`  es un fallo BINARIO de montaje. Subir el timeout no cambiaría nada. Hay que observar el DOM`);
    console.log(`  durante la carga (scripts/evidencia/observar-montaje-proto.mjs), no esperar más.`);
  }
}
if (!fallos.length) console.log(`TODOS ${N}/${N} — el fallo de B1 no se reproduce: revisar contención con la otra corrida`);
