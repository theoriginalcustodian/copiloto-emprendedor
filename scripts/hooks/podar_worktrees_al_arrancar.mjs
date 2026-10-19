#!/usr/bin/env node
// podar_worktrees_al_arrancar.mjs — hook SessionStart: dispara la poda de worktrees SIN que nadie se
// tenga que acordar. Decide CUÁNDO corre; el qué borrar lo decide `scripts/podar-worktrees.sh`.
//
// CAUSA RAÍZ que resuelve (medida el 2026-10-19). `scripts/podar-worktrees.sh` existe desde agosto,
// tiene su propio test y clasifica bien… y NADIE lo invocaba. El único hit del grep fuera del script
// era `.claude/settings.local.json`, que sólo lo PERMITE — un permiso no es un disparador. Su propia
// cabecera afirmaba «el default conserva el comportamiento de los crones que ya lo invocan»: esa
// frase envejeció y se leía como que el mecanismo estaba andando. Resultado: 145 worktrees y ~6 GB
// acumulados en `C:/gfw-src`.
//
// Y su default tampoco alcanzaba: medido con control positivo, con las bases por defecto entraban
// 0 de 3 worktrees al análisis (7 directorios mirados). Cablear un cron al default habría podado
// NADA y su resumen habría dicho «0 podables», que se lee como «está limpio». Por eso el arreglo es
// doble — este disparador MÁS las bases derivadas en el script.
//
// POR QUÉ UN HOOK Y NO UNA NORMA ESCRITA. Este repo ya midió que la disciplina no ordena: el buzón
// pasó de 32 a 136 archivos abiertos mientras la norma de archivar a mano estaba escrita, y lo
// resolvió un janitor automático (memoria/buzon-se-ordena-por-janitor-no-por-disciplina.md). Una
// norma que depende de que la sesión se acuerde al cerrar cae en el hueco entre tareas.
//
// POR QUÉ EN BACKGROUND. La corrida real tarda ~42 s (consulta `gh pr list` por rama). Un
// SessionStart que bloquea 42 s molesta en el caso normal, y esos guards se desarman solos
// (memoria/el-guard-que-grita-en-el-caso-normal-se-desarma-solo.md). Se lanza desacoplado y no se
// espera: este hook sale en milisegundos.
//
// SEGURIDAD: las tres guardas del script son AND — trabajo ya en origin/main, working tree limpio y
// sin actividad en 6 h — y nunca toca el worktree principal ni el actual.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const MINUTOS_THROTTLE = 30;   // dos sesiones que arrancan juntas no disparan dos barridos de 42 s

/**
 * Devuelve el primer worktree registrado que TENGA el guión, con su raíz — o null si ninguno lo
 * tiene. Deriva del estado real (`git worktree list`) por el mismo motivo que las bases del
 * janitor: una lista declarada envejece en silencio y deja el instrumento mirando 0 directorios.
 * Prefiere `repo` cuando lo tiene, para no cruzar de worktree sin necesidad.
 */
function resolverGuion(repo) {
  const rel = path.join("scripts", "poda-worktrees-en-background.sh");
  const candidatos = [repo];
  try {
    const salida = execFileSync("git", ["-C", repo, "worktree", "list", "--porcelain"],
      { encoding: "utf8", timeout: 5000 });
    for (const linea of salida.split("\n")) {
      if (linea.startsWith("worktree ")) candidatos.push(linea.slice(9).trim());
    }
  } catch { /* con `repo` solo alcanza para el caso normal */ }
  for (const base of candidatos) {
    if (!base) continue;
    try {
      const cand = path.join(base, rel);
      if (fs.existsSync(cand)) return { guion: cand, raiz: base };
    } catch { /* un worktree puede estar registrado y no estar en disco */ }
  }
  return null;
}

try {
  const repo = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  // El estado va en el git-common-dir: uno solo para TODOS los worktrees. Si viviera en cada
  // worktree, cada uno tendría su propio throttle y el barrido se dispararía N veces.
  let comun;
  try {
    comun = execFileSync("git",
      ["-C", repo, "rev-parse", "--path-format=absolute", "--git-common-dir"],
      { encoding: "utf8", timeout: 5000 }).trim();
  } catch { process.exit(0); }            // sin repo git no hay nada que podar
  if (!comun || !fs.existsSync(comun)) process.exit(0);

  const marca = path.join(comun, "poda-worktrees-ultima.json");
  const log = path.join(comun, "poda-worktrees.log");
  // El guión se DERIVA de los worktrees que git registra; no se declara contra `repo`.
  // Medido el 2026-10-19: el checkout COMPARTIDO (que es el cwd primario del proyecto, y donde
  // arranca la mayoría de las sesiones) estaba en 9123bf52, sin el merge que trajo este hook. Con
  // `repo` a secas el guión no existía ahí y el `exit 0` de abajo apagaba el mecanismo **callado**,
  // justo en su caso de activación. Y hay una segunda mitad del mismo defecto: el runner hace
  // `cd "$REPO"` y corre `scripts/podar-worktrees.sh` RELATIVO a ese path, así que apuntar a un
  // checkout atrasado corría la versión VIEJA del janitor — la de las bases declaradas, que mira 0
  // directorios y reporta tres ceros. Pasarle la raíz donde el guión existe arregla las dos.
  const hallado = resolverGuion(repo);
  if (!hallado) {
    // NO se sale callado: éste ES el caso de activación del guard. Que el mecanismo no corra tiene
    // que verse, o es indistinguible de que corra y no encuentre nada.
    console.log("[poda] ningún worktree registrado tiene scripts/poda-worktrees-en-background.sh: " +
                "el janitor de worktrees NO corrió en esta sesión. Actualizá el checkout contra " +
                "origin/main, o corré `bash scripts/podar-worktrees.sh --podar` desde un worktree " +
                "al día (CLAUDE.md §3.sexies).");
    process.exit(0);
  }
  const { guion, raiz } = hallado;

  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(marca, "utf8")); } catch { /* primera vez */ }

  // Retroalimentación de la corrida ANTERIOR. En el caso normal este hook no dice NADA: avisar
  // «0 podados» en cada arranque es el ruido que enseña a ignorar el canal. Habla sólo cuando la
  // corrida pasada borró algo — un borrado que nadie ve es indistinguible de un bug.
  if (prev && prev.podados > 0) {
    console.log(`[poda] worktrees borrados en la corrida anterior: ${prev.podados} ` +
                `(${prev.cuando}). Detalle: ${log}`);
  }

  if (prev && prev.cuando) {
    const edadMin = (Date.now() - Date.parse(prev.cuando)) / 60000;
    if (Number.isFinite(edadMin) && edadMin < MINUTOS_THROTTLE) process.exit(0);
  }

  const hijo = spawn("bash", [guion, raiz, log, marca],
    { detached: true, stdio: "ignore", windowsHide: true });
  hijo.unref();
} catch { /* un hook de higiene nunca puede impedir que arranque una sesión */ }
process.exit(0);
