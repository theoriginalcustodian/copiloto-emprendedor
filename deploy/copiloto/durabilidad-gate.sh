#!/usr/bin/env bash
# deploy/copiloto/durabilidad-gate.sh — BL-B1 Parte B.
#
# Aísla la decisión de si la prueba de durabilidad (BL-B1/E3) corre, y el hecho de que un
# `--armar` fallido NUNCA debe abortar el deploy completo (deploy.sh corre con `set -euo
# pipefail`). Sourced por deploy/copiloto/deploy.sh; testeado en aislamiento por
# scripts/test-durabilidad-gate.sh sin tocar prod ni el worktree de deploy.
#
# Default: la prueba CORRE (invertido respecto del opt-in original -- 40 commits quedaron sin
# desplegar mientras el moat de durabilidad era opt-in y nadie lo pedía). Opt-out explícito:
# UC_SKIP_DURABILIDAD=1.

# uc_durabilidad_activa: true (rc=0) salvo UC_SKIP_DURABILIDAD=1 explícito.
uc_durabilidad_activa() {
  [ -z "${UC_SKIP_DURABILIDAD:-}" ]
}

# uc_durabilidad_armar <cmd...>: corre <cmd...> (el `--armar` real, o un comando de test). Su
# resultado se imprime por stdout como "1" (armó) / "0" (NO_MEDIBLE) -- NUNCA se propaga como
# fallo del propio uc_durabilidad_armar, así que bajo `set -e` el caller sigue vivo sin más que
# `if ! uc_durabilidad_armar ...` o una asignación `X=$(uc_durabilidad_armar ...)`.
uc_durabilidad_armar() {
  if "$@"; then
    echo 1
  else
    echo 0
  fi
}
