#!/usr/bin/env bash
# test-medidor-avisa-en-el-borde.sh — un presupuesto al 100% con exit 0 es un guard que falla
# abierto justo en su caso de activación.
#
# Caso real: el 2026-09-30 `memoria/MEMORY.md` llegó a **24000 / 24000 chars EXACTOS** y el medidor
# dijo `[OK ]`. Correcto por definición (la condición es `<=`) e inútil en el único momento en que
# hacía falta: la próxima línea que agregara cualquiera se truncaba, y el truncamiento se lleva la
# cola del índice **en silencio** — el defecto que ya costó duplicados
# (`memoria/el-indice-truncado-fabrica-duplicados.md`).
#
# El criterio de FALLA no cambia. Lo que cambia es que el borde se vea ANTES de cruzarlo.
#
#   1. BORDE CHARS   — índice al 100% del presupuesto     → avisa, exit 0, y dice la ACCIÓN
#   2. HOLGADO       — índice chico                       → no avisa (no grita en el caso normal)
#   3. PASADO        — índice por encima                  → FALLA y exit 1 (no-regresión)
#   4. BORDE LÍNEAS  — muchas líneas cortas, chars verdes → avisa por la OTRA dimensión
#
# El caso 2 impide que el aviso se vuelva ruido permanente, y el 4 existe porque el corte del
# 2026-09-22 fue por LÍNEAS con los chars en verde: avisar sólo de chars deja intacto el modo que
# ya dio síntoma.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MEDIDOR="${MEDIDOR_BAJO_PRUEBA:-$REPO_ROOT/scripts/medir-indice-memoria.py}"
PY="${PYTHON:-python}"
[ -f "$MEDIDOR" ] || { echo "❌ no existe $MEDIDOR"; exit 1; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

# TODA captura de salida de python en Git Bash pasa por acá. El CR del CRLF se pega al valor y rompe
# la aritmética de bash con un «invalid arithmetic operator» cuyo token de error sale VACÍO, así que
# el mensaje no nombra la causa. Mordió dos veces en este mismo archivo antes de centralizarlo.
sin_cr() { tr -d '\r'; }
chars_de()  { "$PY" -c "import io,sys; print(len(io.open(sys.argv[1],encoding='utf-8').read()))" "$1" | sin_cr; }
# chars y líneas del índice fabricado. Los límites de cada caso se DERIVAN de esta medición y no se
# suponen: el relleno de `armar` no cae en un número exacto, y un fixture aproximado hace que el
# caso «al 100%» caiga en realidad al 101% y mida otra cosa. Primer intento de este test: los casos
# 1 y 4 fallaban por eso, no por el medidor — el fixture mentía, no el sujeto.
medir() { "$PY" -c "import io,sys; s=io.open(sys.argv[1],encoding='utf-8').read(); print(len(s), s.count(chr(10))+1)" "$1/memoria/MEMORY.md" | sin_cr; }

# El medidor deduce su raíz del `__file__` (`parents[1]`), así que se lo copia a un árbol con una
# `memoria/` fabricada. Ese mecanismo es el que hizo abortar a auditoría tres veces al correrlo
# desde el scratchpad (`memoria/el-instrumento-respondio-sobre-otro-sujeto.md`); acá se usa a favor.
armar() {   # armar <chars_objetivo> <n_lineas_de_relleno>
  local dir="$TMP/caso"; rm -rf "$dir"; mkdir -p "$dir/scripts" "$dir/memoria"
  cp "$MEDIDOR" "$dir/scripts/medir-indice-memoria.py"
  # 12 tópicos reales + su índice, para que el control positivo interno del medidor (>= 10
  # referencias parseadas) pase. Con menos, el medidor se declara roto y el caso no mide nada.
  local i idx="# Indice"
  for i in $(seq 1 12); do
    printf -- '---\nname: t%s\ndescription: entrada de prueba numero %s distinta de las demas\nmetadata:\n  type: reference\n---\n\ncuerpo %s\n' "$i" "$i" "$i" > "$dir/memoria/t$i.md"
    idx="$idx
- [T$i](t$i.md) - gancho $i"
  done
  printf '%s\n' "$idx" > "$dir/memoria/MEMORY.md"
  local actual objetivo="$1" nl="$2" falta por_linea
  actual="$(chars_de "$dir/memoria/MEMORY.md")"
  falta=$(( objetivo - actual )); [ "$falta" -lt 1 ] && falta=1
  por_linea=$(( falta / nl )); [ "$por_linea" -lt 1 ] && por_linea=1
  # El relleno lleva `r$i` para que las líneas salgan DISTINTAS entre sí. No es cosmética: el
  # medidor trata las líneas duplicadas exactas como defecto y aborta (control 0, PR #771), así que
  # un relleno idéntico repetido hacía fallar este caso por el FIXTURE, no por el sujeto — el mismo
  # modo de falla que la cabecera de este archivo ya documenta para el 100%. El tamaño no se mueve:
  # el presupuesto se mide del archivo YA escrito (`medir`), no de una constante.
  for i in $(seq 1 "$nl"); do
    printf -- '- [T1](t1.md) - r%s %s\n' "$i" "$(printf 'x%.0s' $(seq 1 $por_linea))" >> "$dir/memoria/MEMORY.md"
  done
  echo "$dir"
}

correr() { out="$("$PY" "$1/scripts/medir-indice-memoria.py" --presupuesto "$2" --max-lineas "$3" 2>&1)"; rc=$?; }

echo "── Caso 1: BORDE CHARS — al 100% del presupuesto ⇒ avisa y exit 0"
d="$(armar 3000 5)"; read -r C L < <(medir "$d"); correr "$d" "$C" $((L + 100))
if [ "$rc" != "0" ]; then
  fail "exit $rc: el aviso no puede cambiar el criterio de falla (todavía entra completo)"
  echo "$out" | head -4 | sed 's/^/      /'
elif ! echo "$out" | grep -q "presupuesto: $C / $C"; then
  fail "el fixture no quedó al 100%: el caso no está midiendo el borde"
  echo "$out" | head -2 | sed 's/^/      /'
elif echo "$out" | grep -q "⚠️.*presupuesto"; then
  if echo "$out" | grep -q "ACCIÓN"; then ok "avisa con exit 0 y nombra la acción concreta"
  else fail "avisa pero no dice qué hacer: «estás cerca» no le sirve a nadie"; fi
else
  fail "dijo OK con el presupuesto AGOTADO — la próxima línea se trunca en silencio"
  echo "$out" | head -3 | sed 's/^/      /'
fi

echo "── Caso 2: HOLGADO — índice chico ⇒ NO avisa (control negativo del 1)"
d="$(armar 800 5)"; read -r C L < <(medir "$d"); correr "$d" $((C * 4)) $((L + 100))
if echo "$out" | grep -q "⚠️.*presupuesto"; then
  fail "avisó con 25% de uso: un guard que grita en el caso normal se desarma solo"
  echo "$out" | head -3 | sed 's/^/      /'
else
  ok "silencio con margen de sobra"
fi

echo "── Caso 3: PASADO — por encima del presupuesto ⇒ FALLA (no-regresión)"
d="$(armar 4000 5)"; read -r C L < <(medir "$d"); correr "$d" $((C - 100)) $((L + 100))
if [ "$rc" = "1" ] && echo "$out" | grep -q "FALLA"; then
  ok "sigue fallando cuando se pasa de verdad"
elif echo "$out" | grep -q "UnicodeEncodeError"; then
  # Dos causas distintas producian el MISMO exit 1 y el mensaje elegia una. Contra el medidor de
  # `origin/main` este caso muere por encoding —la linea `FALLA: el indice...` lleva tilde y la
  # consola de Windows es cp1252—, no porque el criterio de rechazo se haya movido. Sin esta rama
  # el test acusaba al aviso de algo que no hizo, y el diagnostico habria mandado a mirar el lugar
  # equivocado.
  fail "murio por UnicodeEncodeError antes de imprimir el veredicto: es el bug de encoding (falta"
  echo "      el reconfigure de stdout), NO el criterio de rechazo. El exit 1 es de la excepcion." | sed 's/^/ /'
else
  fail "exit $rc sin FALLA: el aviso se comió el criterio de rechazo"
  echo "$out" | head -4 | sed 's/^/      /'
fi

echo "── Caso 4: BORDE LÍNEAS — chars en verde y líneas al tope ⇒ avisa por la otra dimensión"
d="$(armar 1500 40)"; read -r C L < <(medir "$d"); correr "$d" $((C * 10)) "$L"
if echo "$out" | grep -q "⚠️.*líneas"; then
  ok "avisa por líneas con los chars holgados (el corte del 22/09 fue por acá)"
else
  fail "no avisó por líneas: queda intacto el modo que YA dio síntoma el 2026-09-22"
  echo "$out" | grep -i "líneas\|presupuesto" | sed 's/^/      /'
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ TODO VERDE — el borde se ve antes de cruzarlo, y el criterio de falla no se movió"
  exit 0
fi
echo "❌ $fallos fallo(s)"
exit 1
