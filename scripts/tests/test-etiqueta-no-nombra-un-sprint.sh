#!/usr/bin/env bash
# test-etiqueta-no-nombra-un-sprint.sh — la cifra del criterio NO puede rotularse con un sprint.
#
# EL DEFECTO (medido 2026-10-13, lo destapó una pregunta del operador): `contar-veredictos.py`
# imprimía dos etiquetas que nombraban un sprint —`web … <- la que se cita este sprint` y
# `mobile … (sprint siguiente, con device/EAS)`— escritas cuando la orden del 2026-09-22 difirió
# mobile. **Ese sprint cerró el 2026-10-08 (DEC-14)**, así que «sprint siguiente» pasó a ser EL
# ACTUAL y la etiqueta siguió diciendo lo contrario. El 2026-10-13 el operador preguntó cuánto había
# avanzado el sprint MOBILE y se le contestó con la cifra de web más un «mobile va al sprint
# siguiente», citando esta salida como si fuera vigente.
#
# POR QUÉ NO DIO SÍNTOMA: una etiqueta que dice «este sprint» o «siguiente» no tiene vencimiento.
# No hay fecha que la contradiga, el instrumento sigue en rc=0 y la cifra que acompaña es CORRECTA —
# lo que envejece es el rótulo, que es justo lo que el lector copia junto al número.
# → memoria `un-umbral-calibrado-al-corpus-del-dia-envejece-con-el`.
#
# POR QUÉ ESTE GUARD MIDE LA SALIDA Y NO EL FUENTE: los comentarios del propio instrumento
# CONTIENEN las frases prohibidas —explican esta historia— así que un grep al `.py` daría falso
# rojo, y un falso rojo en el caso normal enseña a saltear el gate
# (→ `el-guard-que-grita-en-el-caso-normal-se-desarma-solo`). Lo que el defecto produjo fue una
# LÍNEA IMPRESA: eso es lo que se mide.
#
#   1. CONTROL POSITIVO del fixture: el contador corre rc=0 (si no, nada de abajo prueba algo)
#   2. la salida NO dice «este sprint»
#   3. la salida NO dice «sprint siguiente»
#   4. CONTROL DE CEGUERA: la etiqueta anclada SÍ está (si no, el guard mira una línea que no existe)
#   5. CONTROL DEL FIXTURE: la copia SIN parchear corre verde en el árbol mínimo
#   6. MUTANTE: reinyectada la frase en la etiqueta impresa, el guard la CAZA
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTADOR="$REPO_ROOT/scripts/evidencia/contar-veredictos.py"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ASERCIONES_ESPERADAS=6
oks=0
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; oks=$((oks + 1)); }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

PY="$(command -v python || command -v python3)"
if [ -z "$PY" ]; then
  echo "  ⏭️  sin python en el PATH — salteado (no es un verde: es una medición que no se hizo)"
  exit 0
fi

# El corpus es un FIXTURE, nunca el buzón vivo: `coordinacion/` no está versionado y en CI no
# existe, así que medir contra él haría que el gate dependa de quién emitió último (LINTALCANCE).
CORPUS="$("$PY" "$REPO_ROOT/scripts/evidencia/fabricar-corpus-fixture.py" "$TMP" 2> "$TMP/fx.err")"
if [ -z "$CORPUS" ] || [ ! -d "$CORPUS" ]; then
  fail "no pude fabricar el corpus fixture: $(head -3 "$TMP/fx.err")"
  echo "❌ 1 fallo(s)"; exit 1
fi
export COPILOTO_COORD="$CORPUS"

# El patrón se define UNA vez y lo usan el caso real y el mutante: si divergieran, el mutante
# estaría ejercitando un guard distinto del que corre en el gate.
PROHIBIDO='este sprint|sprint siguiente'

# ── 1 · CONTROL POSITIVO ─────────────────────────────────────────────────────────────────────
"$PY" "$CONTADOR" > "$TMP/salida.txt" 2> "$TMP/salida.err"; rc=$?
if [ "$rc" -eq 0 ]; then
  ok "el contador corre contra el fixture (rc=0)"
else
  fail "el contador no corre (rc=$rc): $(head -3 "$TMP/salida.err")"
fi

# ── 2 y 3 · la salida no rotula con un sprint ────────────────────────────────────────────────
for frase in 'este sprint' 'sprint siguiente'; do
  if grep -qF "$frase" "$TMP/salida.txt"; then
    fail "la salida dice «$frase»: $(grep -m1 -F "$frase" "$TMP/salida.txt" | cut -c1-90)"
  else
    ok "la salida no dice «$frase»"
  fi
done

# ── 4 · CONTROL DE CEGUERA ───────────────────────────────────────────────────────────────────
# Sin esto, borrar la línea de mobile entera pondría los casos 2 y 3 en verde: «no dice la frase»
# también se cumple si no dice nada. El guard tiene que probar que MIRÓ la etiqueta.
if grep -qF 'pendiente de device/EAS' "$TMP/salida.txt"; then
  ok "la etiqueta anclada de mobile está impresa (el guard mira una línea que existe)"
else
  fail "no encontré «pendiente de device/EAS»: los casos 2 y 3 pasarían por ausencia, no por fix"
fi

# ── 5 · MUTANTE ──────────────────────────────────────────────────────────────────────────────
# Se muta una COPIA en $TMP, nunca el archivo del repo: un script que muta y revierte al final deja
# el mutante vivo si muere en el medio (→ `un-script-que-muta-produccion-y-revierte-al-final…`).
# No alcanza con copiar el contador a `$TMP`: resuelve sus rutas con
# `RAIZ = Path(__file__).resolve().parents[2]`, así que una copia suelta busca la spec en un árbol
# que no existe y **aborta antes de imprimir una sola línea** — el mutante entonces "no se caza" por
# no haber corrido, no por un guard ciego. Pasó en el primer intento de este archivo, y lo dijo el
# fail-closed del contador («no encontré <la spec>»), no un 0 silencioso.
FAKE="$TMP/arbol"
mkdir -p "$FAKE/docs/copiloto-emprendedor" "$FAKE/scripts/evidencia"
cp "$REPO_ROOT/docs/copiloto-emprendedor/2026-09-22-BL-P5-pantallas-del-prototipo-spec-vision-propuesta.md"    "$FAKE/docs/copiloto-emprendedor/" 2>/dev/null
cp "$REPO_ROOT/scripts/evidencia/criterio3-matriz.mjs" "$FAKE/scripts/evidencia/" 2>/dev/null

# CONTROL DEL PROPIO FIXTURE: la copia sin parchear TIENE que imprimir la etiqueta acá. Sin esto, un
# rojo del mutante sería indistinguible de un árbol mal armado.
cp "$CONTADOR" "$FAKE/scripts/evidencia/base.py"
if "$PY" "$FAKE/scripts/evidencia/base.py" > "$TMP/fake.txt" 2> "$TMP/fake.err"    && grep -qF 'pendiente de device/EAS' "$TMP/fake.txt"; then
  ok "el árbol mínimo sirve (la copia sin parchear imprime la etiqueta): el mutante es atribuible"
else
  fail "el árbol mínimo no sirve, el mutante no prueba nada: $(head -2 "$TMP/fake.err" | tr '
' ' ' | cut -c1-140)"
fi

cp "$CONTADOR" "$FAKE/scripts/evidencia/mutante.py"
"$PY" - "$FAKE/scripts/evidencia/mutante.py" <<'PYEOF'
import io, os, sys
p = sys.argv[1]
src = io.open(p, encoding="utf-8").read()
ancla = '(pendiente de device/EAS)'
if src.count(ancla) != 1:
    sys.exit("ANCLA DEL MUTANTE: %d hits de %r" % (src.count(ancla), ancla))
tmp = p + ".tmp"
io.open(tmp, "w", encoding="utf-8", newline="").write(
    src.replace(ancla, '(sprint siguiente, con device/EAS)'))
os.replace(tmp, p)
PYEOF
if [ $? -ne 0 ]; then
  fail "no pude fabricar el mutante: el caso 5 no prueba nada"
else
  "$PY" "$FAKE/scripts/evidencia/mutante.py" > "$TMP/mut.txt" 2> "$TMP/mut.err"
  if grep -qE "$PROHIBIDO" "$TMP/mut.txt"; then
    ok "MUTANTE cazado: con la frase reinyectada el guard la ve (el verde no es por inercia)"
  else
    # Un mutante que no se caza tiene DOS causas y el mensaje tiene que separarlas: el guard no
    # distingue, o el mutante nunca llegó a imprimir nada (→ `dos-causas-distintas-comparten-el-
    # codigo-de-salida-y-el-mensaje-elige-una`). Sin esto, un mutante que muere al arrancar se lee
    # como «el guard está roto».
    if [ ! -s "$TMP/mut.txt" ]; then
      fail "MUTANTE NO IMPRIMIO NADA (stdout vacío) — no ejercita el guard. stderr: $(head -2 "$TMP/mut.err" | tr '
' ' ' | cut -c1-160)"
    else
      fail "MUTANTE NO cazado: el guard no distingue — el verde de los casos 2 y 3 no significa nada"
    fi
  fi
fi

# ── Cierre CONTADO ───────────────────────────────────────────────────────────────────────────
# El veredicto cuenta los dos lados. Un `echo "5/5"` literal absuelve a un bloque que nunca corrió
# (→ memoria `instrumento-que-no-mira-nunca-falla`).
corridas=$((oks + fallos))
if [ "$corridas" -ne "$ASERCIONES_ESPERADAS" ]; then
  printf '❌ corrieron %d de %d aserciones: el veredicto no cubre todo el archivo\n' \
    "$corridas" "$ASERCIONES_ESPERADAS"
  exit 1
fi
if [ "$fallos" -ne 0 ]; then
  printf '❌ %d de %d fallada(s)\n' "$fallos" "$corridas"; exit 1
fi
printf '✅ %d/%d\n' "$oks" "$corridas"
