#!/usr/bin/env bash
# S3 — Único punto de contacto con el device. Todo lo que toca el teléfono pasa por acá.
#
# Por qué un harness y no `adb` suelto en cada prompt: este sprint corre sin operador, así que
# la evidencia de cada DoD tiene que ser un comando reproducible con salida verificable. Un
# agente tirando `adb` a mano produce evidencia que nadie puede re-correr después.
#
# Uso:
#   S3-device-harness.sh check                 -> device conectado y despierto
#   S3-device-harness.sh install <apk>         -> instala (reemplazando) y verifica
#   S3-device-harness.sh screencap <nombre>    -> PNG a _evidencia/
#   S3-device-harness.sh framestats <etiqueta> -> vuelca gfxinfo crudo a _evidencia/
#   S3-device-harness.sh reset-frames          -> limpia el buffer de frames antes de medir
#   S3-device-harness.sh logcat <etiqueta> <s> -> captura logcat N segundos
#   S3-device-harness.sh net <on|off>          -> corta/restaura wifi (DoD de F7, caché offline)
set -euo pipefail

PKG="${APP_PKG:-app.copiloto.emprendedor}"
EVID="${EVIDENCIA_DIR:-_evidencia}"

log() { printf '[S3] %s\n' "$*"; }
fail() { printf '[S3] ERROR: %s\n' "$*" >&2; exit 1; }

mkdir -p "$EVID"

# Un solo device conectado. Con dos, `adb` elige uno solo y la evidencia queda ambigua —
# peor que no medir, porque parece medida.
requiere_device() {
  local n
  n=$(adb devices | awk 'NR>1 && $2=="device"' | wc -l | tr -d ' ')
  [ "$n" -eq 1 ] || fail "esperaba exactamente 1 device conectado, hay $n. Salida:
$(adb devices)"
}

# Si la pantalla está apagada el screencap sale negro y el gesto no se puede medir.
# Se detecta y se reporta, NO se despierta a la fuerza: un device bloqueado puede ser
# el operador usándolo, y forzarlo sería tocar algo que no es nuestro.
requiere_pantalla() {
  local on
  on=$(adb shell dumpsys power 2>/dev/null | grep -oE 'mWakefulness=[A-Za-z]+' | head -1 | cut -d= -f2 || true)
  [ "$on" = "Awake" ] || fail "la pantalla no está despierta (mWakefulness=${on:-desconocido}) — la evidencia visual saldría en negro"
}

cmd="${1:-}"; shift || true

case "$cmd" in
  check)
    requiere_device
    log "device:  $(adb shell getprop ro.product.model | tr -d '\r') / Android $(adb shell getprop ro.build.version.release | tr -d '\r')"
    log "serial:  $(adb devices | awk 'NR==2{print $1}')"
    log "pantalla: $(adb shell wm size | tr -d '\r')"
    if adb shell pm list packages 2>/dev/null | grep -q "package:$PKG"; then
      log "app:     $PKG INSTALADA (versión $(adb shell dumpsys package "$PKG" | grep -m1 versionName | tr -d ' \r'))"
    else
      log "app:     $PKG NO instalada todavía"
    fi
    ;;

  install)
    apk="${1:-}"; [ -f "$apk" ] || fail "no encuentro el APK en '$apk'"
    requiere_device
    log "instalando $apk …"
    # -r reinstala conservando datos; -d permite bajar de versión (útil al re-buildear dev).
    adb install -r -d "$apk"
    adb shell pm list packages | grep -q "package:$PKG" || fail "instalé pero el paquete no aparece — la instalación no cerró"
    log "OK — $PKG instalado y verificado"
    ;;

  screencap)
    nombre="${1:?falta el nombre de la captura}"
    requiere_device; requiere_pantalla
    out="$EVID/${nombre}.png"
    adb exec-out screencap -p > "$out"
    # Un PNG de 0 bytes o de pocos KB suele ser una captura fallida que igual devuelve exit 0.
    bytes=$(wc -c < "$out" | tr -d ' ')
    [ "$bytes" -gt 5000 ] || fail "la captura salió de $bytes bytes — no es una pantalla real"
    log "OK — $out ($bytes bytes)"
    ;;

  reset-frames)
    requiere_device
    adb shell dumpsys gfxinfo "$PKG" reset >/dev/null
    log "buffer de frames limpio — medí a partir de acá"
    ;;

  framestats)
    etiqueta="${1:?falta la etiqueta de la medición}"
    requiere_device
    out="$EVID/framestats-${etiqueta}.txt"
    adb shell dumpsys gfxinfo "$PKG" framestats > "$out"
    grep -q "PROFILEDATA" "$out" || fail "gfxinfo no devolvió PROFILEDATA — ¿la app está en primer plano?"
    log "OK — $out ($(wc -l < "$out" | tr -d ' ') líneas)"
    ;;

  logcat)
    etiqueta="${1:?falta la etiqueta}"; segs="${2:-10}"
    requiere_device
    out="$EVID/logcat-${etiqueta}.txt"
    adb logcat -c
    timeout "$segs" adb logcat -v time > "$out" || true
    log "OK — $out ($(wc -l < "$out" | tr -d ' ') líneas en ${segs}s)"
    ;;

  net)
    estado="${1:?on|off}"
    requiere_device
    case "$estado" in
      off) adb shell svc wifi disable; adb shell svc data disable; log "red CORTADA" ;;
      on)  adb shell svc wifi enable;  adb shell svc data enable;  log "red restaurada" ;;
      *)   fail "estado inválido '$estado' (on|off)" ;;
    esac
    ;;

  *)
    fail "comando desconocido '${cmd:-}'. Ver el encabezado de este script."
    ;;
esac
