// Separa las TRES clases de señal que un gate de browser suele juntar en un contador, y que no
// significan lo mismo:
//
//   · `pageerror`      -> excepción de JS que nadie atrapó. INVALIDA la captura.
//   · `http>=400`      -> recurso faltante. La activación puede estar intacta; hay que MIRARLO.
//   · `console.error`  -> mezcla de las dos, más lo que el sitio decida loguear. NO sirve de gate.
//
// Nació el 2026-09-28 probando el guard de `criterio3-matriz.mjs`: su brazo de `console.error`
// abortaba celdas con la activación INTACTA porque Chrome pedía un `/favicon.ico` que el server del
// prototipo no tenía (medido: 1 de cada 10 cargas del MISMO id). El guard no estaba mal concebido;
// el contador juntaba clases distintas. Arreglado en `server-proto.mjs` (204 al favicon).
//
// La ventana también decide qué se ve: con `domcontentloaded` + 1200 ms el 404 no aparece en 41
// ids; con `networkidle` + 400 ms sí. Dos mediciones ciertas sobre ventanas distintas.
// ventanas distintas, así que la pregunta no es quién tiene razón sino qué recurso es.
import { chromium } from './pwa-lib.mjs';

const BASE = `http://localhost:${process.env.PROTO_PORT ?? '8124'}/prototipo`;
const IDS = (process.env.SOLO_IDS || 'hitl,cuenta,apar,hablar,detalle,agenda').split(',');

const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
for (const id of IDS) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const http = [];      // respuestas >= 400: recurso faltante, NO error de código
  const fallidos = [];  // pedidos que ni llegaron
  const jsErr = [];     // pageerror: excepción de JS que nadie atrapó  <- esto SÍ acusa al proto
  const conErr = [];    // console.error: mezcla de las dos cosas
  const pedidos = new Map();   // url -> status, para cazar el pedido que NO deja evento `response`
  page.on('request', (r) => { if (!pedidos.has(r.url())) pedidos.set(r.url(), null); });
  page.on('response', (r) => { pedidos.set(r.url(), r.status()); if (r.status() >= 400) http.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => fallidos.push(`${r.url()} (${r.failure()?.errorText ?? '?'})`));
  page.on('pageerror', (e) => jsErr.push(String(e.message).split('\n')[0]));
  page.on('console', (m) => { if (m.type() === 'error') conErr.push(m.text()); });
  try {
    await page.goto(`${BASE}/?ver=${id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
  } catch (e) {
    console.log(`${id}: goto fallo -> ${String(e.message).split('\n')[0].slice(0, 80)}`);
  }
  // la aserción positiva del guard, para saber si la activación ocurrió de verdad
  const aser = { hitl: '.hitl', vozchat: '.hitl', cuenta: '#s-cuenta.on', apar: '#s-apar.on', hablar: '#s-hablar.on' }[id];
  const activo = aser ? !!(await page.$(aser)) : null;
  console.log(`--- ${id}  (activacion: ${aser ? (activo ? 'SI, ' + aser : 'NO, falta ' + aser) : 'sin asercion declarada'})`);
  console.log(`    http>=400   ${http.length}${http.length ? ' -> ' + http.join(' | ') : ''}`);
  console.log(`    requestfail ${fallidos.length}${fallidos.length ? ' -> ' + fallidos.join(' | ') : ''}`);
  console.log(`    pageerror   ${jsErr.length}${jsErr.length ? ' -> ' + jsErr.join(' | ') : ''}`);
  console.log(`    console.err ${conErr.length}${conErr.length ? ' -> ' + conErr.map((t) => t.slice(0, 90)).join(' | ') : ''}`);
  const sinResp = [...pedidos].filter(([, s]) => s === null).map(([u]) => u.replace(BASE, '~'));
  if (sinResp.length) console.log(`    sin response ${sinResp.length} -> ${sinResp.join(' | ')}`);
  await ctx.close();
}
await nav.close();
console.log('');
console.log('Lectura: `http>=400` sin `pageerror` = recurso faltante con la activacion INTACTA.');
console.log('Un guard que aborta por eso tumba celdas buenas; uno que ignora `pageerror` deja pasar');
console.log('las malas. Son dos brazos distintos y no se pueden unir en un contador.');
