#!/usr/bin/env bash
# test-escalador-glob-por-tipo.sh — el escalador debe barrer por TIPO de mensaje, no por substring.
#
# Qué se ejercita (medido en el buzón REAL el 2026-08-12): el escalador autogenera sus alertas
# embebiendo el nombre del contrato huérfano dentro del suyo:
#
#   2026-08-12_urgente_vigilancia-a-backend_contrato-sin-tomar-2026-08-12_contrato_planificacion-a-backend_lote-C….md
#   ^^^^^^^^^^ tipo real: urgente                                          ^^^^^^^^^ substring que engaña al glob
#
# Con `for f in "$ABIERTO"/*_contrato_*.md` esa alerta entraba al barrido de la Regla 1 como si
# fuera un contrato sin tomar. Consecuencia peor que el falso positivo: pasado el umbral, la Regla 1
# GENERA un urgente_ por cada match — o sea, una alerta sobre su propia alerta, cuyo nombre embebe
# el anterior. Cascada autogenerada con nombres cada vez más largos (y en Windows, camino directo
# al MAX_PATH de 260).
#
# Es el mismo defecto que #403 arregló en scripts/lint-contratos-referencias.sh, en el otro
# instrumento del mismo par. Encontrarlo acá fue consecuencia de correr el escalador contra el
# buzón real después del fix del disparador, no de suponerlo: el dry-run lo mostró.
#
# La convención del buzón define el tipo por POSICIÓN: <fecha>_<tipo>_<de>-a-<para>_<slug>.md
#
#   1. CONTROL POSITIVO — contrato_ real y viejo               → escala (la Regla 1 sigue viva)
#   2. EL BUG           — urgente_ con "contrato_" en el slug  → silencio
#   3. NO CASCADA       — sólo el urgente_ en el buzón         → no genera NINGÚN archivo nuevo
#
# El caso 1 impide que el fix degenere en "un glob que no matchea nada": sin él, anclar mal pasaría
# el 2 y el 3 en verde con el escalador ciego.
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

# Nombre EXACTO que produce la Regla 1 — no una aproximación.
ALERTA="2026-08-12_urgente_vigilancia-a-backend_contrato-sin-tomar-2026-08-12_contrato_planificacion-a-backend_lote-C-los-P1.md"
CONTRATO="2026-08-12_contrato_planificacion-a-backend_lote-C-los-P1.md"

cuerpo() { printf '# %s\n\nCuerpo sin marca de disparador, para que la Regla 1 lo considere cumplido.\n' "$1"; }

# UMBRAL_CONTRATO_MIN=0 => la edad nunca es el motivo por el que un caso pasa o falla.
correr() {
  out="$(UMBRAL_CONTRATO_MIN=0 BUZON_DIR="$BUZON" bash "$ESCALADOR" "$@" 2>&1)"
  rc=$?
}

echo "── 1. CONTROL POSITIVO: un contrato_ real y viejo SÍ escala ──"
cuerpo "contrato de verdad" > "$BUZON/abierto/$CONTRATO"
correr --dry-run
if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -q "CONTRATO SIN TOMAR: \?.*$CONTRATO\|CONTRATO SIN TOMAR (.*): $CONTRATO"; then
  ok "la Regla 1 sigue viendo los contratos reales (el ancla no la dejó ciega)"
else
  fail "dejó de escalar un contrato real; exit $rc. Salida: $out"
fi
rm -f "$BUZON/abierto/$CONTRATO"

echo "── 2. EL BUG: la alerta autogenerada no es un contrato ──"
cuerpo "alerta del escalador" > "$BUZON/abierto/$ALERTA"
correr --dry-run
if printf '%s' "$out" | grep -q "CONTRATO SIN TOMAR"; then
  fail "trató su propia alerta como contrato: su tipo es 'urgente'. Salida: $out"
else
  ok "no confunde el tipo con un substring del slug"
fi

echo "── 3. NO CASCADA: con la alerta sola, no nace ningún archivo nuevo ──"
# Sin --dry-run: acá se mide el efecto de verdad, que es la escritura.
antes="$(find "$BUZON/abierto" -maxdepth 1 -name '*.md' | wc -l)"
correr
despues="$(find "$BUZON/abierto" -maxdepth 1 -name '*.md' | wc -l)"
if [ "$antes" -eq "$despues" ]; then
  ok "abierto/ quedó en $despues archivo(s): no se autogeneró una alerta sobre la alerta"
else
  fail "cascada: abierto/ pasó de $antes a $despues. Nuevos: $(find "$BUZON/abierto" -maxdepth 1 -name '*.md' -newer "$BUZON/abierto/$ALERTA" -printf '%f\n')"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-escalador-glob-por-tipo: 3/3"
  exit 0
fi
echo "❌ test-escalador-glob-por-tipo: $fallos fallo(s)"
exit 1
