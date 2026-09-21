#!/usr/bin/env bash
# test-escalador-urgente-agrupado.sh — el escalador no puede inundar el buzón que vigila.
#
# Caso real (2026-09-21 14:52): planificación bajó la cola K-07..K-15 en lote, y seis contratos
# cruzaron el umbral de 120 min en el MISMO ciclo. La Regla 1 escribía un `urgente_` por contrato,
# así que la próxima corrida del cron iba a dejar seis archivos nuevos en `abierto/` —y otros
# tantos por cada destinatario compuesto— por un hecho único: "la cola de backend es más larga de
# lo que absorbe". El buzón ya pagó esta factura en agosto con la cascada de alertas-sobre-alertas
# (ver el comentario del glob anclado en escaladores-buzon.sh).
#
# Lo que se agrupa es el EFECTO COLATERAL en el canal, no el criterio: cada contrato sigue saliendo
# por stdout con su edad y el exit code sigue siendo 1. Por eso el caso 2 es el que importa — sin
# él, "no inunda" y "no alarma" son indistinguibles, y el segundo sería una regresión grave.
#
#   1. Tres contratos al mismo rol           → UN solo urgente_, con los tres nombrados
#   2. CONTROL DE NO-CEGUERA: exit 1 y una línea de stdout por contrato
#   3. Entra un cuarto contrato              → el aviso se REESCRIBE (no queda congelado)
#   4. Dos destinatarios distintos           → un urgente_ por cada uno, no uno solo
#   5. CONTROL NEGATIVO: DISPARADOR pendiente → ningún urgente_
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ESCALADOR="$REPO_ROOT/scripts/escaladores-buzon.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

nuevo_buzon() {
  local d="$TMP/buzon-$1"
  rm -rf "$d"; mkdir -p "$d/abierto" "$d/en-curso" "$d/cerrado"
  printf '%s' "$d"
}

# El bloque cercado de ≥3 líneas no es decorativo: sin él, el lint de referencias alarma sobre el
# propio fixture y el exit 1 del caso 2 pasaría por un motivo ajeno al que se está probando.
contrato() {  # contrato <buzon> <destinatario> <slug> <minutos>
  local f="$1/abierto/2026-09-21_contrato_planificacion-a-$2_$3.md"
  printf '# fixture\n\n```json\n{\n  "fixture": true,\n  "por_que": "que el lint no alarme sobre el propio test"\n}\n```\n' > "$f"
  touch -d "-$4 minutes" "$f"
  printf '%s' "$f"
}

urgentes() { ls -1 "$1/abierto/" 2>/dev/null | grep -c '_urgente_' || true; }

out=""; rc=0
correr() {
  bash "$ESCALADOR" "$1" > "$TMP/salida.txt" 2>&1
  rc=$?
  out="$(cat "$TMP/salida.txt")"
}

echo "── 1. Tres contratos al mismo rol → UN solo urgente_ ──"
b="$(nuevo_buzon 1)"
contrato "$b" backend K-07-acciones 200 >/dev/null
contrato "$b" backend K-08-lo-pediste 190 >/dev/null
contrato "$b" backend K-11-gate 180 >/dev/null
correr "$b"
n="$(urgentes "$b")"
if [ "$n" -eq 1 ]; then
  ok "1 archivo urgente_ para 3 contratos (antes eran 3)"
else
  fail "esperaba 1 urgente_, hubo $n"
fi
aviso="$b/abierto/$(ls -1 "$b/abierto" | grep '_urgente_' | head -1)"
faltan=0
for k in K-07-acciones K-08-lo-pediste K-11-gate; do
  grep -q "$k" "$aviso" || faltan=$((faltan + 1))
done
if [ "$faltan" -eq 0 ]; then
  ok "los tres contratos están nombrados en el aviso (agrupar no es esconder)"
else
  fail "$faltan contrato(s) no aparecen en el aviso agrupado"
fi
if grep -q 'El mas viejo es .*K-07-acciones' "$aviso"; then
  ok "señala el más viejo, que es por dónde se empieza"
else
  fail "el aviso no identifica el contrato más viejo"
fi

echo "── 2. CONTROL DE NO-CEGUERA: sigue alarmando, una línea por contrato ──"
if [ "$rc" -eq 1 ]; then
  ok "exit 1 — agrupar el archivo no apagó la alarma"
else
  fail "REGRESIÓN: exit $rc. El gate dejó de ver contratos sin tomar"
fi
lineas="$(printf '%s\n' "$out" | grep -c 'CONTRATO SIN TOMAR')"
if [ "$lineas" -eq 3 ]; then
  ok "3 líneas en stdout, una por contrato (el reporte no se agrupó)"
else
  fail "esperaba 3 líneas 'CONTRATO SIN TOMAR' en stdout, hubo $lineas"
fi

echo "── 3. Entra un cuarto contrato → el aviso se reescribe ──"
contrato "$b" backend K-99-nuevo 300 >/dev/null
correr "$b"
if [ "$(urgentes "$b")" -eq 1 ]; then
  ok "sigue habiendo un solo aviso"
else
  fail "la segunda corrida duplicó el aviso"
fi
# Sin reescritura el archivo quedaría congelado en la foto del primer ciclo y un contrato que
# entrara después nunca aparecería en el archivo que el destinatario abre — el aviso mentiría por
# omisión, que es el modo de falla que no se nota.
if grep -q 'K-99-nuevo' "$aviso"; then
  ok "el contrato nuevo aparece: el aviso es la foto de AHORA, no la del primer ciclo"
else
  fail "el aviso quedó congelado; K-99 no figura"
fi

echo "── 4. Dos destinatarios distintos → un aviso cada uno ──"
b="$(nuevo_buzon 4)"
contrato "$b" backend-y-frontend1 K-07 200 >/dev/null
contrato "$b" backend-y-frontend2 K-12 200 >/dev/null
correr "$b"
if [ "$(urgentes "$b")" -eq 2 ]; then
  ok "2 avisos para 2 destinatarios (no se agrupa a través de roles)"
else
  fail "esperaba 2 avisos, hubo $(urgentes "$b")"
fi

echo "── 5. CONTROL NEGATIVO: disparador pendiente → ningún aviso ──"
b="$(nuevo_buzon 5)"
f="$(contrato "$b" backend K-13-agenda 200)"
printf '\n**DISPARADOR: pendiente.** Espera el ADR de backend.\n' >> "$f"
correr "$b"
if [ "$(urgentes "$b")" -eq 0 ]; then
  ok "un contrato que declara su espera no genera aviso"
else
  fail "FALSO POSITIVO: alarmó sobre una espera declarada"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-escalador-urgente-agrupado: 8/8"
  exit 0
fi
echo "❌ test-escalador-urgente-agrupado: $fallos fallo(s)"
exit 1
