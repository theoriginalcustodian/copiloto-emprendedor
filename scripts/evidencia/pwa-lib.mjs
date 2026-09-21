// Utilidades de evidencia PWA con el usuario canónico e2e-device (NO crear otro usuario).
// Uso: NODE_PATH=<dir con playwright-core> node scripts/evidencia/<script>.mjs
// La credencial se lee de .env.e2e (gitignored); nunca se imprime.
import { readFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright-core');

export const BASE = process.env.PWA_URL ?? 'https://copilotoemprendedor.duckdns.org';
export const OUT = process.env.EVIDENCIA_OUT ?? 'evidencia-out';
mkdirSync(OUT, { recursive: true });

function credenciales() {
  const env = readFileSync(process.env.ENV_E2E ?? '.env.e2e', 'utf8');
  const get = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim();
  return { email: get('E2E_DEVICE_EMAIL'), password: get('E2E_DEVICE_PASSWORD') };
}

/** Abre la PWA con el service worker y las caches purgados (gotcha pwa-sw-staleness) y loguea. */
export async function abrirLogueado({ ancho = 390, alto = 844 } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, permissions: ['microphone'] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?ver=${Date.now()}`);
  await page.evaluate(async () => {
    (await navigator.serviceWorker?.getRegistrations?.())?.forEach((r) => r.unregister());
    for (const k of await caches.keys()) await caches.delete(k);
  });
  await page.goto(`${BASE}/?ver=${Date.now()}`);
  const { email, password } = credenciales();
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', password);
  await page.click('button[type=submit]');
  await page.waitForSelector('[data-testid=tab-bar], [data-testid=rail], [data-testid=app-shell]', { timeout: 30000 });
  return { browser, page };
}

export const foto = (page, nombre) => page.screenshot({ path: join(OUT, `${nombre}.png`), fullPage: false });
