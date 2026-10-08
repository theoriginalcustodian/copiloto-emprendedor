#!/usr/bin/env bash
# foco-check.sh — ¿el trabajo commiteado desde el SHA base está DENTRO del alcance cerrado?
#
# CAUSA RAÍZ que resuelve (orden del operador, 2026-10-08): «cuando te he dejado trabajo de larga
# duración has terminado haciendo cosas que nunca te pedí… si auditamos algo siempre vamos a
# encontrar algo que corregir pero nos desenfoca del objetivo de terminar».
# Medido en la noche del 2026-10-06/07: 111 commits, 48% auto-referenciales (arreglar los propios
# instrumentos) y 109 de 111 sin citar ningún id de DoD. Cadena de cinco PRs arreglando al que
# arregla: #897 -> #900 -> #919 -> #921 -> #925.
#
# POR QUÉ LOS CRONES EXISTENTES NO LO CAZARON, y por qué este script es otro gancho:
#   - cola-check.sh        mide si hay un hito ARRANCABLE sin arrancar.
#   - no-ocio-check.sh     mide OCIO (sesión parada).
#   - vigilancia-check.sh  compone los dos + VIDA por mtime de transcript.
#   - progreso-check.sh    mide WIP sin commitear / sin pushear / sin PR.
# Los cuatro miden SILENCIO, COLA o ACUMULACIÓN. Una sesión DESVIADA no está en silencio ni parada
# ni acumulando: está commiteando mucho, rápido, con mensajes convincentes. Ese es el hueco.
#
# LO QUE ESTE SCRIPT **NO** HACE: preguntar «¿estoy haciendo lo correcto?». Esa pregunta es
# autoevaluación, y la autoevaluación del agente no cuenta (CANON 7) — la noche del 06/10 me habría
# contestado «sí», con argumentos coherentes, en cada uno de los 53 commits auto-referenciales.
# Mide un hecho mecánico con el que no se puede argumentar: ¿el mensaje del commit cita un id de la
# lista cerrada, sí o no?
#
# Uso:
#   scripts/foco-check.sh              # imprime siempre el desglose
#   scripts/foco-check.sh --quiet      # sólo imprime si hay desvío  (para el cron)
# Exit: 0 = todo en alcance · 1 = hay desvío · 2 = el instrumento está ciego (control falló)

set -uo pipefail
cd "$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null)" || {
  echo "foco-check: no estoy en un repo git"; exit 2; }

ALCANCE="docs/copiloto-emprendedor/ALCANCE-CIERRE-BETA.md"
QUIET=0; [ "${1:-}" = "--quiet" ] && QUIET=1
# Paths que, si son los ÚNICOS tocados, marcan el commit como auto-referencial (el instrumento
# arreglándose a sí mismo en vez de tocar producto).
AUTOREF='^(scripts/|memoria/|docs/|coordinacion/|\.ci-recibos/|\.claude/)'

[ -f "$ALCANCE" ] || { echo "foco-check: falta $ALCANCE — sin lista cerrada no hay foco que medir"; exit 2; }

BASE=$(grep -oE 'SHA base del cierre:\*\* `[0-9a-f]{7,40}`' "$ALCANCE" | grep -oE '[0-9a-f]{7,40}' | head -1)
[ -n "$BASE" ] || { echo "foco-check: no encuentro el SHA base en $ALCANCE"; exit 2; }
git cat-file -e "$BASE^{commit}" 2>/dev/null || { echo "foco-check: el SHA base $BASE no existe en este repo"; exit 2; }

DESDE=$(grep -oE 'INICIO DEL CIERRE:\*\* `[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}`' "$ALCANCE" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}' | head -1)
[ -n "$DESDE" ] || { echo "foco-check: no encuentro el INICIO DEL CIERRE en $ALCANCE"; exit 2; }

# --- la lista cerrada: ids cortos (col 1) + ids de backlog (col 2) ---
mapfile -t FILAS < <(sed -n '/ALCANCE-CERRADO:INICIO/,/ALCANCE-CERRADO:FIN/p' "$ALCANCE" | grep -E '^[A-Za-z0-9]+ \|')
[ "${#FILAS[@]}" -gt 0 ] || { echo "foco-check: la lista cerrada está VACÍA — eso no es luz verde, es un instrumento sin sujeto"; exit 2; }
IDS=()
for f in "${FILAS[@]}"; do
  IDS+=( "$(echo "$f" | awk -F'|' '{gsub(/ /,"",$1); print $1}')" )
  IDS+=( "$(echo "$f" | awk -F'|' '{gsub(/ /,"",$2); print $2}')" )
done
# regex de ids con límites de palabra: un id suelto dentro de otra palabra NO cuenta
RE_IDS=$(printf '%s\n' "${IDS[@]}" | sed '/^$/d' | sort -u | paste -sd'|' -)
RE="(^|[^A-Za-z0-9])(${RE_IDS})([^A-Za-z0-9]|$)"

cita_id() { echo "$1" | grep -qiE "$RE"; }

# --- CONTROL del instrumento, antes de medir nada (un gate que no puede decir NO es decorativo) ---
cita_id "fix(BL-V31): guard B en la quinta tarjeta" || { echo "foco-check CIEGO: no reconoce un id que SÍ está en la lista"; exit 2; }
cita_id "A7: retirar Drive de la UI"                || { echo "foco-check CIEGO: no reconoce el id corto"; exit 2; }
if cita_id "docs(memoria): anotar el hallazgo del barrido"; then
  echo "foco-check ROTO HACIA EL NO: clasifica como en-alcance un commit que no cita ningún id"; exit 2; fi
if cita_id "fix(BL-V310): otro frente"; then
  echo "foco-check ROTO: matchea un id dentro de otra palabra (BL-V31 en BL-V310)"; exit 2; fi

# --- QUÉ se mide: origin/main + las ramas de los worktrees ACTIVOS, nada más -------------------
# `--all` agarraba 1019 commits: incluye refs de otros proyectos (documed/*), worktrees de
# sub-agentes y ramas viejas cuyos commits no son ancestros del base. Medir de más no es sólo
# lento: es medir OTRO SUJETO, y un instrumento que contesta sobre otro sujeto no falla, miente.
# FAIL-OPEN que este bloque evita (lo cazó scripts/tests/test-foco-check.sh en su 1a corrida):
# REFS arrancaba con `origin/main` a secas. En un repo sin ese remoto —fetch roto, remoto renombrado,
# clon nuevo— `git log ^BASE origin/main` fallaba, el `2>/dev/null` se comía el error, y el script
# reportaba «0 commits, sin desvío, exit 0»: verde eterno justo en su caso de activación. Ahora cada
# ref se verifica antes de usarse, y si no resuelve NINGUNA el exit es 2 (ciego), nunca 0 (limpio).
REFS=()
add_ref() { git rev-parse --verify --quiet "$1^{commit}" >/dev/null 2>&1 && REFS+=( "$1" ); }
add_ref HEAD                 # el worktree donde corre: su propio trabajo se mide primero
add_ref origin/main
while read -r r; do
  case "$r" in ""|documed/*|worktree-agent-*) continue ;; esac
  add_ref "$r"
done < <(git worktree list --porcelain | awk '/^branch /{print substr($0,8)}' | sed 's|^refs/heads/||' | sort -u)
if [ "${#REFS[@]}" -eq 0 ]; then
  echo "foco-check CIEGO: no resolvió ninguna ref que medir (¿remoto renombrado? ¿repo sin commits?)"
  echo "  Un instrumento sin sujeto no da luz verde."; exit 2
fi

# Una sola pasada: %x01 marca el renglón del commit; las demás líneas son sus paths.
TMP=$(mktemp); trap 'rm -f "$TMP"' EXIT
if ! git log --no-merges --name-only --format=$'\x01%H\t%an\t%ad\t%s' --date=format:'%d/%m %H:%M' \
  --since="$DESDE" "^$BASE" "${REFS[@]}" > "$TMP" 2>"$TMP.err"; then
  echo "foco-check CIEGO: git log falló — $(head -1 "$TMP.err")"; rm -f "$TMP.err"; exit 2
fi
rm -f "$TMP.err"

dentro=0; desvio=0; autoref=0
D_LIST=""; A_LIST=""
sha=""; subj=""; fecha=""; paths=""
clasificar() {
  [ -z "$sha" ] && return 0
  if cita_id "$subj"; then dentro=$((dentro+1)); return 0; fi
  local fuera
  fuera=$(printf '%s' "$paths" | sed '/^$/d' | grep -vcE "$AUTOREF" || true)
  if [ "${fuera:-0}" -eq 0 ] && [ -n "$(printf '%s' "$paths" | sed '/^$/d')" ]; then
    autoref=$((autoref+1)); A_LIST="${A_LIST}    ${sha:0:8} $fecha  $subj"$'\n'
  else
    desvio=$((desvio+1)); D_LIST="${D_LIST}    ${sha:0:8} $fecha  $subj"$'\n'
  fi
}
while IFS= read -r linea; do
  case "$linea" in
    $'\x01'*)
      clasificar
      linea=${linea#$'\x01'}
      sha=$(printf '%s' "$linea" | cut -f1); autor=$(printf '%s' "$linea" | cut -f2)
      fecha=$(printf '%s' "$linea" | cut -f3); subj=$(printf '%s' "$linea" | cut -f4-)
      paths="" ;;
    "") ;;
    *) paths="${paths}${linea}"$'\n' ;;
  esac
done < "$TMP"
clasificar

total=$((dentro+desvio+autoref))
hay=$((desvio+autoref))

if [ "$QUIET" = "1" ] && [ "$hay" -eq 0 ]; then exit 0; fi

echo "FOCO — alcance cerrado de $ALCANCE  (base $BASE, desde $DESDE)"
echo "  ids en la lista: ${#FILAS[@]}   refs medidas: ${#REFS[@]}   commits desde la base: $total"
echo "  ✅ EN ALCANCE (citan un id):        $dentro"
echo "  🟠 AUTO-REFERENCIAL (sólo instrumento/doc, sin id): $autoref"
echo "  🔴 DESVÍO (tocan producto sin citar id):            $desvio"
[ -n "$A_LIST" ] && { echo "  --- auto-referenciales:"; printf '%s' "$A_LIST"; }
[ -n "$D_LIST" ] && { echo "  --- desvíos:"; printf '%s' "$D_LIST"; }
if [ "$hay" -gt 0 ]; then
  echo
  echo "  ⛔ ACCIÓN: volvé al id en curso. Un hallazgo nuevo se ANOTA en el bloque"
  echo "     HALLAZGOS-DIFERIDOS de $ALCANCE y NO se arregla. Ampliar la lista es del operador."
  exit 1
fi
echo "  ✅ sin desvío."
exit 0
