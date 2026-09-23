// Matriz web del Criterio 3 (Cierre A): captura cada pantalla `spec` de BL-P5 en la PWA de prod,
// a 390 y a escritorio, lado a lado con el prototipo final (BL-P2). Ver pwa-lib.mjs.
//
// Versionado desde la re-medición de FE2 (2026-09-22, `dato_frontend2-a-planificacion_matriz-web-
// re-medida.md`), con sus tres arreglos de raíz: esperar a que la pantalla termine de cargar en vez
// de un timeout fijo, el estado de carga propio de AgendaScreen, y el testid del menú de cuenta que
// cambia según el shell (mobile `avatar-cuenta` / escritorio `rail-user`).
//
// Requiere:
//   - Un server estático sirviendo `Prototipo frontend/odobi-ui/` (NO `odobi-ui/prototipo/`: el
//     HTML referencia `../assets/fonts/`). Desde la raíz del repo:
//       cd "Prototipo frontend/odobi-ui" && python -m http.server 8123
//   - `.env.e2e` en el cwd (o ENV_E2E apuntándolo) — lo lee pwa-lib.mjs.
//
// Mapeo prototipo↔app:
//   ingresos/presu/negocio/afip/cuenta → `?ver=<id>` top-level en ambos.
//   detalle → no es un tile propio: es la tarjeta de Mi día expandida (tap).
//   agenda → sub-vista de Mi día («Ver agenda ›», visible sólo si Calendar está 'ok'). El
//     prototipo la muestra SIEMPRE conectada (mock); si el tenant no tiene Calendar, la app muestra
//     «no conectado» y se documenta, no se fuerza.
//
// Uso: PROTO_PORT=8123 [SOLO_IDS=ingresos,presu] node scripts/evidencia/criterio3-matriz.mjs
import { abrirLogueado, chromium, OUT } from './pwa-lib.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PROTO_PORT = process.env.PROTO_PORT ?? '8123';
const PROTO_BASE = `http://localhost:${PROTO_PORT}/prototipo`;
mkdirSync(OUT, { recursive: true });
const fotoA = (page, nombre) => page.screenshot({ path: join(OUT, `${nombre}.png`), fullPage: true });

const DESKTOP = { ancho: 1440, alto: 900 };
const MOVIL = { ancho: 390, alto: 844 };

async function protoFoto(verId, sufijo, viewport) {
  // Browser propio y CERRADO al final: con la máquina cargada, un Chromium colgado por captura
  // compite con los gates (ver gate-local-serial.sh).
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: viewport.ancho, height: viewport.alto } });
    const page = await ctx.newPage();
    await page.goto(`${PROTO_BASE}/?ver=${verId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    await fotoA(page, `criterio3-${verId}-proto-${sufijo}`);
  } finally {
    await browser.close();
  }
}

// La primera corrida capturó 4/7 pantallas en pleno esqueleto de carga: un timeout fijo alcanza
// para la navegación pero no para el round-trip que llena la pantalla. Se espera la condición real
// (que el testid `*-cargando` se desmonte), no un timeout más largo.
async function esperarCargado(page, testidCargando, timeout = 30000) {
  const ok = await page
    .waitForSelector(`[data-testid=${testidCargando}]`, { state: 'detached', timeout })
    .then(() => true)
    .catch(() => false);
  if (!ok) console.log(`  ⚠️  ${testidCargando}: seguía visible tras ${timeout}ms — la captura puede estar en loading`);
}

async function appNavegar(page, id) {
  switch (id) {
    case 'ingresos':
      await page.getByRole('button', { name: 'Funciones' }).click().catch(() => {});
      await page.getByTestId('tile-ingresos').click();
      await page.waitForSelector('[data-testid=pantalla-ingresos]', { timeout: 15000 });
      await esperarCargado(page, 'ingresos-cargando');
      break;
    case 'presu':
      await page.getByRole('button', { name: 'Funciones' }).click().catch(() => {});
      await page.getByTestId('tile-presupuestos').click();
      await page.waitForSelector('[data-testid=pantalla-presupuestos]', { timeout: 15000 });
      await esperarCargado(page, 'presupuestos-cargando');
      break;
    case 'negocio':
    case 'afip':
    case 'cuenta': {
      // El shell mobile expone `avatar-cuenta`; el de escritorio, `rail-user` (Rail.tsx, PR #299).
      const tile = { negocio: 'perfilNegocio', afip: 'facturacionAfip', cuenta: 'cuenta' }[id];
      await page.getByRole('button', { name: 'Mi día' }).click().catch(() => {});
      const boton = page.locator('[data-testid=avatar-cuenta], [data-testid=rail-user]');
      await boton.first().waitFor({ timeout: 15000 });
      await boton.first().click();
      await page.waitForSelector(`[data-testid=ajuste-tile-${tile}]`, { timeout: 15000 });
      await page.getByTestId(`ajuste-tile-${tile}`).click();
      if (id === 'negocio') await esperarCargado(page, 'perfil-negocio-cargando');
      break;
    }
    case 'detalle': {
      await page.getByRole('button', { name: 'Mi día' }).click().catch(() => {});
      await page.waitForSelector('[data-testid=pantalla-midia]', { timeout: 15000 });
      await esperarCargado(page, 'midia-cargando');
      const primeraTarjeta = page.locator('[data-testid^=midia-tarjeta-]').first();
      await primeraTarjeta.waitFor({ timeout: 15000 });
      await primeraTarjeta.click();
      break;
    }
    case 'agenda': {
      await page.getByRole('button', { name: 'Mi día' }).click().catch(() => {});
      await page.waitForSelector('[data-testid=pantalla-midia]', { timeout: 15000 });
      await esperarCargado(page, 'midia-cargando');
      const verAgenda = page.getByTestId('midia-ver-agenda');
      if (await verAgenda.isVisible({ timeout: 3000 }).catch(() => false)) {
        await verAgenda.click();
        await page.waitForSelector('[data-testid=pantalla-agenda]', { timeout: 15000 });
        // AgendaScreen tiene SU PROPIO estado 'cargando' (Skeleton sin testid): `pantalla-agenda`
        // visible no significa datos listos. Se espera a uno de sus tres estados finales.
        await page
          .waitForSelector(
            '[data-testid=agenda-no-disponible], [data-testid=agenda-no-conectado], [data-testid^=agenda-grupo-]',
            { timeout: 20000 },
          )
          .catch(() => console.log('  ⚠️  agenda: ningún estado final visible tras 20s — la captura puede estar en loading'));
      } else {
        console.log(`  ⚠️  agenda: "Ver agenda" no visible (Calendar no 'ok' en el tenant) — capturo Mi día tal cual`);
      }
      break;
    }
    default:
      throw new Error(`id desconocido: ${id}`);
  }
  await page.waitForTimeout(500);
}

const IDS = (process.env.SOLO_IDS ?? 'detalle,agenda,ingresos,presu,negocio,afip,cuenta').split(',');

for (const id of IDS) {
  console.log(`→ ${id}`);
  for (const [sufijo, viewport] of [['390', MOVIL], ['desktop', DESKTOP]]) {
    try {
      const { browser, page } = await abrirLogueado(viewport);
      try {
        await appNavegar(page, id);
        await fotoA(page, `criterio3-${id}-app-${sufijo}`);
      } finally {
        await browser.close();
      }
    } catch (e) {
      console.log(`  ❌ app ${id} ${sufijo}: ${e.message}`);
    }
    await protoFoto(id, sufijo, viewport)
      .catch((e) => console.log(`  ❌ proto ${id} ${sufijo}: ${e.message}`));
  }
}
console.log('OK — capturas en', OUT);
