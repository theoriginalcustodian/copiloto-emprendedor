#!/usr/bin/env bash
# test-gate-hook-secretos.sh — el gate mira QUÉ CONTIENE el hook, no sólo a dónde apunta.
#
# Por qué existe (BL-V36, 2026-09-22): #649 le dio a `gate.sh` un check fail-closed de
# `core.hooksPath`, y es correcto — pero verifica la RUTA. Un árbol anterior a #601 tiene
# `.githooks/pre-push` y `core.hooksPath=.githooks` (las dos condiciones en verde) con un hook que no
# invoca el escáner: corre entero y no escanea nada. El test M-3 lo midió con un push real (caso C) y
# el commit con el secreto entró al remoto. 4 de 26 árboles vivos estaban así, el checkout compartido
# entre ellos. Un control cuyo interruptor está del lado del controlado es una advertencia; éste no.
#
#   1. POSITIVO  hook SIN secretos-check, hooksPath correcto      → gate ROJO por contenido
#   2. NEGATIVO  hook CON secretos-check                          → ese error NO aparece (y el gate corre)
#   3. CONTROL   el hook sólo lo MENCIONA en un comentario        → sigue ROJO
#                (sin este caso, el guard se satisface con su propio comentario y no mide nada)
#   4. AISLAMIENTO  hooksPath mal + hook completo                 → grita el de #649, no el mío
#                (los dos checks son distintos y ninguno enmascara al otro)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { printf '  ✅ %s\n' "$1"; }
mal() { printf '  ❌ %s\n' "$1"; fallos=$((fallos+1)); }
echo "test-gate-hook-secretos"

# Fixture: un repo propio con una copia de gate.sh, para que su ROOT sea ÉSTE y no el repo real
# (mismo mecanismo que test-recibo-cubre.sh 9a/9c). Los overrides de test se desactivan a propósito
# con `env -u`: el check bajo prueba se saltea justamente cuando están puestos.
armar() {  # armar <contenido-del-pre-push> <hooksPath>
  local R="$T/r"; rm -rf "$R"; mkdir -p "$R/scripts/ci" "$R/.githooks"
  cp "$ROOT/scripts/gate.sh" "$R/scripts/gate.sh"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$R/scripts/ci/core.sh"
  printf '%s\n' "$1" > "$R/.githooks/pre-push"
  git -c init.defaultBranch=main init -q "$R"
  git -C "$R" config user.email t@t; git -C "$R" config user.name t
  git -C "$R" config core.hooksPath "$2"
  echo x > "$R/f"; git -C "$R" add f; git -C "$R" commit -qm base
  (cd "$R" && env -u GATE_CI_DIR -u GATE_RECIBO_DIR -u GATE_RECIBO_COMUN UC_SESION=t \
     bash scripts/gate.sh core) > "$T/out" 2>&1
  echo $?
}

HOOK_BUENO='#!/usr/bin/env bash
bash "$SCRIPT_DIR/scripts/secretos-check.sh" --refs-stdin || exit 1'
HOOK_VIEJO='#!/usr/bin/env bash
echo "[pre-push] (grafo ya sincronizado, nada que hacer)"'
HOOK_COMENTADO='#!/usr/bin/env bash
# antes esto llamaba a secretos-check.sh; quedó el comentario y no la llamada
echo "[pre-push] nada"'

# 1 — POSITIVO
rc="$(armar "$HOOK_VIEJO" .githooks)"
[ "$rc" -ne 0 ] && grep -q 'NO invoca secretos-check' "$T/out" \
  && ok "1 hook sin escáner + hooksPath correcto -> gate ROJO por contenido" \
  || mal "1 rc=$rc · un árbol pre-#601 pasó el gate: $(grep -m1 'gate.sh:' "$T/out" | cut -c1-70)"

# 2 — NEGATIVO (el que le da sentido al 1: si el gate fuera rojo siempre, el 1 no probaría nada)
rc="$(armar "$HOOK_BUENO" .githooks)"
! grep -q 'NO invoca secretos-check' "$T/out" \
  && ok "2 control: con el hook completo ese error NO aparece (rc=$rc)" \
  || mal "2 falso positivo — el guard grita con un hook que SÍ invoca el escáner"

# 3 — CONTROL del guard contra sí mismo
rc="$(armar "$HOOK_COMENTADO" .githooks)"
[ "$rc" -ne 0 ] && grep -q 'NO invoca secretos-check' "$T/out" \
  && ok "3 una mención en un COMENTARIO no satisface al guard" \
  || mal "3 rc=$rc · el guard se conforma con su propio comentario: no está midiendo la llamada"

# 4 — AISLAMIENTO entre los dos checks
rc="$(armar "$HOOK_BUENO" "$T/hooks-absolutos")"
[ "$rc" -ne 0 ] && grep -q "core.hooksPath=" "$T/out" && ! grep -q 'NO invoca secretos-check' "$T/out" \
  && ok "4 con hooksPath mal grita el check de #649, no el de contenido" \
  || mal "4 rc=$rc · los dos checks se pisan: $(grep -m1 'gate.sh:' "$T/out" | cut -c1-70)"

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
