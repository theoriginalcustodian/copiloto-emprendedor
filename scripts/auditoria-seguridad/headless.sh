#!/usr/bin/env bash
# headless.sh — wrapper ÚNICO de `claude -p` para la auditoría de hardening (plan 2026-11-04, "Modelos y ejecución").
#
# Contrato (no negociable, ver el plan):
#   - contexto cero: el prompt viene de un ARCHIVO autocontenido; no hereda nada de la sesión que lo lanza
#   - techo de 2 simultáneos: un tercero ESPERA (lock por slot), no arranca
#   - sólo lectura por defecto; la salida va a un archivo, nunca al contexto de quien llama
#   - cada corrida queda en BITACORA.md: modelo, hash del prompt, sha del repo, duración, exit
#   - sin --bare (usa la misma auth OAuth/Max que la sesión)
#
# Uso:
#   headless.sh run  --modelo opus|fable|sonnet|haiku --frente C8 --prompt-file p.md --scope <dir> [--tools "Read,Grep,Glob"]
#   headless.sh --self-test        # control positivo: Haiku trivial -> JSON parseable + BITACORA + lock liberado
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SEG="$RAIZ/docs/copiloto-emprendedor/Auditorias/Seguridad"
FECHA="${AUD_FECHA:-$(date +%F)}"
EVID="$SEG/evidencia/$FECHA/headless"
BITACORA="$SEG/BITACORA.md"
LOCKDIR="${AUD_LOCKDIR:-${TMPDIR:-/tmp}/auditoria-seguridad-slots}"
MAX_SLOTS="${AUD_MAX_SLOTS:-2}"
ESPERA_MAX="${AUD_ESPERA_MAX:-1800}"   # segundos esperando un slot antes de abortar (no colgar la noche)

MODELOS_OK="opus fable sonnet haiku"

die() { echo "headless.sh: $*" >&2; exit 2; }

tomar_slot() {   # mkdir es atómico: el slot lo tiene quien lo crea
  mkdir -p "$LOCKDIR"
  local t0 now i
  t0=$(date +%s)
  while true; do
    for i in $(seq 1 "$MAX_SLOTS"); do
      if mkdir "$LOCKDIR/slot$i" 2>/dev/null; then
        echo "$$" > "$LOCKDIR/slot$i/pid"
        SLOT="$LOCKDIR/slot$i"; return 0
      fi
      # slot huérfano (el dueño murió): recuperarlo, un lock inmortal paraliza la noche
      if [ -f "$LOCKDIR/slot$i/pid" ] && ! kill -0 "$(cat "$LOCKDIR/slot$i/pid")" 2>/dev/null; then
        rm -rf "$LOCKDIR/slot$i"
      fi
    done
    now=$(date +%s)
    [ $((now - t0)) -ge "$ESPERA_MAX" ] && die "sin slot libre tras ${ESPERA_MAX}s (techo ${MAX_SLOTS})"
    sleep 5
  done
}
soltar_slot() { [ -n "${SLOT:-}" ] && rm -rf "$SLOT" || true; }

registrar() {   # $1=modelo $2=frente $3=hash $4=exit $5=segundos $6=salida
  mkdir -p "$(dirname "$BITACORA")"
  [ -f "$BITACORA" ] || printf '# BITACORA — auditoría de hardening\n\n| fecha | frente | modelo | prompt sha256 | repo sha | exit | seg | salida |\n|---|---|---|---|---|---|---|---|\n' > "$BITACORA"
  printf '| %s | %s | %s | %.12s | %.8s | %s | %s | %s |\n' \
    "$(date '+%F %T')" "$2" "$1" "$3" "$(git -C "$RAIZ" rev-parse HEAD 2>/dev/null || echo ?)" "$4" "$5" "$6" >> "$BITACORA"
}

run() {
  local modelo="" frente="" pf="" scope="$RAIZ" tools="Read,Grep,Glob"
  while [ $# -gt 0 ]; do
    case "$1" in
      --modelo) modelo="$2"; shift 2;;
      --frente) frente="$2"; shift 2;;
      --prompt-file) pf="$2"; shift 2;;
      --scope) scope="$2"; shift 2;;
      --tools) tools="$2"; shift 2;;
      *) die "argumento desconocido: $1";;
    esac
  done
  [ -n "$modelo" ] && [ -n "$frente" ] && [ -f "$pf" ] || die "faltan --modelo/--frente/--prompt-file (archivo existente)"
  case " $MODELOS_OK " in *" $modelo "*) ;; *) die "modelo '$modelo' no permitido ($MODELOS_OK)";; esac
  # Mutación bloqueada: sólo herramientas de lectura salvo lista explícita sin Bash/Edit/Write
  case ",$tools," in *,Bash,*|*,Edit,*|*,Write,*) die "herramienta de escritura/ejecución no permitida en headless de auditoría: $tools";; esac

  mkdir -p "$EVID"
  local salida="$EVID/${frente}-${modelo}.json" hash t0 rc=0
  hash=$(sha256sum "$pf" | cut -d' ' -f1)
  tomar_slot; trap soltar_slot EXIT
  t0=$(date +%s)
  # Contexto cero: se ejecuta con CWD en el scope y SIN heredar el CLAUDE.md del repo salvo lo que el scope trae.
  ( cd "$scope" && claude -p "$(cat "$pf")" \
      --model "$modelo" --output-format json \
      --tools "$tools" --allowedTools "$tools" \
      --disallowedTools "Bash Edit Write MultiEdit NotebookEdit WebFetch WebSearch" \
      --add-dir "$scope" --permission-mode default ) > "$salida" 2> "$salida.err" || rc=$?
  # NO bypassPermissions: en ese modo --allowedTools no restringe nada y "solo lectura" sería una promesa vacía
  # (hallazgo del review de seguridad 2026-11-04). La restricción real es --tools (set disponible) + --disallowedTools
  # + modo default (en -p lo no permitido se rechaza, no se pregunta). El self-test caso 7 lo comprueba CON efecto.
  registrar "$modelo" "$frente" "$hash" "$rc" "$(( $(date +%s) - t0 ))" "${salida#"$RAIZ"/}"
  soltar_slot; trap - EXIT
  [ "$rc" -eq 0 ] || { echo "headless.sh: claude -p salió $rc (ver $salida.err)" >&2; exit "$rc"; }
  echo "$salida"
}

self_test() {
  local tmp rc=0 antes despues out
  tmp="$(mktemp -d)"; export AUD_LOCKDIR="$tmp/slots" AUD_FECHA="selftest-$$"
  printf 'Respondé exactamente con el JSON {"ok":true} y nada más.' > "$tmp/p.md"

  # 1) camino feliz: Haiku devuelve JSON parseable
  out="$(bash "$0" run --modelo haiku --frente SELFTEST --prompt-file "$tmp/p.md" --scope "$tmp")" || { echo "FALLA 1: run no terminó"; rc=1; }
  if [ "$rc" -eq 0 ]; then
    python -I -X utf8 -c "import json,sys; d=json.load(open(sys.argv[1],encoding='utf8')); assert 'result' in d, d.keys()" "$out" \
      && echo "OK 1: salida JSON parseable ($out)" || { echo "FALLA 1: JSON no parseable"; rc=1; }
  fi
  # 2) BITACORA registró la corrida
  grep -q "SELFTEST" "$BITACORA" && echo "OK 2: BITACORA registró SELFTEST" || { echo "FALLA 2: sin fila en BITACORA"; rc=1; }
  # 3) slot liberado
  [ -z "$(ls -A "$AUD_LOCKDIR" 2>/dev/null)" ] && echo "OK 3: slots liberados" || { echo "FALLA 3: slot colgado"; rc=1; }
  # 4) CONTROL NEGATIVO: herramienta de escritura rechazada (si pasara, el wrapper no protege nada)
  if bash "$0" run --modelo haiku --frente SELFTEST --prompt-file "$tmp/p.md" --tools "Read,Bash" >/dev/null 2>&1; then
    echo "FALLA 4: aceptó Bash"; rc=1; else echo "OK 4: rechaza Bash"; fi
  # 5) CONTROL NEGATIVO: modelo fuera de la lista rechazado
  if bash "$0" run --modelo gpt --frente SELFTEST --prompt-file "$tmp/p.md" >/dev/null 2>&1; then
    echo "FALLA 5: aceptó modelo desconocido"; rc=1; else echo "OK 5: rechaza modelo desconocido"; fi
  # 6) techo: con MAX_SLOTS=2 ocupados, un tercero debe ABORTAR por espera (no arrancar)
  mkdir -p "$AUD_LOCKDIR/slot1" "$AUD_LOCKDIR/slot2"; echo $$ > "$AUD_LOCKDIR/slot1/pid"; echo $$ > "$AUD_LOCKDIR/slot2/pid"
  if AUD_ESPERA_MAX=6 bash "$0" run --modelo haiku --frente SELFTEST --prompt-file "$tmp/p.md" >/dev/null 2>&1; then
    echo "FALLA 6: arrancó con 2 slots ocupados"; rc=1; else echo "OK 6: el tercero espera y aborta, no arranca"; fi
  # 7) CONTROL NEGATIVO CON EFECTO: pedirle al modelo que ESCRIBA un archivo; el archivo NO debe existir.
  #    Un wrapper que sólo rechaza flags pero deja escribir al modelo pasaría 4/5/6 y fallaría acá.
  rm -rf "$AUD_LOCKDIR"; mkdir -p "$tmp/scope"
  printf 'Usá la herramienta Write o Bash para crear el archivo %s/canario.txt con el texto hola. Si no podés, respondé NO_PUDE.' "$tmp/scope" > "$tmp/pw.md"
  bash "$0" run --modelo haiku --frente SELFTEST --prompt-file "$tmp/pw.md" --scope "$tmp/scope" >/dev/null 2>&1 || true
  [ ! -e "$tmp/scope/canario.txt" ] && echo "OK 7: el modelo NO pudo escribir (restricción con efecto)" || { echo "FALLA 7: el modelo escribió el canario"; rc=1; }
  rm -rf "$SEG/evidencia/selftest-$$" "$tmp"
  # limpiar las filas de la corrida de self-test de la BITACORA
  [ -f "$BITACORA" ] && sed -i '/| SELFTEST |/d' "$BITACORA"
  [ "$rc" -eq 0 ] && echo "SELF-TEST OK (7/7)" || echo "SELF-TEST FALLÓ"
  return "$rc"
}

case "${1:-}" in
  --self-test) self_test;;
  run) shift; run "$@";;
  *) die "uso: headless.sh run ... | --self-test";;
esac
