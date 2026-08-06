#!/usr/bin/env bash
# Job "backend" de .github/workflows/tests.yml, portado (contrato CI-PROPIO, 2026-08-06).
#
# Sólo la parte que ES la definición de la suite: qué corre y con qué comando. Cómo se para el
# Postgres efímero NO viaja acá a propósito -- es infraestructura específica de cada entorno (el
# service container de GH Actions vs. `deploy/copiloto/test-db.sh` en el VPS), y meterlo acá
# reintroduciría exactamente lo que el ADR-001 vino a sacar: una definición atrapada en un solo
# formato. Este script asume `DATABASE_URL` ya declarada y las dependencias ya instaladas (pip en
# GH, venv en el VPS -- también específico de cada lado).
#
# `PYTHON_BIN` parametriza el intérprete: en el VPS es el venv (`sync-test-backend.sh` pasa
# `/opt/uc-copiloto-venv/bin/python`), en GH Actions es el `python` que `setup-python` puso en el PATH.
#
# Args opcionales: si se pasan, reemplazan el default "collect + suite completa" por un solo
# `pytest` con esos args -- el mismo contrato que ya tenía `sync-test-backend.sh` para correr un
# archivo puntual en el dev-loop.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT/apps/copiloto"
PY="${PYTHON_BIN:-python}"

"$PY" provision.py

if [ "$#" -gt 0 ]; then
  "$PY" -m pytest -ra "$@"
else
  # collect primero: valida imports/mount del motor vendorizado en segundos, antes de pagar el
  # costo de la suite completa si algo ni siquiera importa.
  "$PY" -m pytest tests --co -q
  "$PY" -m pytest tests ../../motor/backend/agent ../../motor/clients/agent -q
fi
