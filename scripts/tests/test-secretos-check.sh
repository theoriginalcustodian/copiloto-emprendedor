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


# 9) la exclusión de `.claude/worktrees/` calla RUIDO, no contenido. Un allowlist de paths es un guard
# al revés: cada patrón es un lugar donde el escáner deja de mirar, así que el caso que importa no es
# "el ruido se fue" (un `.*` también lo lograría) sino "lo demás se SIGUE viendo". Por eso las dos
# aserciones van sobre el MISMO árbol y en la misma corrida.
# Raíz 2026-09-22: `--arbol` re-reportaba, con prefijo `.claude/worktrees/agent-<azar>/`, hallazgos ya
# aceptados en .gitleaksignore para su ruta canónica. Como el nombre del worktree es aleatorio por
# agente, ese ruido es INCOBRABLE: no hay fingerprint que lo cubra. Bloqueó el gate de todas las
# sesiones y empujó a una a editar .gitleaksignore a mano para destrabar su PR -- el guard desarmándose.
T4="$(mktemp -d)"; trap 'rm -rf "$T" "$T2" "$T3" "$T4"' EXIT
(cd "$T4" && git init -q . && git config user.email t@t && git config user.name t
 cp "$ROOT/.gitleaks.toml" .gitleaks.toml; : > .gitleaksignore
 echo hola > README.md && git add . && git commit -qm base)
mkdir -p "$T4/scripts" && cp "$CHK" "$T4/scripts/secretos-check.sh"
[ -d "$ROOT/.tools" ] && ln -sf "$ROOT/.tools" "$T4/.tools" 2>/dev/null || true

bash "$T4/scripts/secretos-check.sh" --arbol >/dev/null 2>&1; rc_limpio=$?
mkdir -p "$T4/.claude/worktrees/agent-a74fba7c1503928d3/docs"
echo "wt=$(printf 'ghp_''%s' 'Cx5vB7nM9qW1eR3tY5uI7oP9aS1dF3gH5jK7')" > "$T4/.claude/worktrees/agent-a74fba7c1503928d3/docs/viejo.md"
bash "$T4/scripts/secretos-check.sh" --arbol >/dev/null 2>&1; rc_wt=$?

# anti-`.*`: el MISMO secreto, fuera del patrón, tiene que seguir cazándose
mkdir -p "$T4/docs" && cp "$T4/.claude/worktrees/agent-a74fba7c1503928d3/docs/viejo.md" "$T4/docs/normal.md"
bash "$T4/scripts/secretos-check.sh" --arbol >/dev/null 2>&1; rc_normal=$?

if [ "$rc_limpio" = 0 ] && [ "$rc_wt" = 0 ] && [ "$rc_normal" = 1 ]; then
  ok "--arbol: worktrees de agente se excluyen, y el MISMO secreto fuera del patrón sigue cazándose"
else
  mal "--arbol/worktrees: limpio=$rc_limpio wt=$rc_wt normal=$rc_normal (esperado 0/0/1)"
fi

# 10) `-v` dice DÓNDE sin decir QUÉ. Sin él, gitleaks sólo informa «leaks found: N» y quien corre el
# gate no sabe qué archivo mirar -- eso fue lo que empujó a editar .gitleaksignore a ciegas. Pero el
# repo es PÚBLICO y esta salida queda en logs y recibos: si `-v` filtrara el valor, la mejora sería
# un empeoramiento neto. El control positivo (el hallazgo aparece) va primero: sin él, "0 en claro"
# lo cumple igual un escáner que no detectó nada.
salida="$(bash "$T4/scripts/secretos-check.sh" --arbol 2>&1)"
if echo "$salida" | grep -q "docs/normal.md"; then
  ok "el reporte NOMBRA el archivo del hallazgo (no sólo cuántos)"
  if echo "$salida" | grep -q "Cx5vB7nM9qW1eR3tY5uI7oP9aS1dF3gH5jK7"; then
    mal "el reporte FILTRA el secreto en claro -- repo público: --redact no está surtiendo efecto"
  else
    ok "y no filtra el valor: sale redactado"
  fi
else
  mal "el reporte no nombra el archivo del hallazgo: falta -v (o cambió el formato de gitleaks)"
fi

# ── 11) La FORMA del secreto: el eje que NINGÚN caso movía ──────────────────────────────────────
# 🔴 HALLAZGO de auditoría, 2026-10-06, y es el más caro del día porque éste es el ÚNICO guard
# fail-closed que corre en cada push y el repo es PÚBLICO. El guard cazaba `ghp_` y claves genéricas
# y NO cazaba `ANTHROPIC_API_KEY=sk-ant-api03-…`, `DATABASE_URL=postgresql://postgres:<pass>@host` ni
# `MP_ACCESS_TOKEN=APP_USR-…`. **No era «no caza X»: era «no caza X en la FORMA en que X aparece de
# verdad»** — el mismo valor SUELTO sí lo cazaba `generic-api-key`; con su prefijo real se escapaba,
# porque los guiones del prefijo y los `:/@` de un DSN rompen el match de alta-entropía contiguo.
#
# ⚠️ Y la mitad más incómoda: el agujero NO fue que faltara un test. Los 10 casos de arriba varían
# MODOS del escáner (git/arbol/historia, allowlist, fingerprint, FTL, `-v`, `--redact`) y sus 4
# controles positivos usan TODOS `ghp_`. Variaban todo salvo la única variable que decide si el
# escáner caza algo. Este caso 11 es, literalmente, «variá la forma».
#
# 🎯 POR QUÉ SE ASERTA EL `RuleID` Y NO SÓLO `rc=1`: `generic-api-key` de `useDefault` puede disparar
# sobre el mismo fixture por otra razón, y entonces el caso saldría VERDE con nuestras reglas
# AUSENTES — un falso verde en el test que acredita el fix. Pedirle el RuleID propio es lo que
# distingue «mi regla lo cazó» de «algo lo cazó».
#
# Higiene: valores SINTÉTICOS de alta entropía, nunca credenciales reales; viven sólo en un árbol
# temporal que borra el `trap`; el escáner corre con `--redact`; `.gitleaksignore` NO se toca. Los
# literales se parten en dos (`'sk-ant-''%s'`) para que el FUENTE de este test —que sí se commitea—
# no contenga el patrón contiguo y no se autodenuncie. Mismo truco que los `ghp_` de arriba.
T5="$(mktemp -d)"; trap 'rm -rf "$T" "$T2" "$T3" "$T4" "$T5"' EXIT

_arbol_virgen() {   # arbol nuevo con la config REAL del repo (si no se copia, no se mide nada nuestro)
  rm -rf "$T5"; mkdir -p "$T5/scripts"
  cp "$ROOT/.gitleaks.toml" "$T5/.gitleaks.toml"; : > "$T5/.gitleaksignore"
  cp "$CHK" "$T5/scripts/secretos-check.sh"
  [ -d "$ROOT/.tools" ] && ln -sf "$ROOT/.tools" "$T5/.tools" 2>/dev/null || true
}

# caza <titulo> <regla esperada> <contenido del fixture>
caza() {
  _arbol_virgen; printf '%s\n' "$3" > "$T5/fixture.env"
  local salida rc
  salida="$(bash "$T5/scripts/secretos-check.sh" --arbol 2>&1)"; rc=$?
  if [ "$rc" = 1 ] && printf '%s' "$salida" | grep -q "RuleID: *$2"; then
    ok "11 caza $1 -> regla $2"
  else
    mal "11 NO caza $1 (rc=$rc, regla=$(printf '%s' "$salida" | grep -o 'RuleID: *[a-z0-9-]*' | head -1))"
  fi
}

# no_caza <titulo> <contenido> -- la FRONTERA: lo que NO puede frenar un push
no_caza() {
  _arbol_virgen; printf '%s\n' "$2" > "$T5/fixture.env"
  local salida rc
  salida="$(bash "$T5/scripts/secretos-check.sh" --arbol 2>&1)"; rc=$?
  if [ "$rc" = 0 ]; then
    ok "11 FRONTERA: $1 no frena el push"
  else
    mal "11 FRONTERA ROTA: $1 dispara (rc=$rc) -- un guard que grita en el caso normal se desarma solo"
  fi
}

caza "ANTHROPIC_API_KEY con su prefijo real" uc-anthropic-api-key \
  "ANTHROPIC_API_KEY=$(printf 'sk-ant-''api03-%s' 'Kp7mQ2xR9vL4nT6bW8yZ3cF5gH1jD0sA7eU2iO4pY6kM8qS1wX3zV5nB7rT9lC2fG4hJ6dK8mP0aQ2sE4uI6oY8t')"
caza "DATABASE_URL con password literal y host REMOTO" uc-postgres-url-con-password \
  "DATABASE_URL=$(printf 'postgresql://postgres:''%s@db.ejemplo-vps.net:5432/fusion' 'xT4nR8qL2wZ6vB9cK1mJ7hG3')"
caza "MP_ACCESS_TOKEN de produccion" uc-mercadopago-access-token-prod \
  "MP_ACCESS_TOKEN=$(printf 'APP_USR''-%s' '8419273645098217-061402-a3f1c9b47e2d5086f41b9c7e35a2d618-284910375')"
caza "MP access token de TEST" uc-mercadopago-access-token-test \
  "MP_TEST_TOKEN=$(printf 'TEST''-%s' '84192736-061402-c3f1a9b47e2d5086f41b')"
caza "GRAPHITY_API_KEY" uc-graphity-api-key \
  "GRAPHITY_API_KEY=$(printf 'gphy_''%s' 'Qw8Er4Ty7Ui2Op5As')"

# La frontera de la regla del DSN, medida como blast radius ANTES de embarcarla: el repo YA contiene
# las dos formas de abajo (CI de `tests.yml`, `provision-rol-*.sh`, `docker-compose.gotrue.yml`). Si
# cualquiera de las dos disparara, el push de las TRES sesiones fallaría y el camino de menor
# resistencia sería `--no-verify` -- que apaga el gate entero, incluido el caso de arriba.
no_caza "un DSN de CI contra localhost (password del service container)" \
  "DATABASE_URL: postgresql://copiloto_app:copiloto@localhost:5432/copiloto_test"
no_caza "un DSN cuya password es una VARIABLE, no un literal" \
  'DSN="postgresql://${USUARIO_POOLER}:${CLAVE}@db.ejemplo-vps.net:5432/fusion"'

# PAR DE CONTRASTE -- la misma entropía SIN el prefijo. Es el control que vuelve atribuible el
# hallazgo: si el valor suelto se caza y el prefijado no, el escáner NO estaba ciego y la causa es la
# FORMA. Sin este par, «lo arreglé» es indistinguible de «no hice nada»: las 3 filas rojas de
# auditoría salían verdes igual. Acá se exige además que lo cace una regla AJENA a las nuestras
# (`uc-*`), que es lo que prueba que el default ya cubría el valor desnudo.
_arbol_virgen
# ⚠️ El nombre de la variable es la OTRA variable del experimento, y la primera version de este
# caso la movio sin darse cuenta: con `CLAVE_SUELTA=` el default NO disparaba, porque
# `generic-api-key` de gitleaks esta condicionado por KEYWORD (`api_key`, `token`, `secret`...), no
# solo por entropia. Un `CLAVE_` en espanol no es keyword de nadie. Variar prefijo Y nombre a la vez
# hacia el par ininterpretable: no se sabia si lo que salvaba al valor era la forma o el nombre.
# Hay que mantener el NOMBRE fijo (`ANTHROPIC_API_KEY`, que SI es keyword) y mover solo el prefijo.
printf 'ANTHROPIC_API_KEY=%s\n' 'Kp7mQ2xR9vL4nT6bW8yZ3cF5gH1jD0sA7eU2iO4pY6kM8qS1wX3zV5nB7rT9lC2fG4hJ6dK8mP0aQ2sE4uI6oY8t' > "$T5/fixture.env"
salida_suelta="$(bash "$T5/scripts/secretos-check.sh" --arbol 2>&1)"; rc_suelta=$?
reglas_suelta="$(printf '%s' "$salida_suelta" | grep -o 'RuleID: *[a-z0-9-]*' | sed 's/.* //' | sort -u | tr '\n' ' ')"
if [ "$rc_suelta" = 1 ] && [ -n "$(printf '%s' "$reglas_suelta" | tr ' ' '\n' | grep -v '^uc-' | grep -v '^$')" ]; then
  ok "11 CONTRASTE: el MISMO valor sin prefijo ya lo cazaba el default ($reglas_suelta) -- el escáner nunca estuvo ciego: el agujero era la FORMA"
else
  mal "11 CONTRASTE roto: el valor desnudo dio rc=$rc_suelta reglas='$reglas_suelta' -- si el default tampoco lo caza, lo que falla es el escáner, no la forma"
fi

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
