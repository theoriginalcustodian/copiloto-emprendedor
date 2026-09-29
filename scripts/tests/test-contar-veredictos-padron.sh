#!/usr/bin/env bash
# test-contar-veredictos-padron.sh — el padrón de ids TIENE que participar de la cuenta.
#
# EL DEFECTO (medido 2026-09-29): `medir(txt, ids, armas)` recibía el padrón y no lo usaba en
# ninguna línea de su cuerpo. Con el padrón VACÍO el resultado era idéntico byte a byte — 21 sujetos
# y 26 hits en el lote A, con 54 ids, con 27 y con 0. O sea que ningún `id` se validaba contra nada:
# un typo del documento (`facutra`) entraba como sujeto legítimo, y la cifra que ese script existe
# para dar —«N de 54»— no se computaba en ninguna parte.
#
# Lo que lo dejó vivir es lo que este test cierra: `universo_de_sujetos()` tenía su propio control
# (`CONTROL DEL UNIVERSO FALLA` si extraía <15 ids) protegiendo un valor que NADIE consumía. Un
# control sobre un dato inerte da verde con toda razón y no significa nada. Y el canario de 5 brazos
# probaba las FORMAS del parser: el padrón era un sexto brazo sin canario.
#
# Por qué este test es EXTERNO y no otro control horneado: el contador ya tenía tres controles
# adentro y ninguno pudo ver esto, porque todos miran hacia adentro del parser. Además el canario
# nuevo vive DENTRO del script, así que sin este archivo sólo correría cuando alguien lo ejecute a
# mano — `ci/lint.sh:33` levanta `scripts/tests/test-*.sh` por glob, así que acá sí lo corre el gate.
#
#   1. CONTROL POSITIVO: el contador corre limpio y da la cifra «de los 54»
#   2. el universo es 54 (la spec), no 27 (la matriz) — C3-13
#   3. la cobertura reporta los 28 ciegos y `plan` como retirado — C3-13 / C3-14
#   4. CANARIO DEL CANARIO: si el padrón se vuelve inerte otra vez, el script FALLA
#   5. CONTROL NEGATIVO del ratchet: un ciego nuevo tiene que romper el gate
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTADOR="$REPO_ROOT/scripts/evidencia/contar-veredictos.py"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

PY="$(command -v python || command -v python3)"
if [ -z "$PY" ]; then
  echo "  ⏭️  sin python en el PATH — salteado (no es un verde: es una medición que no se hizo)"
  exit 0
fi

# El contador lee el buzón real, que NO está versionado: en un clon sin `coordinacion/` aborta con 2
# por diseño («un 0 acá sería del instrumento, no del dato»). Eso no es un fallo de este test.
if ! "$PY" "$CONTADOR" --json > "$TMP/base.json" 2> "$TMP/base.err"; then
  if grep -qE "ABORTA: no encontré \['lote" "$TMP/base.err"; then
    echo "  ⏭️  sin coordinacion/ en este checkout — salteado (el contador aborta por diseño)"
    exit 0
  fi
  fail "el contador no corre: $(head -3 "$TMP/base.err" | tr '\n' ' ')"
  echo "❌ 1 fallo(s)"; exit 1
fi

echo "── Caso 1: CONTROL POSITIVO — corre y da la cifra «de los 54»"
# Accessor por RUTA (`a.b.c`), no `eval`: las expresiones serían literales de este mismo archivo,
# pero dejar un `eval` sobre argv en un repo público es un patrón que alguien copia a un contexto
# donde el argumento sí viene de afuera. El sufijo `#len` pide la longitud y `#join` une una lista.
leer() { "$PY" -c "
import json, sys
ruta, pedido = sys.argv[2], ''
if '#' in ruta:
    ruta, pedido = ruta.split('#', 1)
v = json.load(open(sys.argv[1], encoding='utf-8'))
for k in ruta.split('.'):
    v = v[k]
print(len(v) if pedido == 'len' else ','.join(v) if pedido == 'join' else v)
" "$1" "$2" 2>/dev/null; }

n_a="$(leer "$TMP/base.json" "lotes.lote_A.ids_del_criterio_con_veredicto")"
n_b="$(leer "$TMP/base.json" "lotes.lote_B.ids_del_criterio_con_veredicto")"
if [ -n "$n_a" ] && [ "$n_a" -gt 0 ] 2>/dev/null && [ "$n_b" -gt 0 ] 2>/dev/null; then
  ok "la cifra del criterio existe y es >0 en los dos lotes (A=$n_a · B=$n_b de 54)"
else
  fail "no hay cifra «de los 54»: A='$n_a' B='$n_b'"
fi

echo "── Caso 2: el universo sale de la SPEC (54), no de la matriz (27)"
univ="$(leer "$TMP/base.json" "cobertura_del_instrumento.ids_del_criterio")"
[ "$univ" = "54" ] \
  && ok "universo = 54 ids, los del criterio" \
  || fail "universo = '$univ' (esperaba 54): volvió a salir del instrumento y no de la spec"

echo "── Caso 3: la cobertura reporta los ciegos y los retirados"
ciegos="$(leer "$TMP/base.json" "cobertura_del_instrumento.ciegos#len")"
capta="$(leer "$TMP/base.json" "cobertura_del_instrumento.ids_que_la_matriz_captura")"
if [ "$ciegos" -gt 0 ] 2>/dev/null && [ "$(( ciegos + capta ))" = "54" ]; then
  ok "la aritmética de cobertura cierra: $capta capturados + $ciegos ciegos = 54"
else
  fail "la cobertura no cierra: $capta + $ciegos ≠ 54"
fi
retir="$(leer "$TMP/base.json" "cobertura_del_instrumento.retirados_de_la_spec_que_la_matriz_conserva#join")"
[ "$retir" = "plan" ] \
  && ok "reporta \`plan\` como retirado de la spec (C3-14: el diff es bidireccional)" \
  || fail "los retirados son '$retir' (esperaba 'plan')"

# Para los casos 4 y 5 hay que correr una copia PARCHEADA del contador, y no alcanza con copiarla a
# `$TMP`: el script resuelve sus rutas con `RAIZ = Path(__file__).resolve().parents[2]`, así que una
# copia suelta busca la spec en un árbol que no existe y aborta antes de llegar al canario. El primer
# intento falló así, y el fail-closed del propio contador fue lo que lo dijo con precisión en vez de
# devolver un 0 — «no encontré <la spec>» y no «0 ids». Por eso se le arma el árbol mínimo que
# `parents[2]` espera; el buzón lo sigue tomando de su ruta absoluta, que no depende de RAIZ.
FAKE="$TMP/arbol"
mkdir -p "$FAKE/docs/copiloto-emprendedor" "$FAKE/scripts/evidencia"
cp "$REPO_ROOT/docs/copiloto-emprendedor/2026-09-22-BL-P5-pantallas-del-prototipo-spec-vision-propuesta.md"    "$FAKE/docs/copiloto-emprendedor/" 2>/dev/null
cp "$REPO_ROOT/scripts/evidencia/criterio3-matriz.mjs" "$FAKE/scripts/evidencia/" 2>/dev/null
# CONTROL DEL PROPIO FIXTURE: la copia sin parchear TIENE que correr verde acá. Sin esto, un rojo de
# los casos 4/5 sería indistinguible de un árbol mal armado — que es exactamente lo que ya pasó.
cp "$CONTADOR" "$FAKE/scripts/evidencia/base.py"
if "$PY" "$FAKE/scripts/evidencia/base.py" --json > /dev/null 2> "$TMP/fixture.err"; then
  ok "el árbol mínimo del fixture sirve (la copia sin parchear corre verde)"
else
  fail "el fixture no sirve, los casos 4 y 5 no prueban nada: $(head -2 "$TMP/fixture.err" | tr '
' ' ')"
fi

echo "── Caso 4: CANARIO DEL CANARIO — si el padrón vuelve a ser inerte, el script falla"
# Se rompe el padrón del MISMO modo que estaba roto: se ignora `ids` en el cruce. Si el script sigue
# saliendo 0, su canario no vale nada. Sin este caso, el canario del contador es una promesa.
cp "$CONTADOR" "$FAKE/scripts/evidencia/inerte.py"
"$PY" - "$FAKE/scripts/evidencia/inerte.py" <<'PYEOF'
import io, sys
p = sys.argv[1]
t = io.open(p, encoding="utf-8").read()
# el cruce con el padrón, neutralizado: la métrica deja de depender de `ids`
# Se neutraliza el cruce DENTRO de `ids_del_criterio()`, que es el camino que usan tanto el reporte
# como el canario. Parchear sólo la línea del reporte no alcanzaba: el canario cruzaba por su cuenta
# y seguía viendo bajar la cifra — así se descubrió que el canario no ejercitaba el camino real.
a = 'return sorted({c.split("·")[0] for c in con} & set(ids))'
assert a in t, "el test no encontró el cruce con el padrón: cambió de forma, actualizá el test"
t = t.replace(a, 'return sorted({c.split("·")[0] for c in con})', 1)
io.open(p, "w", encoding="utf-8", newline="\n").write(t)
PYEOF
if [ "$?" != "0" ]; then
  fail "no pude fabricar la versión inerte (el ancla cambió): el canario queda sin control positivo"
elif "$PY" "$FAKE/scripts/evidencia/inerte.py" --json > /dev/null 2> "$TMP/inerte.err"; then
  fail "el canario NO caza el padrón inerte: la versión sin cruce salió VERDE"
else
  if grep -q "CANARIO DEL PADRON FALLA" "$TMP/inerte.err"; then
    ok "con el padrón inerte el script falla, y por el motivo correcto"
  else
    fail "falló por otra razón: $(head -2 "$TMP/inerte.err" | tr '\n' ' ')"
  fi
fi

echo "── Caso 5: CONTROL NEGATIVO del ratchet — un ciego nuevo rompe el gate"
# Se le saca un id al ratchet declarado: el gate tiene que verlo como regresión de cobertura. Es lo
# que prueba que CIEGOS_DECLARADOS es un piso vivo y no una lista decorativa.
cp "$CONTADOR" "$FAKE/scripts/evidencia/ratchet.py"
"$PY" - "$FAKE/scripts/evidencia/ratchet.py" <<'PYEOF'
import io, re, sys
p = sys.argv[1]
t = io.open(p, encoding="utf-8").read()
m = re.search(r'CIEGOS_DECLARADOS = \{(.*?)\}', t, re.S)
assert m, "no encontré CIEGOS_DECLARADOS"
cuerpo = m.group(1)
# le saco el primero de la lista: ahora es un ciego NO declarado
nuevo = re.sub(r'"[a-z0-9()-]+",\s*', '', cuerpo, count=1)
t = t.replace(m.group(0), 'CIEGOS_DECLARADOS = {' + nuevo + '}', 1)
io.open(p, "w", encoding="utf-8", newline="\n").write(t)
PYEOF
if "$PY" "$FAKE/scripts/evidencia/ratchet.py" --json > /dev/null 2> "$TMP/ratchet.err"; then
  fail "el ratchet NO es un piso: quitarle un ciego declarado salió verde"
else
  if grep -q "COBERTURA: REGRESIÓN" "$TMP/ratchet.err"; then
    ok "un ciego fuera del ratchet rompe el gate (el piso está vivo)"
  else
    fail "rompió por otra razón: $(head -2 "$TMP/ratchet.err" | tr '\n' ' ')"
  fi
fi

echo
if [ "$fallos" = "0" ]; then
  echo "✅ TODO VERDE — el padrón participa de la cuenta y su canario tiene control positivo"
  exit 0
fi
echo "❌ $fallos fallo(s)"
exit 1
