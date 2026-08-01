#!/usr/bin/env bash
# scripts/seed-memory.sh — reconcilia la memoria VERSIONADA del repo (memoria/) con el directorio de
# auto-memory de Claude Code para ESTE checkout, de modo que una sesión nueva arranque con el contexto
# completo del proyecto. Parte del init cero-fricción (ver HANDOFF.md).
#
# Claude Code guarda la auto-memory en ~/.claude/projects/<slug>/memory/, donde <slug> deriva del PATH
# del checkout.
#
#   ./scripts/seed-memory.sh                      # autodetecta el slug dir; lo crea si falta
#   CLAUDE_MEM_DIR=/ruta/al/memory ./scripts/seed-memory.sh   # override explícito
#
# ─────────────────────────────────────────────────────────────────────────────────────────────────
# ⚠️ POR QUÉ ESTE SCRIPT NO BORRA (2026-07-21)
#
# Hasta el 2026-07-21 hacía `rsync -a --delete memoria/ → slug/`: un espejo que borraba del destino
# todo lo que no estuviera en el origen. El supuesto era que la memoria vive en el repo y el slug es
# una copia descartable. **Es falso en la mitad de los casos**: el harness le dice a CADA sesión de
# Claude Code que su memoria persistente vive en el slug, así que ahí es donde nacen las entradas
# nuevas. Al detectarlo había 14 lecciones que vivían SÓLO en el slug —todo el sprint mobile-first— y
# una corrida las habría borrado en silencio, terminando en exit 0 e informando cuántos archivos
# sembró, sin mencionar los que destruyó. (Ver `memoria/memoria-repo-vs-slug-drift.md`.)
#
# Ahora el flujo es en dos tiempos y NINGUNO destruye trabajo:
#
#   1. RESCATE (slug → repo)  lo que existe sólo en el slug se promueve a lo versionado, salvo que
#                             git demuestre que fue borrado a propósito — en ese caso el borrado sí se
#                             propaga, que es la intención original.
#   2. SIEMBRA (repo → slug)  aditiva y con `--update`: no pisa un archivo que el destino tiene más
#                             nuevo. Los que difieren se REPORTAN para reconciliar a mano; el índice
#                             `MEMORY.md` no se puede mergear solo.
#
# Regla de lectura del reporte: si la salida trae líneas `[RESCATADO]` hay que commitearlas, y si trae
# `[DIVERGE]` hay que resolverlas a mano. Un `0 / 0 / 0` es lo único que significa "alineado".
# ─────────────────────────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO/memoria"
[ -d "$SRC" ] || { echo "ERROR: no existe $SRC (¿corriste desde el repo?)" >&2; exit 1; }

PROJECTS="$HOME/.claude/projects"

# Deriva el slug de Claude Code para este checkout (bash puro, sin depender de python).
# /c/A/B/copiloto-emprendedor  ->  C:\A\B\...  ->  c--A-B-...-copiloto-emprendedor
default_slug() {
  local drive rest win slug first
  drive="$(printf '%s' "$REPO" | sed -E 's,^/([a-zA-Z])/.*,\1,')"
  rest="$(printf '%s' "$REPO" | sed -E 's,^/[a-zA-Z]/,,')"
  win="${drive}:\\${rest//\//\\}"                     # path estilo Windows con backslashes
  slug="$(printf '%s' "$win" | sed -E 's,[:\\/ ],-,g')"  # : \ / espacio -> '-'
  first="$(printf '%s' "${slug:0:1}" | tr 'A-Z' 'a-z')"  # drive a minúscula
  printf '%s%s' "$first" "${slug:1}"
}

DEST="${CLAUDE_MEM_DIR:-}"
if [ -z "$DEST" ]; then
  # 1) un slug dir YA existente para este repo (proyecto abierto al menos una vez en Claude Code)
  found="$(ls -d "$PROJECTS"/*copiloto-emprendedor 2>/dev/null | head -1 || true)"
  if [ -n "$found" ]; then
    DEST="$found/memory"
  else
    # 2) primera vez: computar el slug y crear el dir
    slug="$(default_slug)"
    [ -n "$slug" ] || { echo "ERROR: no pude derivar el slug; pasá CLAUDE_MEM_DIR=..." >&2; exit 1; }
    DEST="$PROJECTS/$slug/memory"
  fi
fi
mkdir -p "$DEST"

# ¿El repo es git? Sin git no se puede distinguir "entrada nueva del slug" de "entrada borrada a
# propósito del repo" -> fail-safe: se rescata todo y no se borra nada.
HAY_GIT=0
git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1 && HAY_GIT=1

rescatados=0; purgados=0; divergentes=0

# ── 1. RESCATE: lo que vive SÓLO en el slug ──────────────────────────────────────────────────────
while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  [ -e "$SRC/$rel" ] && continue

  # ¿Estuvo versionado y se borró a propósito? Ese borrado SÍ debe propagarse: si no, una memoria
  # que se eliminó por ser incorrecta resucitaría en cada corrida y volvería a contaminar el contexto.
  borrado_adrede=0
  if [ "$HAY_GIT" = "1" ] && \
     [ -n "$(git -C "$REPO" log --diff-filter=D --format=%H -1 -- "memoria/$rel" 2>/dev/null)" ]; then
    borrado_adrede=1
  fi

  if [ "$borrado_adrede" = "1" ]; then
    rm -f "$DEST/$rel"
    printf '  [PURGADO ] %s  (git registra su borrado deliberado)\n' "$rel"
    purgados=$((purgados + 1))
  else
    mkdir -p "$SRC/$(dirname "$rel")"
    cp -a "$DEST/$rel" "$SRC/$rel"
    printf '  [RESCATADO] %s  -> memoria/ (COMMITEAR)\n' "$rel"
    rescatados=$((rescatados + 1))
  fi
done < <(cd "$DEST" && find . -type f -name '*.md' -printf '%P\n' 2>/dev/null || true)

# ── 2. SIEMBRA: repo -> slug, aditiva y sin pisar lo más nuevo del destino ───────────────────────
# Antes de copiar, se reportan los archivos que existen en AMBOS y difieren con el destino más nuevo.
# Son los que `--update` va a saltear: sin este aviso, el drift seguiría siendo silencioso — que es
# exactamente la forma de fallar que este script tuvo hasta hoy.
while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  [ -e "$DEST/$rel" ] || continue
  cmp -s "$SRC/$rel" "$DEST/$rel" && continue
  if [ "$(stat -c %Y "$DEST/$rel")" -gt "$(stat -c %Y "$SRC/$rel")" ]; then
    printf '  [DIVERGE ] %s  el del slug es MÁS NUEVO: no se pisa, reconciliar a mano\n' "$rel"
    divergentes=$((divergentes + 1))
  fi
done < <(cd "$SRC" && find . -type f -name '*.md' -printf '%P\n' 2>/dev/null || true)

if command -v rsync >/dev/null 2>&1; then
  rsync -a --update "$SRC"/ "$DEST"/
else
  cp -a -u "$SRC"/. "$DEST"/
fi

sembrados="$(find "$DEST" -type f -name '*.md' | wc -l | tr -d ' ')"
echo "memoria reconciliada -> $DEST"
echo "  $sembrados archivos .md · rescatados: $rescatados · purgados: $purgados · divergentes: $divergentes"
[ "$rescatados" -gt 0 ] && echo "  ⚠️  Hay entradas rescatadas SIN COMMITEAR: git add memoria/ && git commit"
[ "$divergentes" -gt 0 ] && echo "  ⚠️  Hay archivos divergentes: resolvelos a mano (el índice no se mergea solo)"

# ── 3. SALUD DEL ÍNDICE ──────────────────────────────────────────────────────────────────────────
# Enganchado acá, y no en un cron ni en la disciplina de nadie: un control que hay que ACORDARSE de
# correr se desincroniza (memoria/atar-la-accion-a-un-momento-no-a-un-estado.md), y este es el
# momento en que la memoria ya se está tocando. Si el índice pasa el techo de carga, su cola deja de
# existir para la sesión SIN dar síntoma (memoria/el-indice-truncado-fabrica-duplicados.md).
# Avisa, no aborta: sembrar la memoria no debe fallar porque el índice esté gordo.
MEDIDOR="$REPO/scripts/medir-indice-memoria.py"
if [ ! -f "$MEDIDOR" ]; then
  # Un control que no está no puede fallar: decilo, no lo saltees en silencio.
  echo "  ⚠️  Falta $MEDIDOR — la salud del índice quedó SIN medir."
elif ! command -v python >/dev/null 2>&1; then
  echo "  ⚠️  No hay python en el PATH — la salud del índice quedó SIN medir."
else
  echo
  PYTHONIOENCODING=utf-8 python "$MEDIDOR" || echo "  ⚠️  El índice necesita PODA — ver arriba qué falla."
fi
exit 0
