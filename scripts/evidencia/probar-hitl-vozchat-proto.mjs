// ¿Qué monta el prototipo en `?ver=hitl` y `?ver=vozchat`, y cuál es el equivalente de la card del
// chat de la app? Read-only.
//
// `?ver=hitl` (index.html:3470) es `if (a) a.click()` SIN rama else: si `#accion-lucia` no existe,
// no pasa nada y la captura sale de la pantalla base **sin error**. Un guard que falla hacia el «no»
// no da síntoma, así que acá el control es explícito: ¿existía el nodo? ¿el click cambió algo?
import { chromium } from './pwa-lib.mjs';
const BASE = `http://localhost:${process.env.PROTO_PORT ?? '8124'}/prototipo`;
const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });

for (const id of ['hitl', 'vozchat']) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?ver=${id}`, { waitUntil: 'domcontentloaded' });
  const antes = await page.evaluate(() => ({
    existeAccionLucia: !!document.querySelector('#accion-lucia'),
    hitl: document.querySelectorAll('.hitl').length,
  }));
  await page.waitForTimeout(1500);   // ventana fija: acá observo un efecto, no espero un estado
  const desp = await page.evaluate(() => {
    const h = document.querySelector('.hitl');
    return {
      hitl: document.querySelectorAll('.hitl').length,
      titulo: h ? (h.querySelector('b') || {}).textContent?.trim() : null,
      enChat: h ? !!h.closest('#chat, [id*="chat"], #hilo, [class*="hilo"]') : false,
      cardEnFuncion: !!document.querySelector('#card.on'),
      visibles: Array.from(document.querySelectorAll('[id].on')).map((e) => '#' + e.id).slice(0, 6),
    };
  });
  console.log(`?ver=${id}`);
  console.log(`   #accion-lucia existía al cargar: ${antes.existeAccionLucia ? 'sí' : 'NO → el click no hizo nada y nada avisa'}`);
  console.log(`   .hitl: ${antes.hitl} antes -> ${desp.hitl} después` + (desp.titulo ? `  título "${desp.titulo}"` : ''));
  console.log(`   ¿el .hitl está dentro del chat?: ${desp.enChat ? 'sí' : 'no'}   ·   #card.on en la función: ${desp.cardEnFuncion ? 'sí' : 'no'}`);
  console.log(`   contenedores .on: ${desp.visibles.join(' ') || '(ninguno)'}`);
  console.log('');
  await page.close();
}
await ctx.close(); await nav.close();
