#!/usr/bin/env node
/**
 * S7 — Parsea el volcado de la Medición 1 y clasifica la causa del tirón.
 *
 * La Medición 1 (definida en el handoff de la sesión de frontend de DocuMed) bisecta el espacio de
 * búsqueda con una sola pregunta: *durante el tirón, ¿`panelY` deja de avanzar, o avanza liso y
 * sólo los píxeles se detienen?* Cada respuesta manda a una capa distinta del stack, y las tres son
 * incompatibles entre sí — por eso esta medición va ANTES que cualquier A/B.
 *
 * Entrada: el log de `adb logcat` filtrado por `SPIKE_REPLIEGUE` (una línea JSON por gesto).
 * Uso: node S7-parse-medicion1.mjs _evidencia/medicion1.log [--hz=60]
 */
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const archivo = args.find((a) => !a.startsWith('--'));
const HZ = Number(args.find((a) => a.startsWith('--hz='))?.split('=')[1] ?? 60);
const PERIODO = 1000 / HZ;

if (!archivo) {
  console.error('uso: S7-parse-medicion1.mjs <log> [--hz=60]');
  process.exit(2);
}

const gestos = [];
for (const linea of readFileSync(archivo, 'utf8').split(/\r?\n/)) {
  const i = linea.indexOf('SPIKE_REPLIEGUE ');
  if (i < 0) continue;
  try {
    gestos.push(JSON.parse(linea.slice(i + 'SPIKE_REPLIEGUE '.length)));
  } catch {
    // Una línea rota es ruido de logcat, no un gesto — se ignora, pero se cuenta abajo.
  }
}

if (!gestos.length) {
  console.error(`[S7] ERROR: ningún gesto en ${archivo}.`);
  console.error('[S7] Control antes de concluir nada: ¿el logcat capturó algo? ¿la app está en el');
  console.error('[S7] dev-client con el spike abierto? ¿se arrastró CON EL DEDO (el swipe sintético');
  console.error('[S7] no reproduce el defecto ni, por tanto, emite gestos útiles)?');
  process.exit(1);
}

/**
 * Umbral de "hueco". Dos períodos de vsync = la app se saltó al menos un frame entero de muestreo.
 * Con dedo humano y `onUpdate` sano, los deltas caen cerca de `PERIODO`.
 */
const HUECO = PERIODO * 2;

const porVariante = new Map();
for (const g of gestos) {
  const k = g.etiqueta ?? '(sin etiqueta)';
  if (!porVariante.has(k)) porVariante.set(k, []);
  porVariante.get(k).push(g);
}

console.log(`[S7] ${archivo} · ${gestos.length} gestos · ${HZ}Hz (período ${PERIODO.toFixed(1)}ms)\n`);

const resumen = [];
for (const [variante, gs] of porVariante) {
  const peores = gs.map((g) => g.peorDeltaMs);
  const conHueco = gs.filter((g) => g.peorDeltaMs > HUECO);

  // ¿El tirón cae siempre en el mismo PUNTO de pantalla, o en el mismo INSTANTE del gesto?
  // Son indistinguibles a ojo (uno arrastra a velocidad parecida cada vez) y el handoff deja la
  // ambigüedad abierta explícitamente. Con las dos dispersiones se puede cerrar: la magnitud que
  // se repite es la que manda.
  const disp = (xs) => {
    if (xs.length < 2) return null;
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return +Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length).toFixed(1);
  };
  const dispY = disp(conHueco.map((g) => g.yEnPeorDelta).filter((v) => v != null));
  const dispT = disp(conHueco.map((g) => g.msDesdeInicio).filter((v) => v != null));

  // ¿Salta el VALOR (panelY) o salta la ENTRADA (translationY)? Si los saltos de `y` son parejos
  // mientras el tiempo tiene huecos, el valor fluyó y lo que se atrasó fue el dibujo.
  const saltosMax = Math.max(...gs.flatMap((g) => g.saltosY.map(Math.abs)));

  let veredicto;
  if (!conHueco.length) {
    veredicto = 'SIN_HUECOS · el hilo de UI no se bloqueó en esta variante';
  } else if (saltosMax > PERIODO * 6) {
    veredicto = 'ENTRADA · translationY salta → gesture-handler / InputDispatcher';
  } else {
    veredicto = 'HILO_UI_BLOQUEADO · render/compositor — corresponde Perfetto, no gfxinfo';
  }

  console.log(`  ${variante}  (${gs.length} gestos)`);
  console.log(`    peor delta por gesto: ${peores.map((p) => p.toFixed(0)).join(' · ')} ms`);
  console.log(`    gestos con hueco (>${HUECO.toFixed(0)}ms): ${conHueco.length}/${gs.length}`);
  if (conHueco.length) {
    console.log(`    dispersión del punto (px): ${dispY ?? 'n/d'}   ← baja = ocurre en el mismo LUGAR`);
    console.log(`    dispersión del instante (ms): ${dispT ?? 'n/d'}   ← baja = ocurre en el mismo MOMENTO`);
  }
  console.log(`    salto máximo de y entre muestras: ${saltosMax.toFixed(1)} px`);
  console.log(`    → ${veredicto}\n`);

  resumen.push({ variante, gestos: gs.length, conHueco: conHueco.length, peorMs: Math.max(...peores), veredicto });
}

// El caso base tiene que exhibir el defecto o la corrida entera no significa nada. Es la lección
// más cara del handoff: un A/B cuyo control no reproduce el síntoma "prueba" cualquier cosa.
const base = resumen.find((r) => r.variante.startsWith('V1'));
console.log('  ─────');
if (!base) {
  console.log('  ⚠️  No hay gestos de V1 (caso base). Sin control no se puede comparar nada.');
} else if (base.conHueco === 0) {
  console.log('  ⚠️  EL CASO BASE NO EXHIBIÓ EL DEFECTO.');
  console.log('     La corrida NO es concluyente: si V1 no se traba, que otra variante "no se trabe"');
  console.log('     no dice nada. Repetir arrastrando más lento y más largo, con el dedo.');
} else {
  console.log(`  ✓ Caso base exhibió el defecto (${base.conHueco}/${base.gestos} gestos, peor ${base.peorMs.toFixed(0)}ms).`);
  console.log('    Las demás variantes son comparables contra él.');
}
