#!/usr/bin/env bash
# test-escalador-edad-por-fecha.sh — el atajo por fecha del nombre en `edad_alta_min`.
#
# CAUSA RAÍZ (medida 2026-08-12 22:41 local): el atajo comparaba `fecha_archivo != fecha_hoy` para
# decidir «esto es de un día anterior, es viejo». Pero las sesiones nombran los archivos con la
# fecha UTC y `date` corre en local: a las 22:41 -0300 los archivos nuevos se llaman `2026-08-13` y
# el script cree que es `2026-08-12`. Resultado: los 13 archivos de HOY reportaban `999999min` y
# escalaban en el instante de nacer. La alarma pasó a sonar en todos los ciclos.
#
# Un escalador que alarma siempre no es un escalador estricto: es uno APAGADO, porque el próximo
# pedido realmente abandonado se lee igual que los otros trece.
#
# El caso 1 (POSITIVO) va primero a propósito: si el escalador no alarma ni con un pedido de ayer,
# entonces los negativos pasan por ausencia y no prueban nada — la falla que este repo ya pagó dos
# veces en un día (`memoria/el-instrumento-respondio-sobre-otro-sujeto.md`).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ESCALADOR="$REPO_ROOT/scripts/escaladores-buzon.sh"

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

echo "test-escalador-edad-por-fecha"

BUZON="$(mktemp -d)"
trap 'rm -rf "$BUZON"' EXIT
mkdir -p "$BUZON/abierto" "$BUZON/en-curso" "$BUZON/cerrado"

ayer="$(date -d 'yesterday' +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d)"
hoy="$(date +%Y-%m-%d)"
manana="$(date -d 'tomorrow' +%Y-%m-%d 2>/dev/null || date -v+1d +%Y-%m-%d)"

nuevo() { printf 'contenido de prueba\n' > "$BUZON/abierto/$1"; }
nuevo "${ayer}_pedido_frontend-a-backend_de-ayer-sin-responder.md"
nuevo "${hoy}_pedido_frontend-a-backend_de-hoy-recien-creado.md"
nuevo "${manana}_pedido_frontend-a-backend_fecha-utc-adelantada.md"

# --dry-run: no escribe `urgente_` en el buzón de prueba. El reporte va igual a stdout.
salida="$(bash "$ESCALADOR" --dry-run "$BUZON" 2>&1)"

# ── 1. POSITIVO — sin esto, los dos negativos son verde-por-ausencia ──────────────────────────
if printf '%s' "$salida" | grep -q "de-ayer-sin-responder"; then
  ok "1 POSITIVO · un pedido_ de AYER escala (el escalador está viendo el buzón)"
else
  fail "1 POSITIVO · no escaló ni el de ayer; los negativos de abajo no probarían nada. salida=<$salida>"
fi

# ── 2. NEGATIVO — el bug real: fecha del futuro tratada como «día anterior» ───────────────────
if printf '%s' "$salida" | grep -q "fecha-utc-adelantada"; then
  fail "2 NEGATIVO · un pedido_ con fecha FUTURA escaló — es el bug de \`!=\` en vez de \`<\`: a las 22:41 local los archivos nombrados en UTC son 'de otro día' y reportan 999999min"
else
  ok "2 NEGATIVO · una fecha futura (UTC adelantada) NO se toma por vieja"
fi

# ── 3. NEGATIVO — el de hoy recién creado tampoco ─────────────────────────────────────────────
if printf '%s' "$salida" | grep -q "de-hoy-recien-creado"; then
  fail "3 NEGATIVO · un pedido_ creado recién escaló; la edad debe salir del sidecar, no de la fecha"
else
  ok "3 NEGATIVO · un pedido_ de hoy recién creado no escala"
fi

# ── 4. El 999999 no debe aparecer para nada nacido hoy o después ──────────────────────────────
# Chequea el SÍNTOMA además de la clasificación: el número absurdo es lo que se ve en el reporte
# del cron, y es lo que hizo sospechar del instrumento en primer lugar.
if printf '%s' "$salida" | grep -q "fecha-utc-adelantada.*999999\|999999.*fecha-utc-adelantada"; then
  fail "4 NEGATIVO · el reporte muestra 999999min para un archivo del futuro"
else
  ok "4 NEGATIVO · ningún 999999 sobre archivos de hoy/futuro"
fi

# ── 5. POSITIVO — la edad YA ACUMULADA no se pierde al arreglar el atajo ──────────────────────
# Al cambiar `!=` por `<`, los archivos que antes salían por el atajo pasan al sidecar. Si el primer
# avistamiento asumiera `now`, un pedido_ de 40 min reales reportaría 0: el escalador dejaría de
# mentir hacia arriba para mentir hacia abajo, que es peor porque nadie lo nota. El piso es el mtime.
viejo_hoy="${hoy}_pedido_frontend-a-backend_de-hoy-pero-con-40-minutos.md"
nuevo "$viejo_hoy"
touch -d '40 minutes ago' "$BUZON/abierto/$viejo_hoy" 2>/dev/null \
  || touch -t "$(date -v-40M +%Y%m%d%H%M 2>/dev/null)" "$BUZON/abierto/$viejo_hoy" 2>/dev/null
rm -rf "$BUZON/.escalador-estado"   # primer avistamiento de todos
salida5="$(bash "$ESCALADOR" --dry-run "$BUZON" 2>&1)"
if printf '%s' "$salida5" | grep -q "de-hoy-pero-con-40-minutos"; then
  ok "5 POSITIVO · un pedido_ de hoy con 40 min de mtime escala (la edad previa no se pierde)"
else
  fail "5 POSITIVO · no escaló un pedido_ de 40 min reales — el primer avistamiento está asumiendo \`now\` en vez del mtime. salida=<$salida5>"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-escalador-edad-por-fecha: todo verde"
  exit 0
fi
echo "❌ test-escalador-edad-por-fecha: $fallos fallo(s)"
exit 1
