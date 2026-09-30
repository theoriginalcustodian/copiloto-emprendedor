#!/usr/bin/env bash
# Tests de `scripts/a-todos-sin-cierre.sh` — el reportador de `a-todos` sin cerrador declarado.
#
# ## El caso 2 es el que este test existe para que no vuelva
#
# La primera corrida real del script salió **rc=1 sin una sola línea de salida**: con 0 cerrables,
# `grep` sale 1 y `pipefail` mataba el script — o sea justo en el **caso NORMAL** (hoy el corpus real
# tiene 0 cerrables de 6). Y el control positivo horneado **pasó igual**, porque su fixture SÍ tiene
# un cerrable: cubrió la mitad que yo sospechaba y la otra quedó muda. Por eso acá el caso vacío es un
# caso de primera clase y no una nota al pie.
#
# ## El caso 7 es el que hace que el `exit 2` valga algo
#
# Un `exit 2` que nunca se ejercita es indistinguible de uno que no funciona. El caso 7 copia el
# script a un directorio con una **lib CIEGA** al lado (el mismo truco del canario del alfabeto:
# inyectar un lector ciego, no un dato raro) y exige `exit 2`. Sin eso, el día que el parseo de
# nombres se rompa el script diría «0 sin cierre» y sonaría a buena noticia.
set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/scripts/a-todos-sin-cierre.sh"
[ -x "$SCRIPT" ] || { echo "FALLA: no existe o no es ejecutable $SCRIPT"; exit 1; }

fallos=0
check() { # check <descripcion> <esperado> <obtenido>
  if [ "$2" = "$3" ]; then echo "  ok   $1"
  else echo "  FALLA $1 -- esperaba [$2], obtuve [$3]"; fallos=$((fallos + 1)); fi
}

nuevo_buzon() { local d; d="$(mktemp -d)"; mkdir -p "$d/abierto" "$d/en-curso" "$d/cerrado/2000-01-01"; printf '%s' "$d"; }
A_TODOS="2000-01-01_hallazgo_planificacion-a-todos_sujeto-de-prueba.md"

echo "== 1. buzon inexistente -> exit 2 (NO PUDE MEDIR), no exit 0"
BUZON_DIR=/ruta/que/no/existe bash "$SCRIPT" --quiet >/dev/null 2>&1
check "rc" "2" "$?"

echo "== 2. buzon SIN ningun a-todos -> exit 0 y reporta 0 (el caso que mataba al script)"
bz="$(nuevo_buzon)"
: > "$bz/abierto/2000-01-01_dato_backend-a-planificacion_cualquiera.md"
out="$(BUZON_DIR="$bz" bash "$SCRIPT" --quiet 2>&1)"; rc=$?
check "rc" "0" "$rc"
check "dice 0 sin cierre" "si" "$(printf '%s' "$out" | grep -q '0 sin cierre declarado' && echo si || echo no)"
check "dice que examino 1" "si" "$(printf '%s' "$out" | grep -q 'de 1 archivos examinados' && echo si || echo no)"
rm -rf "$bz"

echo "== 3. un a-todos sin CIERRA: -> SIN CIERRE"
bz="$(nuevo_buzon)"; : > "$bz/abierto/$A_TODOS"
out="$(BUZON_DIR="$bz" bash "$SCRIPT" 2>&1)"; rc=$?
check "rc" "0" "$rc"
check "1 sin cierre" "si" "$(printf '%s' "$out" | grep -qE '0 cerrables .+ 1 sin cierre declarado' && echo si || echo no)"
rm -rf "$bz"

echo "== 4. un a-todos CON CIERRA: en un cierre_ -> CERRABLE"
bz="$(nuevo_buzon)"; : > "$bz/abierto/$A_TODOS"
printf '**CIERRA:** `%s`\n' "$A_TODOS" > "$bz/cerrado/2000-01-01/2000-01-01_cierre_x-a-planificacion_z.md"
out="$(BUZON_DIR="$bz" bash "$SCRIPT" 2>&1)"; rc=$?
check "rc" "0" "$rc"
check "1 cerrable" "si" "$(printf '%s' "$out" | grep -qE '1 cerrables .+ 0 sin cierre declarado' && echo si || echo no)"
rm -rf "$bz"

echo "== 5. el CIERRA: en un dato_ (no en un cierre_) NO cuenta"
bz="$(nuevo_buzon)"; : > "$bz/abierto/$A_TODOS"
printf '**CIERRA:** `%s`\n' "$A_TODOS" > "$bz/abierto/2000-01-01_dato_x-a-planificacion_z.md"
out="$(BUZON_DIR="$bz" bash "$SCRIPT" --quiet 2>&1)"
check "sigue sin cierre" "si" "$(printf '%s' "$out" | grep -q '0 cerrables' && echo si || echo no)"
rm -rf "$bz"

echo "== 6. el CIERRA: escrito en el PROPIO a-todos NO se autocierra"
bz="$(nuevo_buzon)"
printf '**CIERRA:** `%s`\n' "$A_TODOS" > "$bz/abierto/$A_TODOS"
out="$(BUZON_DIR="$bz" bash "$SCRIPT" --quiet 2>&1)"
check "no se satisface con su propio cuerpo" "si" "$(printf '%s' "$out" | grep -q '0 cerrables' && echo si || echo no)"
rm -rf "$bz"

echo "== 7. LECTOR CIEGO -> exit 2, no un '0 sin cierre' tranquilizador"
sandbox="$(mktemp -d)"; mkdir -p "$sandbox/scripts/lib"
cp "$SCRIPT" "$sandbox/scripts/"
# lib ciega: misma API, siempre devuelve vacio. Es el equivalente del monkeypatch del canario.
cat > "$sandbox/scripts/lib/buzon-roles.sh" <<'LIBCIEGA'
BUZON_ROL_RE='[a-z0-9-]+'
destinatario_de_nombre() { printf ''; }
emisor_de_nombre() { printf ''; }
LIBCIEGA
bz="$(nuevo_buzon)"; : > "$bz/abierto/$A_TODOS"
BUZON_DIR="$bz" bash "$sandbox/scripts/a-todos-sin-cierre.sh" --quiet >/dev/null 2>&1
check "rc con lector ciego" "2" "$?"
rm -rf "$sandbox" "$bz"

echo "== 8. el corpus REAL corre y no mueve nada"
antes="$(bash "$SCRIPT" --quiet 2>&1)"; rc=$?
check "rc sobre el buzon real" "0" "$rc"
despues="$(bash "$SCRIPT" --quiet 2>&1)"
check "idempotente (dos corridas, misma cuenta)" "$antes" "$despues"

echo
if [ "$fallos" -eq 0 ]; then echo "TODOS OK (8 casos)"; exit 0
else echo "$fallos FALLA(S)"; exit 1; fi
