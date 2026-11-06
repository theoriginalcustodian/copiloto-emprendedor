#!/usr/bin/env bash
# scripts/ci/candado-stage.sh — candado por tríada del gate en el VPS. Se hace `source` desde gate.sh.
#
# Por qué existe: la tríada por sesión (sesion-env.sh, BL-B6) separa SESIONES, no dos gates de la
# MISMA tríada. El 2026-09-22 corrieron a la vez tres gates sobre el stage legacy (backend ×2 desde
# `_ctl/` detached + FE2): el `rm -rf` del stage de uno pasaba en medio de los tests de otro — 18
# ConnectionRefused en a267be6c, y parte de esa corrida pudo testear el código de 107fdf61, no el
# suyo. Lo peligroso no es el rojo: es un VERDE atado a un SHA cuyo código no fue el que corrió.
#
# Mecánica: `mkdir` remoto (atómico) sobre `<stage>.gate-lock`, con un archivo `owner` = token + SHA.
# Tomar/vencer/informar va en UNA sola llamada remota, para que el chequeo de vencimiento y la toma
# no queden separados por un viaje de red. Un candado más viejo que el TTL es de un gate muerto (se
# cortó la luz, se mató la terminal): se renombra (atómico) y se toma. Soltarlo exige ser el dueño.
#
# Parametrizable: UC_DEPLOY_HOST (host), UC_GATE_LOCK_WAIT (segundos de espera, default 900),
# UC_GATE_LOCK_TTL (vencimiento, default 1800), GATE_SSH (comando remoto; el test lo reemplaza por
# un shim local — no toca la red).

_CANDADO_HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
_CANDADO_TOKEN="$(hostname)-$$-$(date +%s)"

# _candado_intento <ruta> <ttl> <sha> → imprime TOMADO | VENCIDO_TOMADO <edad> <dueño> | OCUPADO <edad> <dueño>
#
# ⚠️ La exclusión mutua es la de la SYSCALL mkdir(2), NO la del binario `mkdir`. Medido 2026-11-06 en el runner de CI
# (Ubuntu 26.04, coreutils = uutils/Rust 0.10.0, ext4): entre 10 y 346 de 400 pares de `mkdir` simultáneos sobre el
# mismo path dieron DOS ganadores, mientras `os.mkdir` de python dio 0/150 y el `mkdir` GNU del VPS (24.04) 0/400. El
# kernel y el fs eran sanos; la herramienta no. Por eso se llama a la syscall directo (`python3`), y `python3` ausente
# es un error explícito (SIN_PYTHON3) en vez de un caer callado a un `mkdir` cuya atomicidad nadie midió.
_candado_intento() {
  local ruta="$1" ttl="$2" sha="$3"
  ${GATE_SSH:-ssh} "$_CANDADO_HOST" "
    L='$ruta'; T='$_CANDADO_TOKEN'
    command -v python3 >/dev/null 2>&1 || { echo SIN_PYTHON3; exit 0; }
    mk() { python3 -c 'import os,sys; os.mkdir(sys.argv[1])' \"\$1\"; }
    if mk \"\$L\" 2>/dev/null; then echo \"\$T $sha\" > \"\$L/owner\"; echo TOMADO; exit 0; fi
    edad=\$(( \$(date +%s) - \$(stat -c %Y \"\$L\" 2>/dev/null || date +%s) ))
    dueno=\$(cat \"\$L/owner\" 2>/dev/null || echo '?')
    if [ \"\$edad\" -gt '$ttl' ] && mv \"\$L\" \"\$L.vencido-\$T\" 2>/dev/null; then
      rm -rf \"\$L.vencido-\$T\"
      if mk \"\$L\" 2>/dev/null; then echo \"\$T $sha\" > \"\$L/owner\"; echo \"VENCIDO_TOMADO \$edad \$dueno\"; exit 0; fi
    fi
    echo \"OCUPADO \$edad \$dueno\""
}

# tomar_candado <stage> <sha> → 0 si lo tiene, 1 si venció la espera (el gate NO corre sobre un stage ajeno)
tomar_candado() {
  local ruta="$1.gate-lock" sha="$2" espera="${UC_GATE_LOCK_WAIT:-900}" ttl="${UC_GATE_LOCK_TTL:-1800}"
  local t0 r; t0=$(date +%s)
  while :; do
    r="$(_candado_intento "$ruta" "$ttl" "$sha")"
    case "$r" in
      SIN_PYTHON3*) echo "==> ❌ el host del VPS no tiene python3: sin él no hay una primitiva de candado atómica medida (el binario mkdir puede no serlo, ver arriba). No se corre sobre un stage sin candado." >&2; return 1 ;;
      TOMADO) echo "==> candado del stage tomado ($ruta)"; return 0 ;;
      VENCIDO_TOMADO*) echo "==> candado VENCIDO (${r#VENCIDO_TOMADO }) — era de un gate muerto; tomado"; return 0 ;;
    esac
    if [ $(( $(date +%s) - t0 )) -ge "$espera" ]; then
      echo "==> ❌ stage ocupado por otro gate de la MISMA tríada tras ${espera}s de espera (${r#OCUPADO }). No se corre sobre un stage ajeno." >&2
      return 1
    fi
    echo "==> stage ocupado por otro gate de la misma tríada (edad/dueño: ${r#OCUPADO }) — espero"
    sleep "${UC_GATE_LOCK_POLL:-15}"
  done
}

# soltar_candado <stage> → sólo borra el candado si el dueño es ESTA corrida
soltar_candado() {
  local ruta="$1.gate-lock"
  ${GATE_SSH:-ssh} "$_CANDADO_HOST" "grep -q '^$_CANDADO_TOKEN ' '$ruta/owner' 2>/dev/null && rm -rf '$ruta'" || true
}
