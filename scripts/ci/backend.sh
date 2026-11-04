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

# Sin base, `provision.py` aborta (KeyError DATABASE_URL) y con `set -e` no corre NI UN test. En CI eso es
# lo correcto: fallar cerrado evita el verde con los @necesita_pg salteados. Pero el dev-loop sin Postgres
# que `sync-test-backend.sh` documenta como DEFAULT quedaba muerto (anunciaba «se SALTAN» y abortaba).
# El salto es OPT-OUT EXPLÍCITO: sólo el runner lo pide, y CI nunca define la variable.
if [ "${UC_SIN_PG:-0}" = "1" ]; then
  echo "==> provision.py SALTEADO (UC_SIN_PG=1): corrida sin Postgres, los @necesita_pg se saltan"
else
  "$PY" provision.py
fi

if [ "$#" -gt 0 ]; then
  "$PY" -m pytest -ra "$@"
else
  # collect primero: valida imports/mount del motor vendorizado en segundos, antes de pagar el
  # costo de la suite completa si algo ni siquiera importa.
  # CONTROLESDEPLOYSINGATE (2026-10-07): los dos controles `.py` de `deploy/copiloto/` entran acá y
  # no en `lint` porque necesitan pytest (uno es estilo pytest, el otro `unittest`), y `lint` corre
  # python STDLIB. Corridos como script, el primero salía VERDE sin ejecutar ninguna aserción.
  "$PY" -m pytest tests --co -q
  # SM-N58: el conteo de skips sale SIEMPRE al final, con el delta contra la línea base declarada, y
  # un skip no declarado hace fallar el job. Un `skipped` dentro de un verde se lee como cobertura
  # (SM-I7), y el conteo leído con `tail` ya mintió una vez (27 en vez de 41). `-rs` deja el motivo
  # de cada salto en el log; el junit da los nodeids, estables ante ediciones (el `path:línea` no).
  JUNIT="$(mktemp "${TMPDIR:-/tmp}/uc-backend-junit.XXXXXX.xml")"
  trap 'rm -f "$JUNIT"' EXIT
  set +e
  "$PY" -m pytest tests ../../motor/backend/agent ../../motor/clients/agent ../../deploy/copiloto/test_meclaves_check.py ../../deploy/copiloto/test_caddy_converge.py ../../deploy/copiloto/test_worker_pollers_check.py ../../scripts/ci/test_skips_linea_base.py -q -rs --junitxml="$JUNIT"
  RC_PYTEST=$?
  set -e
  # Sin Postgres los @necesita_pg se saltan por diseño (dev-loop): se informa, no se evalúa.
  SOLO_INFORMAR=(); [ "${UC_SIN_PG:-0}" = "1" ] && SOLO_INFORMAR=(--solo-informar)
  set +e
  "$PY" "$ROOT/scripts/ci/skips_linea_base.py" "$JUNIT" "$ROOT/scripts/ci/skips-linea-base.txt" "${SOLO_INFORMAR[@]}"
  RC_SKIPS=$?
  set -e
  [ "$RC_PYTEST" -ne 0 ] && exit "$RC_PYTEST"
  exit "$RC_SKIPS"
fi
