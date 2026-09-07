#!/usr/bin/env bash
# test-vigilancia-rol-digitos-extremo-a-extremo.sh — el watchdog REAL, no el helper, con roles
# que llevan dígitos (`frontend1`/`frontend2`).
#
# Qué se ejercita (caso real, 2026-09-07): `test-buzon-dos-sesiones-frontend.sh` (Tarea 0, PR#476)
# prueba `lee_patrones()`/`destinatario_de_nombre()`/`firma_patrones()` — las funciones del
# HELPER, en aislamiento. Eso certificó el filtro de lectura, pero frontend2 reportó en vivo que
# `vigilancia-check.sh` (el binario real, corriendo end-to-end) seguía diciendo "FRONTEND nunca
# dio señal de vida" el mismo día que ella había posteado un `avance_` — y planificación confirmó
# el diagnóstico correcto: *"el control negativo que pedí prueba el filtro, no el watchdog"*. Un
# test que sólo cubre la capa que uno tenía en la cabeza certifica el resto sin haberlo tocado.
#
# Por eso este archivo corre el SCRIPT REAL (`bash vigilancia-check.sh`, no las funciones sueltas)
# contra un buzón de fixtures, igual que `test-vigilancia-rol-ausente.sh` — mismo harness, mismo
# criterio relacional (¿el contrato es más nuevo que la última señal de vida del rol?), aplicado
# a un rol CON DÍGITO en el nombre en vez de a `backend`/`auditoria`.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VIGILANCIA="$REPO_ROOT/scripts/vigilancia-check.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

nuevo_buzon() {
  local d="$TMP/buzon-$1"
  rm -rf "$d"; mkdir -p "$d/abierto" "$d/en-curso" "$d/cerrado/$(date +%F)"
  printf '%s' "$d"
}

nuevo_slug_root() {
  local d="$TMP/slugs-$1"
  rm -rf "$d"; mkdir -p "$d/c--proyecto-principal"
  printf '%s' "$d"
}

out=""; rc=0
correr() {  # correr <buzon> <slug_root> [SESION_ACTUAL]
  local buzon="$1" root="$2" sesion="${3:-planificacion}"
  SESION_ACTUAL="$sesion" BUZON_DIR="$buzon" TRANSCRIPTS_DIR="$root/c--proyecto-principal" \
    SLUGS_ROOT="$root" bash "$VIGILANCIA" --dry-run > "$TMP/salida.txt" 2>&1
  rc=$?
  out="$(cat "$TMP/salida.txt")"
}

hace() { date -d "-$1 minutes" '+%Y-%m-%d %H:%M:%S'; }

msg() {  # msg <ruta> <minutos-de-antiguedad>
  printf '# fixture\n\n```json\n{\n  "fixture": true,\n  "por_que": "que el lint no alarme sobre el propio test"\n}\n```\n\n/ejecutar-con-eficiencia\n' > "$1"
  touch -d "$(hace "$2")" "$1"
}

echo "── 1. EL BUG REPORTADO / CONTROL NEGATIVO: frontend2 firmó DESPUÉS del contrato ──"
b="$(nuevo_buzon 1)"; r="$(nuevo_slug_root 1)"
# El contrato es VIEJO (120min); el avance_ de frontend2 es más NUEVO (60min) -> frontend2 estuvo
# viva DESPUÉS del contrato. Con el bug ([a-z]+ no matchea el dígito), senal_rol('frontend2')
# nunca encuentra este archivo (su glob es `*_frontend2-a-*`, roto) y devuelve 0 -> "nunca dio
# señal" -> alarma falsa. Con el fix, tiene que quedar en silencio.
msg "$b/abierto/2026-08-12_contrato_planificacion-a-frontend2_C6-cotas-de-chat.md" 120
msg "$b/cerrado/$(date +%F)/2026-09-07_avance_frontend2-a-todos_cerre-algo.md" 60
correr "$b" "$r"
if printf '%s' "$out" | grep -q "SIN DUEÑO: FRONTEND2"; then
  fail "alarma falsa: frontend2 SÍ dio señal después del contrato, y el watchdog dice que nunca. Salida: $out"
else
  ok "no acusa a frontend2 de muda — su avance_ posterior SÍ se reconoce como señal de vida"
fi

echo "── 2. CONTROL POSITIVO (no regresión): frontend2 realmente ausente SÍ alarma ──"
b="$(nuevo_buzon 2)"; r="$(nuevo_slug_root 2)"
msg "$b/abierto/2026-08-12_contrato_planificacion-a-frontend2_hito-nuevo.md" 118
correr "$b" "$r"
if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -q "SIN DUEÑO: FRONTEND2"; then
  ok "SÍ alarma cuando frontend2 realmente no dio señal — el fix no apagó el watchdog"
else
  fail "esperaba 'SIN DUEÑO: FRONTEND2' con exit 1; hubo exit $rc. Salida: $out"
fi

echo "── 3. CONTROL NEGATIVO: la firma de frontend1 NO tapa la ausencia de frontend2 ──"
b="$(nuevo_buzon 3)"; r="$(nuevo_slug_root 3)"
msg "$b/cerrado/$(date +%F)/2026-09-07_avance_frontend1-a-todos_cerre-mi-tarea.md" 5
msg "$b/abierto/2026-08-12_contrato_planificacion-a-frontend2_otro-hito.md" 118
correr "$b" "$r"
if printf '%s' "$out" | grep -q "SIN DUEÑO: FRONTEND1"; then
  fail "falso positivo: frontend1 SÍ firmó hace 5min, no debería aparecer muda"
else
  ok "frontend1 (con señal reciente) no aparece muda"
fi
if printf '%s' "$out" | grep -q "SIN DUEÑO: FRONTEND2"; then
  ok "frontend2 (sin señal, rol DISTINTO de frontend1) sí aparece muda — no hay fail-open cruzado"
else
  fail "frontend2 debería aparecer muda; la señal de frontend1 no puede tapar la de frontend2"
fi

echo "── 4. MAIL FRESCO extremo a extremo con SESION_ACTUAL=frontend2 ──"
b="$(nuevo_buzon 4)"; r="$(nuevo_slug_root 4)"
msg "$b/abierto/2026-09-07_contrato_planificacion-a-frontend2_recien-llegado.md" 2
msg "$b/cerrado/$(date +%F)/2026-09-07_avance_frontend2-a-todos_lo-que-yo-misma-escribi.md" 2
correr "$b" "$r" "frontend2"
if printf '%s' "$out" | grep -q "recien-llegado"; then
  ok "SESION_ACTUAL=frontend2 ve el mail fresco dirigido a -a-frontend2_"
else
  fail "el mail fresco -a-frontend2_ no llegó a SESION_ACTUAL=frontend2. Salida: $out"
fi
if printf '%s' "$out" | grep -q "lo-que-yo-misma-escribi"; then
  fail "frontend2 se autoalarma con lo que ella misma escribió"
else
  ok "frontend2 no se autoalarma con su propio avance_"
fi

echo
[ "$fallos" -eq 0 ] && { echo "✅ test-vigilancia-rol-digitos-extremo-a-extremo: OK"; exit 0; }
echo "❌ test-vigilancia-rol-digitos-extremo-a-extremo: $fallos fallo(s)"; exit 1
