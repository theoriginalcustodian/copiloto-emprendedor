#!/usr/bin/env bash
# ¿El trabajo de una rama ya vive en `main`? — el único predicado de este repo que contesta ESA
# pregunta, con sus controles adentro.
#
# ╔═ POR QUÉ EXISTE ════════════════════════════════════════════════════════════════════════════╗
# La pregunta «¿esta rama se puede borrar / tiene trabajo sin respaldo?» se midió mal CUATRO veces
# el 2026-11-05, y antes otras cuatro el 2026-10-13 (memoria/la-cita-de-procedencia-muere-en-el-merge.md
# §Refuerzo). Los predicados refutados, y por qué cada uno miente:
#
#   1. `git rev-list origin/main..rama`  (contar commits)
#      El squash-merge crea un commit NUEVO: el de la rama nunca queda ancestro. Reportó decenas
#      de ramas «sin respaldo» que estaban enteras en main.
#   2. `git cherry main rama`  (patch-id)
#      Caza el squash 1:1 y nada más: con 2+ commits el squash une los patches y ningún patch-id
#      individual coincide.
#   3. `git diff origin/main rama`  (árboles completos)
#      Una rama vieja difiere en cientos de archivos POR ESTAR ATRASADA, no por aportar
#      (memoria/base-rancia-invierte-la-direccion-del-diff.md).
#   4. `git diff origin/main rama -- <sólo sus archivos>`
#      Mejor, pero sigue midiendo diferencia de árboles: marcó `fe1/bl-v23-…` con 54/55 archivos
#      «pendientes» cuando ese trabajo YA había aterrizado por otro camino (PR #713 CLOSED →
#      #719 «reconstruido limpio»).
#
# Lo que SÍ contesta: PRESENCIA. ¿Las líneas que la rama agregó existen hoy en algún archivo de
# main? Es insensible a cuánto avanzó main después, que es lo que arruina a los cuatro de arriba.
#
# ╔═ LAS DOS PREGUNTAS SON DISTINTAS ═══════════════════════════════════════════════════════════╗
# «¿tiene PR mergeado?»  → `gh pr list --state merged --head <rama>`: el único registro que el
#                           squash no destruye. Es el paso 1, y NO lo hace este script.
# «¿vive el trabajo?»    → este script. Una rama sin PR puede tener todo su aporte en main, y una
#                           con aporte ausente puede ser trabajo DESCARTADO a propósito.
# Medido el 2026-11-05: de 31 ramas sin PR mergeado, 29 tenían su aporte en main. Y de las 2
# restantes, `frontend2/sm-k2-marca` marcaba una ficha DOD-PARCIAL que en main ya está TERMINADO:
# mergearla habría RETROCEDIDO el registro. Por eso «el patch no está» nunca se cierra como
# «el trabajo no está».
#
# ╔═ DOS TRAMPAS DEL INSTRUMENTO, LAS DOS PAGADAS ══════════════════════════════════════════════╗
#  · NORMALIZACIÓN ASIMÉTRICA. El aporte se extrae sin indentación; comparar con `grep -x` contra
#    un archivo que SÍ la tiene falla SIEMPRE. El control positivo daba 71% por esto, con las
#    99 «ausentes» siendo comentarios indentados presentes en main. Hoy los dos lados se
#    normalizan igual (memoria/la-capa-de-lectura-normalizo-el-sujeto-antes-de-medirlo.md).
#  · EL CONTROL QUE NO CORTA. Antes sólo IMPRIMÍA el control positivo, así que un control malo no
#    frenaba nada y las cifras sesgadas salían igual de citables. Ahora un control <95% ABORTA
#    con rc=4 y no mide ninguna rama.
#
# Uso:  scripts/ramas-aporte-en-main.sh [rama…]      (sin args: lee ramas de stdin, una por línea)
# Salida por rama: ATERRIZADA ≥90% · PARCIAL 40-89% · AUSENTE <40% · SIN-APORTE · ERR
# rc: 0 medido · 2 no es repo · 4 control positivo no acreditado · 5 control negativo falló
set -u

REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "no es un repo git" >&2; exit 2; }
cd "$REPO_ROOT" || exit 2

UMBRAL_CONTROL=${UMBRAL_CONTROL:-95}
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
git fetch --quiet origin 2>/dev/null

# ── ÍNDICE de main: todo su contenido, UNA vez, ya normalizado ────────────────────────────────
# Una invocación de grep -f por rama, en vez de una por línea (eran 339 × árbol × rama).
git grep -h '' origin/main -- . 2>/dev/null \
  | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | sort -u > "$TMP/main_idx.txt"
echo "índice de origin/main: $(wc -l < "$TMP/main_idx.txt") líneas únicas"

# ── aporte de una rama: líneas '+' significativas desde su merge-base ─────────────────────────
# El filtro de longitud y el de líneas-sólo-puntuación sacan el ruido que matchea en cualquier
# parte (`}`, `});`, imports triviales) y que infla la presencia sin medir nada.
aporte_de() {
  local mb
  mb=$(git merge-base origin/main "origin/$1" 2>/dev/null) || return 1
  [ -n "$mb" ] || return 1
  git diff -U0 "$mb" "origin/$1" -- . 2>/dev/null \
    | grep '^+' | grep -v '^+++' | sed 's/^+//' \
    | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' \
    | awk 'length($0) >= 25' | grep -v '^[]})/*#-]*$' | sort -u > "$TMP/aporte.txt"
}

medir() {  # imprime "presentes total"
  aporte_de "$1" || { echo "ERR ERR"; return; }
  local t p
  t=$(wc -l < "$TMP/aporte.txt")
  [ "$t" -eq 0 ] && { echo "0 0"; return; }
  p=$(grep -F -x -f "$TMP/aporte.txt" "$TMP/main_idx.txt" 2>/dev/null | sort -u | wc -l)
  echo "$p $t"
}

# ── CONTROL POSITIVO: el último merge a main debe dar ~100% presente ──────────────────────────
# El sujeto NO se elige de memoria ni del output que se está auditando: las dos veces que lo hice
# el 2026-11-05 el esperado salió falso y condenó a un instrumento correcto
# (memoria/un-control-positivo-con-esperado-falso-acusa-al-script.md). Acá sale de la forja: la
# rama del PR mergeado más reciente, que por construcción está íntegra en main.
CTRL=$(gh pr list --state merged --limit 1 --json headRefName --jq '.[0].headRefName' 2>/dev/null)
if [ -z "${CTRL:-}" ] || ! git rev-parse --verify --quiet "origin/$CTRL" >/dev/null; then
  echo "ABORTO: no pude obtener de la forja una rama de control (¿gh sin auth, o rama borrada?)." >&2
  echo "        Sin control positivo no hay cifra: NO degrado a 'medir igual'." >&2
  exit 4
fi
read -r cp ct <<EOF
$(medir "$CTRL")
EOF
cpct=0; [ "${ct:-0}" -gt 0 ] && cpct=$(( cp * 100 / ct ))
echo "control positivo ($CTRL, PR mergeado): $cp/$ct = ${cpct}%  (exigido ≥${UMBRAL_CONTROL}%)"
if [ "$cpct" -lt "$UMBRAL_CONTROL" ]; then
  echo "ABORTO: control positivo ${cpct}% — instrumento NO acreditado, no mido ninguna rama." >&2
  echo "— muestra de lo que no matcheó, PARA DIAGNOSTICAR, no para citar:" >&2
  grep -F -x -v -f "$TMP/main_idx.txt" "$TMP/aporte.txt" 2>/dev/null | head -6 >&2
  exit 4
fi

# ── CONTROL NEGATIVO: una línea fabricada no puede aparecer ───────────────────────────────────
printf 'const deadbeefCafeBabe = "linea que no existe en el arbol de main jamas de los jamases";\n' \
  > "$TMP/neg.txt"
if grep -F -x -f "$TMP/neg.txt" "$TMP/main_idx.txt" >/dev/null 2>&1; then
  echo "ABORTO: el control negativo encontró una línea fabricada — el índice está mal." >&2
  exit 5
fi
echo "control negativo: OK"
echo

# ── medición ──────────────────────────────────────────────────────────────────────────────────
ramas() { if [ "$#" -gt 0 ]; then printf '%s\n' "$@"; else cat; fi; }
ramas "$@" | while read -r r; do
  [ -n "$r" ] || continue
  case "$r" in main|origin|HEAD|dependabot/*) continue;; esac
  git rev-parse --verify --quiet "origin/$r" >/dev/null || { printf '  %-11s %s\n' "NO-EXISTE" "$r"; continue; }
  read -r p t <<EOF
$(medir "$r")
EOF
  [ "$p" = "ERR" ] && { printf '  %-11s %s\n' "ERR" "$r"; continue; }
  [ "$t" -eq 0 ]   && { printf '  %-11s %s\n' "SIN-APORTE" "$r"; continue; }
  pc=$(( p * 100 / t ))
  if   [ "$pc" -ge 90 ]; then cls="ATERRIZADA"
  elif [ "$pc" -ge 40 ]; then cls="PARCIAL   "
  else                        cls="AUSENTE   "; fi
  printf '  %s %3d%% (%4d/%4d líneas) %s\n' "$cls" "$pc" "$p" "$t" "$r"
done
