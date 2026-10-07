#!/usr/bin/env bash
# test_pipelineorden_publish_tras_guard.sh — PIPELINEORDEN: si el guard de /healthz de [5/7] aborta,
# el publish de [5.5/7] (swap del symlink `dist`) NO puede llegar a ejecutarse NUNCA. Es la garantía
# que deja prod coherente (frontend viejo + API viejo) ante cualquier abort a mitad de pipeline --
# la auditoría 2026-10-06 midió la forma contraria del bug: /healthz `a659f0b2` (viejo) vs shell
# `1aedff14` (nuevo), con el pipeline de ANTES (publish en [1/7], antes del restart/gate).
#
# Método: extrae el bloque REAL de deploy.sh desde [5/7] hasta el cierre del heredoc REMOTE_PUBLISH
# (dos invocaciones `ssh` SEPARADAS, tal cual el script las emite) y las corre con un `ssh` stub que
# NO interpreta el heredoc -- sólo registra CUÁL de las dos lo invocó (por una marca única de cada
# heredoc) y devuelve el exit code que el caso pide. Nunca toca el VPS ni systemctl.
#
# Control positivo (discriminación): en el caso "guard aborta", el stub de REMOTE_UNITS devuelve 1 --
# eso depende de que `set -euo pipefail` esté activo en el bloque extraído (lo está: deploy.sh lo fija
# una sola vez, al principio del archivo, y el bloque extraído no lo pisa). Si el test corriera SIN
# heredar ese `set -e`, el caso "aborta" fallaría silenciosamente y lo hubiera cazado el control
# negativo (abajo).
#
# Uso: bash deploy/copiloto/test_pipelineorden_publish_tras_guard.sh [ruta/a/deploy.sh]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="${1:-$HERE/deploy.sh}"

# Bloque: desde el echo de [5/7] hasta el cierre literal del heredoc REMOTE_PUBLISH (dos `ssh` reales).
extraer_bloque() {
  sed -n '/^echo "==> \[5\/7\]/,/^REMOTE_PUBLISH$/p' "$1"
}

# correr_caso <nombre> <deploy> <guard_falla:0|1>
correr_caso() {
  local nombre="$1" deploy="$2" guard_falla="$3"
  local sandbox bin bloque log rc
  sandbox="$(mktemp -d)"; bin="$sandbox/bin"; mkdir -p "$bin"
  log="$sandbox/ssh-calls.log"; : > "$log"

  # ssh stub: lee el heredoc completo de stdin, lo clasifica por una marca única de cada uno
  # (ambas marcas viven HOY en deploy.sh, no las inventa el test), y lo anota en el log.
  cat > "$bin/ssh" <<STUB
#!/usr/bin/env bash
entrada="\$(cat)"
if echo "\$entrada" | grep -q "SHA_GUARDA="; then
  echo "REMOTE_UNITS" >> "$log"
  [ "$guard_falla" = "1" ] && exit 1 || exit 0
fi
if echo "\$entrada" | grep -q "dist.tmp"; then
  echo "REMOTE_PUBLISH" >> "$log"
  exit 0
fi
echo "DESCONOCIDO" >> "$log"; exit 0
STUB
  chmod +x "$bin/ssh"

  bloque="$(extraer_bloque "$deploy")"
  if [ -z "$bloque" ]; then echo "  [$nombre] ERROR: no encontré el bloque [5/7]..[5.5/7] en $deploy"; rm -rf "$sandbox"; return 2; fi

  # `eval "$bloque"` con heredocs REALES embebidos en el texto (<<'REMOTE_UNITS'...) no propaga el
  # exit code a `set -e` de forma confiable (reproducido: el mismo bloque SÍ aborta bien corrido como
  # archivo con `bash`, pero vía `eval` de una variable no) -- por eso se escribe a un script temporal
  # y se corre con `bash`, nunca con `eval`. Mismo contenido, canal de ejecución distinto.
  script="$sandbox/bloque.sh"
  {
    echo 'set -euo pipefail'
    echo 'HOST="stub-host"; REMOTE="/stub"; SHA_BUILD="cccccccccccccccccccccccccccccccccccccccc"; STG="dist-cccc-run"'
    echo 'WEB_PORT=8099; WEB_UNIT="x"; WORKER_UNIT="y"; WORKER_SOPORTE_UNIT="z"'
    echo "LOCAL=\"$sandbox\"; UC_CANARIO_FALLA_TRAS_RESTART=\"\""
    printf '%s\n' "$bloque"
  } > "$script"

  rc=0
  ( export PATH="$bin:$PATH"; bash "$script" ) >/dev/null 2>&1 || rc=$?

  cat "$log"
  rm -rf "$sandbox"
  return 0
}

echo "== PIPELINEORDEN: $DEPLOY"
fallos=0

echo "-- caso 1 (control positivo): guard SANO -> las dos ssh (UNITS y PUBLISH) tienen que correr"
llamadas1="$(correr_caso "sano" "$DEPLOY" "0")"
echo "   llamadas: $(echo "$llamadas1" | tr '\n' ' ')"
if echo "$llamadas1" | grep -q "REMOTE_UNITS" && echo "$llamadas1" | grep -q "REMOTE_PUBLISH"; then
  echo "  ok   caso sano: publish corrió"
else
  echo "  ROJO: caso sano no corrió las dos ssh esperadas"; fallos=$((fallos+1))
fi

echo "-- caso 2 (el caso que importa): guard ABORTA -> PUBLISH NO puede correr nunca"
llamadas2="$(correr_caso "guard-aborta" "$DEPLOY" "1")"
echo "   llamadas: $(echo "$llamadas2" | tr '\n' ' ')"
if echo "$llamadas2" | grep -q "REMOTE_UNITS" && ! echo "$llamadas2" | grep -q "REMOTE_PUBLISH"; then
  echo "  PASA: PIPELINEORDEN — el abort del guard deja a PUBLISH sin ejecutar (prod queda coherente, todo viejo)"
else
  echo "  ROJO: PUBLISH corrió a pesar del abort del guard -- prod quedaría mezclado (el bug que esto cierra)"
  fallos=$((fallos+1))
fi

# Control negativo real: bf406abe YA tiene la separación (su propio comentario cita "(PIPELINEORDEN)"
# -- #871 la introdujo antes de bf406abe, así que ese SHA no sirve de "antes"). El baseline correcto es
# 37562bdb (padre de c7e38bff/#871, el commit que introdujo [5.5/7]): ahí el publish vivía adentro de
# [1/7]/el build, sin un segundo `ssh` separado tras el guard -- la extracción tiene que dar VACÍO
# (sin terminador REMOTE_PUBLISH, confirmado: 0 hits de esa cadena en ese SHA), que es justo la forma
# del defecto: no hay un "después del guard" que discrimine, porque todo se publicó ANTES del guard.
VIEJO_SHA="37562bdb5488762fcee6652f9260372fcd98bcc9"
if git -C "$HERE" cat-file -e "$VIEJO_SHA:deploy/copiloto/deploy.sh" 2>/dev/null; then
  VIEJO="$(mktemp)"
  git -C "$HERE" show "$VIEJO_SHA:deploy/copiloto/deploy.sh" > "$VIEJO"
  if grep -q "REMOTE_PUBLISH" "$VIEJO"; then
    echo "  CONTROL FALLIDO: $VIEJO_SHA sí tiene REMOTE_PUBLISH -- no es el baseline pre-separación que se esperaba"
    fallos=$((fallos+1))
  else
    echo "  ok   control negativo: $VIEJO_SHA (pre-#871) NO separa publish del build -- confirma que la garantía es posterior a ese SHA"
  fi
  rm -f "$VIEJO"
else
  echo "  control negativo contra $VIEJO_SHA: SALTEADO (SHA no alcanzable -- fetch con profundidad completa primero)"
fi

echo
if [ "$fallos" -eq 0 ]; then echo "OK: PIPELINEORDEN — publish nunca corre si el guard post-restart abortó"; exit 0; fi
echo "FALLO: $fallos caso(s)"; exit 1
