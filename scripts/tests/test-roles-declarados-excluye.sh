#!/usr/bin/env bash
# test-roles-declarados-excluye.sh — el control NEGATIVO que faltaba: a quiénes EXCLUYE la línea `ROLES:`.
#
# POR QUÉ ESTE TEST Y NO OTRO. `roles_declarados_en()` ya tenía tests, y todos preguntaban lo mismo:
# «¿la línea se ENCUENTRA?» (el ancla, los adornos `_ROLES_:`, los backticks). Ninguno comparaba el
# VALOR devuelto contra lo que el humano escribió — y eso es justo lo que estaba mal: el archivo SÍ
# tenía la línea, así que cualquier control de PRESENCIA salía verde mientras la función devolvía
# CINCO roles donde la ficha declaraba TRES.
#
# La causa medida (hallazgo 2026-10-15, §2): se tokenizaba todo lo que seguía a los dos puntos, así
# que la oración que explicaba POR QUÉ `auditoria` y `manejo-de-errores` quedaban afuera los NOMBRABA
# — y nombrarlos ahí era declararlos. La aclaración que excluye es lo que incluye. Dual de
# `memoria/el-guard-se-satisface-con-su-propio-comentario.md`: ahí el comentario satisface al guard,
# acá lo alimenta.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$AQUI/../lib/buzon-roles.sh"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
fallos=0
ok()  { echo "  ✅ $1"; }
mal() { echo "  ❌ $1"; fallos=$((fallos+1)); }

ficha() { printf '%s\n' '# ficha' '' "$1" > "$TMP/f.md"; }
devuelve() { roles_declarados_en "$TMP/f.md" | tr '\n' ' ' | sed 's/ *$//'; }

# excluye <descripcion> <linea ROLES:> <rol-que-NO-debe-estar> <rol-que-SI-debe-estar>
excluye() {
  ficha "$2"
  local got; got="$(devuelve)"
  if printf '%s\n' $got | grep -qx "$3"; then
    mal "$1 — devolvió '$got' e incluye '$3', que la línea EXCLUYE"
  elif ! printf '%s\n' $got | grep -qx "$4"; then
    mal "$1 — devolvió '$got' y perdió '$4', que la línea SÍ declara (recortó de más)"
  else
    ok "$1 — '$got'"
  fi
}

echo "── 1-5. CONTROL NEGATIVO: el rol nombrado en la EXPLICACIÓN no queda declarado ──"
excluye "em dash (el que usan las fichas)" \
  'ROLES: backend — y no auditoria, porque no tiene sesión viva' auditoria backend
excluye "paréntesis de aclaración" \
  'ROLES: backend (no auditoria: sin sesión)' auditoria backend
excluye "fin de oración" \
  'ROLES: backend. No auditoria, que no corre.' auditoria backend
excluye "doble guion ASCII" \
  'ROLES: frontend1 -- excluye a manejo-de-errores' manejo-de-errores frontend1
excluye "guion simple con espacios" \
  'ROLES: frontend2 - y no auditoria' auditoria frontend2

echo "── 6. NO REGRESIÓN: el separador no parte un rol que LLEVA guiones ──"
# `manejo-de-errores` tiene dos guiones internos: si el corte fuera por guion suelto, lo truncaría.
ficha 'ROLES: manejo-de-errores, backend'
got="$(devuelve)"
if printf '%s\n' $got | grep -qx manejo-de-errores && printf '%s\n' $got | grep -qx backend; then
  ok "el rol con guiones sobrevive — '$got'"
else
  mal "partió un rol con guiones internos: '$got'"
fi

echo "── 7. NO REGRESIÓN: la línea con adornos de markdown sigue parseándose ──"
ficha '**ROLES:** `backend`, `frontend1`, `frontend2`'
got="$(devuelve)"
n=$(printf '%s\n' $got | grep -c .)
if [ "$n" = "3" ]; then ok "los tres roles con backticks — '$got'"; else mal "esperaba 3, dio $n: '$got'"; fi

echo "── 8. FAIL-OPEN: si el corte deja el conjunto VACÍO, devolver nada (= 'no declara') ──"
# Devolver nada hace que el caller use el alcance del NOMBRE, que escala a MÁS roles, no a menos.
# La salida peligrosa sería recortar hasta dejar a nadie y tratarlo como padrón válido: eso es el
# apagado del escalador contra el que monta guardia el caso 1 de test-escalador-roles-declarados.sh.
ficha 'ROLES: — backend'
got="$(devuelve)"
if [ -z "$got" ]; then
  ok "conjunto vacío → 'no declara' → el caller cae al alcance del nombre (fail-OPEN)"
else
  mal "devolvió '$got' con el valor después del separador: el corte no se aplicó al inicio"
fi

echo
if [ "$fallos" -eq 0 ]; then echo "✅ test-roles-declarados-excluye: OK"; else echo "❌ test-roles-declarados-excluye: $fallos fallo(s)"; fi
exit "$fallos"