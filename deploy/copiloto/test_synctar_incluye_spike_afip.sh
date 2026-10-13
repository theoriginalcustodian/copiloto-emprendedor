#!/usr/bin/env bash
# test_synctar_incluye_spike_afip.sh — `apps/copiloto/tests/test_afip_payload_archivado.py` lee
# `spikes/afip-emit-pdf/RESULT.md` (la respuesta REAL de AFIP archivada) y lo compara contra el contrato
# del gateway. `sync-test-backend.sh` sólo empaqueta lo que su `tar` nombra: si RESULT.md no viaja, el
# test del VPS no encuentra su sujeto. Este control mide que el tar lo nombre, SIN VPS.
#
# Control positivo hermético: la MISMA línea con el path sacado tiene que fallar la misma prueba — si no
# discrimina, el verde no prueba nada. (No usa el historial de git: un HEAD que ya tiene el fix no daría
# control, y un clon superficial no tiene historia.)
#
# Uso: bash deploy/copiloto/test_synctar_incluye_spike_afip.sh [ruta/a/sync-test-backend.sh]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT="${1:-$HERE/sync-test-backend.sh}"
PATH_SPIKE="spikes/afip-emit-pdf/RESULT.md"

tiene_el_path() {
  # la línea del tar (`-czf - ...`), y sólo esa: un comentario que cite el path no cuenta como empaquetarlo
  grep -E '^[[:space:]]*-czf - .*[[:space:]]spikes/afip-emit-pdf/RESULT\.md([[:space:]]|$)' "$1" >/dev/null 2>&1
}

echo "== SYNCTARSPIKEAFIP: $SCRIPT"
fallos=0

if tiene_el_path "$SCRIPT"; then
  echo "  PASA: el tar de $SCRIPT incluye $PATH_SPIKE"
else
  echo "  ROJO: el tar NO declara $PATH_SPIKE — test_afip_payload_archivado.py no encontraría su sujeto en el VPS"
  fallos=$((fallos+1))
fi

# Control positivo: la misma línea SIN el path (sed sobre una copia) tiene que fallar.
SIN="$(mktemp)"
trap 'rm -f "$SIN"' EXIT
sed 's# spikes/afip-emit-pdf/RESULT\.md##' "$SCRIPT" > "$SIN"
if cmp -s "$SCRIPT" "$SIN"; then
  echo "  ROJO: el control no pudo quitar el path (la línea del tar cambió de forma) — el test no discrimina"
  fallos=$((fallos+1))
elif tiene_el_path "$SIN"; then
  echo "  ROJO: sacado el path del tar, la prueba SIGUE pasando — no discrimina"
  fallos=$((fallos+1))
else
  echo "  ok   control positivo: sin el path en el tar la prueba falla"
fi

# Contra el comentario: el path citado en un comentario NO puede satisfacer la prueba.
COM="$(mktemp)"
trap 'rm -f "$SIN" "$COM"' EXIT
printf '# tar ... spikes/afip-emit-pdf/RESULT.md\n  -czf - apps/copiloto scripts \\\n' > "$COM"
if tiene_el_path "$COM"; then
  echo "  ROJO: un comentario que cita el path satisface la prueba (el guard se satisface con su propio comentario)"
  fallos=$((fallos+1))
else
  echo "  ok   un comentario que cita el path no cuenta"
fi

echo
if [ "$fallos" -eq 0 ]; then echo "OK: SYNCTARSPIKEAFIP — el tar lleva $PATH_SPIKE al VPS"; exit 0; fi
echo "FALLO: $fallos caso(s)"; exit 1
