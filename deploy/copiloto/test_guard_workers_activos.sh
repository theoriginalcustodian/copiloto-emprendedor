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

# Bloque COMPLETO de [5/7]: del guard hasta el cierre del heredoc (incluye el check WORKERPOLLER, que va
# DESPUÉS de los is-active). Se descarta la línea terminadora `REMOTE_UNITS`.
extraer_bloque_completo() {
  sed -n '/^SHA_GUARDA="\$SHA"$/,/^REMOTE_UNITS$/p' "$1" | sed '$d'
}

# Cabecera REAL del heredoc remoto de [5/7]: la línea que sigue a `<<'REMOTE_UNITS'`. Hoy es
# `set -euo pipefail`, y es lo ÚNICO que hace que un `systemctl is-active` fallido ABORTE el ssh (sin
# él, el rc del ssh es el del último comando: un worker principal caído con el de soporte activo
# daría 0). El test la copia tal cual en vez de inyectar su propio `set -e`: antes el wrapper lo ponía
# él mismo, así que borrar el `set -e` del heredoc real no ponía nada en rojo (mutante G3, 2026-10-13).
extraer_cabecera() {
  awk '/<<.REMOTE_UNITS.[[:space:]]*$/{getline; print; exit}' "$1" | tr -d '\r'
}

# correr_caso <nombre> <unit_caido: "" | y | z> [rc_poller]
#   y = worker principal, z = worker de soporte.
#   rc_poller (WORKERPOLLER): si viene, corre el bloque COMPLETO con `$VENV/bin/python` stubeado que
#   sale con ese rc -- los tres units quedan `active`, así que SÓLO el check de pollers puede abortar.
#   En ese modo imprime además `ARGS: <argv que recibió el check>`, `AVISO: si|no` (¿dijo «NO VERIFICADO»?)
#   y `MANIFIESTO: <última línea de DEPLOY-MANIFEST.json>` (el rastro que sobrevive al deploy).
#   manifiesto_dir=dir: el manifiesto es un DIRECTORIO, así que el append no puede confirmarse (ni como
#   root: no depende de chmod) -- el caso «no pude dejar constancia».
correr_caso() {
  local nombre="$1" unit_caido="$2" rc_poller="${3:-}" manifiesto_dir="${4:-}"
  local sandbox bin bloque cabecera script rc manif
  sandbox="$(mktemp -d)"; bin="$sandbox/bin"; mkdir -p "$bin" "$sandbox/remote"
  manif="$sandbox/remote/DEPLOY-MANIFEST.json"
  if [ -n "$manifiesto_dir" ]; then mkdir -p "$manif"; else echo '{"desplegado_en":"2026-10-13T00:00:00Z","linea":"semilla-del-deploy"}' > "$manif"; fi

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
  if [ -n "$unit_caido" ] && [ "\$unit" = "$unit_caido" ]; then echo "failed"; exit 3; fi
  echo "active"; exit 0
fi
exit 0
STUB
  chmod +x "$bin/systemctl"

  if [ -n "$rc_poller" ]; then
    bloque="$(extraer_bloque_completo "$DEPLOY")"
    mkdir -p "$sandbox/venv/bin"
    cat > "$sandbox/venv/bin/python" <<STUB
#!/usr/bin/env bash
echo "\$@" > "$sandbox/py-args"
exit $rc_poller
STUB
    chmod +x "$sandbox/venv/bin/python"
  else
    bloque="$(extraer_bloque "$DEPLOY")"
  fi
  if [ -z "$bloque" ]; then echo "  [$nombre] ERROR: no encontré el bloque del guard+is-active en $DEPLOY"; rm -rf "$sandbox"; return 2; fi
  cabecera="$(extraer_cabecera "$DEPLOY")"
  if [ -z "$cabecera" ]; then echo "  [$nombre] ERROR: no encontré el heredoc REMOTE_UNITS en $DEPLOY"; rm -rf "$sandbox"; return 2; fi

  # Mismo motivo que PIPELINEORDEN: correr como SCRIPT (bash <archivo>), no `eval` de una variable
  # con heredocs/loops embebidos -- eval no propaga el exit code de forma confiable ahí.
  script="$sandbox/bloque.sh"
  {
    printf '%s\n' "$cabecera"
    echo "SHA=\"$SHA\"; PORT=8099; WEB_UNIT=\"x\"; WORKER_UNIT=\"y\"; WORKER_SOPORTE_UNIT=\"z\"; CANARIO_FALLA=\"\"; REMOTE=\"$sandbox/remote\"; VENV=\"$sandbox/venv\"; DEPLOY_NONCE=\"nonce-de-prueba\""
    printf '%s\n' "$bloque"
    echo 'echo "LLEGO_AL_FINAL_DEL_BLOQUE"'
  } > "$script"

  rc=0
  out="$(export PATH="$bin:$PATH"; bash "$script" 2>&1)" || rc=$?
  echo "$out" | grep -q "LLEGO_AL_FINAL_DEL_BLOQUE" && llego="si" || llego="no"
  echo "$out" | grep -q "NO VERIFICADO" && aviso="si" || aviso="no"
  args=""; [ -f "$sandbox/py-args" ] && args="$(cat "$sandbox/py-args")"
  ultima=""; [ -f "$manif" ] && ultima="$(tail -n 1 "$manif")"
  rm -rf "$sandbox"
  echo "$llego"
  if [ -n "$rc_poller" ]; then echo "ARGS: $args"; echo "AVISO: $aviso"; echo "MANIFIESTO: $ultima"; fi
  return 0
}

echo "== GUARDSOLOWEB: $DEPLOY"
fallos=0

echo "-- caso 1 (control positivo): los tres units activos -> el bloque llega al final"
llego1="$(correr_caso "sano" "")"
if [ "$llego1" = "si" ]; then
  echo "  ok   caso sano: el guard deja pasar"
else
  echo "  ROJO: con los tres units sanos, el guard abortó igual -- falso positivo"
  fallos=$((fallos+1))
fi

# Los DOS workers, cada uno solo: el principal NO es el último comando del bloque, así que sólo aborta
# si el `set -e` de la cabecera real está; el de soporte sí es el último (su rc llega al ssh igual).
for par in "worker principal:y" "worker de soporte:z"; do
  etiqueta="${par%%:*}"; unit="${par##*:}"
  echo "-- caso 2 (el que importa): $etiqueta CAÍDO, /healthz sano -> el guard DEBE abortar"
  llego2="$(correr_caso "caido-$unit" "$unit")"
  if [ "$llego2" = "no" ]; then
    echo "  PASA: GUARDSOLOWEB — $etiqueta caído aborta el deploy aunque /healthz esté sano"
  else
    echo "  ROJO: $etiqueta cayó y el bloque llegó al final igual -- el gate es cosmético (el bug que esto cierra)"
    fallos=$((fallos+1))
  fi
done

# WORKERPOLLER: `is-active` prueba PROCESO. Con los tres units `active` y /healthz sano, un worker que
# no pollea su task queue (rc≠0 del check) TIENE que abortar; con el check sano, tiene que dejar pasar.
echo "-- caso 3 (control positivo): units activos + check de pollers sano -> llega al final"
res3="$(correr_caso "poller-sano" "" 0)"
if [ "$(echo "$res3" | head -n1)" = "si" ]; then
  echo "  ok   el check sano deja pasar"
else
  echo "  ROJO: el check de pollers salió 0 y el bloque abortó igual -- falso positivo"
  fallos=$((fallos+1))
fi
args3="$(echo "$res3" | sed -n 's/^ARGS: //p')"
for esperado in "worker_pollers_check.py" "y:AGENT_B_TASK_QUEUE:agent-emprendedor" "z:SOPORTE_TASK_QUEUE:agent-soporte"; do
  if echo "$args3" | grep -q -F -- "$esperado"; then
    echo "  ok   el check recibió $esperado"
  else
    echo "  ROJO: el check no recibió '$esperado' (argv: $args3)"
    fallos=$((fallos+1))
  fi
done

echo "-- caso 4 (el que importa): units ACTIVOS pero el worker NO pollea (check rc=1) -> DEBE abortar"
res4="$(correr_caso "poller-falta" "" 1)"
if [ "$(echo "$res4" | head -n1)" = "no" ]; then
  echo "  PASA: WORKERPOLLER — active-pero-sin-pollear aborta el deploy"
else
  echo "  ROJO: el worker no pollea y el bloque llegó al final igual -- is-active verde bastaba (el bug que esto cierra)"
  fallos=$((fallos+1))
fi

# Los estados del check que NO son un hallazgo del worker (ver worker_pollers_check.py). Un vacío del
# instrumento no es un hallazgo -- pero tampoco es un pase, y las dos mitades se prueban:
echo "-- caso 5: Temporal está arriba pero NO contestó la pregunta (rc=2, sin_api) -> SIGUE, EN VOZ ALTA"
res5="$(correr_caso "poller-sin-api" "" 2)"
if [ "$(echo "$res5" | head -n1)" = "si" ] && [ "$(echo "$res5" | sed -n 's/^AVISO: //p')" = "si" ]; then
  echo "  PASA: sin_api no aborta un deploy sano Y dice NO VERIFICADO"
else
  echo "  ROJO: rc=2 debía seguir con aviso «NO VERIFICADO» (llegó=$(echo "$res5" | head -n1), aviso=$(echo "$res5" | sed -n 's/^AVISO: //p'))"
  fallos=$((fallos+1))
fi

for par in "3:inalcanzable (sin Temporal el worker tampoco pollea)" "137:el check murió por señal (no es un resultado declarado)"; do
  rc_p="${par%%:*}"; que="${par#*:}"
  echo "-- caso 6: $que (rc=$rc_p) -> DEBE abortar"
  res6="$(correr_caso "poller-rc$rc_p" "" "$rc_p")"
  if [ "$(echo "$res6" | head -n1)" = "no" ]; then
    echo "  PASA: rc=$rc_p aborta el deploy"
  else
    echo "  ROJO: rc=$rc_p no abortó -- falla ABIERTO justo en el caso de activación del guard"
    fallos=$((fallos+1))
  fi
done

# RASTRO (condición de planificación sobre #1078): con rc=2 el deploy SIGUE y el aviso de stdout es
# efímero. Lo que queda dos horas después es el DEPLOY-MANIFEST.json: «verificó» y «no pudo verificar»
# tienen que ser DISTINGUIBLES ahí, y atables a su deploy (sha + nonce). Se mide contra el ARCHIVO.
manif_de() { echo "$1" | sed -n 's/^MANIFIESTO: //p'; }

echo "-- caso 7: rc=2 (sin_api) deja RASTRO «NO_VERIFICADO» en el manifiesto, atado a sha+nonce"
m5="$(manif_de "$res5")"
if echo "$m5" | grep -q -F '"evento":"workerpoller"' \
   && echo "$m5" | grep -q -F '"workerpoller":"NO_VERIFICADO"' \
   && echo "$m5" | grep -q -F '"rc":2' \
   && echo "$m5" | grep -q -F "\"sha\":\"$SHA\"" \
   && echo "$m5" | grep -q -F '"deploy_nonce":"nonce-de-prueba"'; then
  echo "  PASA: el deploy que no pudo verificar lo dice en el artefacto que sobrevive"
else
  echo "  ROJO: rc=2 siguió pero el manifiesto no lo registra (última línea: '$m5') -- indistinguible de un deploy verificado"
  fallos=$((fallos+1))
fi

echo "-- caso 8: rc=0 (verificado) deja el rastro DISTINTO -- si fuera igual, el registro no discrimina"
m3="$(manif_de "$res3")"
if echo "$m3" | grep -q -F '"workerpoller":"verificado"' && echo "$m3" | grep -q -F '"rc":0' \
   && ! echo "$m3" | grep -q -F 'NO_VERIFICADO'; then
  echo "  PASA: verificado y NO_VERIFICADO quedan distinguibles en el manifiesto"
else
  echo "  ROJO: rc=0 no dejó un rastro «verificado» distinto del de rc=2 (última línea: '$m3')"
  fallos=$((fallos+1))
fi

echo "-- caso 9: un aborto (rc=1) NO escribe rastro de «verificado» (la última línea sigue siendo la del deploy)"
m4="$(manif_de "$res4")"
if echo "$m4" | grep -q -F 'semilla-del-deploy'; then
  echo "  PASA: el deploy abortado no deja un evento workerpoller"
else
  echo "  ROJO: un deploy que abortó dejó un evento workerpoller (última línea: '$m4')"
  fallos=$((fallos+1))
fi

echo "-- caso 10: el rastro NO se puede confirmar (manifiesto no escribible) -> DEBE abortar, no seguir mudo"
res10="$(correr_caso "poller-sin-rastro" "" 2 dir)"
if [ "$(echo "$res10" | head -n1)" = "no" ]; then
  echo "  PASA: un deploy sin verificar que tampoco puede dejar constancia no se acredita"
else
  echo "  ROJO: sin poder escribir el rastro el deploy siguió -- el «NO VERIFICADO» vuelve a ser sólo stdout"
  fallos=$((fallos+1))
fi

echo
if [ "$fallos" -eq 0 ]; then echo "OK: GUARDSOLOWEB — is-active de los workers discrimina y puede abortar el deploy"; exit 0; fi
echo "FALLO: $fallos caso(s)"; exit 1
