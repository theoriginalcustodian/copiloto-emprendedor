// Matriz web del Criterio 3 (Cierre A): captura cada pantalla `spec` de BL-P5 en la PWA de prod,
// a 390 y a escritorio, lado a lado con el prototipo final (BL-P2). Ver pwa-lib.mjs.
//
// Versionado desde la re-medición de FE2 (2026-09-22, `dato_frontend2-a-planificacion_matriz-web-
// re-medida.md`), con sus tres arreglos de raíz: esperar a que la pantalla termine de cargar en vez
// de un timeout fijo, el estado de carga propio de AgendaScreen, y el testid del menú de cuenta que
// cambia según el shell (mobile `avatar-cuenta` / escritorio `rail-user`).
//
// 2026-09-23 (auditoría, Bloque A del criterio 3) — tres defectos que hacían que una corrida
// FALLIDA fuera indistinguible de una exitosa. Los tres están medidos en
// `dato_auditoria-a-planificacion_DICTAMEN-criterio-3-las-filas-caducaron.md`:
//   1. NO FALLABA NUNCA. Cada error caía en un `.catch` que sólo imprimía, no había ningún
//      `process.exit(1)`, y el script cerraba con un `console.log('OK')` incondicional. Medido: una
//      corrida con los 4 launches rotos salió exit 0 diciendo «OK», dejando en su lugar las capturas
//      de la corrida ANTERIOR — un veredicto emitido sobre ellas es indistinguible de uno real.
//   2. CAPTURABA LA PANTALLA EQUIVOCADA DEL PROTOTIPO, de forma INTERMITENTE. El prototipo monta
//      cada vista con `setTimeout(…, 60)` + transición CSS, y el `waitForTimeout(400)` competía con
//      ella. Medido sobre `?ver=cuenta` a 390: 3 corridas → 2 capturaron «Mi día» en vez de «Mi
//      cuenta». Ahora se espera el selector REAL de cada vista (`PROTO_VISTA`), no un reloj.
//   3. La espera de Agenda conocía 3 de los 4 estados finales; ante `agenda-calendario-caida`
//      (#659, BL-V23) decía «puede estar en loading» — diagnóstico equivocado: ya había cargado.
//
// Requiere:
//   - Un server estático sirviendo `Prototipo frontend/odobi-ui/` (NO `odobi-ui/prototipo/`: el
//     HTML referencia `../assets/fonts/`). Desde la raíz del repo:
//       cd "Prototipo frontend/odobi-ui" && python -m http.server 8123
//   - `.env.e2e` en el cwd (o ENV_E2E apuntándolo) — lo lee pwa-lib.mjs.
//   - `NODE_PATH` apuntando a un directorio que contenga `playwright-core`. NO está instalado en
//     este repo; en esta máquina sale de otro repo del workspace. Sin esto el script muere con
//     `Cannot find module 'playwright-core'`. Estaba documentado sólo en `pwa-lib.mjs:2`, que es
//     donde nadie lo busca.
//   - `CHROME_PATH` al chromium COMPLETO si falta el `chrome-headless-shell` de la versión que pide
//     Playwright (`…/ms-playwright/chromium-<v>/chrome-win64/chrome.exe`). Sin esto, todos los
//     `launch` fallan.
//
// Mapeo prototipo↔app:
//   ingresos/presu/negocio/afip/cuenta → `?ver=<id>` top-level en ambos.
//   detalle → no es un tile propio: es la tarjeta de Mi día expandida (tap).
//   agenda → sub-vista de Mi día («Ver agenda ›», visible sólo si Calendar está 'ok'). El
//     prototipo la muestra SIEMPRE conectada (mock); si el tenant no tiene Calendar, la app muestra
//     «no conectado» y se documenta, no se fuerza.
//
// Uso: PROTO_PORT=8123 [SOLO_IDS=ingresos,presu] node scripts/evidencia/criterio3-matriz.mjs
// Sale 1 si alguna captura esperada falta o quedó sin reescribir en esta corrida.
import { abrirLogueado, chromium, OUT } from './pwa-lib.mjs';
import { mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const PROTO_PORT = process.env.PROTO_PORT ?? '8123';
const PROTO_BASE = `http://localhost:${PROTO_PORT}/prototipo`;
mkdirSync(OUT, { recursive: true });
const fotoA = (page, nombre) => page.screenshot({ path: join(OUT, `${nombre}.png`), fullPage: true });

const DESKTOP = { ancho: 1440, alto: 900 };
const MOVIL = { ancho: 390, alto: 844 };

// Marca de inicio: todo PNG que esta corrida declare como suyo tiene que ser POSTERIOR a esto.
// Es el control de frescura, y va adentro del script a propósito: la carpeta `evidencia-out/`
// acumula corridas y un archivo viejo con bytes plausibles es indistinguible de uno recién escrito.
const INICIO = Date.now();
const fallos = [];
const esperados = new Set();

// Selector que prueba que el prototipo montó LA vista pedida. Sale de `index.html` (bloque
// `if (ver === '…')`): cada id agrega la clase `on` a un contenedor propio. Esperar esto en vez de
// un `waitForTimeout` es la diferencia entre medir la pantalla pedida y medir la pantalla de inicio.
const PROTO_VISTA = {
  detalle: '#tablero .fi.on',
  agenda: '#agenda.on',
  ingresos: '#ingresos.on',
  presu: '#presu.on',
  negocio: '#s-negocio.on',
  afip: '#s-afip.on',
  cuenta: '#s-cuenta.on',
  // Ampliables para el Bloque B (los 22 ids de FE1 y el resto de los 54 de la spec):
  tablero: '#tablero.on',
  clientes: '#clientes.on',
  ajustes: '#ajustes.on',
  factura: '#factura.on',
  gastos: '#funcion.on',
  apar: '#s-apar.on',
  hablar: '#s-hablar.on',
  apps: '#s-apps.on',
  plan: '#s-plan.on',
  bi: '#inteligencia.on',
  reveal: '#reveal.on',
  ingresar: '#ingresar.on',
  consent: '#consent.on',
};

async function protoFoto(verId, sufijo, viewport) {
  // Browser propio y CERRADO al final: con la máquina cargada, un Chromium colgado por captura
  // compite con los gates (ver gate-local-serial.sh).
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: viewport.ancho, height: viewport.alto } });
    const page = await ctx.newPage();
    await page.goto(`${PROTO_BASE}/?ver=${verId}`, { waitUntil: 'networkidle' });
    const sel = PROTO_VISTA[verId];
    if (sel) {
      // Si la vista no monta, esto TIRA y la captura no se toma: es preferible no tener la imagen
      // a tener la de otra pantalla con el nombre de ésta.
      await page.waitForSelector(sel, { state: 'visible', timeout: 10000 });
      await page.waitForTimeout(250); // que asiente la transición ya montada
    } else {
      console.log(`  ⚠️  ${verId}: sin selector de vista en PROTO_VISTA — cayendo a espera por reloj`);
      await page.waitForTimeout(400);
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
        // visible no significa datos listos. Se espera a uno de sus estados finales — los CUATRO:
        // `agenda-calendario-caida` entró con #659 (BL-V23) y faltaba acá, así que el script
        // reportaba «puede estar en loading» sobre una pantalla que ya había terminado de cargar.
        await page
          .waitForSelector(
            '[data-testid=agenda-no-disponible], [data-testid=agenda-no-conectado], [data-testid=agenda-calendario-caida], [data-testid^=agenda-grupo-]',
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
    esperados.add(join(OUT, `criterio3-${id}-app-${sufijo}.png`));
    esperados.add(join(OUT, `criterio3-${id}-proto-${sufijo}.png`));
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
      fallos.push(`app ${id} ${sufijo}: ${e.message}`);
    }
    await protoFoto(id, sufijo, viewport).catch((e) => {
      console.log(`  ❌ proto ${id} ${sufijo}: ${e.message}`);
      fallos.push(`proto ${id} ${sufijo}: ${e.message}`);
    });
  }
}

// Control de frescura: no alcanza con que el archivo exista. `evidencia-out/` acumula corridas, y
// un PNG de ayer con bytes plausibles se juzga igual que uno de hoy — así es como un veredicto se
// emite sobre la medición de otro sin que nadie lo note.
for (const p of esperados) {
  if (!existsSync(p)) fallos.push(`FALTA la captura ${p}`);
  else if (statSync(p).mtimeMs < INICIO) fallos.push(`RESIDUO: ${p} no se reescribió en esta corrida`);
}

if (fallos.length) {
  console.error(`\n❌ ${fallos.length} problema(s) — esta corrida NO sirve como evidencia:`);
  for (const f of fallos) console.error(`   · ${f}`);
  process.exit(1);
}
console.log('OK — capturas en', OUT);
