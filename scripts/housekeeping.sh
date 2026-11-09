#!/usr/bin/env bash
# housekeeping.sh — barrido de lo que SOBRA una vez que el trabajo entró a origin/main.
#
# POR QUÉ ES UN SCRIPT Y NO UNA REGLA. La regla ya existía en COORDINACION.md y no se cumplió:
# medido el 2026-11-09 había 34 worktrees vivos y ~60 `PLAN.md.bak-*` en coordinacion/. El mismo
# patrón ya se pagó con el buzón (32 → 136 abiertos hasta que lo tomó un janitor,
# memoria/buzon-se-ordena-por-janitor-no-por-disciplina.md). Lo mecánico no se delega a que alguien
# se acuerde: el `mv`/`rm` cae en el hueco entre tareas y nadie lo reclama.
#
# QUÉ BORRA (sólo cuando la rama YA es ancestro de origin/main — o sea, el trabajo está adentro):
#   · el worktree              (git worktree remove)
#   · la rama local            (git branch -D)
#   · la rama remota           (git push origin --delete)
#   · el `.goal` de ese worktree (se va con el worktree)
#
# QUÉ NO BORRA NUNCA, y es a propósito:
#   · el checkout COMPARTIDO (otras sesiones tienen trabajo sin commitear ahí)
#   · los pines de _vigia-pins/ (los regenera vigia.sh; borrarlos deja ciegos a los instrumentos)
#   · worktrees en detached HEAD sin --incluir-detached (no se puede probar que su trabajo esté
#     adentro: sin rama no hay nada contra qué medir el ancestro)
#   · los `.bak`: se LISTAN y se borran sólo con --purgar-bak, porque alguno fue rescate real
#
# IDEMPOTENTE: correrlo N veces deja el mismo estado. La segunda corrida no encuentra nada.
#
# Uso:
#   scripts/housekeeping.sh                      # reporta, NO borra (igual que --dry-run)
#   scripts/housekeeping.sh --aplicar            # borra lo mergeado
#   scripts/housekeeping.sh --aplicar --rama X   # sólo esa rama y su worktree
#   scripts/housekeeping.sh --purgar-bak         # lista los .bak de coordinacion/ y los borra
#   scripts/housekeeping.sh --incluir-detached   # incluye worktrees sin rama (pide confirmación)
set -uo pipefail

ROOT="$(git rev-parse --git-common-dir 2>/dev/null)" || { echo "❌ no es un repo git"; exit 2; }
ROOT="$(cd "$(dirname "$ROOT")" && pwd)"
REF="origin/main"

# 🔴 PRINCIPAL sale de la PRIMERA entrada de `worktree list --porcelain` (git garantiza que es el
# worktree principal), NO de `rev-parse --show-toplevel`: eso último resuelve contra el CWD, así que
# corriendo el script DESDE un worktree devolvía ese worktree y la guarda "no tocar el compartido"
# quedaba apuntando al lugar equivocado. Medido el 2026-11-09 con el control positivo: el checkout
# COMPARTIDO apareció listado como BASURA, y con --aplicar se lo habría llevado puesto.
PRINCIPAL="$(git -C "$ROOT" worktree list --porcelain | awk '/^worktree /{print substr($0,10); exit}')"
PRINCIPAL="$(cd "$PRINCIPAL" 2>/dev/null && pwd || echo "$PRINCIPAL")"

# El worktree DESDE EL QUE CORRÉS tampoco se borra: su rama puede ser ancestro de origin/main sin
# tener ni un commit propio todavía (recién creada), y "ancestro" ahí no significa "trabajo adentro"
# sino "trabajo sin empezar". Un limpiador que se borra el piso bajo los pies no es idempotente.
ACTUAL="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
ACTUAL="$(cd "$ACTUAL" 2>/dev/null && pwd || echo "$ACTUAL")"

APLICAR=0; RAMA=""; PURGAR_BAK=0; DETACHED=0
while [ $# -gt 0 ]; do
  case "$1" in
    --aplicar)           APLICAR=1 ;;
    --dry-run)           APLICAR=0 ;;
    --rama)              RAMA="${2:-}"; shift ;;
    --purgar-bak)        PURGAR_BAK=1 ;;
    --incluir-detached)  DETACHED=1 ;;
    -h|--help)           sed -n '1,40p' "$0"; exit 0 ;;
    *) echo "❌ opción desconocida: $1"; exit 2 ;;
  esac
  shift
done

# El ancestro se mide contra el ORIGIN fresco, no contra el reflog local: una rama puede estar
# mergeada hace horas y el local no saberlo. Sin este fetch el script no borra nada y parece que
# "no había basura" — el falso negativo más caro posible para un limpiador.
echo "── fetch de $REF (el ancestro se mide contra el remoto, no contra el local) ──"
if ! git -C "$ROOT" fetch origin main --quiet 2>/dev/null; then
  echo "⚠️  el fetch falló: sin red, lo que sigue mide contra un $REF POSIBLEMENTE RANCIO."
  echo "    No se borra nada en ese estado." ; APLICAR=0
fi

# 🔴 EL CRITERIO NO ES LA ANCESTRÍA DEL COMMIT, ES LA IGUALDAD DEL CONTENIDO.
# Primera versión (2026-11-09) preguntaba `merge-base --is-ancestor <rama> origin/main`. Este repo
# mergea con SQUASH: el merge crea un commit NUEVO con el mismo árbol, y el commit de la rama no
# queda en la historia de main. O sea que el criterio daba FALSO para toda rama realmente mergeada
# y el limpiador clasificaba BASURA=0 SIEMPRE — un gate que no puede disparar nunca, que es
# justamente el modo de falla que no da síntoma: la salida decía «el sistema está limpio» con 35
# worktrees y 1.220 ramas encima. Lo cazó el control POR EFECTO de autoaplicarlo a su propio PR
# (#1799, mergeado 390daf8a): la rama estaba mergeada y el script no la veía.
# Lo que SÍ es cierto después de un squash es que el árbol de la rama es idéntico al de origin/main
# — así que se mide el contenido, que es lo que importaba desde el principio: «¿queda algo acá que
# no esté en main?». Cubre squash, merge normal y fast-forward por igual.
_ya_entro() { git -C "$ROOT" diff --quiet "$REF" "refs/heads/$1" 2>/dev/null; }

# Un diff vacío NO dice nada de lo que todavía no se commiteó. Esta guarda es la que evita el único
# borrado irreversible que importa: un worktree cuyo contenido ya está en main pero que tiene
# trabajo sin commitear encima.
_limpio() { [ -z "$(git -C "$1" status --porcelain 2>/dev/null)" ]; }

MERGEADOS=(); VIVOS=(); SALTADOS=()
while IFS= read -r line; do
  case "$line" in worktree\ *) WT="${line#worktree }" ;; branch\ *) BR="${line#branch refs/heads/}"; _emit=1 ;; detached) BR=""; _emit=1 ;; "") _emit=0 ;; *) continue ;; esac
  [ "${_emit:-0}" = 1 ] || continue
  _emit=0
  WTN="$(cd "$WT" 2>/dev/null && pwd || echo "$WT")"

  # Guardas duras: el compartido y los pines NO se tocan jamás.
  if [ "$WTN" = "$PRINCIPAL" ]; then SALTADOS+=("$WTN  [checkout COMPARTIDO — intocable]"); continue; fi
  if [ -n "$ACTUAL" ] && [ "$WTN" = "$ACTUAL" ]; then SALTADOS+=("$WTN  [es el worktree desde el que corrés]"); continue; fi
  case "$WTN" in *_vigia-pins*) SALTADOS+=("$WTN  [pin de vigia.sh — lo regenera el lanzador]"); continue ;; esac

  if [ -z "$BR" ]; then
    if [ "$DETACHED" = 1 ]; then MERGEADOS+=("$WTN|")
    else SALTADOS+=("$WTN  [detached: sin rama no hay nada que comparar — usá --incluir-detached]"); fi
    continue
  fi
  if [ -n "$RAMA" ] && [ "$BR" != "$RAMA" ]; then SALTADOS+=("$WTN  [--rama $RAMA no la incluye]"); continue; fi

  if ! _ya_entro "$BR"; then VIVOS+=("$WTN|$BR"); continue; fi
  if ! _limpio "$WTN"; then SALTADOS+=("$WTN  [su contenido ya está en $REF, pero tiene cambios SIN COMMITEAR: no se toca]"); continue; fi
  MERGEADOS+=("$WTN|$BR")
done < <(git -C "$ROOT" worktree list --porcelain)

echo
echo "── worktrees con TRABAJO VIVO (no se tocan): ${#VIVOS[@]} ──"
for e in "${VIVOS[@]}"; do echo "   · ${e%%|*}  →  ${e##*|}"; done
echo
echo "── saltados por guarda: ${#SALTADOS[@]} ──"
for e in "${SALTADOS[@]}"; do echo "   · $e"; done
echo
echo "── BASURA (árbol idéntico a $REF y sin cambios locales ⇒ no queda nada acá): ${#MERGEADOS[@]} ──"
for e in "${MERGEADOS[@]}"; do _b="${e##*|}"; echo "   · ${e%%|*}  →  ${_b:-<detached>}"; done

if [ "${#MERGEADOS[@]}" -eq 0 ]; then
  echo "   (nada: el sistema está limpio)"
else
  if [ "$APLICAR" = 0 ]; then
    echo
    echo "⚠️  MODO REPORTE: no se borró nada. Para ejecutarlo: scripts/housekeeping.sh --aplicar"
  else
    echo
    for e in "${MERGEADOS[@]}"; do
      wt="${e%%|*}"; br="${e##*|}"
      echo "→ limpiando $wt ${br:+(rama $br)}"
      git -C "$ROOT" worktree remove --force "$wt" 2>&1 | sed 's/^/     /'
      if [ -n "$br" ]; then
        git -C "$ROOT" branch -D "$br" 2>&1 | sed 's/^/     /'
        # Sólo se borra en el remoto si EXISTE allá. Un `push --delete` de una rama que nunca se
        # pusheó imprime `error: failed to push some refs` y eso se lee como fallo del limpiador
        # cuando en realidad no había nada que borrar: el falso rojo enseña a ignorar la salida.
        if [ -n "$(git -C "$ROOT" ls-remote --heads origin "$br" 2>/dev/null)" ]; then
          git -C "$ROOT" push origin --delete "$br" 2>&1 | tail -1 | sed 's/^/     /'
        else
          echo "     (no existía en origin: nada que borrar allá)"
        fi
      fi
    done
    git -C "$ROOT" worktree prune
  fi
fi

# ── .bak de coordinacion/: se listan siempre, se borran sólo si se pide ──
COORD="$PRINCIPAL/coordinacion"
if [ -d "$COORD" ]; then
  mapfile -t BAKS < <(find "$COORD" -maxdepth 1 -type f -name '*.bak*' 2>/dev/null)
  echo
  echo "── .bak sueltos en coordinacion/: ${#BAKS[@]} ──"
  if [ "${#BAKS[@]}" -gt 0 ]; then
    _peso=0; for b in "${BAKS[@]}"; do _peso=$((_peso + $(wc -c < "$b"))); done
    echo "   peso total: $((_peso / 1048576)) MB"
    if [ "$PURGAR_BAK" = 1 ]; then
      for b in "${BAKS[@]}"; do rm -f "$b" && echo "   borrado: $(basename "$b")"; done
    else
      echo "   (no se borran sin --purgar-bak: alguno pudo ser un rescate real)"
    fi
  fi
fi

echo
echo "── control por EFECTO (no por autoevaluación) ──"
echo "   worktrees vivos ahora: $(git -C "$ROOT" worktree list | wc -l | tr -d ' ')"
echo "   ramas locales ahora:   $(git -C "$ROOT" branch | wc -l | tr -d ' ')"
echo "FIN-housekeeping-rc=0"
