#!/usr/bin/env bash
# test-vigilancia-mail-fresco-propia-sesion.sh — MAIL FRESCO no puede alarmar con lo que YO escribí.
#
# Qué se ejercita (caso real del 2026-08-13, sesión frontend, modo autónomo): el bloque "MAIL
# FRESCO" de vigilancia-check.sh es un gate COMPARTIDO por las 4 sesiones (los 4 monitoreo-*.md lo
# invocan idéntico: `bash scripts/vigilancia-check.sh --quiet`, sin distinguir quién lo corre), pero
# su filtro de "no avisarme de lo que yo mismo escribí" venía hardcodeado a `_planificacion-a-*`
# (fix del 2026-08-06 para ESA sesión únicamente). Cualquier otra sesión que publicara su propio
# `-a-todos_` (p.ej. un `avance_` de cierre) se autoalarmaba en su ciclo siguiente durante la
# ventana de 5min — reproducido en vivo 3 ciclos seguidos por frontend contra su propio avance_.
#
# El fix parametriza `SESION_ACTUAL` (default "planificacion", preserva el comportamiento histórico
# para invocaciones que no la seteen). Estos casos cubren: (1) el default sigue protegiendo a
# planificación exactamente igual que antes — no regresión; (2) una sesión NO-planificación con
# `SESION_ACTUAL` seteado deja de autoalarmarse con lo propio — el fix; (3) esa misma sesión SÍ ve
# lo ajeno (broadcast de otra sesión, y ahora también correo dirigido específicamente a ella) — el
# fix no apaga la señal real, sólo el eco.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VIGILANCIA="$REPO_ROOT/scripts/vigilancia-check.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

# Buzón de prueba SIN PLAN.md: el chequeo de COLA se saltea solo (límite ya documentado en el
# encabezado de vigilancia-check.sh) y el resto de los ganchos corre igual.
nuevo_buzon() {
  local d="$TMP/buzon-$1"
  rm -rf "$d"; mkdir -p "$d/abierto" "$d/en-curso" "$d/cerrado"
  printf '%s' "$d"
}

hace() { date -d "-$1 minutes" '+%Y-%m-%d %H:%M:%S'; }

# Bloque cercado con ≥3 líneas: sin esto el lint de contratos ("PROSA PURA") alarma sobre el propio
# fixture y el script sale 1 por un motivo ajeno al que se está probando (mismo helper que usa
# test-vigilancia-rol-ausente.sh).
msg() {  # msg <ruta> <minutos-de-antiguedad>
  printf '# fixture\n\n```json\n{\n  "fixture": true,\n  "por_que": "que el lint no alarme sobre el propio test"\n}\n```\n\n/ejecutar-con-eficiencia\n' > "$1"
  touch -d "$(hace "$2")" "$1"
}

out=""; rc=0
correr() {  # correr <buzon> [SESION_ACTUAL]
  local buzon="$1" sesion="${2:-}"
  if [ -n "$sesion" ]; then
    SESION_ACTUAL="$sesion" BUZON_DIR="$buzon" TRANSCRIPTS_DIR="$TMP/transcripts-vacio" \
      bash "$VIGILANCIA" --dry-run > "$TMP/salida.txt" 2>&1
  else
    BUZON_DIR="$buzon" TRANSCRIPTS_DIR="$TMP/transcripts-vacio" \
      bash "$VIGILANCIA" --dry-run > "$TMP/salida.txt" 2>&1
  fi
  rc=$?
  out="$(cat "$TMP/salida.txt")"
}

echo "── 1. CONTROL NEGATIVO (no-regresión): planificación sigue sin verse a sí misma (default) ──"
b="$(nuevo_buzon 1)"
msg "$b/abierto/2026-08-13_avance_planificacion-a-todos_housekeeping.md" 2
correr "$b"   # sin SESION_ACTUAL -> default "planificacion", comportamiento histórico
if printf '%s' "$out" | grep -q "MAIL FRESCO" ; then
  fail "REGRESIÓN: el default volvió a alarmar con el propio broadcast de planificación. Salida: $out"
else
  ok "planificación (default) sigue sin autoalarmarse — comportamiento histórico intacto"
fi

echo "── 2. CONTROL POSITIVO (no-regresión): planificación SÍ ve lo ajeno (default) ──"
b="$(nuevo_buzon 2)"
msg "$b/abierto/2026-08-13_avance_backend-a-todos_D5-cerrado.md" 2
correr "$b"
if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -q "D5-cerrado"; then
  ok "planificación (default) sigue viendo broadcasts ajenos"
else
  fail "esperaba exit 1 + el archivo de backend nombrado; hubo exit $rc. Salida: $out"
fi

echo "── 3. EL BUG REPRODUCIDO SIN EL FIX / CONTROL NEGATIVO CON EL FIX: frontend no se autoalarma ──"
b="$(nuevo_buzon 3)"
msg "$b/abierto/2026-08-13_avance_frontend-a-todos_cola-vacia.md" 2
correr "$b" "frontend"
if printf '%s' "$out" | grep -q "MAIL FRESCO"; then
  fail "BUG: frontend se autoalarmó con su propio avance_ (el caso real del 2026-08-13). Salida: $out"
else
  ok "frontend con SESION_ACTUAL=frontend no se autoalarma con lo propio"
fi

echo "── 4. CONTROL POSITIVO: frontend SÍ ve un broadcast ajeno ──"
b="$(nuevo_buzon 4)"
msg "$b/abierto/2026-08-13_avance_backend-a-todos_D5-cerrado.md" 2
correr "$b" "frontend"
if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -q "D5-cerrado"; then
  ok "frontend ve un broadcast -a-todos_ escrito por otra sesión"
else
  fail "esperaba exit 1 + el archivo de backend nombrado; hubo exit $rc. Salida: $out"
fi

echo "── 5. CONTROL POSITIVO: frontend SÍ ve correo dirigido a ella específicamente (capacidad nueva) ──"
b="$(nuevo_buzon 5)"
msg "$b/abierto/2026-08-13_contrato_planificacion-a-frontend_hito-nuevo.md" 2
correr "$b" "frontend"
if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -q "hito-nuevo"; then
  ok "frontend ve un mensaje -a-frontend_ dirigido a ella (antes invisible para este gate)"
else
  fail "esperaba exit 1 + el archivo dirigido a frontend nombrado; hubo exit $rc. Salida: $out"
fi

echo "── 6. CONTROL NEGATIVO: frontend no se alarma con correo dirigido a OTRA sesión ──"
b="$(nuevo_buzon 6)"
msg "$b/abierto/2026-08-13_contrato_planificacion-a-backend_hito-ajeno.md" 2
correr "$b" "frontend"
if printf '%s' "$out" | grep -q "hito-ajeno"; then
  fail "frontend vio un mensaje dirigido a backend, no a ella. Salida: $out"
else
  ok "frontend no se entromete en correo dirigido a otra sesión"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-vigilancia-mail-fresco-propia-sesion: 6/6"
  exit 0
fi
echo "❌ test-vigilancia-mail-fresco-propia-sesion: $fallos fallo(s)"
exit 1
