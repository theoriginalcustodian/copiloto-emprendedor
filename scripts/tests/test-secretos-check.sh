#!/usr/bin/env bash
# Test de secretos-check.sh (BL-B3): control POSITIVO (un secreto se detecta) y NEGATIVO (limpio pasa),
# más que un escáner que no puede correr es rc=2 (nunca "limpio"). El "secreto" se arma en runtime por
# concatenación para que ESTE archivo no sea a su vez un hallazgo.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHK="$ROOT/scripts/secretos-check.sh"
T="$(mktemp -d)"; T2=""; trap 'rm -rf "$T" "$T2"' EXIT
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

# 7) --arbol: control positivo/negativo, y su allowlist es SIN sha (archivo:regla:línea) -- repo
# temporal PROPIO (aislado de los checks 1-6: ésos dejan fixtures con tokens sin allowlist para arbol).
# Regresión del bug real de #601: un checkout superficial (depth=1) re-detecta el mismo contenido
# bajo un SHA nuevo que una allowlist por-commit (--historia) no puede prever; --arbol no depende del sha.
T2="$(mktemp -d)"
(cd "$T2" && git init -q . && git config user.email t@t && git config user.name t
 cp "$ROOT/.gitleaks.toml" .gitleaks.toml; : > .gitleaksignore
 echo hola > README.md && git add . && git commit -qm base)
mkdir -p "$T2/scripts" && cp "$CHK" "$T2/scripts/secretos-check.sh"
[ -d "$ROOT/.tools" ] && ln -sf "$ROOT/.tools" "$T2/.tools" 2>/dev/null || true

bash "$T2/scripts/secretos-check.sh" --arbol >/dev/null 2>&1 && ok "--arbol: árbol limpio pasa" || mal "--arbol: árbol limpio debería pasar"
echo "arbol=$(printf 'ghp_''%s' 'Bq3nM5pR7tV9xZ1aC3eG5iK7mO9qS1uW3yA5')" > "$T2/pordisco.txt"
(cd "$T2" && git add pordisco.txt && git commit -qm pordisco)
bash "$T2/scripts/secretos-check.sh" --arbol >/dev/null 2>&1; rc=$?
[ "$rc" = 1 ] && ok "--arbol: secreto en el árbol se detecta" || mal "--arbol: debería detectar el secreto (rc=$rc)"

GL="$(bash "$CHK" --bin)"
(cd "$T2" && "$GL" detect --no-git -s . --redact --no-banner -c .gitleaks.toml -r r2.json --exit-code 0 >/dev/null 2>&1)
fp2="$(python3 -c "import json,sys;print(json.load(open(sys.argv[1]))[0]['Fingerprint'])" "$T2/r2.json" 2>/dev/null || true)"
if [ -n "$fp2" ]; then
  echo "$fp2" > "$T2/.gitleaksignore"
  bash "$T2/scripts/secretos-check.sh" --arbol >/dev/null 2>&1 && ok "--arbol: fingerprint sin sha se perdona" || mal "--arbol: el fingerprint sin sha debería perdonarse"
  # el MISMO contenido, ahora clonado depth=1 (SHA distinto en el checkout superficial): --arbol lo sigue
  # perdonando porque su huella nunca incluyó un sha -- esto es lo que --historia NO puede garantizar.
  clon="$T2/clon-shallow"
  git clone -q --depth 1 "file://$T2" "$clon" >/dev/null 2>&1
  cp "$T2/.gitleaksignore" "$clon/.gitleaksignore"; cp -r "$T2/scripts" "$clon/scripts"
  [ -d "$ROOT/.tools" ] && ln -sf "$ROOT/.tools" "$clon/.tools" 2>/dev/null || true
  bash "$clon/scripts/secretos-check.sh" --arbol >/dev/null 2>&1 && ok "--arbol: sobrevive a un checkout superficial (regresión #601)" \
    || mal "--arbol: un checkout superficial NO debería reintroducir el hallazgo ya perdonado"
else
  mal "no pude extraer el fingerprint sin sha del hallazgo de control (--arbol)"
fi

# 8) config rota != hallazgo. gitleaks devuelve rc=1 por las DOS causas y el script las mapeaba al
# mismo mensaje: el 2026-09-22 dos casos de un test adversarial se anunciaron «ABORTA - hallazgo»
# habiendo abortado SIN ESCANEAR NADA (MSYS_NO_PATHCONV=1 heredada -> gitleaks no cargo .gitleaks.toml).
# Fail-closed en ambos casos, pero el mensaje equivocado manda a buscar un secreto inexistente, y eso
# es lo que empuja al --no-verify, que apaga el hook entero.
T3="$(mktemp -d)"; trap 'rm -rf "$T" "$T2" "$T3"' EXIT
cd "$T3" && git init -q . && git config user.email t@t && git config user.name t
mkdir -p "$T3/scripts" && cp "$CHK" "$T3/scripts/secretos-check.sh"
[ -d "$ROOT/.tools" ] && ln -s "$ROOT/.tools" "$T3/.tools" 2>/dev/null || true
: > "$T3/.gitleaksignore"; echo "limpio" > ok.txt && git add . && git commit -qm base

# control NEGATIVO primero: con la config BUENA y el arbol limpio, rc=0. Sin esto, el rc=2 de abajo
# podria venir del fixture y no de la config rota.
cp "$ROOT/.gitleaks.toml" "$T3/.gitleaks.toml"
bash "$T3/scripts/secretos-check.sh" --arbol >/dev/null 2>&1; rc_ok=$?

printf 'esto ][ no es TOML valido
' > "$T3/.gitleaks.toml"
bash "$T3/scripts/secretos-check.sh" --arbol > "$T3/salida" 2>&1; rc_rota=$?

if [ "$rc_ok" = 0 ] && [ "$rc_rota" = 2 ] && grep -q "NUNCA CORRI" "$T3/salida"; then
  ok "config rota -> rc=2 y dice que no escaneo (no rc=1 'encontre secretos')"
else
  mal "config rota: rc_limpio=$rc_ok rc_rota=$rc_rota (esperado 0 y 2) msg=$(grep -c 'NUNCA CORRI' "$T3/salida")"
fi
cd "$T"

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
