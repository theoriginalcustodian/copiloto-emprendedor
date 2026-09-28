// ¿Qué queda en el DOM del prototipo cuando se abre `?ver=<id>`?
//
// Por qué medirlo en vez de leerlo: para `esc` el estado final sale de
// `abrirEscritorio()` → `yMidia = H() - ASOMO` → `pintar()` → `classList.toggle('borde', asomando)`.
// Deducir de ahí qué selector queda es exactamente la clase de inferencia que este instrumento
// existe para no hacer. Abrir la vista y preguntarle al DOM cuesta segundos.
//
// Read-only, sin login, contra el prototipo local. No toca la app ni el tenant.
import { chromium } from './pwa-lib.mjs';

const PORT = process.env.PROTO_PORT ?? '8123';
const BASE = `http://localhost:${PORT}/prototipo`;
const IDS = (process.env.SONDA_IDS ?? 'esc,comousar,soporte,bi-refresh').split(',');

// Candidatos por id: lo que el codigo sugiere, para CONFIRMAR o descartar — no para asumir.
const CANDIDATOS = {
  esc: ['#midia.borde', '#midia.snap', '#escritorio.on', '#escritorio'],
  comousar: ['#s-comousar.on', '#ajustes.on'],
  soporte: ['#s-soporte.on', '#ajustes.on'],
  'bi-refresh': ['#bi-refresh.cargando', '#bi-refresh.anim', '#inteligencia.on'],
};

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  for (const id of IDS) {
    await page.goto(`${BASE}/?ver=${id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500); // el proto monta con setTimeout(…, 60) + transicion CSS
    console.log(`\n── ${id} ──`);
    for (const sel of CANDIDATOS[id] ?? []) {
      const n = await page.locator(sel).count();
      const visible = n > 0 ? await page.locator(sel).first().isVisible().catch(() => null) : null;
      console.log(`   ${n > 0 ? '✓' : '·'} ${sel.padEnd(22)} count=${n}${visible === null ? '' : ` visible=${visible}`}`);
    }
    // Y el estado crudo, por si ningun candidato acierta: sin esto un 0 en todos no dice nada.
    const crudo = await page.evaluate(() => {
      const m = document.querySelector('#midia');
      return {
        midia_class: m?.className ?? null,
        midia_transform: m?.style.transform ?? null,
        con_on: [...document.querySelectorAll('.on')].map((e) => `${e.tagName.toLowerCase()}#${e.id || '?'}`).slice(0, 8),
      };
    });
    console.log(`   crudo: #midia class="${crudo.midia_class}" transform="${crudo.midia_transform}"`);
    console.log(`   con .on: ${crudo.con_on.join(', ') || '(ninguno)'}`);
  }
} finally {
  await browser.close();
}
