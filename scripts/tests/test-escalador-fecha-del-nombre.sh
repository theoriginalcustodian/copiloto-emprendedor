#!/usr/bin/env bash
# test-escalador-fecha-del-nombre.sh — la fecha del nombre es una DECLARACIÓN, no una medición.
#
# Caso real, medido por auditoría el 2026-09-30 00:0x: un `pedido_` de **tres minutos de vida**
# reportando `999999min`, porque lo nombró `2026-09-29_` — al cruzar la medianoche la jornada mental
# sigue siendo la de ayer. `edad_alta_min` daba la fecha del nombre por PISO («un archivo de un día
# anterior ya es viejo, sin importar mtime ni sidecar») y ese supuesto es falso justo ahí. Las cuatro
# sesiones venían fechando 29 toda la jornada, así que no era un borde: era todo lo que cualquiera
# escribiera en las horas siguientes, y cada uno nacía por encima de todo umbral generando su
# `urgente_`.
#
# El fix no quita el piso —eso haría MENTIR HACIA ABAJO, el modo que no se nota— sino que lo
# reemplaza por el dato que discrimina los dos casos: el NACIMIENTO del archivo (`stat -c %W`),
# inmune a las ediciones posteriores.
#
#   1. MEDIANOCHE      — nombre de ayer, nacido recién       → NO escala (y avisa que renombre)
#   2. VIEJO DE VERDAD — nombre de ayer, mtime de hace días  → SÍ escala (no perdí la protección)
#   3. HOY NORMAL      — nombre de hoy, recién nacido        → NO escala (no-regresión)
#   4. GLOB DESALINEADO— el nombre generado no lo alcanza su propio patrón de retiro → GRITA
#   5. GLOB ALINEADO   — control negativo del 4: sin override, nunca grita
#   6. REGLA 2 DICE LA ACCIÓN — el output nombra «MOVER … a cerrado/», una sola vez
#   7. SIN PEDIDOS     — no imprime la instrucción cuando no hay nada que apagar
#
# El caso 2 es el que impide que este fix se vuelva un apagador silencioso, y el 5 es el control
# negativo del 4: un guard que sólo se probó en su caso de disparo no sabe si grita de más.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ESCALADOR="${ESCALADOR_BAJO_PRUEBA:-$REPO_ROOT/scripts/escaladores-buzon.sh}"
[ -f "$ESCALADOR" ] || { echo "❌ no existe $ESCALADOR"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

HOY="$(date +%Y-%m-%d)"
AYER="$(date -d '1 day ago' +%Y-%m-%d 2>/dev/null || echo '2026-01-01')"
BUZON="$TMP/buzon"
limpiar() { rm -rf "$BUZON"; mkdir -p "$BUZON/abierto" "$BUZON/en-curso" "$BUZON/cerrado" "$BUZON/.escalador-estado"; }

# UMBRAL_PEDIDO_MIN=30 por defecto en el script; lo fijo para no depender de él.
correr() { out="$(UMBRAL_PEDIDO_MIN=30 UMBRAL_CONTRATO_MIN=0 BUZON_DIR="$BUZON" bash "$ESCALADOR" 2>&1)"; rc=$?; }

echo "── Caso 1: MEDIANOCHE — nombre de AYER, archivo nacido hace segundos"
limpiar
echo "# pedido recien escrito" > "$BUZON/abierto/${AYER}_pedido_auditoria-a-planificacion_algo.md"
correr
if echo "$out" | grep -q "PEDIDO SIN RESPUESTA"; then
  fail "escaló un pedido_ de segundos de vida: la fecha del nombre le gana a la medición"
  echo "$out" | grep "PEDIDO SIN" | sed 's/^/      /'
elif echo "$out" | grep -q "FECHA MAL ESCRITA"; then
  ok "no escaló, y avisó que el nombre está mal fechado con la acción concreta"
else
  fail "no escaló pero tampoco avisó: el dato de control queda mal escrito y nadie lo sabe"
fi

echo "── Caso 2: VIEJO DE VERDAD — nombre de ayer y mtime de hace 3 días ⇒ SÍ escala"
limpiar
F2="$BUZON/abierto/${AYER}_pedido_auditoria-a-planificacion_viejo.md"
echo "# pedido viejo" > "$F2"
touch -d '3 days ago' "$F2" 2>/dev/null || touch -t 202601010000 "$F2"
correr
if echo "$out" | grep -q "PEDIDO SIN RESPUESTA.*viejo"; then
  ok "escaló: quitar el piso por fecha NO apagó el caso que el piso protegía"
else
  fail "NO escaló un pedido_ realmente viejo — el fix mintió HACIA ABAJO, el modo que no se nota"
  echo "$out" | sed 's/^/      /' | head -6
fi

echo "── Caso 3: HOY NORMAL — nombre de hoy, recién nacido ⇒ no escala ni avisa (no-regresión)"
limpiar
echo "# pedido de hoy" > "$BUZON/abierto/${HOY}_pedido_auditoria-a-planificacion_hoy.md"
correr
if echo "$out" | grep -q "PEDIDO SIN RESPUESTA"; then
  fail "escaló un pedido_ de hoy recién escrito"
elif echo "$out" | grep -q "FECHA MAL ESCRITA"; then
  fail "avisó de fecha mal escrita sobre un nombre CORRECTO: el aviso grita en el caso normal"
else
  ok "silencio, que es lo correcto"
fi

echo "── Caso 4: GLOB DESALINEADO — lo que genero no lo alcanza mi patrón de retiro ⇒ GRITA"
limpiar
echo "# contrato" > "$BUZON/abierto/${AYER}_contrato_planificacion-a-backend_algo.md"
out="$(UMBRAL_CONTRATO_MIN=0 BUZON_DIR="$BUZON" URGENTE_ST_GLOB_INFIJO="_urgente_OTRA-FORMA-a-" bash "$ESCALADOR" 2>&1)"; rc=$?
if echo "$out" | grep -q "INSTRUMENTO ROTO"; then
  ok "gritó: el día que el nombre cambie, el retiro roto se ve en vez de callarse"
else
  fail "CALLÓ con el patrón desalineado — ese silencio es el urgente_ inmortal de vuelta (#740)"
  echo "$out" | sed 's/^/      /' | head -6
fi

echo "── Caso 5: GLOB ALINEADO — control negativo del 4: sin override NO grita"
limpiar
echo "# contrato" > "$BUZON/abierto/${AYER}_contrato_planificacion-a-backend_algo.md"
correr
if echo "$out" | grep -q "INSTRUMENTO ROTO"; then
  fail "gritó en el caso NORMAL: un guard que grita siempre se desarma solo"
  echo "$out" | sed 's/^/      /' | head -6
else
  ok "silencio con el patrón coherente (el caso 4 no pasa por la razón equivocada)"
fi

echo "── Caso 6: REGLA 2 DICE LA ACCIÓN — y una sola vez con dos pedidos"
limpiar
for i in 1 2; do
  F="$BUZON/abierto/${HOY}_pedido_auditoria-a-planificacion_p${i}.md"
  echo "# p$i" > "$F"; touch -d '3 days ago' "$F" 2>/dev/null || touch -t 202601010000 "$F"
done
correr
veces="$(echo "$out" | grep -c "lo que APAGA estas alarmas es MOVER")"
escalados="$(echo "$out" | grep -c "PEDIDO SIN RESPUESTA")"
if [ "$escalados" != "2" ]; then
  fail "esperaba 2 pedidos escalados y hubo $escalados: el caso no está ejercitando la Regla 2"
elif [ "$veces" = "1" ]; then
  ok "nombra la acción que la apaga, una sola vez para los dos"
elif [ "$veces" = "0" ]; then
  fail "no dice qué la apaga: los dos respondimos sin mover porque nadie sabía que mover era el acto"
else
  fail "repitió la instrucción $veces veces — ruido que entrena a saltear el bloque"
fi

echo "── Caso 7: SIN PEDIDOS — no imprime la instrucción"
limpiar; correr
if echo "$out" | grep -q "lo que APAGA estas alarmas"; then
  fail "imprimió la instrucción sin ningún pedido escalado"
else
  ok "no dice nada cuando no hay nada que apagar"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ TODO VERDE — la fecha del nombre volvió a ser una declaración, y la medición es del archivo"
  exit 0
fi
echo "❌ $fallos fallo(s)"
exit 1
