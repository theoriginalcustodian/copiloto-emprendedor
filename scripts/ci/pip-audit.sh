#!/usr/bin/env bash
# Auditoría recurrente de dependencias Python (SEC: pip-audit deja de ser una corrida puntual).
# Corre `pip-audit` sobre requirements.txt y FALLA si hay una dependencia con advisory conocido.
#
# CONTROL POSITIVO en la misma corrida: audita antes un pin sabidamente vulnerable (PyJWT 2.13.0,
# 15 advisories el 2026-11-05) y exige que lo detecte. Si el control no grita, el "0 vulnerables" de
# abajo no vale nada (base de avisos caída, red cortada, herramienta rota) y la corrida falla.
#
# PIPAUDIT_BIN permite apuntar a un pip-audit ya instalado; sin él se instala la versión pinneada.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"
PIPAUDIT_VERSION="2.10.1"
PY="${PYTHON_BIN:-python}"

if [ -n "${PIPAUDIT_BIN:-}" ]; then
  AUDIT=("$PIPAUDIT_BIN")
else
  "$PY" -m pip install -q "pip-audit==${PIPAUDIT_VERSION}"
  AUDIT=("$PY" -m pip_audit)
fi

CTRL="$(mktemp)"; trap 'rm -f "$CTRL"' EXIT
echo "PyJWT==2.13.0" > "$CTRL"
if "${AUDIT[@]}" -r "$CTRL" --no-deps >/dev/null 2>&1; then
  echo "ABORT [pip-audit]: el CONTROL POSITIVO (PyJWT==2.13.0) NO fue detectado: el instrumento no ve, el resultado no vale." >&2
  exit 2
fi
echo "==> control positivo OK (PyJWT==2.13.0 detectado como vulnerable)"

echo "==> pip-audit sobre requirements.txt"
"${AUDIT[@]}" -r requirements.txt --no-deps
echo "==> 0 dependencias con advisory conocido"
