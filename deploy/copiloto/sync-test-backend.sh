#!/usr/bin/env bash
# deploy/copiloto/sync-test-backend.sh — dev-loop de backend del Copiloto cliente-web.
# Sincroniza el worktree (apps/copiloto + motor vendorizado + deploy/worker) a un STAGE aislado del
# VPS y corre pytest EN EL venv del VPS (la PC no tiene temporalio/fastmcp; regla del proyecto: los
# tests corren en el VPS). NO toca el deploy vivo ni el stage de la sesión de deploy.
#
# IDEMPOTENTE: rm -rf del stage + re-untar en cada corrida (sin stale files).
# Parametrizable (cero hardcoding): UC_DEPLOY_HOST, UC_TEST_STAGE, UC_VENV, UC_TEST_DATABASE_URL.
# Uso: bash deploy/copiloto/sync-test-backend.sh [args de pytest]   (default: "tests -q")
#
# LOS TESTS CONTRA POSTGRES SON OPT-IN (UC_TEST_DATABASE_URL), Y EL DEFAULT ES NO CORRERLOS.
# Motivo: en fusion NO hay base ni schema de test — el rol `uc_factory` no puede crear ninguno
# (`rolcreatedb=false`, `has_database_privilege(...,'CREATE')=false`, medido 2026-07-22), así que la
# única URL disponible apunta al schema VIVO. Encenderlo por default haría que cada corrida de las
# tres sesiones escriba en producción: es el incidente de las 552 filas huérfanas otra vez.
# Aislar de verdad (base o schema propio) exige un superuser de fusion => MAYOR, fuera de este script.
#
# Y el skip se GRITA, no se susurra: `-ra` muestra el motivo de cada salto y el epílogo dice cuántos
# quedaron sin correr. Un `-q` que informa "passed" escondiendo 17 skipped se lee como cobertura
# completa y no lo es (hallazgo 2026-07-22).
set -euo pipefail

HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
STAGE="${UC_TEST_STAGE:-/opt/uc-copiloto-cliente-stage}"
VENV="${UC_VENV:-/opt/uc-copiloto-venv}"
LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MOTOR="motor"                                     # motor VENDORIZADO en el repo (Fase 2); antes: deploy/skeleton_kit/.../reference

# El default incluye `../../motor`: ahí viven 41 tests —el ConversationWorkflow ReAct, el dispatch, el
# barrido adversarial— que hasta el 2026-07-22 NO SE CORRÍAN NUNCA. No estaban rotos (41 passed la
# primera vez que se ejecutaron), pero nadie se habría enterado si se rompían, y es la columna del
# producto: la orquestación durable es el moat.
#
# El motor es un FORK DURO vendorizado (CLAUDE.md §2): se evoluciona acá, así que sus tests son
# nuestros y su rojo es nuestro problema. Con args explícitos manda lo que pida quien invoca — esto
# sólo cambia el default, que es lo que corre cuando nadie eligió nada.
if [ "$#" -gt 0 ]; then PYTEST_ARGS="$*"; else PYTEST_ARGS="tests ../../motor -q"; fi

# Opt-in explícito: sólo viaja si la sesión la exportó a propósito.
# `UC_RLS_FORCE` viaja con ella: los tests que provisionan tablas al vuelo (el adversarial de RLS)
# leen ese flag para decidir si nacen con `FORCE`. Default 1 — la base de tests ejercita el estado
# FINAL de la migración, no la etapa intermedia en la que está producción hoy.
#
# `COPILOTO_AUTOSANACION_DSN` viaja con el MISMO nombre que en producción, a propósito: el ciclo de
# auto-reparación lo lee desde el composition root con ese nombre, y darle otro en tests haría que
# la suite ejercite un cableado que no existe en ningún lado. Lo emite `test-db.sh --export` como
# `UC_TEST_AUTOSANACION_URL` (rol `copiloto_autosanacion`, BYPASSRLS, acotado a `copiloto_traumas`).
if [ -n "${UC_TEST_DATABASE_URL:-}" ]; then
  PG_ENV="DATABASE_URL='${UC_TEST_DATABASE_URL}' UC_RLS_FORCE='${UC_RLS_FORCE:-1}' "
  [ -n "${UC_TEST_AUTOSANACION_URL:-}" ] && \
    PG_ENV="${PG_ENV}COPILOTO_AUTOSANACION_DSN='${UC_TEST_AUTOSANACION_URL}' "
  # Mismo patrón que AUTOSANACION arriba, para el rol de lectura de la Consola (CONS0a). Emitido por
  # `test-db.sh --export` como `UC_TEST_CONSOLA_URL` (rol `copiloto_consola`, BYPASSRLS, SELECT-only).
  [ -n "${UC_TEST_CONSOLA_URL:-}" ] && \
    PG_ENV="${PG_ENV}COPILOTO_CONSOLA_DSN='${UC_TEST_CONSOLA_URL}' "
  PG_AVISO="ON — los tests @necesita_pg CORREN y ESCRIBEN en la base apuntada (UC_RLS_FORCE=${UC_RLS_FORCE:-1})"
else
  PG_ENV=""
  PG_AVISO="OFF — los tests @necesita_pg se SALTAN (no están en el número de abajo)"
fi

echo "==> sync worktree -> ${HOST}:${STAGE} (clean)"
# `--exclude __pycache__` no es cosmética: el checkout es COMPARTIDO por varias sesiones, y basta con
# que otra corra pytest para que se reescriban los `.pyc` mientras este `tar` lee el directorio →
# "file changed as we read it" y el sync aborta. Además viajan más rápido sin ellos, y los `.pyc` de
# la PC no le sirven a nadie en el VPS.
# `scripts/` viaja desde el 2026-07-31: sin él, `test_censo_except_guard.py` se **SKIPPEA** en local
# ("no está …/scripts/censo-except.py — checkout parcial") y corre sólo en el CI. Un guard que se
# salta en el bucle rápido es un guard que se descubre 8 minutos tarde: exactamente lo que este
# runner vino a evitar. Pasó de verdad — el CI cazó un `except` mudo que la corrida local no vio.
tar -C "$LOCAL" --exclude='__pycache__' --exclude='*.pyc' --exclude='.pytest_cache' \
  -czf - apps/copiloto "$MOTOR" deploy/worker scripts \
  | ssh "$HOST" "rm -rf '$STAGE' && mkdir -p '$STAGE' && tar -C '$STAGE' -xzf -"

echo "==> pytest en el venv del VPS: ${PYTEST_ARGS}"
echo "==> Postgres: ${PG_AVISO}"
set +e
ssh "$HOST" "cd '$STAGE/apps/copiloto' && ${PG_ENV}PYTHONPATH='$STAGE/apps/copiloto:$STAGE/$MOTOR' '$VENV/bin/python' -m pytest -ra ${PYTEST_ARGS}"
RC=$?
set -e

if [ -z "${UC_TEST_DATABASE_URL:-}" ]; then
  echo "==> ⚠️  Ese resultado NO incluye los tests contra Postgres. Para incluirlos:"
  echo "        eval \"\$(bash deploy/copiloto/test-db.sh --export)\"   # base efímera, rol NO-superuser"
  echo "        bash deploy/copiloto/sync-test-backend.sh ${PYTEST_ARGS}"
fi
exit $RC
