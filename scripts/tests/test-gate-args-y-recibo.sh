#!/usr/bin/env bash
# test-gate-args-y-recibo.sh — A1 §4.1–4.2: `gate.sh` no puede dar verde por ausencia ni pisar su recibo.
#
#   NEGATIVO  arg que no es job (`--solo backend`, `backnd`) -> exit 2, sin recibo y sin correr jobs.
#   POSITIVO  un job válido corre, y `core` ok + `lint` failed en dos corridas del MISMO sha dejan AMBOS
#             en el recibo (acumula), con inicio<=fin y ruta de log que existe.
#   HISTORIAL un `failed` seguido de un `ok` del mismo job deja el failed en `historial`.
# Sin el positivo, el negativo pasaría también si gate.sh no corriera nada (la falla que se está arreglando).
# Usa stubs en un dir temporal (GATE_CI_DIR / GATE_RECIBO_DIR): no toca red, VPS ni el recibo real.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-gate-args-y-recibo"

T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
mkdir -p "$T/ci"
for j in core web mobile lint; do printf '#!/usr/bin/env bash\necho stub-%s\nexit 0\n' "$j" > "$T/ci/$j.sh"; done
printf '#!/usr/bin/env bash\necho stub-lint-rojo\nexit "${STUB_LINT_RC:-1}"\n' > "$T/ci/lint.sh"
gate() { GATE_CI_DIR="$T/ci" GATE_RECIBO_DIR="$T/rec" UC_SESION=backend bash "$ROOT/scripts/gate.sh" "$@" >"$T/out.txt" 2>&1; }

# 1. NEGATIVO
for malo in "--solo" "backnd"; do
  rm -rf "$T/rec"
  gate "$malo" backend; rc=$?
  if [ "$rc" -eq 2 ] && ! ls "$T"/rec/*.json >/dev/null 2>&1 && ! grep -q "OK" "$T/out.txt"; then ok "arg inválido '$malo' -> exit 2, sin recibo, sin veredicto verde"
  else fail "arg inválido '$malo': rc=$rc (esperaba 2, sin recibo ni ✅)"; fi
done

# 2. POSITIVO: dos corridas parciales, mismo SHA
rm -rf "$T/rec"
STUB_LINT_RC=1 gate core lint; rc1=$?
SHA="$(git -C "$ROOT" rev-parse HEAD)"; R="$T/rec/$SHA.json"
[ "$rc1" -eq 1 ] && ok "corrida con lint rojo -> exit 1" || fail "corrida con lint rojo rc=$rc1 (esperaba 1)"
STUB_LINT_RC=0 gate core web; rc2=$?
[ "$rc2" -eq 0 ] && ok "segunda corrida (core web) -> exit 0" || fail "segunda corrida rc=$rc2 (esperaba 0)"
jobs_presentes="$(jq -r '.jobs | keys | join(",")' "$R" 2>/dev/null)"
[ "$jobs_presentes" = "core,lint,web" ] && ok "el recibo acumula los 3 jobs de las 2 corridas ($jobs_presentes)" || fail "recibo NO acumuló: jobs=[$jobs_presentes]"
[ "$(jq -r '.jobs.lint' "$R")" = "failed" ] && ok "lint sigue failed (la 2ª corrida no lo tapó)" || fail "lint no quedó failed"
n_core="$(jq '.detalle.core.historial | length' "$R")"
[ "$n_core" = "2" ] && ok "core tiene 2 entradas de historial (corrió en las dos)" || fail "historial de core = $n_core (esperaba 2)"
log="$(jq -r '.detalle.web.log' "$R")"
[ -f "$log" ] && ok "la ruta de log del job existe" || fail "log inexistente: $log"
jq -e '.detalle.web | (.inicio <= .fin) and (.inicio > 0)' "$R" >/dev/null && ok "inicio y fin registrados (inicio<=fin)" || fail "inicio/fin inválidos"

# 3. HISTORIAL: failed y luego ok del mismo job
STUB_LINT_RC=0 gate lint; rc3=$?
[ "$(jq -r '.jobs.lint' "$R")" = "ok" ] && [ "$(jq -r '[.detalle.lint.historial[].resultado] | join(",")' "$R")" = "failed,ok" ] \
  && ok "lint failed->ok: el estado es ok pero el historial conserva el failed" || fail "historial de lint: $(jq -c '.detalle.lint.historial' "$R")"

[ "$fallos" -eq 0 ] && { echo "OK"; exit 0; } || { echo "FALLÓ ($fallos)"; exit 1; }
