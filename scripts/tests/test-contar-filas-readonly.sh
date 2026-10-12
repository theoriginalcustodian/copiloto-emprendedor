#!/usr/bin/env bash
# Control POSITIVO del guard read-only de `scripts/evidencia/contar-filas-prod.sh`.
#
# Por qué existe: un mecanismo roto hacia el «no» no da síntoma. El guard de ese script podría estar
# desarmado (un grep mal escrito, un `-E` perdido) y nadie lo notaría, porque en el uso normal el SQL
# nunca contiene verbos de escritura: el camino feliz sale verde con el guard presente o ausente.
# Esto inyecta el caso hostil a propósito y exige que CORTE.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ORIGINAL="$RAIZ/scripts/evidencia/contar-filas-prod.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { echo "  ✅ $1"; }
malo() { echo "  ❌ $1"; fallos=$((fallos+1)); }

echo "== 1. el camino normal pasa (si esto falla, el resto no significa nada) =="
if bash "$ORIGINAL" --dry-run >/dev/null 2>&1; then
  ok "--dry-run sale 0"
else
  malo "--dry-run NO sale 0: el script está roto, el control no puede concluir nada"
fi

echo "== 2. CONTROL POSITIVO: con un verbo de escritura inyectado, tiene que cortar con exit 3 =="
# Se inyecta en la lista de tablas, que es la única superficie de cambio legítima: simula
# exactamente la edición futura descuidada contra la que el guard protege. Va por python y no por
# sed/heredoc a propósito: un escape que pasa por una capa extra llega como byte invisible, y eso ya
# se pagó hoy (un `\b` que llegó al disco como \x08 y dejó un gate rojo contra un texto correcto).
python -I - "$ORIGINAL" "$TMP/inyectado.sh" <<'PY'
import io, sys
orig, dest = sys.argv[1], sys.argv[2]
s = io.open(orig, encoding='utf-8').read()
ancla = '  "gastos'
assert ancla in s, 'el ancla de inyeccion no existe: el test quedo rancio respecto del script'
s = s.replace(ancla, '  "hostil | copiloto_cobros | 1=1; delete from copiloto_cobros --"\n' + ancla, 1)
io.open(dest, 'w', encoding='utf-8', newline='\n').write(s)
PY

if [ ! -s "$TMP/inyectado.sh" ]; then
  malo "no pude construir el mutante: el control queda INVÁLIDO, no verde"
else
  set +e
  salida="$(bash "$TMP/inyectado.sh" --dry-run 2>&1)"
  codigo=$?
  set -e
  if [ "$codigo" = "3" ]; then
    ok "el guard disparó (exit 3)"
  else
    malo "el guard NO disparó: exit=$codigo. El SQL hostil habría salido. Salida: ${salida:0:200}"
  fi
fi

echo "== 3. argumentos libres rechazados (exit 2) =="
set +e
bash "$ORIGINAL" --lo-que-sea >/dev/null 2>&1
codigo=$?
set -e
[ "$codigo" = "2" ] && ok "argumento desconocido ⇒ exit 2" || malo "argumento desconocido dio exit=$codigo"

echo
if [ "$fallos" = "0" ]; then
  echo "VERDE: 3/3 — y el control positivo se ejercitó, no se asumió."
  exit 0
fi
echo "ROJO: $fallos control(es) fallaron."
exit 1
