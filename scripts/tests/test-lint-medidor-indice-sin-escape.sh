#!/usr/bin/env bash
# El medidor del índice está cableado en `scripts/ci/lint.sh` para que ABORTE el gate. Este test no
# re-mide el índice (eso lo hace el medidor, y hoy demostró su control positivo: exit 1 con 5
# huérfanas, exit 0 al indexarlas). Lo que protege es el CABLEADO, que es lo que se rompe por
# descuido: `lint.sh` es exactamente el archivo donde alguien agrega `|| true` para desbloquear un
# merge urgente, y un gate desarmado así no da ningún síntoma — sale verde.
#
# Clase: `un-mecanismo-roto-hacia-el-no-no-da-sintoma` + `el-guard-que-grita-en-el-caso-normal-se-
# desarma-solo`. El control positivo del propio test está horneado (caso 3).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LINT="$ROOT/scripts/ci/lint.sh"
fallos=0
ok()   { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; fallos=$((fallos+1)); }

echo "── Caso 1: lint.sh invoca el medidor"
if grep -q 'medir-indice-memoria\.py' "$LINT"; then
  ok "el medidor está cableado en lint.sh"
else
  fail "lint.sh NO invoca medir-indice-memoria.py: el índice quedó sin gate"
fi

echo "── Caso 2: la invocación NO tiene escape"
# `|| true`, `|| :`, `|| echo`, un `-` inicial o un `set +e` en la misma línea desarman el abort sin
# borrar la línea, así que `grep -q` del caso 1 seguiría dando verde.
linea="$(grep -n 'medir-indice-memoria\.py' "$LINT" | grep -v '^\s*#' | grep -v ' *#.*medir-indice' || true)"
if [ -z "$linea" ]; then
  fail "no encontré una invocación no comentada del medidor"
elif echo "$linea" | grep -Eq '\|\||set \+e|^\s*-|continue-on-error'; then
  fail "la invocación del medidor tiene un escape y NO aborta: $linea"
else
  ok "la invocación aborta el gate (sin ||, sin set +e)"
fi

echo "── Caso 3: CONTROL POSITIVO del test — un escape fabricado TIENE que romperlo"
# Sin esto, los casos 1 y 2 podrían estar mirando un patrón que nunca matchea y saldrían verdes para
# siempre. Se fabrica la línea desarmada y se exige que el predicado del caso 2 la rechace.
FAKE="$(mktemp)"
printf 'python3 "$ROOT/scripts/medir-indice-memoria.py" || true\n' > "$FAKE"
l2="$(grep -n 'medir-indice-memoria\.py' "$FAKE")"
if echo "$l2" | grep -Eq '\|\||set \+e|^\s*-|continue-on-error'; then
  ok "el predicado del caso 2 SÍ caza un escape fabricado"
else
  fail "el predicado del caso 2 no caza '|| true': el caso 2 es decorativo"
fi
rm -f "$FAKE"

echo "── Caso 4: el medidor corre ANTES de las suites de coordinación"
# 🔻 2026-10-06: el ancla era `for t in`, el bucle literal dentro de `lint.sh`. El bucle se MUDÓ a
# `scripts/ci/tests-coordinacion.sh` (fila `LINTDENOM`: adentro de lint.sh su caso interesante —el
# glob sin match, que salía VERDE con cero tests— era inalcanzable sin copiar el script a otro
# árbol). El INVARIANTE que este caso protege no cambió: el rojo del índice no se mezcla con el de
# las suites. Lo que cambió es dónde está la invocación, así que se ancla en el nombre del script.
# ⚠️ Y si NINGUNA de las dos anclas aparece, esto FALLA: un ancla que dejó de existir vuelve el
# `-n` falso y la comparación nunca se hace — un control que no encuentra su sujeto no aprueba,
# acusa. Fue exactamente así como este test cazó la mudanza en vez de aprobarla en silencio.
n_med="$(grep -n 'medir-indice-memoria\.py' "$LINT" | head -1 | cut -d: -f1)"
n_buc="$(grep -nE 'tests-coordinacion\.sh|for t in' "$LINT" | head -1 | cut -d: -f1)"
if [ -n "$n_med" ] && [ -n "$n_buc" ] && [ "$n_med" -lt "$n_buc" ]; then
  ok "el rojo del índice no se mezcla con el de las suites ($n_med < $n_buc)"
else
  fail "el medidor quedó después de las suites, o no encontré una de las dos anclas (medidor=$n_med suites=$n_buc)"
fi

echo
if [ "$fallos" = "0" ]; then
  echo "✅ TODO VERDE — el medidor del índice aborta el gate, y el predicado que lo verifica tiene control"
  exit 0
fi
echo "❌ $fallos fallo(s)"
exit 1
