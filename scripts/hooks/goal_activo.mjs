#!/usr/bin/env node
/**
 * goal_activo.mjs — UserPromptSubmit. Inyecta la ORDEN DE TRABAJO activa, si hay una.
 *
 * Por qué existe (forense 2026-10-08, repo copiloto-emprendedor): 17 gates medían CALIDAD y
 * ninguno PERTINENCIA; 64 PRs en un día, 4 citando un id del backlog firmado. El fallo no fue
 * ignorancia de la cola — los ids se citaban de pasada — sino que nada comparaba el trabajo
 * contra UNA orden declarada. El operador descartó la variante "cron que me obligue a leer el
 * plan" con medición: ese día los crones estaban PRENDIDOS inyectando turnos.
 *
 * 🔴 CONTRATO DE TAMAÑO — hermano del de canon_invariantes.mjs, que NO se toca (318 tok/turno).
 * Este hook emite CERO cuando no hay `.goal`: en cualquier repo sin orden activa es inerte.
 * Con goal activo son ~3 líneas (~60 tokens/turno). No agregar prosa: el DoD largo vive en el
 * doc del padrón, y `scripts/goal.sh show` lo imprime entero cuando se necesita.
 *
 * El archivo `.goal` lo escribe `scripts/goal.sh set <ID>`, que RECHAZA un id ausente del
 * padrón: el goal no lo puede inventar el agente. Y `scripts/ci/atribucion.sh` compara cada
 * commit del push contra este mismo id — la inyección recuerda, el gate es el que frena.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const raizGit = (d) => {
  for (let p = resolve(d); ; p = dirname(p)) {
    if (existsSync(join(p, ".git"))) return p;   // en un worktree `.git` es un ARCHIVO, no un dir
    if (dirname(p) === p) return null;
  }
};

// La raíz se busca desde la ubicación de ESTE archivo primero, y sólo después desde el cwd.
// Medido: con el cwd en otro lado el hook salía MUDO — y un hook mudo no da síntoma, que es
// exactamente la clase de defecto que este mecanismo existe para evitar.
const raizDesde = [dirname(fileURLToPath(import.meta.url)), process.cwd()]
  .map(raizGit).find(Boolean);

let salida = "";
try {
  const raiz = raizDesde;
  const f = raiz && join(raiz, ".goal");
  if (f && existsSync(f)) {
    const kv = Object.fromEntries(
      readFileSync(f, "utf8").split(/\r?\n/).filter(Boolean)
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
    );
    if (kv.id) {
      const dod = (kv.dod || "(sin DoD en el doc)").replace(/\s+/g, " ").slice(0, 300);
      salida =
        `<orden-de-trabajo priority="max">\n` +
        `🎯 GOAL ACTIVO: ${kv.id}  (${kv.fuente || "?"})\n` +
        `   DoD (del doc, no mío): ${dod}\n` +
        (kv.nota ? `   nota del operador: ${kv.nota}\n` : "") +
        `   Trabajo fuera de ${kv.id} = DESVÍO. Si corresponde cambiar de orden, es una decisión` +
        ` del operador o un \`goal.sh set <OTRO>\` explícito, nunca un commit de hecho consumado.` +
        ` Terminado = el DoD cumplido con evidencia; después, \`goal.sh clear\`.\n` +
        `</orden-de-trabajo>`;
    }
  }
} catch { salida = ""; } // un hook que explota no puede trabar el prompt

process.stdin.resume();
process.stdin.on("data", () => {});
process.stdin.on("end", () => { if (salida) process.stdout.write(salida); process.exit(0); });
