#!/usr/bin/env bash
# test-escalador-gc-sidecars-huerfanos.sh — el sidecar vive y muere CON su mensaje, pero sólo se
# migra o se borra mientras el escalador TODAVÍA VE el mensaje: el que se archivó se lleva el
# mensaje y deja el sidecar. Medido el 2026-10-08 en el buzón real: 150 archivos de estado, 60 con
# la forma legacy, y el mensaje de 58 ya no existe en ninguna parte.
#
# No es basura inocua: el sidecar se llama como el mensaje, así que un NOMBRE REUSADO hereda la
# sombra — la rama de migración lo adopta con su timestamp viejo y el mensaje nuevo nace ya
# escalado, con una edad que nadie escribió.
#
#   1. CONTROL POSITIVO: el sidecar de un mensaje VIVO en abierto/ sobrevive
#   2. idem con el mensaje en en-curso/ (el escalador mira los dos)
#   3. huérfano CON sufijo        → purgado
#   4. huérfano LEGACY sin sufijo → purgado (ésos son los 58)
#   5. FAIL-CLOSED: sin en-curso/, «no pude mirar» ≠ «miré y no hay» → no purga NADA y lo dice
#   5.bis sin abierto/ el script aborta ANTES (guard de :100): la otra mitad ya está cubierta
#   6. conjunto vivo VACÍO pero legible → sí purga (es un estado legítimo, no una ceguera)
#   7. IDEMPOTENTE: la segunda corrida purga 0 y el denominador lo demuestra
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ESCALADOR="$REPO_ROOT/scripts/escaladores-buzon.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-escalador-gc-sidecars-huerfanos"

HOY="$(date +%F)"
VIVO="${HOY}_dato_planificacion-a-backend_mensaje-vivo.md"
MUERTO="${HOY}_dato_planificacion-a-backend_mensaje-archivado.md"
LEGACY="${HOY}_dato_planificacion-a-backend_sombra-legacy.md"

armar() {   # armar -> deja $B con un buzón nuevo y los 3 sidecars
  B="$TMP/b$1"; rm -rf "$B"; mkdir -p "$B/abierto" "$B/en-curso" "$B/cerrado" "$B/.escalador-estado"
  printf '# fixture\n\n```json\n{\n  "fixture": true\n}\n```\n' > "$B/abierto/$VIVO"
  local t; t="$(date +%s)"
  printf '%s\n' "$t" > "$B/.escalador-estado/$VIVO.first-seen"
  printf '%s\n' "$t" > "$B/.escalador-estado/$MUERTO.first-seen"
  printf '%s\n' "$t" > "$B/.escalador-estado/$LEGACY"            # forma legacy, sin sufijo
}
correr() { salida="$(bash "$ESCALADOR" "$B" 2>&1)"; }
hay() { [ -e "$B/.escalador-estado/$1" ]; }

# ── 1, 3 y 4: el vivo sobrevive, los dos huérfanos se van ──────────────────────────────────────
armar 1; correr
hay "$VIVO.first-seen"   && ok "1 CONTROL POSITIVO: el sidecar del mensaje VIVO sobrevive" \
                         || fail "1 purgó el sidecar de un mensaje que SIGUE en abierto/ — reinicia su edad"
hay "$MUERTO.first-seen" && fail "3 el huérfano con sufijo sobrevivió: un nombre reusado hereda su edad" \
                         || ok "3 huérfano CON sufijo purgado"
hay "$LEGACY"            && fail "4 el huérfano LEGACY sobrevivió (ésos son los 58 del buzón real)" \
                         || ok "4 huérfano LEGACY (sin sufijo) purgado"
case "$salida" in
  *"GC de sidecars:"*) ok "4.bis el GC imprime su DENOMINADOR (un instrumento que no mira nunca falla)" ;;
  *) fail "4.bis el GC no reportó nada: no se puede distinguir «miré 3» de «no miré»" ;;
esac

# ── 2: en-curso/ también cuenta como vivo ──────────────────────────────────────────────────────
armar 2; mv "$B/abierto/$VIVO" "$B/en-curso/$VIVO"; correr
hay "$VIVO.first-seen" && ok "2 el mensaje en en-curso/ también protege su sidecar" \
                       || fail "2 purgó el sidecar de un mensaje en en-curso/ — el escalador sí lo mira"

# ── 5: FAIL-CLOSED de la rama PROPIA. «No pude mirar» no es «miré y no hay» ──────────────
# Es la discriminación que el primer diseño tenía mal: si se decidiera por el CONTEO, un buzón
# legítimamente vacío (caso 6) y uno ilegible darían lo mismo, y el ilegible purgaría TODO.
# Se saca `en-curso/` y NO `abierto/`: sin `abierto/` el script muere antes, en el guard de
# `:100` («no puedo ver mi sujeto») — ver 5.bis. Probar esa mitad mediría el guard ajeno.
armar 5; rm -rf "$B/en-curso"; correr
if hay "$MUERTO.first-seen" && hay "$LEGACY"; then
  case "$salida" in
    *"GC de sidecars OMITIDO"*) ok "5 FAIL-CLOSED: sin en-curso/ no purga nada y dice por qué" ;;
    *) fail "5 no purgó (bien) pero NO lo dijo: un silencio se lee como «no había huérfanos»" ;;
  esac
else fail "5 purgó con en-curso/ ilegible — todo parecía huérfano porque no pudo mirar"; fi

# ── 5.bis: la OTRA mitad ya la cubre un guard de más arriba, y conviene dejarlo medido ─────
# `escaladores-buzon.sh:100` aborta el script entero si falta `abierto/`. Por eso el `-d $ABIERTO`
# del GC no es «por si acaso» redundante: documenta que la condición es sobre las DOS fuentes,
# y si algún día ese guard se relaja, el GC no se vuelve ciego en silencio.
armar 5bis; rm -rf "$B/abierto"; correr
if hay "$MUERTO.first-seen" && hay "$LEGACY"; then
  case "$salida" in
    *"no puedo ver mi sujeto"*) ok "5.bis sin abierto/ aborta ANTES, en el guard de :100" ;;
    *) fail "5.bis no purgó pero tampoco nombró la causa: $(printf '%s' "$salida" | head -1)" ;;
  esac
else fail "5.bis purgó sin poder ver abierto/"; fi

# ── 6: el conjunto vivo VACÍO es legítimo, y entonces purgar es CORRECTO ───────────────────────
armar 6; rm -f "$B/abierto/$VIVO"; correr
if hay "$MUERTO.first-seen" || hay "$LEGACY"; then
  fail "6 no purgó con abierto/ vacío: «todo archivado» es un estado legítimo, no una ceguera"
else ok "6 conjunto vivo vacío pero LEGIBLE: purga, que es lo correcto"; fi

# ── 7: idempotencia, medida por el denominador y no por «no falló» ─────────────────────────────
armar 7; correr; correr
case "$salida" in
  *"0 huerfano(s) purgado(s)"*) ok "7 IDEMPOTENTE: la segunda corrida purga 0" ;;
  *"GC de sidecars:"*)          fail "7 la segunda corrida volvió a purgar: $(printf '%s' "$salida" | grep -o 'GC de sidecars:.*')" ;;
  *)                            fail "7 la segunda corrida no reportó el GC: sin denominador no hay idempotencia medible" ;;
esac

[ "$fallos" = 0 ] && { echo "TODO VERDE -- el sidecar no sobrevive a su mensaje"; exit 0; }
echo "$fallos check(s) fallaron"; exit 1
