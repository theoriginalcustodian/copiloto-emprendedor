#!/usr/bin/env node
/**
 * S5 — Parsea `dumpsys gfxinfo <pkg> framestats` y produce los números del gate F2.
 *
 * Por qué script: la decisión rutas-vs-capas se toma con un número. Un número no se estima
 * ni se describe ("se ve más fluido") — se calcula, y el cálculo tiene que ser reproducible
 * por quien lea el RESULT.md después.
 *
 * 🔴 **Mide DOS cosas, y la segunda es la que importa acá.**
 *
 *   1. Duración de frame — cuánto tardó en dibujarse cada frame que SÍ se dibujó.
 *      Es la métrica estándar de jank.
 *
 *   2. Hueco entre frames — cuánto pasó entre un frame y el siguiente.
 *      Esta es la que caza el síntoma que reportó el operador: *"hay un punto donde se
 *      detiene muy poco tiempo y luego sigue"*. Si el hilo JS se traba, la app **no dibuja
 *      nada** durante ese lapso: no hay frames lentos que contar, hay frames AUSENTES.
 *      Un parser que sólo mire duración vería p95 sana y concluiría "no hay problema" —
 *      justo el falso negativo que dejaría pasar el bug al sprint entero.
 *
 * Uso: node S5-parse-framestats.mjs _evidencia/framestats-A.txt [--hz 60] [--json]
 */
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const archivo = args.find((a) => !a.startsWith('--'));
const HZ = Number(args.find((a) => a.startsWith('--hz='))?.split('=')[1] ?? 60);
const comoJson = args.includes('--json');

if (!archivo) {
  console.error('uso: S5-parse-framestats.mjs <archivo> [--hz=60] [--json]');
  process.exit(2);
}

const PRESUPUESTO_MS = 1000 / HZ; // 16.67 a 60Hz — el presupuesto de un frame

/** Columnas de `framestats` que usamos. El orden lo declara la línea de encabezado. */
const COLS = ['Flags', 'IntendedVsync', 'FrameCompleted'];

const texto = readFileSync(archivo, 'utf8');

// El volcado trae bloques ---PROFILEDATA--- por ventana. Se concatenan todos.
const bloques = [...texto.matchAll(/---PROFILEDATA---\r?\n([\s\S]*?)---PROFILEDATA---/g)].map((m) => m[1]);
if (!bloques.length) {
  console.error(`[S5] ERROR: no hay bloques PROFILEDATA en ${archivo}.`);
  console.error('[S5] Causa habitual: la app no estaba en primer plano al medir, o el buffer');
  console.error("[S5] estaba vacío. Corré 'S3 reset-frames', hacé el gesto, y volvé a medir.");
  process.exit(1);
}

const frames = [];
for (const bloque of bloques) {
  const lineas = bloque.trim().split(/\r?\n/);
  const encabezado = lineas[0].split(',').map((s) => s.trim());
  const idx = Object.fromEntries(COLS.map((c) => [c, encabezado.indexOf(c)]));
  if (Object.values(idx).some((i) => i < 0)) {
    console.error(`[S5] ERROR: faltan columnas esperadas. Encabezado real:\n  ${encabezado.join(',')}`);
    process.exit(1);
  }
  for (const linea of lineas.slice(1)) {
    const c = linea.split(',');
    if (c.length < encabezado.length) continue;
    const flags = Number(c[idx.Flags]);
    // Flags != 0 → frame que Android mismo marca como no representativo (primer dibujo,
    // relayout de ventana). Contarlos ensucia la medición con ruido de arranque.
    if (flags !== 0) continue;
    const vsync = Number(c[idx.IntendedVsync]);
    const fin = Number(c[idx.FrameCompleted]);
    if (!Number.isFinite(vsync) || !Number.isFinite(fin) || fin <= vsync) continue;
    frames.push({ vsync, fin, duracionMs: (fin - vsync) / 1e6 });
  }
}

if (frames.length < 10) {
  console.error(`[S5] ERROR: sólo ${frames.length} frames válidos — muestra insuficiente para concluir nada.`);
  process.exit(1);
}

frames.sort((a, b) => a.vsync - b.vsync);

/** Hueco = cuánto pasó desde que empezó un frame hasta que empezó el siguiente. */
const huecos = [];
for (let i = 1; i < frames.length; i++) huecos.push((frames[i].vsync - frames[i - 1].vsync) / 1e6);

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

const dur = frames.map((f) => f.duracionMs);
const lentos = dur.filter((d) => d > PRESUPUESTO_MS).length;

// Un hueco de más de 2 frames = la app se saltó al menos un vsync entero: no dibujó nada.
// Ese es el "salto" perceptible. 4+ frames (>66ms a 60Hz) ya es una detención visible.
const HUECO_SALTO = PRESUPUESTO_MS * 2;
const HUECO_VISIBLE = PRESUPUESTO_MS * 4;
const saltos = huecos.filter((h) => h > HUECO_SALTO);
const visibles = huecos.filter((h) => h > HUECO_VISIBLE);

const r = {
  archivo,
  hz: HZ,
  presupuestoMs: +PRESUPUESTO_MS.toFixed(2),
  framesValidos: frames.length,
  duracion: {
    p50: +pct(dur, 50).toFixed(2), p95: +pct(dur, 95).toFixed(2),
    p99: +pct(dur, 99).toFixed(2), max: +Math.max(...dur).toFixed(2),
    lentos, pctLentos: +((lentos / dur.length) * 100).toFixed(1),
  },
  huecos: {
    p50: +pct(huecos, 50).toFixed(2), p95: +pct(huecos, 95).toFixed(2),
    p99: +pct(huecos, 99).toFixed(2), max: +Math.max(...huecos).toFixed(2),
    saltos: saltos.length,
    visibles: visibles.length,
    peores: [...huecos].sort((a, b) => b - a).slice(0, 5).map((h) => +h.toFixed(1)),
  },
};

// El veredicto es del operador/analista, no del script. Lo que el script aporta es la
// clasificación mecánica del síntoma, para que no se discuta la lectura del dato.
r.sintoma =
  r.huecos.visibles > 0 ? 'DETENCION_VISIBLE'
  : r.huecos.saltos > 2 ? 'SALTOS_MENORES'
  : r.duracion.pctLentos > 5 ? 'JANK_SOSTENIDO'
  : 'FLUIDO';

if (comoJson) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }

console.log(`[S5] ${archivo}  ·  ${r.framesValidos} frames válidos  ·  ${HZ}Hz (presupuesto ${r.presupuestoMs}ms)`);
console.log('');
console.log('  DURACIÓN DE FRAME (los que se dibujaron)');
console.log(`    p50 ${r.duracion.p50}ms · p95 ${r.duracion.p95}ms · p99 ${r.duracion.p99}ms · max ${r.duracion.max}ms`);
console.log(`    sobre presupuesto: ${r.duracion.lentos}/${r.framesValidos} (${r.duracion.pctLentos}%)`);
console.log('');
console.log('  HUECO ENTRE FRAMES  ← el que caza la detención');
console.log(`    p50 ${r.huecos.p50}ms · p95 ${r.huecos.p95}ms · p99 ${r.huecos.p99}ms · max ${r.huecos.max}ms`);
console.log(`    saltos (>${(HUECO_SALTO).toFixed(0)}ms): ${r.huecos.saltos}  ·  detenciones visibles (>${(HUECO_VISIBLE).toFixed(0)}ms): ${r.huecos.visibles}`);
console.log(`    5 peores huecos: ${r.huecos.peores.join(' · ')} ms`);
console.log('');
console.log(`  SÍNTOMA: ${r.sintoma}`);
