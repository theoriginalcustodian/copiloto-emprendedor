#!/usr/bin/env bash
# housekeeping-check.sh — MIDE si quedó basura de trabajo ya mergeado. No borra nada.
#
# DÓNDE VIVE Y POR QUÉ NO EN lint.sh: su corpus (worktrees y ramas locales) está FUERA del repo.
# Un gate así en CI daría vacío siempre — mediría al EQUIPO, no al commit, y en el runner no hay
# worktrees (memoria/un-gate-cuyo-corpus-vive-fuera-del-repo-mide-al-equipo-no-al-commit.md). Por eso
# se engancha al `pre-push`, que es local, y en CI se autodeclara NO-APLICABLE en vez de salir verde:
# un instrumento que no mira nunca falla, y ese verde absuelve al ciego.
#
# CALIBRACIÓN — bloquea sólo donde el falso positivo es imposible:
#   · BLOQUEA (rc=1): el worktree desde el que corrés tiene su rama ya mergeada en origin/main Y
#     con commits propios. Eso es basura inequívoca: el trabajo está adentro y seguís sentado ahí.
#   · AVISA (rc=0): los worktrees heredados de otras sesiones. Medido el 2026-11-09: 35 vivos y 1220
#     ramas locales. Un guard que grita en el caso normal se desarma solo
#     (memoria/el-guard-que-grita-en-el-caso-normal-se-desarma-solo.md), así que el pasivo histórico
#     se reporta, no frena a nadie.
#   · UC_HOUSEKEEPING_BLOQUEA=1 sube el aviso a bloqueo cuando el pasivo esté saldado.
set -uo pipefail

if [ "${CI:-}" = "true" ] || [ -n "${GITHUB_ACTIONS:-}" ]; then
  echo "── housekeeping: NO-APLICABLE en CI (su corpus son worktrees/ramas locales, acá no existen) ──"
  exit 0
fi

ROOT="$(git rev-parse --git-common-dir 2>/dev/null)" || exit 0
ROOT="$(cd "$(dirname "$ROOT")" && pwd)"
REF="origin/main"
BLOQUEA="${UC_HOUSEKEEPING_BLOQUEA:-0}"

PRINCIPAL="$(git -C "$ROOT" worktree list --porcelain | awk '/^worktree /{print substr($0,10); exit}')"
PRINCIPAL="$(cd "$PRINCIPAL" 2>/dev/null && pwd || echo "$PRINCIPAL")"
ACTUAL="$(git rev-parse --show-toplevel 2>/dev/null || echo "")"
ACTUAL="$(cd "$ACTUAL" 2>/dev/null && pwd || echo "$ACTUAL")"
RAMA_ACTUAL="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")"

git -C "$ROOT" fetch origin main --quiet 2>/dev/null || true

# Mismo criterio corregido que housekeeping.sh: CONTENIDO, no ancestría. El repo mergea con squash,
# así que `--is-ancestor` da falso para toda rama realmente mergeada y el medidor no podía disparar.
_ya_entro() { git -C "$ROOT" diff --quiet "$REF" "refs/heads/$1" 2>/dev/null; }
_limpio_aqui() { [ -z "$(git -C "$ROOT" status --porcelain 2>/dev/null)" ]; }

# ── 1. el caso duro: estoy sentado en un worktree cuyo trabajo YA entró ──
rc=0
if [ -n "$RAMA_ACTUAL" ] && [ "$RAMA_ACTUAL" != "HEAD" ] && [ "$ACTUAL" != "$PRINCIPAL" ]; then
  # "con commits propios" distingue basura de trabajo sin empezar: una rama recién creada desde
  # origin/main TAMBIÉN es ancestro, y marcarla sería el falso positivo que desarma el guard.
  propios="$(git -C "$ROOT" rev-list --count "$REF".."refs/heads/$RAMA_ACTUAL" 2>/dev/null || echo 0)"
  if _ya_entro "$RAMA_ACTUAL" && _limpio_aqui && [ "${propios:-0}" = "0" ]; then
    # ancestro + 0 commits propios: puede ser recién creada (limpio) o ya mergeada (basura).
    # Se distingue por si la rama tiene commits que origin/main NO tenía al crearse: si el reflog
    # del worktree muestra trabajo, es basura. Sin eso, se asume limpio y sólo se avisa.
    if [ "$(git -C "$ROOT" log --oneline -1 --format=%H "refs/heads/$RAMA_ACTUAL" 2>/dev/null)" = "$(git -C "$ROOT" rev-parse "$REF" 2>/dev/null)" ]; then
      echo "ℹ️  housekeeping: estás en '$RAMA_ACTUAL' (sin commits propios aún) — nada que limpiar."
    else
      echo "⚠️  housekeeping: '$RAMA_ACTUAL' ya es ancestro de $REF. Si tu PR se mergeó, este worktree es basura."
      echo "    → bash scripts/housekeeping.sh --aplicar --rama '$RAMA_ACTUAL'"
      [ "$BLOQUEA" = 1 ] && rc=1
    fi
  fi
fi

# ── 2. el pasivo: cuánta basura heredada hay (aviso, no bloqueo) ──
basura=0; detached=0
while IFS= read -r line; do
  case "$line" in
    worktree\ *) WT="${line#worktree }" ;;
    branch\ *)   BR="${line#branch refs/heads/}"; _e=1 ;;
    detached)    BR=""; _e=1 ;;
    *) continue ;;
  esac
  [ "${_e:-0}" = 1 ] || continue; _e=0
  WTN="$(cd "$WT" 2>/dev/null && pwd || echo "$WT")"
  [ "$WTN" = "$PRINCIPAL" ] && continue
  [ "$WTN" = "$ACTUAL" ] && continue
  case "$WTN" in *_vigia-pins*) continue ;; esac
  if [ -z "$BR" ]; then detached=$((detached+1)); continue; fi
  _ancestro "refs/heads/$BR" && basura=$((basura+1))
done < <(git -C "$ROOT" worktree list --porcelain)

nbak=0
[ -d "$PRINCIPAL/coordinacion" ] && nbak="$(find "$PRINCIPAL/coordinacion" -maxdepth 1 -type f -name '*.bak*' 2>/dev/null | wc -l | tr -d ' ')"
nramas="$(git -C "$ROOT" branch | wc -l | tr -d ' ')"

echo "── housekeeping (pasivo, aviso): worktrees mergeados=$basura · detached=$detached · ramas locales=$nramas · .bak en coordinacion/=$nbak ──"
if [ "$basura" -gt 0 ] || [ "$nbak" -gt 0 ]; then
  echo "    → barrido: bash scripts/housekeeping.sh            (reporta)"
  echo "               bash scripts/housekeeping.sh --aplicar  (borra lo mergeado)"
fi
exit "$rc"
