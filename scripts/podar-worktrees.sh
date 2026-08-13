#!/usr/bin/env bash
# podar-worktrees.sh — poda SÓLO los worktrees que ya no pueden perder trabajo de nadie.
#
# CAUSA RAÍZ que resuelve: el audit cross-sesión abre cada sesión gritando «29 worktrees activos», y
# esa alarma no distingue el worktree donde una sesión está trabajando ahora mismo del que quedó de un
# PR mergeado hace tres días. Una alarma que no discrimina enseña a saltearla — el mismo fallo que ya
# se corrigió en el watchdog de coordinación (#394/#400). Podar a mano tampoco sirve: es razonar caso
# por caso 29 veces, que es justo lo que el janitor del buzón dejó de hacer por la misma razón.
#
# EL RIESGO REAL no es el disco: es borrar el worktree que otra sesión tiene abierto, o uno con
# trabajo que no está en ninguna rama. Por eso el default es NO borrar nada y las tres guardas de
# abajo son AND, no OR. Ante cualquier duda, el worktree se conserva: el costo de conservar de más es
# una línea en un listado; el de borrar de menos es el WIP de otra sesión.
#
# GUARDAS (las tres tienen que darse para podar):
#   1. El TRABAJO de la rama ya está en origin/main. Ojo con el detalle que casi vuelve inútil este
#      script: acá los PRs se mergean con **squash**, así que la rama NUNCA es ancestro de main y
#      `merge-base --is-ancestor` da "no mergeado" para todo lo que sí terminó. La primera versión
#      clasificó 18 de 29 así — conservador, y por eso mismo indistinguible de no tener script. Se
#      resuelve con tres pruebas independientes, y alcanza con que UNA dé positiva:
#        (a) es ancestro de origin/main (merge normal / fast-forward),
#        (b) GitHub dice que hubo un PR MERGEADO con esa rama como head — la autoridad real,
#        (c) el contenido que la rama tocó es idéntico al de origin/main (squash sin PR, o cherry-pick).
#   2. El working tree está LIMPIO — sin modificados, sin staged, sin untracked. Un archivo sin
#      commitear en un worktree no está en ninguna rama y se pierde entero.
#      → memoria: el-working-tree-compartido-guarda-trabajo-que-no-esta-en-ninguna-rama
#   3. No hubo actividad en las últimas HORAS_GRACIA (default 6). Limpio + mergeado + tocado hace 10
#      minutos = una sesión que acaba de mergear y SIGUE PARADA AHÍ; borrarlo le invalida el cwd a
#      mitad de trabajo.
#
# NUNCA TOCA: el worktree principal, ni nada fuera de `.claude/worktrees/` (`C:/gfw-src/…`,
# `_documed-wt` y compañía son de otros propósitos), ni el worktree desde el que se lo invoca.
#
# Uso:
#   scripts/podar-worktrees.sh                 # dry-run: clasifica y no borra NADA (default)
#   scripts/podar-worktrees.sh --podar         # borra sólo los PODABLE
#   scripts/podar-worktrees.sh --horas 24      # sube la gracia
#   scripts/podar-worktrees.sh --quiet         # sólo el resumen (para crones)
#
# Exit code: siempre 0 salvo error de uso. Esto informa, no gatea: un worktree de más no es un fallo.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PODAR=0
QUIET=0
HORAS_GRACIA=6
while [ $# -gt 0 ]; do
  case "$1" in
    --podar) PODAR=1 ;;
    --quiet) QUIET=1 ;;
    --horas) HORAS_GRACIA="${2:-6}"; shift ;;
    -h|--help) sed -n '2,40p' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "opción desconocida: $1" >&2; exit 2 ;;
  esac
  shift
done

AQUI="$(pwd -P)"
GRACIA_SEG=$((HORAS_GRACIA * 3600))
AHORA="$(date +%s)"

if ! git -C "$REPO_ROOT" rev-parse --verify -q origin/main >/dev/null; then
  echo "❌ no hay ref origin/main — sin ella no se puede afirmar que una rama esté mergeada."
  echo "   Se aborta: clasificar sin esa referencia sería adivinar, y acá adivinar borra trabajo."
  exit 1
fi

# ── Ramas con PR mergeado, según GitHub ──────────────────────────────────────────────────────
# Una sola llamada para todas, no una por worktree. Si `gh` no está o falla, se degrada a las otras
# dos pruebas y se avisa: perder esta señal hace al script más conservador, nunca más peligroso.
RAMAS_MERGEADAS=""
if command -v gh >/dev/null 2>&1; then
  RAMAS_MERGEADAS="$(gh pr list --state merged --limit 300 --json headRefName -q '.[].headRefName' 2>/dev/null)"
fi
[ -z "$RAMAS_MERGEADAS" ] && [ "$QUIET" = "0" ] && \
  echo "⚠️  sin lista de PRs mergeados (gh no disponible o sin respuesta) — se clasifica sólo por git"

# ¿El trabajo de este worktree ya está en origin/main? (ver GUARDA 1 en la cabecera)
trabajo_ya_en_main() {
  local wt="$1" sha="$2" rama="$3"
  # (a) ancestro directo
  git -C "$REPO_ROOT" merge-base --is-ancestor "$sha" origin/main 2>/dev/null && return 0
  # (b) PR mergeado con esa rama como head
  if [ "$rama" != "(detached)" ] && [ -n "$RAMAS_MERGEADAS" ]; then
    printf '%s\n' "$RAMAS_MERGEADAS" | grep -qxF "$rama" && return 0
  fi
  # (c) el contenido que la rama tocó es idéntico al de main. Si main cambió esos archivos después
  #     por otro motivo, da negativo y el worktree se conserva — el error cae del lado seguro.
  local base archivos
  base="$(git -C "$wt" merge-base origin/main HEAD 2>/dev/null)" || return 1
  [ -z "$base" ] && return 1
  archivos="$(git -C "$wt" diff --name-only "$base" HEAD 2>/dev/null)"
  [ -z "$archivos" ] && return 0   # la rama no cambió nada respecto de main
  printf '%s\n' "$archivos" | tr '\n' '\0' \
    | xargs -0 git -C "$wt" diff --quiet origin/main HEAD -- 2>/dev/null
}

# ── ¿Alguien tocó este worktree dentro de la ventana de gracia? ──────────────────────────────
# El mtime del directorio raíz no alcanza: no cambia cuando se edita un archivo hondo. Pero tampoco
# hace falta la fecha exacta — la pregunta es binaria («¿hay ALGÚN archivo tocado hace menos de N
# horas?»), así que se corta con `-quit` en el primero que aparezca.
#
# La primera versión hacía un `stat` por archivo sobre 400 archivos × 29 worktrees: ~11.600 procesos,
# y en Windows no terminó en 5 minutos. Un chequeo de higiene que tarda más que el problema que
# resuelve no se corre nunca. Un solo `find` con prune y corte temprano hace lo mismo en un instante.
tocado_recientemente() {
  local wt="$1"
  local hallado
  # Con gracia 0 nada puede estar «tocado hace menos de 0 horas»: se responde sin escanear. No es
  # micro-optimización — es lo que baja el test de 40 s a unos pocos, y un test caro se termina
  # sacando del gate.
  [ "$HORAS_GRACIA" = "0" ] && return 1
  hallado="$(find "$wt" \
      \( -name node_modules -o -name .git -o -name dist -o -name build -o -name .venv \
         -o -name __pycache__ -o -name .expo -o -name coverage \) -prune -o \
      -type f -newermt "-${HORAS_GRACIA} hours" -print -quit 2>/dev/null)"
  [ -n "$hallado" ]
}

podables=(); sucios=(); no_mergeados=(); en_gracia=(); ignorados=(); rotos=()

while IFS= read -r wt; do
  [ -z "$wt" ] && continue
  wt_real="$(cd "$wt" 2>/dev/null && pwd -P)" || { ignorados+=("$wt (inaccesible)"); continue; }
  nombre="${wt_real##*/worktrees/}"

  # Fuera de .claude/worktrees/ no se toca nunca: no son worktrees de trabajo de estas sesiones.
  case "$wt_real" in
    *"/.claude/worktrees/"*) : ;;
    *) ignorados+=("$nombre (fuera de .claude/worktrees/)"); continue ;;
  esac
  # Ni el worktree desde el que corre este script.
  [ "$wt_real" = "$AQUI" ] && { ignorados+=("$nombre (es el worktree actual)"); continue; }

  # ── GUARDA 0 · ¿es un worktree DE VERDAD? ──────────────────────────────────────────────────
  # Medido el 2026-08-13: hay directorios registrados en `git worktree list` que perdieron su
  # archivo `.git`. Ahí git no falla — **camina hacia arriba** y responde por el CHECKOUT PRINCIPAL,
  # que tiene ~400 archivos modificados sin commitear. O sea que `git -C <dir> status` devuelve el
  # estado de OTRO árbol, y las guardas 1 y 2 quedan midiendo cualquier cosa.
  # Es la misma familia que el flake de un instrumento compartido: la respuesta llega, parece válida,
  # y es de otro sujeto. Se detecta comparando el toplevel contra el propio directorio.
  top="$(git -C "$wt_real" rev-parse --show-toplevel 2>/dev/null | tr -d '\r')"
  top_real="$(cd "$top" 2>/dev/null && pwd -P)"
  if [ "$top_real" != "$wt_real" ]; then
    rotos+=("$nombre (registrado, pero git responde por $top_real — NO se toca)"); continue
  fi

  rama="$(git -C "$wt_real" symbolic-ref --quiet --short HEAD 2>/dev/null || echo '(detached)')"
  sha="$(git -C "$wt_real" rev-parse HEAD 2>/dev/null || echo '')"

  # Guarda 2 primero: es la más barata y la que más trabajo protege.
  if [ -n "$(git -C "$wt_real" status --porcelain 2>/dev/null)" ]; then
    sucios+=("$nombre [$rama]"); continue
  fi
  # Guarda 1: ¿el trabajo ya está en origin/main? (ancestro · PR mergeado · contenido idéntico)
  if [ -z "$sha" ] || ! trabajo_ya_en_main "$wt_real" "$sha" "$rama"; then
    no_mergeados+=("$nombre [$rama]"); continue
  fi
  # Guarda 3: gracia por actividad reciente.
  if tocado_recientemente "$wt_real"; then
    en_gracia+=("$nombre [$rama · tocado hace < ${HORAS_GRACIA}h]"); continue
  fi
  podables+=("$wt_real|$nombre|$rama")
done < <(git -C "$REPO_ROOT" worktree list --porcelain | awk '/^worktree /{print substr($0,10)}')

listar() {
  local titulo="$1"; shift
  [ "$#" -eq 0 ] && return
  printf '\n%s (%s)\n' "$titulo" "$#"
  printf '  · %s\n' "$@"
}

# ── Directorios en .claude/worktrees/ que NO están registrados ───────────────────────────────
# `git worktree prune` limpia el REGISTRO de los worktrees rotos, pero deja el directorio en disco.
# Si sólo se itera `git worktree list`, esos directorios desaparecen del informe y quedan invisibles
# para siempre — ocupando disco y, peor, pareciendo worktrees a quien entre por el explorador.
# Sólo se reportan: pueden contener trabajo, y borrarlos no es una decisión de un script de higiene.
# OJO con de dónde cuelga `.claude/worktrees/`: NO de $REPO_ROOT. Este script puede correr desde un
# worktree, y ahí `$REPO_ROOT/.claude/worktrees` no existe — la primera versión miró ahí y reportó
# «0 huérfanos» cuando había 21. Verde por mirar el lugar equivocado, otra vez.
# La carpeta cuelga siempre del worktree PRINCIPAL, que es la primera entrada de `worktree list`.
huerfanos=()
principal="$(git -C "$REPO_ROOT" worktree list --porcelain | awk '/^worktree /{print substr($0,10); exit}')"
dir_wts="$principal/.claude/worktrees"
if [ -d "$dir_wts" ]; then
  nombres_registrados="$(git -C "$REPO_ROOT" worktree list --porcelain \
                         | awk '/^worktree /{print substr($0,10)}' | sed 's#.*/worktrees/##')"
  for d in "$dir_wts"/*/; do
    [ -d "$d" ] || continue
    n="$(basename "$d")"
    printf '%s\n' "$nombres_registrados" | grep -qxF "$n" || huerfanos+=("$n")
  done
fi

if [ "$QUIET" = "0" ]; then
  listar "🧟 HUÉRFANOS — el directorio existe pero git ya no lo registra (sólo se informan)" "${huerfanos[@]}"
  listar "💥 ROTOS — registrados como worktree pero git responde por otro árbol" "${rotos[@]}"
  listar "🔒 SUCIOS — trabajo sin commitear, no se tocan" "${sucios[@]}"
  listar "🔒 NO MERGEADOS — tienen commits que sólo viven ahí" "${no_mergeados[@]}"
  listar "⏳ EN GRACIA — limpios y mergeados, pero alguien los tocó recién" "${en_gracia[@]}"
  listar "➖ IGNORADOS por diseño" "${ignorados[@]}"
  if [ "${#podables[@]}" -gt 0 ]; then
    printf '\n🧹 PODABLES (%s)\n' "${#podables[@]}"
    for p in "${podables[@]}"; do
      IFS='|' read -r _ n r <<< "$p"; printf '  · %s [%s]\n' "$n" "$r"
    done
  fi
fi

if [ "$PODAR" = "0" ]; then
  printf '\n📋 dry-run · %s podable(s) · %s sucio(s) · %s no mergeado(s) · %s en gracia (%sh) · %s roto(s) · %s huérfano(s)\n' \
    "${#podables[@]}" "${#sucios[@]}" "${#no_mergeados[@]}" "${#en_gracia[@]}" "$HORAS_GRACIA" \
    "${#rotos[@]}" "${#huerfanos[@]}"
  [ "${#podables[@]}" -gt 0 ] && echo "   Para borrarlos: scripts/podar-worktrees.sh --podar"
  exit 0
fi

borrados=0; fallidos=0
for p in "${podables[@]}"; do
  IFS='|' read -r ruta n r <<< "$p"
  if git -C "$REPO_ROOT" worktree remove "$ruta" 2>/dev/null; then
    echo "  ✅ podado: $n [$r]"; borrados=$((borrados + 1))
  else
    # Sin --force a propósito: si git se niega, hay algo que este script no vio. Se informa y se deja.
    echo "  ⚠️  git se negó a borrar $n — se deja intacto (nunca se fuerza)"; fallidos=$((fallidos + 1))
  fi
done
git -C "$REPO_ROOT" worktree prune
printf '\n🧹 %s podado(s) · %s conservado(s) por negativa de git · %s protegido(s) por las guardas\n' \
  "$borrados" "$fallidos" "$(( ${#sucios[@]} + ${#no_mergeados[@]} + ${#en_gracia[@]} + ${#rotos[@]} ))"
exit 0
