#!/usr/bin/env bash
# test-vigilancia-rol-ausente.sh — el watchdog tiene que ver la sesión AUSENTE, no sólo la tarde.
#
# Qué se ejercita (caso real del 2026-08-12, modo autónomo): C4.1 —el P0 que bloquea la beta— se
# contrató a las 11:57 y a las 13:40 seguía sin dueño porque backend nunca abrió ventana.
# `vigilancia-check --quiet` devolvió exit 0 —"sin novedades"— durante ~100 min. La línea culpable
# era el fail-open del bloque de VIDA:
#
#     [ "$mt" -eq 0 ] && continue   # sin transcript rotulado <4h para ese rol -> sin señal, no alarma
#
# que sólo sabe juzgar a un rol que escribió alguna vez: detecta al que llega tarde, nunca al que
# no vino.
#
# El criterio es RELACIONAL —¿el contrato es más nuevo que la última señal de vida de su
# destinatario?— y por eso no hay umbral que calibrar. El primer intento SÍ usaba un umbral
# ("cero transcript") y acusó en falso a frontend, que estaba trabajando pero cuya ventana no
# tenía marcador de cron; los casos 2 y 4 existen para que esa regresión no vuelva.
#
#   1. CONTROL POSITIVO — contrato posterior a la última firma del rol      → alarma (exit 1)
#   2. CONTROL NEGATIVO — el rol firmó DESPUÉS del contrato                 → silencio
#   3. CONTROL NEGATIVO — sin contrato abierto                              → silencio
#   4. CONTROL NEGATIVO — la señal viene de un slug hermano (así corre auditoría) → silencio
#   5. CONTROL POSITIVO — cero señal de cualquier tipo                      → alarma
#
# El caso 3 protege al watchdog de sí mismo: un vigía que grita de más se apaga solo en una semana.
# La expectativa se deriva del buzón (`contrato_…-a-<rol>_`), nunca de una lista hardcodeada.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
VIGILANCIA="$REPO_ROOT/scripts/vigilancia-check.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

# Un buzón de prueba SIN PLAN.md: el chequeo de COLA se saltea solo (límite ya documentado en el
# encabezado de vigilancia-check.sh) y el resto de los ganchos corre igual.
nuevo_buzon() {
  local d="$TMP/buzon-$1"
  rm -rf "$d"; mkdir -p "$d/abierto" "$d/en-curso" "$d/cerrado"
  printf '%s' "$d"
}

# Slugs bajo un root propio: si `senal_rol` viera los transcripts REALES de la máquina, el caso 1
# sería un falso verde en cualquier PC donde backend esté vivo.
nuevo_slug_root() {
  local d="$TMP/slugs-$1"
  rm -rf "$d"; mkdir -p "$d/c--proyecto-principal"
  printf '%s' "$d"
}

# Deja el stdout en $out y el exit code en $rc. NO se usa `out=$(correr …)`: la substitución de
# comandos abre un subshell y `rc` asignado ahí se pierde al volver.
out=""; rc=0
correr() {  # correr <buzon> <slug_root>
  local buzon="$1" root="$2"
  BUZON_DIR="$buzon" TRANSCRIPTS_DIR="$root/c--proyecto-principal" SLUGS_ROOT="$root" \
    bash "$VIGILANCIA" --dry-run > "$TMP/salida.txt" 2>&1
  rc=$?
  out="$(cat "$TMP/salida.txt")"
}

# Horas relativas a ahora, para que el filtro `-newermt '-8 hours'` del script no descarte los
# fixtures — fechas absolutas de 2026 quedarían fuera de la ventana y todo daría "sin señal".
hace() { date -d "-$1 minutes" '+%Y-%m-%d %H:%M:%S'; }

# Crea un archivo del buzón con antigüedad dada. El bloque cercado NO es decorativo: sin él, el
# lint de contratos ("PROSA PURA") alarma sobre el propio fixture y el script sale 1 por un motivo
# ajeno al que se está probando — con lo cual la aserción `rc -eq 1` del caso 1 pasaría también
# sin el fix, que es precisamente lo que un control negativo tiene que poder descartar.
msg() {  # msg <ruta> <minutos-de-antiguedad>
  # El bloque cercado necesita ≥3 líneas de contenido: ése es el umbral del lint de referencias.
  printf '# fixture\n\n```json\n{\n  "fixture": true,\n  "por_que": "que el lint no alarme sobre el propio test"\n}\n```\n\n/ejecutar-con-eficiencia\n' > "$1"
  touch -d "$(hace "$2")" "$1"
}

echo "── 1. CONTROL POSITIVO: contrato posterior a la última firma de backend ──"
b="$(nuevo_buzon 1)"; r="$(nuevo_slug_root 1)"
msg "$b/cerrado/2026-08-12_avance_backend-a-todos_housekeeping.md" 120
msg "$b/abierto/2026-08-12_contrato_planificacion-a-backend_C4-1-cerrar-signup.md" 118
correr "$b" "$r"
if [ "$rc" -eq 1 ] && printf '%s' "$out" | grep -q "SIN DUEÑO: BACKEND"; then
  ok "alarma con exit 1 y señala a BACKEND"
else
  fail "esperaba exit 1 + 'SIN DUEÑO: BACKEND'; hubo exit $rc. Salida: $out"
fi
if printf '%s' "$out" | grep -q "C4-1-cerrar-signup"; then
  ok "nombra el contrato huérfano (no obliga a ir a buscarlo)"
else
  fail "la alarma no nombra el contrato sin dueño"
fi

echo "── 2. CONTROL NEGATIVO: el rol firmó DESPUÉS del contrato (estaba trabajando) ──"
b="$(nuevo_buzon 2)"; r="$(nuevo_slug_root 2)"
msg "$b/abierto/2026-08-12_contrato_planificacion-a-frontend_C6-cotas-de-chat.md" 118
msg "$b/abierto/2026-08-12_dato_frontend-a-todos_flake-en-el-gate.md" 40
correr "$b" "$r"
if printf '%s' "$out" | grep -q "SIN DUEÑO: FRONTEND"; then
  fail "REGRESIÓN: acusó a un rol que firmó después del contrato. Salida: $out"
else
  ok "no acusa a quien dio señal posterior al contrato"
fi

echo "── 3. CONTROL NEGATIVO: sin contrato abierto → silencio ──"
b="$(nuevo_buzon 3)"; r="$(nuevo_slug_root 3)"
correr "$b" "$r"
if printf '%s' "$out" | grep -q "SIN DUEÑO"; then
  fail "FALSO POSITIVO: alarmó sin que nadie esperara a ese rol. Salida: $out"
else
  ok "sin expectativa en el buzón no hay falta"
fi

echo "── 4. CONTROL NEGATIVO: la señal viene del slug hermano (así corre auditoría) ──"
b="$(nuevo_buzon 4)"; r="$(nuevo_slug_root 4)"
msg "$b/abierto/2026-08-12_contrato_planificacion-a-auditoria_pasada-3-arranca.md" 90
correr "$b" "$r"
if printf '%s' "$out" | grep -q "SIN DUEÑO: AUDITORIA"; then
  ok "auditoría sin ventana se ve (antes era invisible: su slug no es el principal)"
else
  fail "no detectó a auditoría sin dueño. Salida: $out"
fi
mkdir -p "$r/c--claude-worktrees-auditoria"
echo '{"type":"user"}' > "$r/c--claude-worktrees-auditoria/sesion.jsonl"
touch -d "$(hace 10)" "$r/c--claude-worktrees-auditoria/sesion.jsonl"   # transcript, no mensaje
correr "$b" "$r"
if printf '%s' "$out" | grep -q "SIN DUEÑO: AUDITORIA"; then
  fail "REGRESIÓN: no reconoció la ventana viva en el slug hermano. Salida: $out"
else
  ok "reconoce la ventana viva en el slug hermano"
fi

echo "── 5. CONTROL POSITIVO: cero señal de cualquier tipo ──"
b="$(nuevo_buzon 5)"; r="$(nuevo_slug_root 5)"
msg "$b/abierto/2026-08-12_contrato_planificacion-a-backend_lote-B-higiene.md" 30
correr "$b" "$r"
if printf '%s' "$out" | grep -q "nunca dio señal de vida"; then
  ok "distingue 'nunca apareció' de 'dejó de aparecer'"
else
  fail "esperaba el texto de cero señal. Salida: $out"
fi

echo "── 6. CONTROL NEGATIVO: el contrato es recién nacido (nadie pudo leerlo todavía) ──"
# Mismo escenario que el caso 5 —rol sin ninguna señal, contrato abierto— cambiando SÓLO la edad del
# contrato: 5 min en vez de 30. Sin la ventana de gracia el criterio relacional dispara sobre cada
# mensaje que uno acaba de escribir, y una alarma que suena siempre se saltea por reflejo. Se cazó
# en vivo: el `listo_` que destrababa el lote B salió alarmado 4 min después de escribirlo.
b="$(nuevo_buzon 6)"; r="$(nuevo_slug_root 6)"
msg "$b/abierto/2026-08-12_contrato_planificacion-a-backend_lote-B-higiene.md" 5
correr "$b" "$r"
if printf '%s' "$out" | grep -q "SIN DUEÑO"; then
  fail "acusó por un contrato de 5 minutos: nadie tuvo ventana para leerlo aún. Salida: $out"
else
  ok "no acusa por un contrato más nuevo que la ventana de gracia"
fi

# Y el control positivo del control: el MISMO contrato, envejecido más allá de la gracia, SÍ alarma.
# Sin esto, un bug que apagara la regla entera pasaría el caso 6 en verde.
touch -d "$(hace 30)" "$b/abierto/2026-08-12_contrato_planificacion-a-backend_lote-B-higiene.md"
correr "$b" "$r"
if printf '%s' "$out" | grep -q "SIN DUEÑO"; then
  ok "el mismo contrato, pasada la gracia, sí alarma (la gracia demora, no apaga)"
else
  fail "la gracia apagó la regla en vez de demorarla. Salida: $out"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-vigilancia-rol-ausente: 9/9"
  exit 0
fi
echo "❌ test-vigilancia-rol-ausente: $fallos fallo(s)"
exit 1
