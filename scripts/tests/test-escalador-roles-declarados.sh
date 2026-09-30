#!/usr/bin/env bash
# test-escalador-roles-declarados.sh — un broadcast exige reporte a los roles que el CONTRATO
# declara, no a todos los que el broadcast alcanza.
#
# Caso real del 2026-09-29 (FACTID). El fix de broadcast de ese mismo día ya había arreglado la
# mitad gruesa: un `a-todos` se atiende REPORTANDO y no moviendo, así que dejó de ser inapagable.
# Los dos `urgente_` del día lo fechan solos — el de 238 min escaló al rol literal `todos` (versión
# vieja) y el de 197 min ya apuntaba a UN solo rol (versión nueva).
#
# Lo que quedaba es más fino y peor: **la lista de roles que deben reportar salía del BROADCAST, no
# del CONTRATO**. FACTID declaraba tres piezas —core, web, mobile— y ninguna era de
# `manejo-de-errores`; el escalador le exigía un reporte igual, así que la única forma de apagarlo
# era que esa sesión reportara **sobre trabajo que no era suyo**. Eso no es ruido: es pedirle a una
# sesión que afirme algo que no midió, que es justo lo que el resto del harness existe para impedir.
#
# Y explica el ciclo sin culpar a nadie: manejo-de-errores no estaba ignorando un contrato — no
# tenía nada que hacer en él.
#
#   1. NO-REGRESIÓN   — `a-todos` SIN línea ROLES:            → expande a todos (lo de hoy)
#   2. EL CASO FACTID — ROLES: con las tres piezas reales      → NO escala a manejo-de-errores
#   3. MARKDOWN       — `**ROLES:** backend` en negrita        → la lee igual
#   4. FAIL-SAFE      — un rol inexistente entre válidos       → usa los válidos, ignora el otro
#   5. FAIL-OPEN      — ROLES: con SÓLO un rol inexistente     → cae a todos, NO se silencia
#   6. NO ES BROADCAST— contrato a UN rol con línea ROLES:     → la línea no aplica
#
# El caso 5 es el que impide que esto se convierta en un interruptor de apagado: un typo en la línea
# `ROLES:` no puede desactivar el escalador para ese contrato. Si la declaración no deja ningún rol
# válido, el contrato escala como si no la tuviera — es el lado conservador a propósito, porque
# escalar de más cuesta ruido y escalar de menos pierde el contrato. Mismo razonamiento que el caso
# 4 de `test-escalador-disparador-pendiente.sh`: tolerar el formato no puede degenerar en no
# escalar nunca.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ESCALADOR="$REPO_ROOT/scripts/escaladores-buzon.sh"
[ -f "$ESCALADOR" ] || { echo "❌ no existe $ESCALADOR"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

BUZON="$TMP/buzon"
mkdir -p "$BUZON/abierto" "$BUZON/en-curso" "$BUZON/cerrado"

# UMBRAL_CONTRATO_MIN=0 => cualquier edad supera el umbral, como en el test hermano: así este test
# falla por UN solo motivo (la lista de roles) y no por el reloj.
correr() {
  out="$(UMBRAL_CONTRATO_MIN=0 BUZON_DIR="$BUZON" bash "$ESCALADOR" --dry-run 2>&1)"
  rc=$?
}

# escribir <nombre> [linea ROLES tal cual, o vacio]
escribir() {
  rm -f "$BUZON"/abierto/*.md
  local nombre="$1" linea="${2:-}"
  {
    echo "# contrato — FACTID: la mitad frontend de la idem-key"
    [ -n "$linea" ] && echo "$linea"
    echo
    echo "Tres piezas: core compartido, web y mobile."
  } > "$BUZON/abierto/$nombre"
}

BC="2026-09-29_contrato_planificacion-a-todos_FACTID-mitad-frontend.md"

echo "── Caso 1: NO-REGRESIÓN — sin línea ROLES:, se expande a todos"
escribir "$BC"; correr
if echo "$out" | grep -q 'manejo-de-errores' && echo "$out" | grep -q 'backend'; then
  ok "sin declaración, el broadcast sigue alcanzando a todos los roles"
else
  fail "cambió el comportamiento por defecto — esto NO es un fix, es un apagado"
  echo "$out" | sed 's/^/      /' | head -4
fi

echo "── Caso 2: EL CASO FACTID — ROLES: con las tres piezas reales"
escribir "$BC" "**ROLES:** backend, frontend1, frontend2"; correr
if echo "$out" | grep -q 'manejo-de-errores'; then
  fail "sigue exigiendo reporte a manejo-de-errores, que no tenía ninguna de las tres piezas"
  echo "$out" | sed 's/^/      /' | head -4
elif echo "$out" | grep -qE 'backend'; then
  ok "escala sólo a los roles declarados (manejo-de-errores queda afuera)"
else
  fail "no escaló a nadie: la declaración no puede apagar el contrato"
fi

echo "── Caso 3: MARKDOWN — la línea como se escribe de verdad en un .md"
escribir "$BC" "> _ROLES_: \`backend\`"; correr
if echo "$out" | grep -q 'manejo-de-errores'; then
  fail "el ancla no tolera el markdown real (mismo defecto que ^DISPARADOR:, 3ª reincidencia)"
else
  ok "lee la línea con cita, énfasis y backticks"
fi

echo "── Caso 4: FAIL-SAFE — un rol inexistente entre válidos"
escribir "$BC" "ROLES: backend, sesion-que-no-existe"; correr
# ⚠️ No alcanza con «no aparece el inválido»: hoy este caso sale VERDE por la razón equivocada
# -- el escalador expande a todos, y entre ellos está `backend`, así que la aserción se cumple sin
# que la declaración se haya leído. Un caso que acierta por accidente no prueba nada
# (`memoria/un-guard-que-acierta-por-accidente-no-da-sintoma.md`). Por eso se exige además que
# `manejo-de-errores` quede AFUERA: eso sólo puede pasar si la lista salió del contrato.
if echo "$out" | grep -q 'sesion-que-no-existe'; then
  fail "inventó un destinatario: un urgente_ a un rol inexistente no lo lee nadie"
elif echo "$out" | grep -q 'manejo-de-errores'; then
  fail "ignoró el inválido pero tampoco usó los declarados: la lista sigue saliendo del broadcast"
elif echo "$out" | grep -q 'backend'; then
  ok "usa los válidos, ignora el desconocido, y la lista sale del contrato"
else
  fail "un rol mal escrito no puede arrastrar a los que sí existen"
fi

echo "── Caso 5: FAIL-OPEN — ROLES: con SÓLO un rol inexistente"
escribir "$BC" "ROLES: sesion-que-no-existe"; correr
if echo "$out" | grep -qE 'CONTRATO SIN TOMAR|BROADCAST'; then
  ok "cae al comportamiento por defecto: un typo NO apaga el escalador"
else
  fail "silenciado por una línea mal escrita — esto es un interruptor de apagado accidental"
  echo "$out" | sed 's/^/      /' | head -4
fi

echo "── Caso 6: NO ES BROADCAST — contrato dirigido a UN rol"
escribir "2026-09-29_contrato_planificacion-a-backend_FACTID-backend.md" "ROLES: frontend1"; correr
if echo "$out" | grep -q 'le toca a backend'; then
  ok "en un contrato dirigido, la línea ROLES: no aplica (el destinatario manda)"
else
  fail "la línea ROLES: se metió en un contrato que ya tiene un destinatario único"
  echo "$out" | sed 's/^/      /' | head -4
fi

echo "── Caso 7: EN-CURSO — un broadcast NUNCA escala al rol literal \`todos\`"
# La rama de en-curso/ tenia el defecto ENTERO y nadie lo miraba: pedia el avance del rol `todos`,
# que nadie firma, asi que la edad no bajaba nunca. Medido sobre el buzon real el 2026-09-29: tres
# contratos en alarma permanente, uno de 2137 min (35 h), con reportes de las cuatro sesiones ahi
# mismo. `todos` no es un destinatario: un urgente_ dirigido a el no lo lee nadie.
rm -f "$BUZON"/abierto/*.md
{
  echo "# contrato — BL-Q3 v2: la unidad de medicion"
  echo
  echo "Cuerpo."
} > "$BUZON/en-curso/2026-09-28_contrato_planificacion-a-todos_BLQ3-v2-unidad.md"
out="$(UMBRAL_SILENCIO_DEFAULT_MIN=0 UMBRAL_CONTRATO_MIN=0 BUZON_DIR="$BUZON" bash "$ESCALADOR" --dry-run 2>&1)"
if echo "$out" | grep -qE 'dueño del frente: todos|frente: todos'; then
  fail "en-curso/ sigue escalando al rol literal 'todos', que no es nadie"
  echo "$out" | sed 's/^/      /' | head -3
elif echo "$out" | grep -qE 'EN-CURSO SIN AVANCE.*(backend|frontend1|auditoria)'; then
  ok "nombra roles REALES (los mudos), no el broadcast"
else
  fail "no reporto el contrato en en-curso/: el fix no puede silenciar esta rama"
  echo "$out" | sed 's/^/      /' | head -3
fi

echo "── Caso 8: EN-CURSO + ROLES: — la declaracion tambien manda en esta rama"
rm -f "$BUZON"/en-curso/*.md
{
  echo "# contrato — FACTID"
  echo "ROLES: backend"
  echo
  echo "Cuerpo."
} > "$BUZON/en-curso/2026-09-28_contrato_planificacion-a-todos_FACTID.md"
out="$(UMBRAL_SILENCIO_DEFAULT_MIN=0 UMBRAL_CONTRATO_MIN=0 BUZON_DIR="$BUZON" bash "$ESCALADOR" --dry-run 2>&1)"
if echo "$out" | grep -qE 'EN-CURSO SIN AVANCE.*(auditoria|manejo-de-errores|frontend)'; then
  fail "la linea ROLES: no se lee en en-curso/ — el fix quedo a medias, en una sola rama"
  echo "$out" | sed 's/^/      /' | head -3
elif echo "$out" | grep -qE 'EN-CURSO SIN AVANCE.*backend'; then
  ok "en en-curso/ tambien sale del contrato, no del broadcast"
else
  fail "no reporto nada: la declaracion no puede apagar esta rama tampoco"
  echo "$out" | sed 's/^/      /' | head -3
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ TODO VERDE — el contrato declara quién reporta, y ni un typo ni un rol inventado"
  echo "   pueden apagar el escalador"
  exit 0
fi
echo "❌ $fallos fallo(s)"
exit 1
