#!/usr/bin/env bash
# Caracteriza los mecanismos que responden "¿este archivo del buzon es para mi?".
#
# Nacio para medir el DEFECTO del 2026-10-12 —cada consumidor con su propia logica para la MISMA
# pregunta, y 9 mensajes con destino COMPUESTO invisibles para planificacion, uno de ellos un
# `urgente_` de 5 dias— y se queda para medir el fix: sin el instrumento que midio el defecto, el
# fix no se compara contra nada.
#
# BASELINE con la lib del 2026-10-11 (reproducible, es el control POSITIVO de este spike):
#   mkdir -p /tmp/ctl/scripts/lib && git show <sha-pre-fix>:scripts/lib/buzon-roles.sh > /tmp/ctl/scripts/lib/buzon-roles.sh
#   cp -r spikes /tmp/ctl/ && bash /tmp/ctl/spikes/buzon-destino-compuesto/spike.sh
#   -> MEC-A 5 fallos de 12 · la regex inline del bloque SIN DUENO 2 de 12 · me_interpela no existia.
#
# Uso: bash spikes/buzon-destino-compuesto/spike.sh
# Exit: 0 los dos consumidores aciertan los 12 casos · 1 alguno falla
set -u
cd "$(dirname "$0")/../.." || exit 2
source scripts/lib/buzon-roles.sh

# Casos REALES tomados de coordinacion/abierto (no inventados), + los negativos que importan.
CASOS=(
  "2026-10-12_contrato_planificacion-a-frontend_x.md|frontend1|SI"
  "2026-10-06_hallazgo_auditoria-a-planificacion_x.md|planificacion|SI"
  "2026-10-07_hallazgo_auditoria-a-planificacion-y-backend_x.md|planificacion|SI"
  "2026-10-07_hallazgo_auditoria-a-backend-y-planificacion_x.md|planificacion|SI"
  "2026-10-07_hallazgo_auditoria-a-planificacion-backend-y-frontend2_x.md|planificacion|SI"
  "2026-10-07_hallazgo_auditoria-a-planificacion-backend-y-frontend2_x.md|frontend2|SI"
  "2026-10-07_hallazgo_auditoria-a-planificacion-y-frontend1_x.md|frontend1|SI"
  "2026-10-08_hallazgo_backend-a-todos_x.md|planificacion|SI"
  # NEGATIVOS: lo que NO debe llegarme. Un filtro que dice SI a todo no es un filtro.
  "2026-10-07_hallazgo_auditoria-a-backend_x.md|planificacion|NO"
  "2026-10-07_hallazgo_auditoria-a-frontend1_x.md|frontend2|NO"
  "2026-10-07_hallazgo_auditoria-a-backend-y-frontend1_x.md|planificacion|NO"
  # El que mide substring vs token: 'frontend' NO es 'frontend1'.
  "2026-10-07_hallazgo_auditoria-a-frontend1_x.md|frontend|NO"
)

# MEC-A: lee_patrones + glob. Consumidor real: vigilancia-check.sh (el find del MAIL FRESCO).
mec_a() { local n="$1" rol="$2" p
  while IFS= read -r p; do
    case "$n" in $p) return 0 ;; esac
  done < <(lee_patrones "$rol"); return 1; }

# MEC-B: me_interpela(). Consumidor real: vigilancia-check.sh (el loop del bloque SIN DUENO), que
# hasta el 2026-10-12 tenia su propia regex inline y cazaba 2 de las 3 formas compuestas.
mec_b() { me_interpela "$2" "$1"; }

printf '%-58s %-14s %-4s %-7s %-7s\n' ARCHIVO ROL ESP "glob" "interpela"
fa=0; fb=0
for c in "${CASOS[@]}"; do
  IFS='|' read -r n rol esp <<< "$c"
  mec_a "$n" "$rol" && a=SI || a=NO
  mec_b "$n" "$rol" && b=SI || b=NO
  ma=" "; mb=" "
  [ "$a" != "$esp" ] && { ma="X"; fa=$((fa+1)); }
  [ "$b" != "$esp" ] && { mb="X"; fb=$((fb+1)); }
  printf '%-58s %-14s %-4s %-5s%s %-7s%s\n' "${n:0:58}" "$rol" "$esp" "$a" "$ma" "$b" "$mb"
done
echo
echo "MEC-A  lee_patrones + glob  (find del MAIL FRESCO)   fallos: $fa de ${#CASOS[@]}"
echo "MEC-B  me_interpela         (loop de SIN DUENO)      fallos: $fb de ${#CASOS[@]}"

# Asimetria DECLARADA, no defecto: el glob no tiene anclaje de token y `find -iname` deja que `*`
# cruce el `_`, asi que un SLUG que contenga `-a-<rol>_` le da un falso positivo. me_interpela()
# ancla al principio y NO. Se mide para que la laxitud quede probada y no sea folklore del comentario.
LAX="2026-10-07_hallazgo_auditoria-a-backend_sobre-el-mensaje-a-planificacion_x.md"
mec_a "$LAX" planificacion && la=SI || la=NO
mec_b "$LAX" planificacion && lb=SI || lb=NO
echo
echo "LAXITUD del glob (slug que contiene '-a-planificacion_'): glob=$la (esperado SI, es laxo) · interpela=$lb (esperado NO)"
lax_mal=0
[ "$la" = "SI" ] || { echo "  !! el glob dejo de ser laxo: el comentario de lee_patrones() ya no describe el codigo"; lax_mal=1; }
[ "$lb" = "NO" ] || { echo "  !! me_interpela perdio el anclaje: ya no es mas estricto que el glob"; lax_mal=1; }

echo
total=$((fa + fb + lax_mal))
[ "$total" -eq 0 ] && { echo "VERDE: los dos consumidores aciertan los ${#CASOS[@]} casos, y la asimetria declarada se sostiene."; exit 0; }
echo "ROJO: $total discrepancia(s). X = difiere del esperado."; exit 1
