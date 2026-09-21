// Evidencia PWA de la Ola 1 FE1 (BL-W3, W4, W6, W9, W10) con e2e-device. Ver pwa-lib.mjs.
import { abrirLogueado, foto } from './pwa-lib.mjs';

const resultados = [];
const paso = async (nombre, fn) => {
  try {
    await fn();
    resultados.push(`OK   ${nombre}`);
  } catch (e) {
    resultados.push(`FALLA ${nombre}: ${String(e.message).split('\n')[0]}`);
  }
};

const { browser, page } = await abrirLogueado();
const t = (id) => page.getByTestId(id);
const irAjustes = async () => { await page.getByRole('button', { name: 'Mi día' }).first().click(); await t('avatar-cuenta').first().click(); await t('pantalla-ajustes').waitFor(); };

await paso('W4 rodillo de ejemplos en el chat vacío', async () => {
  await page.getByRole('button', { name: 'Chat' }).first().click();
  await t('rodillo-ejemplos').waitFor({ timeout: 10000 });
  await foto(page, 'W4-rodillo');
});

await paso('W3 Contanos qué tal: envío de texto', async () => {
  await irAjustes();
  await t('ajuste-tile-feedback').click();
  await t('feedback-pregunta').waitFor();
  await t('feedback-texto').fill(`[e2e BL-W3 ${new Date().toISOString()}] prueba de evidencia PWA`);
  await t('feedback-texto-enviar').click();
  await t('feedback-texto-confirmado').waitFor({ timeout: 15000 });
  await foto(page, 'W3-feedback-confirmado');
});

await paso('W3 derivación a Soporte', async () => {
  await t('feedback-a-soporte').click();
  await t('soporte-screen').waitFor();
  await foto(page, 'W3-a-soporte');
});

await paso('W10 encabezado de Soporte (isotipo + tiempo + qué viaja)', async () => {
  await t('soporte-presentacion').waitFor();
  const txt = await t('soporte-detalle').innerText();
  if (/\d+\s*(h|hs|horas|hábiles)/i.test(txt)) throw new Error(`promete un número: ${txt}`);
  await foto(page, 'W10-soporte-encabezado');
});

await paso('W9 Cómo usar la app abre el chat con la pregunta', async () => {
  await irAjustes();
  await t('ajuste-tile-cuenta').click();
  await t('account-como-uso-la-app').click();
  await t('como-usar-tema-0').waitFor();
  await foto(page, 'W9-temas');
  await t('como-usar-tema-0').click();
  await t('rodillo-ejemplos').or(t('composer')).first().waitFor({ timeout: 10000 });
  await foto(page, 'W9-chat-con-pregunta');
});

await paso('W6 estado del refresco en Inteligencia', async () => {
  await page.getByRole('button', { name: 'Inteligencia' }).first().click();
  await t('inteligencia-actualizar').waitFor({ timeout: 20000 });
  await t('inteligencia-actualizar').click();
  await page.getByText(/Actualizando…|Al día · recién/).first().waitFor({ timeout: 10000 });
  await foto(page, 'W6-refresco');
});

console.log(resultados.join('\n'));
await browser.close();
process.exit(resultados.some((r) => r.startsWith('FALLA')) ? 1 : 0);
