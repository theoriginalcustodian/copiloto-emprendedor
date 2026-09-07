#!/usr/bin/env bash
# test-buzon-dos-sesiones-frontend.sh — el desdoble frontend1/frontend2 NO puede tragarse mensajes.
#
# Qué se ejercita: el destinatario de un mensaje sale del NOMBRE del archivo. Al partir `frontend`
# en dos sesiones, el modo de fallar NO es un error ruidoso — es que un `-a-frontend1_` deje de
# matchear el filtro y `ls abierto/` afirme que no hay nada pendiente (COORDINACION.md §4.2, "un
# vacío que no protesta"). Peor: `escaladores-buzon.sh` reescribía el destinatario vacío a `todos`
# vía `${para:-todos}`, así que la escalación salía MAL DIRIGIDA en vez de fallar.
#
# CONTROL NEGATIVO (el que exige el DoD): no alcanza con "frontend1 ve lo suyo". Hay que probar que
# frontend1 NO ve lo de frontend2 — un filtro roto que devuelve TODO también pasaría el happy-path.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# shellcheck source=../lib/buzon-roles.sh
. "$REPO_ROOT/scripts/lib/buzon-roles.sh"

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/abierto"

FE1="2026-09-07_contrato_planificacion-a-frontend1_tokens.md"
FE2="2026-09-07_contrato_planificacion-a-frontend2_gates.md"
BCAST="2026-09-07_contrato_planificacion-a-frontend_para-las-dos.md"
TODOS="2026-09-07_avance_backend-a-todos_deploy-listo.md"
AJENO="2026-09-07_contrato_planificacion-a-backend_no-es-de-ui.md"
PROPIO="2026-09-07_avance_frontend1-a-todos_cerre-tarea-0.md"
for f in "$FE1" "$FE2" "$BCAST" "$TODOS" "$AJENO" "$PROPIO"; do : > "$TMP/abierto/$f"; done

# Lo que ve una sesión = unión de sus patrones, menos lo que ella misma escribió.
bandeja() {
  local s="$1" args=() p
  while IFS= read -r p; do args+=(-o -iname "$p"); done < <(lee_patrones "$s")
  find "$TMP/abierto" -maxdepth 1 -type f \( "${args[@]:1}" \) \
    ! -iname "*_${s}-a-*" -printf '%f\n' 2>/dev/null | sort
}

ve()    { bandeja "$1" | grep -qxF "$2"; }

echo "── 1) cada sesión ve lo dirigido a ella"
ve frontend1 "$FE1" && ok "frontend1 ve su -a-frontend1_" || fail "frontend1 NO ve su propio contrato"
ve frontend2 "$FE2" && ok "frontend2 ve su -a-frontend2_" || fail "frontend2 NO ve su propio contrato"

echo "── 2) CONTROL NEGATIVO: no ve lo de la otra sesión de frontend"
ve frontend1 "$FE2" && fail "frontend1 ve el contrato de frontend2 (filtro no discrimina)" \
                    || ok "frontend1 NO ve el -a-frontend2_"
ve frontend2 "$FE1" && fail "frontend2 ve el contrato de frontend1 (filtro no discrimina)" \
                    || ok "frontend2 NO ve el -a-frontend1_"
ve frontend1 "$AJENO" && fail "frontend1 ve un contrato de backend" || ok "frontend1 NO ve lo de backend"

echo "── 3) el broadcast -a-frontend_ sigue llegando a LAS DOS"
ve frontend1 "$BCAST" && ok "frontend1 ve el broadcast -a-frontend_" || fail "el broadcast se perdió para frontend1"
ve frontend2 "$BCAST" && ok "frontend2 ve el broadcast -a-frontend_" || fail "el broadcast se perdió para frontend2"
ve frontend1 "$TODOS" && ok "frontend1 ve el -a-todos_"             || fail "el -a-todos_ se perdió"

echo "── 4) no autoalarma: nadie ve lo que escribió"
ve frontend1 "$PROPIO" && fail "frontend1 se ve su propio avance_" || ok "frontend1 NO ve lo que ella escribió"

echo "── 5) el parser entiende roles con dígitos (la causa raíz)"
[ "$(destinatario_de_nombre "$FE1")" = "frontend1" ] \
  && ok "destinatario_de_nombre('…-a-frontend1_…') = frontend1" \
  || fail "destinatario_de_nombre devolvió '$(destinatario_de_nombre "$FE1")', no 'frontend1'"
[ "$(emisor_de_nombre "$PROPIO")" = "frontend1" ] \
  && ok "emisor_de_nombre('…_frontend1-a-todos_…') = frontend1" \
  || fail "emisor_de_nombre devolvió '$(emisor_de_nombre "$PROPIO")', no 'frontend1'"
[ "$(destinatario_de_nombre "$BCAST")" = "frontend" ] \
  && ok "el rol sin dígito no se rompió (no regresión)" \
  || fail "regresión: destinatario_de_nombre rompió el caso viejo"

echo
[ "$fallos" -eq 0 ] && { echo "✅ test-buzon-dos-sesiones-frontend: OK"; exit 0; }
echo "❌ test-buzon-dos-sesiones-frontend: $fallos fallo(s)"; exit 1
