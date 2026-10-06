#!/usr/bin/env bash
# deploy/copiloto/durabilidad-gate.sh — BL-B1 Parte B (armado BLOQUEANTE, contrato POSTDEPLOY B).
#
# Decide si la prueba de durabilidad (BL-B1/E3) corre, y resuelve dónde está su credencial. Sourced
# por deploy/copiloto/deploy.sh; testeado en aislamiento por scripts/test-durabilidad-gate.sh sin
# tocar prod ni el worktree de deploy.
#
# Historia: la versión anterior dejaba pasar el restart cuando --armar fallaba ("NO_MEDIBLE, no
# bloqueante"). Resultado medido 2026-10-06: deploy a prod con el moat de durabilidad sin probar y
# con el log diciendo que el deploy fue OK. Un armado que falla NO deja pasar el restart.
#
# Default: la prueba CORRE y es bloqueante. Opt-out explícito y ruidoso: UC_SKIP_DURABILIDAD=1.

# uc_durabilidad_activa: true (rc=0) salvo UC_SKIP_DURABILIDAD=1 explícito.
uc_durabilidad_activa() {
  [ -z "${UC_SKIP_DURABILIDAD:-}" ]
}

# uc_durabilidad_env_e2e <local_root>: imprime la ruta de .env.e2e (rc=0) o nada (rc=1).
# Orden: UC_ENV_E2E_PATH explícito (si está y no existe, falla: no hay fallback silencioso) ->
# <worktree>/.env.e2e -> <checkout común>/.env.e2e.
# Por qué el tercero: .env.e2e es gitignored, así que un worktree de deploy NUNCA lo trae. Los
# worktrees comparten el git-common-dir; la raíz del checkout principal sale de ahí, sin hardcodear rutas.
uc_durabilidad_env_e2e() {
  local local_root="$1" common p
  if [ -n "${UC_ENV_E2E_PATH:-}" ]; then
    [ -f "$UC_ENV_E2E_PATH" ] && { echo "$UC_ENV_E2E_PATH"; return 0; }
    return 1
  fi
  p="$local_root/.env.e2e"
  [ -f "$p" ] && { echo "$p"; return 0; }
  common="$(git -C "$local_root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)" || common=""
  if [ -n "$common" ]; then
    p="$(dirname "$common")/.env.e2e"
    [ -f "$p" ] && { echo "$p"; return 0; }
  fi
  return 1
}

# uc_durabilidad_aviso_opt_out: el opt-out no es silencioso. Va a stderr y queda en el log del deploy.
uc_durabilidad_aviso_opt_out() {
  echo "⚠️⚠️ DURABILIDAD SALTEADA (UC_SKIP_DURABILIDAD=1): este deploy NO prueba que las conversaciones y el HITL sobrevivan el restart." >&2
}
