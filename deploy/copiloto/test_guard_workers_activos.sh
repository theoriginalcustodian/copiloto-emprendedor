#!/usr/bin/env bash
# test_guard_workers_activos.sh — GUARDSOLOWEB: [5/7] reinicia TRES units (web + 2 workers) pero el
# único control POSITIVO que podía abortar el deploy era el `/healthz` del web. Un worker que no
# levanta (Temporal, el moat) es un fallo SILENCIOSO -- las conversaciones no avanzan, sin romper
# ninguna request. El fix: el `systemctl is-active` de los dos workers tiene que poder ABORTAR el
# deploy (no ser cosmético), y tiene que correr ANTES de [5.5/7] (publish), como ya exige
# PIPELINEORDEN para el guard de /healthz.
#
# Método (mismo patrón que test_guard_postrestart.sh): extrae el bloque real de [5/7] -- desde el
# guard de /healthz hasta el `systemctl is-active` del tercer unit -- y lo corre con `curl` y
# `systemctl` stubeados. Caso hostil: UC_CANARIO_WORKER_CAIDO=1 hace que `is-active` del worker
# devuelva "failed" (exit≠0) aunque /healthz esté sano. El guard DEBE abortar igual.
#
# Uso: bash deploy/copiloto/test_guard_workers_activos.sh [ruta/a/deploy.sh]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="${1:-$HERE/deploy.sh}"
SHA="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

# Bloque: desde `SHA_GUARDA=` (guard de /healthz) hasta el is-active del TERCER unit inclusive.
extraer_bloque() {
  sed -n '/^SHA_GUARDA="\$SHA"$/,/^systemctl is-active "\$WORKER_SOPORTE_UNIT"$/p' "$1"
}

# correr_caso <nombre> <worker_caido:0|1>
correr_caso() {
  local nombre="$1" worker_caido="$2"
  local sandbox bin bloque script rc
  sandbox="$(mktemp -d)"; bin="$sandbox/bin"; mkdir -p "$bin"

  cat > "$bin/curl" <<STUB
#!/usr/bin/env bash
echo '{"status":"ok","sha":"$SHA"}'
STUB
  chmod +x "$bin/curl"

  # systemctl stub: sólo entiende `is-active <unit>`. El worker "caído" devuelve texto+exit 3
  # (mismo exit code real de systemd para unidades que no están active).
  cat > "$bin/systemctl" <<STUB
#!/usr/bin/env bash
if [ "\$1" = "is-active" ]; then
  unit="\$2"
  if [ "$worker_caido" = "1" ] && [ "\$unit" = "y" ]; then echo "failed"; exit 3; fi
  echo "active"; exit 0
fi
exit 0
STUB
  chmod +x "$bin/systemctl"

  bloque="$(extraer_bloque "$DEPLOY")"
  if [ -z "$bloque" ]; then echo "  [$nombre] ERROR: no encontré el bloque del guard+is-active en $DEPLOY"; rm -rf "$sandbox"; return 2; fi

  # Mismo motivo que PIPELINEORDEN: correr como SCRIPT (bash <archivo>), no `eval` de una variable
  # con heredocs/loops embebidos -- eval no propaga el exit code de forma confiable ahí.
  script="$sandbox/bloque.sh"
  {
    echo 'set -euo pipefail'
    echo "SHA=\"$SHA\"; PORT=8099; WEB_UNIT=\"x\"; WORKER_UNIT=\"y\"; WORKER_SOPORTE_UNIT=\"z\"; CANARIO_FALLA=\"\""
    printf '%s\n' "$bloque"
    echo 'echo "LLEGO_AL_FINAL_DEL_BLOQUE"'
  } > "$script"

  rc=0
  out="$(export PATH="$bin:$PATH"; bash "$script" 2>&1)" || rc=$?
  echo "$out" | grep -q "LLEGO_AL_FINAL_DEL_BLOQUE" && llego="si" || llego="no"
  rm -rf "$sandbox"
  echo "$llego"
  return 0
}

echo "== GUARDSOLOWEB: $DEPLOY"
fallos=0

echo "-- caso 1 (control positivo): los tres units activos -> el bloque llega al final"
llego1="$(correr_caso "sano" "0")"
if [ "$llego1" = "si" ]; then
  echo "  ok   caso sano: el guard deja pasar"
else
  echo "  ROJO: con los tres units sanos, el guard abortó igual -- falso positivo"
  fallos=$((fallos+1))
fi

echo "-- caso 2 (el que importa): worker_soporte CAÍDO, /healthz sano -> el guard DEBE abortar"
llego2="$(correr_caso "worker-caido" "1")"
if [ "$llego2" = "no" ]; then
  echo "  PASA: GUARDSOLOWEB — un worker caído aborta el deploy aunque /healthz esté sano"
else
  echo "  ROJO: el worker cayó y el bloque llegó al final igual -- el gate es cosmético (el bug que esto cierra)"
  fallos=$((fallos+1))
fi

echo
if [ "$fallos" -eq 0 ]; then echo "OK: GUARDSOLOWEB — is-active de los workers discrimina y puede abortar el deploy"; exit 0; fi
echo "FALLO: $fallos caso(s)"; exit 1
