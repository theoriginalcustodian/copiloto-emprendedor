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
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PROTO_PORT = process.env.PROTO_PORT ?? '8123';
const PROTO_BASE = `http://localhost:${PROTO_PORT}/prototipo`;
mkdirSync(OUT, { recursive: true });
const fotoA = (page, nombre) => page.screenshot({ path: join(OUT, `${nombre}.png`), fullPage: true });

const DESKTOP = { ancho: 1440, alto: 900 };
const MOVIL = { ancho: 390, alto: 844 };

// El prototipo activa cada `?ver=` con un `setTimeout` que hace click en un nodo. Dos formas de
// fallar CALLADO, medidas el 2026-09-28 (BL-Q3 v2 §10, `index.html:3470-3474`):
//   1. `$('#ajustes').classList...` sin guard (3472-3474) → TypeError en la consola del browser. Un
//      error dentro de un setTimeout NO rompe la captura: Playwright saca la foto de la pantalla
//      base y la celda sale «bien».
//   2. `const a = $('#accion-lucia'); if (a) a.click();` (3470) → el guard de nulidad se comió la
//      única señal. No emite NADA: foto perfecta de otra cosa.
// Para (1) alcanza escuchar la consola. Para (2) hace falta una aserción POSITIVA de que la
// activación ocurrió — un `if` que saltea la acción que ES la medición no protege nada.
const ASERCION_PROTO = {
  hitl: '.hitl',          // `?ver=hitl` clickea #accion-lucia; sin él no hay `.hitl` y no hay error
  vozchat: '.hitl',       // misma superficie, otro disparador
  cuenta: '#s-cuenta.on',
  apar: '#s-apar.on',
  hablar: '#s-hablar.on',
};

async function protoFoto(verId, sufijo, viewport) {
  // Browser propio y CERRADO al final: con la máquina cargada, un Chromium colgado por captura
  // compite con los gates (ver gate-local-serial.sh).
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  const errores = [];   // sólo lo que INVALIDA la captura
  const avisos = [];    // lo que hay que MIRAR, pero no invalida
  try {
    const ctx = await browser.newContext({ viewport: { width: viewport.ancho, height: viewport.alto } });
    const page = await ctx.newPage();
    // DOS clases, DOS brazos — no entran en un contador (medido por auditoría 2026-09-28):
    //   · `pageerror`  = excepción de JS sin atrapar ⇒ INVALIDA la captura, aborta.
    //   · `console.error` / `http>=400` = recurso faltante; la activación puede estar INTACTA.
    //     Abortar por esto tumbaba celdas buenas: Chrome pedía un `/favicon.ico` que el server del
    //     proto no tenía, 1 de cada 10 cargas del MISMO id, y el fallo se movía de id en id.
    //     Se AVISA y se captura igual; la aserción positiva de abajo es la que decide si hubo activación.
    page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') avisos.push(`console.error: ${m.text()}`); });
    page.on('response', (r) => { if (r.status() >= 400) avisos.push(`http ${r.status()} ${r.url()}`); });
    await page.goto(`${PROTO_BASE}/?ver=${verId}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);

    const esperado = ASERCION_PROTO[verId];
    if (esperado) {
      const hay = await page.$(esperado);
      if (!hay) {
        // Los dos mensajes NO compiten: la excepción de JS puede ser LA CAUSA de que falte el
        // selector. Medido por auditoría 2026-09-28 inyectando el TypeError real de
        // `index.html:3472-3474` (borrar `#s-cuenta` ⇒ el proto llama `.classList` sobre null): el
        // guard abortaba bien, pero el mensaje que salía era «falta `#s-cuenta.on`» y quien lo lee
        // va a buscar el selector, no la excepción que lo tumbó. Mover el chequeo de `errores`
        // ARRIBA de esta aserción NO sirve: se pierde el caso simétrico (excepción inocua + la
        // activación falla por otro motivo). Se ACUMULA: el mensaje dice qué faltó Y qué se rompió,
        // y no elige la causa. Clase: `memoria/dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una.md`.
        throw new Error(
          `proto ${verId}: la activación NO ocurrió — falta \`${esperado}\`. La foto sería de la ` +
          `pantalla base, no de ${verId}. NO se captura: una celda no medida vale más que una medida mal.`
          + (errores.length
              ? ` ⚠️ Y hubo ${errores.length} excepción(es) de JS que pueden ser LA CAUSA, no un dato aparte: ${errores.join(' | ')}`
              : '')
        );
      }
    }
    if (errores.length) {
      throw new Error(
        `proto ${verId}: ${errores.length} excepción(es) de JS sin atrapar — la captura no es de fiar: `
        + errores.join(' | ')
      );
    }
    if (avisos.length) {
      console.log(`  ⚠️  proto ${verId} ${sufijo}: ${avisos.length} aviso(s) NO fatales (activación verificada) — ${avisos.slice(0, 3).join(' | ')}`);
    }
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

const NO_MEDIDAS = [];   // toda celda que no se capturó: decide el exit code
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
      NO_MEDIDAS.push(`app ${id} ${sufijo}: ${String(e.message).slice(0, 180)}`);
    }
    await protoFoto(id, sufijo, viewport).catch((e) => {
      console.log(`  ❌ proto ${id} ${sufijo}: ${e.message}`);
      NO_MEDIDAS.push(`proto ${id} ${sufijo}: ${String(e.message).slice(0, 180)}`);
    });
  }
}

// El guard impedía el PNG malo y el proceso salía **exit 0** igual: quien corre esto en background y
// mira el exit veía VERDE con celdas faltantes. Un veredicto que miente es peor que no tenerlo —
// es `el-pipe-se-come-el-exit-code` con otra cara. Medido por auditoría 2026-09-28: EXIT_RECHAZO=0
// con 2 celdas abortadas. La lista va al stdout Y al JSON, y el exit es 1.
writeFileSync(
  `${OUT}/criterio3-no-medidas.json`,
  JSON.stringify({ generado: new Date().toISOString(), ids: IDS, no_medidas: NO_MEDIDAS }, null, 2),
);
if (NO_MEDIDAS.length) {
  console.log('');
  console.log(`❌ ${NO_MEDIDAS.length} celda(s) NO MEDIDA(s) — la corrida NO es completa:`);
  for (const m of NO_MEDIDAS) console.log(`   · ${m}`);
  console.log(`   (también en ${OUT}/criterio3-no-medidas.json)`);
  process.exit(1);
}
console.log('OK — capturas en', OUT, `— ${IDS.length * 2} celdas, 0 no medidas`);
