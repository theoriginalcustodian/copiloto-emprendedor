// ¿Qué SUPERFICIE monta el prototipo para cada `?ver=`? Read-only, los 41 ids de una pasada.
//
// Por qué barrer todos: el defecto «la fila compara otra superficie» ya apareció en cinco filas por
// el mismo motivo — `card`, `card-presu`, `card-cobro` (card en `#funcion` vs card en el hilo del
// chat en la app), `hitl` (recordatorio vs confirmación), y `caida`/`agenda`/`presu` que cazaron
// otras sesiones. Cinco por la misma causa no es una fila mal medida: es el esquema. Un veredicto
// COHERENTE sobre dos pantallas distintas sale verde igual, así que esto no se ve leyendo veredictos.
//
// ─── POR QUÉ ESTE INSTRUMENTO MIDE UN *DELTA* Y NO UN ESTADO ────────────────────────────────────
// Las dos versiones anteriores midieron el ESTADO ABSOLUTO de la página y las dos se equivocaron,
// con el mismo error de familia:
//
//   v1 buscaba sólo `[id].on`  -> reportó `caida`, `chat` y `esc` como «PANTALLA_BASE / no monta
//      nada». Los tres montan: `caida` inyecta un `.ex.on` SIN id en `#exp` y mutá `display`
//      (`index.html:3640-3652`); `chat` y `esc` mueven por TRANSFORM, sin clase ninguna.
//   v2 agregó transform y nodos `.on` sin id -> y clasificó `caida` como «TRANSFORM #chat 844px» y
//      `chat` como «NODO_SIN_ID». Al revés de lo que dice el código, porque **844px es el chat en
//      REPOSO**: `caida` no lo toca y hereda el default; `chat` lo sube a `yChat=0`, donde el
//      umbral deja de verlo. El detector estaba leyendo la línea base y atribuyéndosela al `?ver=`.
//
// La causa es una sola y no se arregla mirando más cosas: **sin línea base, «lo que hay» no se
// distingue de «lo que este id hizo».** Así que acá se captura la página SIN `?ver=`, y de cada id
// se reporta sólo la DIFERENCIA. Dos controles, sin los cuales un delta vacío no significa nada:
//
//   · RUIDO: dos bases independientes. El prototipo tiene `setInterval` de 11 s, 6 s y 1 s
//     (`index.html:3442,3457,2964`), así que algo cambia solo. Lo que difiere entre dos bases es
//     ruido y se descuenta de todos los deltas.
//   · CONTROL POSITIVO DEL PROPIO DETECTOR: una tercera base se mide como si fuera un id. Su delta
//     tiene que salir VACÍO. Si no sale vacío, el instrumento no sabe decir «no cambió nada» y
//     ningún otro resultado suyo se puede leer.
import { chromium } from './pwa-lib.mjs';

const BASE = `http://localhost:${process.env.PROTO_PORT ?? '8124'}/prototipo`;
// Ventana fija: acá OBSERVO el estado resultante, no espero uno. Es PARÁMETRO porque la ventana
// decide qué señal existe, y comparar dos generadores exige igualar primero sus ventanas: el
// prototipo activa cada `?ver=` con un `setTimeout` de 60-120 ms disparado por un script inline, así
// que una ventana corta contra un server lento puede fotografiar la pantalla base **antes** de que la
// activación ocurra — un falso verde que no acusa al server sino al margen.
const ESPERA = Number(process.env.ESPERA_MS ?? 1200);
const WAIT_UNTIL = process.env.WAIT_UNTIL ?? 'domcontentloaded';
const IDS = (process.env.SOLO_IDS || [
  'afip', 'agenda', 'ajustes', 'apar', 'apps', 'bi', 'bi-refresh', 'bi-vacio', 'bloqueado', 'caida',
  'card', 'card-presu', 'card-cobro', 'card-factura', 'card-cliente', 'cargando', 'chat', 'clientes',
  'consent', 'cuenta', 'detalle', 'entrada', 'esc', 'escucha', 'factura', 'gastos', 'grabando', 'hablar',
  'hitl', 'ingresar', 'ingresar-error', 'ingresos', 'negocio', 'plan', 'presu', 'reveal', 'tablero',
  'vacio', 'vacio-visto', 'volver', 'vozchat',
].join(',')).split(',');

const nav = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });

// Estado estructural: las CUATRO vías por las que este prototipo cambia de estado, ninguna
// hardcodeada al caso que ya conozco (si mañana aparece una quinta, el delta la muestra como
// clave nueva en vez de callarla).
const capturar = async (url) => {
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push('pageerror: ' + String(e.message).split('\n')[0].slice(0, 70)));
  page.on('console', (m) => { if (m.type() === 'error') errores.push('console.error: ' + m.text().slice(0, 70)); });
  await page.goto(url, { waitUntil: WAIT_UNTIL });
  await page.waitForTimeout(ESPERA);
  const est = await page.evaluate(() => {
    const firma = (e) => e.id ? '#' + e.id
      : (e.tagName.toLowerCase() + '.' + Array.from(e.classList).filter((c) => c !== 'on').join('.'));
    const y = (e) => {
      const t = (e.style.transform || '') + ' ' + getComputedStyle(e).transform;
      const m = t.match(/translateY\((-?[\d.]+)px\)|matrix\([^)]*,\s*(-?[\d.]+)\)/);
      return m ? Math.round(parseFloat(m[1] ?? m[2])) : null;
    };
    const mapa = {};
    // 1) todo lo marcado `.on`, con id o sin id
    for (const e of document.querySelectorAll('.on')) mapa['on ' + firma(e)] = 'on';
    // 2) posición por transform de cualquier elemento que la declare inline
    for (const e of document.querySelectorAll('[style*="transform"]')) {
      const v = y(e); if (v !== null) mapa['transform ' + firma(e)] = v + 'px';
    }
    // 3) visibilidad forzada por `display` inline — así entra lo que `caida` oculta y muestra
    for (const e of document.querySelectorAll('[style*="display"]')) mapa['display ' + firma(e)] = e.style.display;
    // 4) los textos que deciden si dos capturas son comparables
    const txt = (s) => (document.querySelector(s) || {}).textContent?.trim().slice(0, 48) || null;
    for (const [k, s] of [['card-tit', '#card-tit'], ['hitl', '.hitl b'], ['encaja', '#encaja-lbl']]) {
      const v = txt(s); if (v) mapa['texto ' + k] = v;
    }
    return mapa;
  });
  await page.close();
  return { est, errores };
};

const diff = (a, b, ruido = new Set()) => {
  const salida = [];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (ruido.has(k) || a[k] === b[k]) continue;
    salida.push(a[k] === undefined ? `+${k}=${b[k]}`
      : b[k] === undefined ? `-${k}` : `~${k}: ${a[k]}->${b[k]}`);
  }
  return salida.sort();
};
const clave = (d) => d.replace(/^[+~-]/, '').split(/[=:]/)[0].trim();

// ── los dos controles, ANTES de medir un solo id ────────────────────────────────────────────────
const b1 = await capturar(`${BASE}/`);
const b2 = await capturar(`${BASE}/`);
const ruido = new Set(diff(b1.est, b2.est).map(clave));
console.log(`CONTROL ruido: ${ruido.size} clave(s) cambian solas entre dos bases -> se descuentan`);
if (ruido.size) console.log('   ' + [...ruido].join(' | '));

const b3 = await capturar(`${BASE}/`);
const vacio = diff(b1.est, b3.est, ruido);
console.log(`CONTROL POSITIVO del detector: base-vs-base -> ${vacio.length ? 'FALLA' : 'delta vacio, OK'}`);
if (vacio.length) {
  console.log('   ' + vacio.join(' | '));
  console.log('!! El detector no distingue «no cambio nada» de «cambio algo»: ningun resultado de');
  console.log('!! abajo se puede leer. No amplies la lista de cosas que mira; arregla la base.');
  await ctx.close(); await nav.close(); process.exit(2);
}
console.log(`base: ${Object.keys(b1.est).length} claves de estado, espera ${ESPERA}ms`);
console.log('');

const filas = [];
for (const id of IDS) {
  try {
    const { est, errores } = await capturar(`${BASE}/?ver=${id}`);
    const d = diff(b1.est, est, ruido);
    // La superficie es lo que hace comparables dos capturas: card, hitl-en-chat, subvista-de-ajustes,
    // contenedor o mutación-en-sitio son cosas distintas con el mismo aspecto de «pantalla».
    // Se clasifica por el DELTA, nunca por lo que hay en pantalla.
    const sum = d.join(' ');
    // OJO: no alcanza con mirar el CAMBIO de titulo. `?ver=card` abre la card con «Nuevo gasto»,
    // que es EXACTAMENTE el valor que `#card-tit` ya tiene en la base -> el delta de texto sale
    // vacio y la card quedaba clasificada CONTENEDOR. El default enmascara el delta: la senal
    // fiable de que la card se abrio es `+on #card`, no el texto. Misma familia que el bug que
    // este archivo documenta arriba, en chico.
    const sup = /[+]on #card=/.test(sum) || /texto card-tit/.test(sum) ? 'CARD'
      : /texto hitl/.test(sum) ? 'HITL_EN_CHAT'
      : /\+on #s-/.test(sum) ? 'SUBVISTA_AJUSTES'
      : /\+on #/.test(sum) ? 'CONTENEDOR'
      : /transform/.test(sum) ? 'TRANSFORM'
      : /\+on [a-z]/.test(sum) || /display/.test(sum) ? 'MUTACION_EN_SITIO'
      : d.length ? 'OTRO' : 'SIN_DELTA';
    filas.push({ id, sup, d, errores });
    console.log(`  ${id.padEnd(16)} ${sup.padEnd(18)} ${d.join(' | ').slice(0, 150) || '(delta vacio)'}`);
    if (errores.length) console.log(`  ${''.padEnd(16)} ${'!! consola'.padEnd(18)} ${errores.join(' | ').slice(0, 150)}`);
  } catch (e) {
    filas.push({ id, sup: 'ERROR', d: [], errores: [] });
    console.log(`  ${id.padEnd(16)} ${'ERROR'.padEnd(18)} ${String(e.message).split('\n')[0].slice(0, 90)}`);
  }
}
await ctx.close(); await nav.close();

console.log('');
console.log('=== conteo por superficie ===');
const porSup = filas.reduce((a, f) => ((a[f.sup] = (a[f.sup] || 0) + 1), a), {});
Object.entries(porSup).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${k.padEnd(18)} ${n}`));

const sinDelta = filas.filter((f) => f.sup === 'SIN_DELTA');
if (sinDelta.length) {
  console.log('');
  console.log(`=== ${sinDelta.length} id(s) SIN DELTA: el ?ver= no cambio nada respecto de la base ===`);
  console.log('  El control positivo de arriba paso, asi que esto NO es ceguera del detector:');
  console.log('  o el id no esta implementado, o su rama fallo callada (ver index.html:3470,');
  console.log('  `if (a) a.click()` sin rama else). Una captura de estos ids fotografia la base.');
  console.log('  ' + sinDelta.map((f) => f.id).join(', '));
}

const conError = filas.filter((f) => f.errores.length);
if (conError.length) {
  console.log('');
  console.log(`=== ${conError.length} id(s) con error en CONSOLA: la captura sale igual, muda ===`);
  for (const f of conError) console.log(`  ${f.id.padEnd(16)} ${f.errores.join(' | ').slice(0, 110)}`);
}

console.log('');
console.log('=== ids que COMPARTEN contenedor: difieren por estado interno, no por pantalla ===');
const porCont = {};
for (const f of filas) {
  const cont = f.d.filter((x) => /^\+on #/.test(x)).map((x) => x.slice(4).split('=')[0]).join(' ');
  if (cont) (porCont[cont] = porCont[cont] || []).push(f.id);
}
const compartidos = Object.entries(porCont).filter(([, ids]) => ids.length > 1);
for (const [cont, ids] of compartidos) console.log(`  ${cont.padEnd(30)} ${ids.join(', ')}`);
console.log(`  -> ${compartidos.reduce((a, [, i]) => a + i.length, 0)} ids en ${compartidos.length} contenedores.`);
console.log('     Una fila validada «por pantalla» NO los distingue: la captura del contenedor es la misma.');
console.log('');
console.log('Las filas cuya superficie del proto no sea la misma que la de la app no admiten');
console.log('veredicto COHERENTE/INCOHERENTE: hay que declarar superficie (y dimension) primero.');
