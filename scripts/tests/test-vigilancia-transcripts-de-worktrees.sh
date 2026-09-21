#!/usr/bin/env bash
# test-vigilancia-transcripts-de-worktrees.sh — una sesión lanzada desde un worktree tiene que poder
# quedar MUDA a los ojos del vigilante.
#
# CASO REAL (2026-09-21): FE1, FE2 y auditoría corrían desde `C:/gfw-src/wt-*`. Claude Code guarda
# su transcript bajo el slug de ESE cwd (`C--gfw-src-wt-fe1b/`), y el bloque 3 de
# vigilancia-check.sh sólo miraba el slug principal: `mt_fe=0 → continue`. Si una se moría, el
# vigilante callaba — y el silencio se leía como «todo bien».
#
#   1. CONTROL NEGATIVO — transcript viejo en un slug de worktree, SIN mirarlo → no hay SESION MUDA
#      (reproduce el agujero: prueba que el caso 2 depende del cambio y no del fixture)
#   2. EL CASO — el mismo slug listado como extra                         → SESION MUDA: BACKEND
#   3. CONTROL POSITIVO — transcript fresco en ese slug                   → sin SESION MUDA
#   4. AUTO — el slug se deriva de `git worktree list` de un repo real de fixture
#   5. AISLAMIENTO — con TRANSCRIPTS_DIR de test y sin extras, no lee slugs reales
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VIG="$SCRIPT_DIR/../vigilancia-check.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

mkdir -p "$TMP/buzon/abierto" "$TMP/buzon/en-curso" "$TMP/buzon/cerrado"
ROOT="$TMP/slugs"; PRINCIPAL="$ROOT/c--proyecto-principal"; mkdir -p "$PRINCIPAL"
# Escalador de mentira con centinela: sin él, el gate agrega «NO TERMINARON» y ensucia la salida.
printf '#!/usr/bin/env bash
echo "ESCALADORES: FIN-OK"
' > "$TMP/esc.sh"
# ⚠️ Nunca `correr | grep -q` con pipefail: grep -q corta el pipe, el productor muere por SIGPIPE y
# el pipeline sale ≠0 aunque haya matcheado — falso rojo en los casos positivos, falso verde en los
# negados. Por eso todo va con here-string.
git init -q "$TMP/repo" && git -C "$TMP/repo" -c user.email=t@t -c user.name=t commit -q --allow-empty -m base

transcript() {  # transcript <dir> <minutos-de-antigüedad>
  mkdir -p "$1"
  local f="$1/sesion.jsonl"
  printf '%s\n' '{"type":"user","message":"Monitor de PARÁLISIS (sesión BACKEND). Ruta absoluta del buzón"}' > "$f"
  touch -d "-$2 minutes" "$f"
}
correr() {  # correr <extras> → salida
  BUZON_DIR="$TMP/buzon" TRANSCRIPTS_DIR="$PRINCIPAL" SLUGS_ROOT="$ROOT" RAMAS_GIT_DIR="$TMP/repo" \
    TRANSCRIPTS_EXTRA_DIRS="$1" ESCALADOR_SH="$TMP/esc.sh" bash "$VIG" --dry-run 2>&1
}

WT_SLUG="$ROOT/C--gfw-src-wt-backend"
transcript "$WT_SLUG" 60

echo "── 1. CONTROL NEGATIVO: sin mirar el slug del worktree, el agujero ──"
if grep -q "SESION MUDA: BACKEND" <<< "$(correr "")"; then
  fail "alarmó sin mirar el worktree: el caso 2 no probaría nada"
else
  ok "sin el slug del worktree, BACKEND es invisible (el agujero reproducido)"
fi

echo "── 2. EL CASO: el slug del worktree entra ──"
sal2="$(correr "$WT_SLUG")"
if grep -q "SESION MUDA: BACKEND sin escribir hace 60min" <<< "$sal2"; then
  ok "BACKEND muda hace 60min, visto desde su worktree"
else
  fail "no vio la sesión muda del worktree"
fi

echo "── 3. CONTROL POSITIVO: la misma sesión viva ──"
transcript "$WT_SLUG" 2
if grep -q "SESION MUDA" <<< "$(correr "$WT_SLUG")"; then fail "acusa a una sesión viva"; else ok "sesión viva: sin alarma"; fi

echo "── 4. AUTO: el slug sale de git worktree list ──"
transcript "$WT_SLUG" 60
rm -rf "$WT_SLUG"
git -C "$TMP/repo" worktree add -q --detach "$TMP/wt-auto" 2>/dev/null
wt_path="$(git -C "$TMP/repo" worktree list --porcelain | sed -n 's/^worktree //p' | grep 'wt-auto$')"
slug_auto="$ROOT/$(printf '%s' "$wt_path" | sed 's/[^A-Za-z0-9]/-/g')"
transcript "$slug_auto" 60
if grep -q "SESION MUDA: BACKEND" <<< "$(correr auto)"; then
  ok "derivó el slug del worktree sin lista a mano"
else
  fail "auto no encontró el slug de $wt_path"
fi

echo "── 5. AISLAMIENTO: TRANSCRIPTS_DIR de test sin extras no toca slugs reales ──"
sal5="$(BUZON_DIR="$TMP/buzon" TRANSCRIPTS_DIR="$PRINCIPAL" SLUGS_ROOT="$ROOT" RAMAS_GIT_DIR="$TMP/repo" \
        ESCALADOR_SH="$TMP/esc.sh" bash "$VIG" --dry-run 2>&1)"
if grep -q "SESION MUDA" <<< "$sal5"; then fail "con override de test leyó slugs fuera del fixture"; else ok "el fixture aísla"; fi

echo
if [ "$fallos" -eq 0 ]; then echo "✅ test-vigilancia-transcripts-de-worktrees: OK"; exit 0; fi
echo "❌ test-vigilancia-transcripts-de-worktrees: $fallos fallo(s)"; exit 1
