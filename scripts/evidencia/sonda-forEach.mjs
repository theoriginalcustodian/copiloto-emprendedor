// ¿`soporte` y `esc` están ROTOS en el prototipo, o es timing de la sonda?
// Control positivo horneado: `comousar` sale del MISMO `forEach` que `soporte` (index.html:3597).
// Si comousar anda y soporte no, no es timing ni es la sonda — es el prototipo.
import { chromium } from './pwa-lib.mjs';
const BASE = `http://localhost:${process.env.PROTO_PORT ?? '8123'}/prototipo`;
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const id of ['comousar', 'soporte', 'feedback', 'esc']) {
    await page.goto(`${BASE}/?ver=${id}`, { waitUntil: 'networkidle' });
    // Esperar el SELECTOR, no el reloj. Con `waitForTimeout(1500)` esta misma sonda reportó
    // `soporte` roto y `esc` sin transform — dos falsos «roto» — mientras `comousar`, que sale del
    // MISMO forEach, pasaba. Es el defecto #2 del generador reproducido en un instrumento nuevo:
    // la espera por tiempo compite con la transición del proto y falla intermitente, sin señal.
    await page
      .waitForSelector(id === 'esc' ? '#midia[style*="translateY"]' : `#s-${id}.on`, { timeout: 10000 })
      .catch(() => console.log(`   (no aparecio el selector de ${id} en 10 s)`));
    const r = await page.evaluate((k) => {
      const el = document.querySelector('#s-' + k);
      const m = document.querySelector('#midia');
      return {
        dom: !!el,
        on: el?.classList.contains('on') ?? null,
        clases: el?.className ?? null,
        ajustes_on: document.querySelector('#ajustes')?.classList.contains('on') ?? null,
        transform: m?.style.transform || '(vacio)',
        ver: new URLSearchParams(location.search).get('ver'),
      };
    }, id);
    console.log(
      `${id.padEnd(10)} ver=${String(r.ver).padEnd(10)} #s-${id}: dom=${r.dom} on=${r.on}` +
        ` | #ajustes.on=${r.ajustes_on} | #midia.transform=${r.transform}` +
        (r.clases !== null ? `  class="${r.clases}"` : ''),
    );
  }
} finally {
  await browser.close();
}
