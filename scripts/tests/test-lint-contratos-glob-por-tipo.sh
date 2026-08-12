#!/usr/bin/env bash
# test-lint-contratos-glob-por-tipo.sh — el lint debe mirar el TIPO del mensaje, no un substring.
#
# Qué se ejercita (caso real del 2026-08-12): el escalador de buzón genera sus propias alertas con
# el nombre del contrato huérfano EMBEBIDO en el suyo:
#
#   2026-08-12_urgente_vigilancia-a-backend_contrato-sin-tomar-2026-08-12_contrato_planificacion-a-backend_lote-B….md
#   ^^^^^^^^^^ tipo real: urgente                                  ^^^^^^^^^ substring que engaña al glob
#
# El glob era `-name '*contrato_*'`, que matchea por SUBSTRING, así que el lint trataba esas alertas
# como contratos y las marcaba «PROSA PURA» — una alerta autogenerada nunca va a traer un bloque
# cercado, con lo cual la violación era permanente e inarreglable. Dos líneas de ruido fijo en cada
# corrida de `vigilancia-check.sh`.
#
# Por qué importa más que el ruido: el instrumento se acusaba A SÍ MISMO, y una alarma que suena
# siempre enseña a saltear la lista entera — incluida la violación real que aparezca mañana. Es la
# misma familia que el falso positivo del watchdog (#400) y que el flake del `mobile` (D9).
#
# La convención del buzón define el tipo por POSICIÓN, no por presencia:
#   <fecha>_<tipo>_<de>-a-<para>_<slug>.md
# por eso el fix ancla el glob a `????-??-??_contrato_*` en vez de buscar la palabra donde caiga.
#
#   1. CONTROL POSITIVO — contrato_ real sin artefacto            → alarma (el lint sigue vivo)
#   2. EL BUG           — urgente_ con "contrato_" en el slug     → silencio
#   3. CONTROL NEGATIVO — contrato_ real CON bloque cercado       → silencio
#
# El caso 1 es lo que impide que el fix se convierta en "apagar el lint": sin él, un glob que no
# matchea NADA pasaría el caso 2 en verde y nadie se enteraría de que el lint dejó de mirar.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LINT="$REPO_ROOT/scripts/lint-contratos-referencias.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

BUZON="$TMP/buzon"
mkdir -p "$BUZON/abierto" "$BUZON/en-curso"

# Prosa pura deliberada: ni bloque cercado ni path a artefacto.
prosa() { printf '# %s\n\nTexto sin shape ni ejemplo. Sólo describe.\n' "$1" > "$2"; }

out=""; rc=0
correr() {
  BUZON_DIR="$BUZON" bash "$LINT" --quiet > "$TMP/salida.txt" 2>&1
  rc=$?
  out="$(cat "$TMP/salida.txt")"
}

echo "── 1. CONTROL POSITIVO: un contrato_ real sin artefacto SÍ se marca ──"
prosa "contrato de verdad" "$BUZON/abierto/2026-08-12_contrato_planificacion-a-backend_lote-B-higiene.md"
correr
if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -q "PROSA PURA: 2026-08-12_contrato_planificacion-a-backend_lote-B-higiene.md"; then
  ok "el lint sigue mirando los contratos reales (el fix no lo apagó)"
else
  fail "el lint dejó de ver un contrato prosa-pura; exit $rc. Salida: $out"
fi
rm -f "$BUZON/abierto/2026-08-12_contrato_planificacion-a-backend_lote-B-higiene.md"

echo "── 2. EL BUG: alerta autogenerada con 'contrato_' embebido en el slug ──"
# Nombre EXACTO que produce scripts/escaladores-buzon.sh — no una aproximación.
alerta="2026-08-12_urgente_vigilancia-a-backend_contrato-sin-tomar-2026-08-12_contrato_planificacion-a-backend_lote-B-higiene-despues-de-C4-1.md"
prosa "alerta del escalador" "$BUZON/abierto/$alerta"
correr
if printf '%s' "$out" | grep -q "PROSA PURA"; then
  fail "acusó a un urgente_ autogenerado: su tipo es 'urgente', no 'contrato'. Salida: $out"
else
  ok "no confunde el tipo con un substring del slug"
fi

echo "── 3. CONTROL NEGATIVO: contrato_ real CON bloque cercado → silencio ──"
rm -f "$BUZON/abierto/$alerta"   # que este caso mida SÓLO el contrato con shape, no arrastre el 2
printf '# contrato\n\n```json\n{\n  "campo": "valor",\n  "otro": 1\n}\n```\n' \
  > "$BUZON/abierto/2026-08-12_contrato_planificacion-a-frontend_con-shape.md"
correr
if printf '%s' "$out" | grep -q "PROSA PURA"; then
  fail "FALSO POSITIVO sobre un contrato que sí trae artefacto. Salida: $out"
else
  ok "un contrato con shape no se marca"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-lint-contratos-glob-por-tipo: 3/3"
  exit 0
fi
echo "❌ test-lint-contratos-glob-por-tipo: $fallos fallo(s)"
exit 1
