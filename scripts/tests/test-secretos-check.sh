#!/usr/bin/env bash
# Test de secretos-check.sh (BL-B3): control POSITIVO (un secreto se detecta) y NEGATIVO (limpio pasa),
# más que un escáner que no puede correr es rc=2 (nunca "limpio"). El "secreto" se arma en runtime por
# concatenación para que ESTE archivo no sea a su vez un hallazgo.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHK="$ROOT/scripts/secretos-check.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { echo "  ✅ $1"; }
mal() { echo "  ❌ $1"; fallos=$((fallos+1)); }

# repo de prueba con la misma config que el real
cd "$T" && git init -q . && git config user.email t@t && git config user.name t
cp "$ROOT/.gitleaks.toml" "$T/.gitleaks.toml"; : > "$T/.gitleaksignore"
echo "hola" > README.md && git add . && git commit -qm base
BASE="$(git rev-parse HEAD)"

# el script real corre con cwd=ROOT; para el repo temporal reapuntamos ROOT con una copia mínima
mkdir -p "$T/scripts" && cp "$CHK" "$T/scripts/secretos-check.sh"
[ -d "$ROOT/.tools" ] && ln -s "$ROOT/.tools" "$T/.tools" 2>/dev/null || true

# 1) NEGATIVO: historia limpia -> 0
bash "$T/scripts/secretos-check.sh" --historia >/dev/null 2>&1 && ok "historia limpia pasa (rc=0)" || mal "historia limpia debería pasar"

# 2) POSITIVO: un token con forma de PAT de GitHub -> rc=1
tok="ghp_""$(printf 'aB3dE5gH7jK9mN1pQ3sT5vW7yZ9bC1dE3fG5')"
echo "GITHUB_TOKEN=$tok" > cfg.txt && git add cfg.txt && git commit -qm "malo"
MALO="$(git rev-parse HEAD)"
bash "$T/scripts/secretos-check.sh" --historia >/dev/null 2>&1; rc=$?
[ "$rc" = 1 ] && ok "secreto en la historia se detecta (rc=1)" || mal "secreto NO detectado (rc=$rc)"

# 3) rango: el commit limpio->malo falla; base..base (vacío) pasa
bash "$T/scripts/secretos-check.sh" --rango "$BASE..$MALO" >/dev/null 2>&1; rc=$?
[ "$rc" = 1 ] && ok "--rango con el commit malo falla" || mal "--rango debería fallar (rc=$rc)"
bash "$T/scripts/secretos-check.sh" --rango "$BASE..$BASE" >/dev/null 2>&1 && ok "--rango sin commits nuevos pasa" || mal "--rango vacío debería pasar"

# 4) --refs-stdin (lo que recibe el hook): rama existente y rama nueva
echo "refs/heads/x $MALO refs/heads/x $BASE" | bash "$T/scripts/secretos-check.sh" --refs-stdin >/dev/null 2>&1; rc=$?
[ "$rc" = 1 ] && ok "--refs-stdin (rama existente) falla con el commit malo" || mal "--refs-stdin debería fallar (rc=$rc)"
echo "refs/heads/x $BASE refs/heads/x 0000000000000000000000000000000000000000" | bash "$T/scripts/secretos-check.sh" --refs-stdin >/dev/null 2>&1 \
  && ok "--refs-stdin (rama nueva, limpia) pasa" || mal "rama nueva limpia debería pasar"
echo "refs/heads/x 0000000000000000000000000000000000000000 refs/heads/x $BASE" | bash "$T/scripts/secretos-check.sh" --refs-stdin >/dev/null 2>&1 \
  && ok "--refs-stdin (borrado de rama) no escanea y pasa" || mal "borrado de rama debería pasar"

# 5) fail-closed: binario inexistente -> rc=2, NUNCA 0
GITLEAKS_BIN="/no/existe/gitleaks" bash "$T/scripts/secretos-check.sh" --historia >/dev/null 2>&1; rc=$?
[ "$rc" = 2 ] && ok "escáner inutilizable = rc=2 (fail-closed)" || mal "escáner roto debería dar rc=2 (dio $rc)"

# 6) la allowlist es por fingerprint: perdonar el hallazgo lo silencia, y sólo ése
GL="$(bash "$CHK" --bin)"
(cd "$T" && "$GL" git --redact --no-banner -r "$T/r.json" --exit-code 0 . >/dev/null 2>&1)
fp="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))[0]['Fingerprint'])" "$T/r.json" 2>/dev/null || true)"
if [ -n "$fp" ]; then
  echo "$fp" > "$T/.gitleaksignore"
  bash "$T/scripts/secretos-check.sh" --historia >/dev/null 2>&1 && ok "el fingerprint perdonado se silencia" || mal "el fingerprint perdonado debería silenciarse"
  echo "otro=$(printf 'ghp_''%s' 'Zy9xW7vU5tS3rQ1pO9nM7lK5jH3gF1dS9aP2')" > "$T/otro.txt"; (cd "$T" && git add otro.txt && git commit -qm otro)
  bash "$T/scripts/secretos-check.sh" --historia >/dev/null 2>&1; rc=$?
  [ "$rc" = 1 ] && ok "un hallazgo NUEVO no queda cubierto por la allowlist" || mal "un hallazgo nuevo debería fallar (rc=$rc)"
else
  mal "no pude extraer el fingerprint del hallazgo de control"
fi

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
