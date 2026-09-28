// ¿Por qué `#s-<id>.on` aparece en el 40-60% de las cargas del prototipo?
//
// La sonda de tasa (sonda-tasa-desktop.mjs) clasificó bien el PATRÓN —intermitente— y atribuyó
// mal la CAUSA: su conclusión pre-escrita decía «es la espera». Sus propios números la refutan.
// Los éxitos salen a 19-104 ms; los fallos consumen los 10 s enteros. Un timeout mal elegido
// produce éxitos CERCA del límite. Acá no hay ni uno: es binario, y subir el timeout no cambia nada.
//
// Este script no adivina entre las tres hipótesis: las separa mirando el DOM mientras carga.
//   A) la clase nunca se agrega        -> el setTimeout(...,60) no corrió (¿se perdió `ver`?)
//   B) se agrega y algo la quita       -> hay un reset (el loop de demo) compitiendo
//   C) se agrega y sigue puesta        -> el fallo es del selector/instrumento, no del prototipo
//
// El MutationObserver se instala con addInitScript, ANTES de que corra un script de la página:
// instalarlo después de `goto` no puede ver la mutación que ya pasó — el mismo error que cometí
// con waitForTimeout, en otra forma.
import { chromium } from './pwa-lib.mjs';

const PORT = process.env.PROTO_PORT || '8123';
const IDS = (process.env.SOLO_IDS || 'apar,soporte,esc').split(',');
const N = Number(process.env.N || 4);
const VIEWPORTS = [{ n: '390', width: 390, height: 844 }, { n: 'desktop', width: 1440, height: 900 }];

// El objetivo por id: `esc` no marca clase, mueve #midia por transform.
const objetivo = (id) => (id === 'esc' ? { sel: '#midia', attr: 'style' } : { sel: `#s-${id}`, attr: 'class' });

const navegador = await chromium.launch({ executablePath: process.env.CHROME_PATH });
const filas = [];

for (const vp of VIEWPORTS) {
  for (const id of IDS) {
    const { sel, attr } = objetivo(id);
    for (let i = 1; i <= N; i++) {
      const ctx = await navegador.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      // Se instala antes del primer script de la página: registra CADA cambio del atributo.
      await page.addInitScript(({ sel, attr }) => {
        window.__eventos = [];
        const t0 = Date.now();
        const arrancar = () => {
          const nodo = document.querySelector(sel);
          if (!nodo) { setTimeout(arrancar, 5); return; }
          window.__eventos.push({ ms: Date.now() - t0, valor: nodo.getAttribute(attr) || '' });
          new MutationObserver(() => {
            window.__eventos.push({ ms: Date.now() - t0, valor: nodo.getAttribute(attr) || '' });
          }).observe(nodo, { attributes: true, attributeFilter: [attr] });
        };
        arrancar();
      }, { sel, attr });

      // Un error de JS entre la lectura de `ver` (index.html:3389) y el `forEach` que agrega la
      // clase (:3597) haría que la marca NUNCA se agregue, sin depender del tiempo — que es
      // exactamente el patrón binario que estoy persiguiendo. Sin escuchar `pageerror` el
      // instrumento no puede verlo: vería «no apareció» y me mandaría a mirar el reloj.
      const errores = [];
      const consola = [];
      page.on('pageerror', (e) => errores.push(String(e && e.message ? e.message : e)));
      page.on('console', (m) => { if (m.type() === 'error') consola.push(m.text().slice(0, 160)); });
      let loadMs = null;
      const tGoto = Date.now();
      page.once('load', () => { loadMs = Date.now() - tGoto; });
      await page.goto(`http://localhost:${PORT}/prototipo/?ver=${id}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);   // ventana fija a propósito: acá NO espero un estado, OBSERVO.

      const eventos = await page.evaluate(() => window.__eventos || []);
      const href = await page.evaluate(() => location.search);
      const marca = id === 'esc'
        ? (v) => /translateY\((?!0px)/.test(v)
        : (v) => v.split(/\s+/).includes('on');
      const conMarca = eventos.filter((e) => marca(e.valor));
      const ultimo = eventos.length ? marca(eventos[eventos.length - 1].valor) : false;

      const fila = {
        vp: vp.n, id, i, search: href,
        nEventos: eventos.length,
        aparecio: conMarca.length > 0,
        msPrimera: conMarca.length ? conMarca[0].ms : null,
        sigueAlFinal: ultimo,
        caso: conMarca.length === 0 ? 'A_NUNCA_SE_AGREGO' : (ultimo ? 'C_PUESTA_Y_SIGUE' : 'B_SE_AGREGO_Y_SE_FUE'),
        traza: eventos.map((e) => `${e.ms}ms:${e.valor.slice(0, 70)}`),
        errores, loadMs, consola,
      };
      filas.push(fila);
      console.log(`${fila.id} @${fila.vp} #${fila.i}  ${fila.caso}  search="${fila.search}"  ` +
        `load=${loadMs === null ? 'NUNCA' : loadMs + 'ms'}  errores=${errores.length}` +
        (fila.msPrimera !== null ? `  1ra marca a ${fila.msPrimera}ms` : ''));
      errores.forEach((e) => console.log(`     ⚠️ PAGEERROR: ${e}`));
      if (fila.caso !== 'C_PUESTA_Y_SIGUE') fila.traza.forEach((t) => console.log(`     ${t}`));
      await ctx.close();
    }
  }
}
await navegador.close();

console.log('\n=== ¿el evento `load` llega? ===');
const sinLoad = filas.filter((f) => f.loadMs === null);
console.log(`  cargas sin evento load: ${sinLoad.length}/${filas.length}` +
  (sinLoad.length ? ` -> ${sinLoad.map((f) => `${f.id}@${f.vp}#${f.i}`).join(', ')}` : ''));

console.log('\n=== ¿los fallos tienen error de JS y los éxitos no? ===');
const conMarca = filas.filter((f) => f.aparecio);
const sinMarca = filas.filter((f) => !f.aparecio);
const conErr = (a) => a.filter((f) => f.errores.length).length;
console.log(`  CON la marca:  ${conMarca.length} cargas, ${conErr(conMarca)} con pageerror`);
console.log(`  SIN la marca:  ${sinMarca.length} cargas, ${conErr(sinMarca)} con pageerror`);
if (sinMarca.length && conErr(sinMarca) === sinMarca.length && conErr(conMarca) === 0) {
  console.log('  → CAUSA AISLADA: un error de JS rompe el arranque justo en las cargas sin marca.');
} else if (sinMarca.length && conErr(sinMarca) === 0) {
  console.log('  → NO es un error de JS: las cargas sin marca corren limpias. Mirar la traza de arriba.');
}

const porCaso = filas.reduce((a, f) => ((a[f.caso] = (a[f.caso] || 0) + 1), a), {});
console.log('\n=== conteo por caso ===');
Object.entries(porCaso).forEach(([c, n]) => console.log(`  ${c}: ${n}/${filas.length}`));

// El `search` es el control de la hipótesis A: si la marca no se agregó Y el `?ver=` está intacto,
// el parámetro no es la causa y hay que mirar el script de la página.
const sinVer = filas.filter((f) => !f.search.includes('ver='));
console.log(`\ncargas que PERDIERON el ?ver=: ${sinVer.length}/${filas.length}` +
  (sinVer.length ? ` -> ${sinVer.map((f) => `${f.id}@${f.vp}#${f.i}`).join(', ')}` : ' (el parámetro nunca se pierde)'));
