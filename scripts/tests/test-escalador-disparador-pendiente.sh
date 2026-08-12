#!/usr/bin/env bash
# test-escalador-disparador-pendiente.sh — la excepción "DISPARADOR: pendiente" tiene que ver el
# contrato tal como se escribe de verdad, no sólo en texto plano.
#
# Qué se ejercita (caso real del 2026-08-12): el escalador YA traía la regla —un contrato que
# declara que espera algo no escala, el control negativo del DoD— pero anclada así:
#
#   grep -qiE '^DISPARADOR:[[:space:]]*pendiente'
#
# y el contrato de lote C la declara como la escribe cualquiera en un .md:
#
#   **DISPARADOR: pendiente.** Lote B implementado/commiteado/pusheado y con gate 5/5 verde
#   ^^ el ancla ^ nunca llega a la D
#
# Resultado: la regla existía y no disparaba nunca. `vigilancia-check.sh` salía EXIT=1 cada 3
# minutos por una espera CORRECTA (backend esperaba lote B, como el contrato ordena).
#
# Por qué importa más que el ruido: ese exit code es el que esta sesión usa para decidir si hay
# parálisis. Un EXIT=1 permanente por una espera sana es indistinguible de un EXIT=1 por parálisis
# real — la alarma que suena siempre no informa, entrena a saltearla. Misma familia que #400
# (watchdog acusando contratos recién nacidos), #403 (el lint acusándose a sí mismo) y D9.
#
# No es una feature nueva: es una regla existente que no veía el formato real de su propio dato.
#
#   1. CONTROL POSITIVO — contrato viejo SIN la marca          → escala (la regla 1 sigue viva)
#   2. EL BUG           — marca en negrita markdown            → silencio
#   3. NO-REGRESIÓN     — marca en texto plano (lo que ya iba) → silencio
#   4. FAIL-OPEN        — "DISPARADOR: cumplido" en negrita    → escala
#
# El caso 1 es lo que impide que el fix se convierta en "apagar la regla 1". El caso 4 es su
# gemelo por el otro lado: un regex relajado de más (que matchee "DISPARADOR" y no le exija
# "pendiente") silenciaría un contrato que declara su disparador CUMPLIDO — exactamente el que SÍ
# tiene que escalar. Sin el 4, "tolerar markdown" puede degenerar en "no escalar nunca".
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ESCALADOR="$REPO_ROOT/scripts/escaladores-buzon.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

BUZON="$TMP/buzon"
mkdir -p "$BUZON/abierto" "$BUZON/en-curso" "$BUZON/cerrado"

CONTRATO="$BUZON/abierto/2026-08-12_contrato_planificacion-a-backend_lote-C-los-P1.md"

# UMBRAL_CONTRATO_MIN=0 => cualquier edad supera el umbral. El test mide la regla del DISPARADOR,
# no la del umbral de edad (ésa ya la cubre la ventana de gracia de #400) — así no depende de
# `touch -d` ni del reloj, y falla por un solo motivo.
correr() {
  out="$(UMBRAL_CONTRATO_MIN=0 BUZON_DIR="$BUZON" bash "$ESCALADOR" --dry-run 2>&1)"
  rc=$?
}

# Escribe el contrato con la línea de disparador tal cual se pasa (o sin ninguna).
contrato_con() {
  { echo "# Contrato lote C"
    echo
    [ -n "$1" ] && echo "$1"
    echo
    echo "Los P1 de las auditorias, en orden."
  } > "$CONTRATO"
}

echo "── 1. CONTROL POSITIVO: contrato viejo SIN marca de disparador SÍ escala ──"
contrato_con ""
correr
if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -q "CONTRATO SIN TOMAR"; then
  ok "la regla 1 sigue escalando lo que corresponde (el fix no la apagó)"
else
  fail "dejó de escalar un contrato sin tomar; exit $rc. Salida: $out"
fi

echo "── 2. EL BUG: la marca en negrita markdown (formato real del contrato) ──"
contrato_con '**DISPARADOR: pendiente.** Lote B implementado/commiteado/pusheado y con gate 5/5 verde'
correr
if printf '%s' "$out" | grep -q "CONTRATO SIN TOMAR"; then
  fail "escaló un contrato que declara su disparador pendiente en negrita. Salida: $out"
else
  ok "la excepción ve la marca aunque venga con marcado markdown"
fi

echo "── 3. NO-REGRESIÓN: la marca en texto plano sigue silenciando ──"
contrato_con 'DISPARADOR: pendiente'
correr
if printf '%s' "$out" | grep -q "CONTRATO SIN TOMAR"; then
  fail "el fix rompió el formato que YA funcionaba (texto plano). Salida: $out"
else
  ok "el formato original sigue valiendo"
fi

echo "── 4. FAIL-OPEN: 'DISPARADOR: cumplido' en negrita TIENE que escalar ──"
contrato_con '**DISPARADOR: cumplido.** Lote B ya mergeado, arrancá'
correr
if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -q "CONTRATO SIN TOMAR"; then
  ok "un disparador cumplido no se silencia por tener la palabra DISPARADOR"
else
  fail "silenció un contrato con disparador CUMPLIDO: el regex matchea de más; exit $rc. Salida: $out"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-escalador-disparador-pendiente: 4/4"
  exit 0
fi
echo "❌ test-escalador-disparador-pendiente: $fallos fallo(s)"
exit 1
