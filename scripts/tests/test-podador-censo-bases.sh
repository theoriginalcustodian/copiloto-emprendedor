#!/usr/bin/env bash
# Mide el censo de huerfanos de `podar-worktrees.sh` FUERA de `.claude/worktrees/`.
#
# EL DEFECTO que ejercita (2026-10-12): el censo colgaba de `$principal/.claude/worktrees` y no de
# las BASES, asi que `--base <otra>` ampliaba el analisis de REGISTRADOS y dejaba el censo ciego.
# El caso 5 es el CONTROL POSITIVO: corre la version de `origin/main` contra el MISMO fixture y
# exige que NO vea nada. Sin el, un verde del caso 1 no distingue "el fix funciona" de "el fixture
# no tenia nada que encontrar".
#
# Uso: bash scripts/tests/test-podador-censo-bases.sh
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 2
REPO="$(pwd -P)"
SCRIPT="$REPO/scripts/podar-worktrees.sh"
fallos=0
ok()   { echo "  ✅ $1"; }
mal()  { echo "  ❌ $1"; fallos=$((fallos+1)); }

BASE="$(mktemp -d)"
CTL="$REPO/scripts/.ctl-podador-origin-main.sh"
# El mutante se borra SIEMPRE: un script que copia y revierte al final deja el mutante si muere en
# el medio ([[un-script-que-muta-produccion-y-revierte-al-final-deja-el-mutante]]).
trap 'rm -rf "$BASE"; rm -f "$CTL"' EXIT

# ── fixture: una carpeta por CLASE que el censo tiene que distinguir ────────────────────────────
mkdir -p "$BASE/wt-huerfano"
printf 'gitdir: %s/.git/worktrees/wt-huerfano\n' "$REPO" > "$BASE/wt-huerfano/.git"   # .git ARCHIVO
mkdir -p "$BASE/wt-resto/apps" "$BASE/wt-resto/scripts" "$BASE/wt-resto/docs"         # sin .git, 3 marcadores
mkdir -p "$BASE/clon-ajeno/.git"                                                      # .git DIRECTORIO
mkdir -p "$BASE/scratch-logs"; : > "$BASE/scratch-logs/a.log"                         # sin marcadores
mkdir -p "$BASE/ambiguo/apps"                                                         # 1 marcador

salida="$(bash "$SCRIPT" --base "$BASE" 2>&1)"

echo "── 1. EL CASO: el censo mira la BASE, no el path fijo ──"
censo="$(printf '%s\n' "$salida" | grep '🔎 CENSO:' || true)"
[ -n "$censo" ] || mal "no hay linea CENSO: el instrumento no dice cuantos directorios miro"
printf '%s' "$censo" | grep -q '5 directorio(s) mirados' \
  && ok "censo los 5 directorios del fixture" \
  || mal "censo mal: $censo"

echo "── 2. CLASIFICACION por forma del .git ──"
printf '%s' "$censo" | grep -q '1 huerfano(s)' && ok "el .git ARCHIVO no registrado = huerfano" || mal "huerfanos != 1: $censo"
printf '%s' "$censo" | grep -q '1 resto(s)'    && ok "sin .git + 3 dirs del repo = resto"      || mal "restos != 1: $censo"
printf '%s' "$censo" | grep -q '1 con UN solo dir' && ok "1 marcador = ambiguo, contado aparte" || mal "ambiguos != 1: $censo"
printf '%s\n' "$salida" | grep -q 'wt-huerfano' && ok "nombra al huerfano"  || mal "no nombra wt-huerfano"
printf '%s\n' "$salida" | grep -q 'wt-resto'    && ok "nombra al resto"     || mal "no nombra wt-resto"

echo "── 3. CONTROL NEGATIVO: el clon ajeno NO es hallazgo ──"
printf '%s\n' "$salida" | grep -qE '(HUÉRFANOS|RESTOS)[^§]*clon-ajeno' \
  && mal "el clon con .git DIRECTORIO entro como hallazgo (falso positivo)" \
  || ok "el clon independiente queda fuera de los hallazgos"
printf '%s\n' "$salida" | grep -qE '(HUÉRFANOS|RESTOS)[^§]*scratch-logs' \
  && mal "un directorio de scratch entro como hallazgo" \
  || ok "el scratch sin marcadores queda fuera"

echo "── 4. NO BORRA: el fixture sigue entero tras el dry-run ──"
n="$(find "$BASE" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')"
[ "$n" = "5" ] && ok "las 5 carpetas siguen en disco (dry-run no toca nada)" || mal "el dry-run cambio el disco: quedan $n de 5"

# ANCLA FIJA, y el motivo es el fallo que este test tuvo en CI el 2026-10-12: el control positivo
# citaba `origin/main` como "la version vieja". Mientras el fix estaba en una rama eso era cierto y
# el test daba 10/10 en local; al mergearse el PR #1035, `origin/main` paso a TENER el fix y el
# control se volvio imposible de satisfacer -- el test se autodestruyo al entrar a main, y el rojo
# aparecio en el PR siguiente, no en el suyo.
#   Un control positivo no puede anclarse a un ref MOVIL: mide "antes del merge", y despues miente.
# `52b5cd18` es el ultimo commit SIN el fix (`git log -2 origin/main -- scripts/podar-worktrees.sh`
# el 2026-10-12) y es historia inmutable. Mismo patron que `test_redeploy_mismo_sha.sh`, que compara
# contra `bf406abe` fijo; el job `lint` ya trae `fetch-depth: 0`, que es lo que ambos necesitan.
REF_PREFIX="${REF_PREFIX:-52b5cd18}"

echo "── 5. CONTROL POSITIVO: la version PRE-FIX ($REF_PREFIX) NO ve nada de esto ──"
if git -C "$REPO" show "$REF_PREFIX:scripts/podar-worktrees.sh" > "$CTL" 2>/dev/null; then
  vieja="$(bash "$CTL" --base "$BASE" 2>&1)"
  printf '%s\n' "$vieja" | grep -q '🔎 CENSO:' \
    && mal "la version PRE-FIX ya tenia la linea CENSO: el ancla $REF_PREFIX no es pre-fix, re-medi con git log -2" \
    || ok "la vieja no tiene linea CENSO (no dice cuantos miro)"
  printf '%s\n' "$vieja" | grep -qE 'wt-huerfano|wt-resto' \
    && mal "la version vieja SI vio el fixture: el defecto no se reproduce, revisar la premisa" \
    || ok "la vieja es CIEGA al fixture — defecto reproducido, el fix es lo que cambia"
else
  mal "no pude traer $REF_PREFIX:scripts/podar-worktrees.sh (sin control positivo, el verde no acredita). Si el objeto no esta en el clon, el job necesita fetch-depth: 0"
fi

echo
[ "$fallos" -eq 0 ] && { echo "✅ test-podador-censo-bases: OK"; exit 0; }
echo "❌ test-podador-censo-bases: $fallos fallo(s)"; exit 1
