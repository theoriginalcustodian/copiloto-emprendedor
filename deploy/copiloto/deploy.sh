#!/usr/bin/env bash
# deploy/copiloto/deploy.sh — deploy vivo del Copiloto del Emprendedor (Task 11, plan
# 2026-07-03-copiloto-deploy-multitenant.md). Se ejecuta DESDE la PC del operador (mismo patrón que
# <scratchpad>/deploy_sync_test.sh): sincroniza el worktree -> VPS y desde ahí orquesta TODO
# server-side por SSH. Secretos NUNCA bajan a la PC ni se imprimen (SUPABASE_JWT_SECRET se
# sourcea VPS->fusion y se escribe directo en /etc/unreal-copilot/copiloto.env, server-side).
#
# IDEMPOTENTE: corrible N veces sin duplicar unidades, sin re-agregar bloques de Caddy, sin romper
# hermes/temporal/mp/el vhost raíz (Caddy SOLO se recarga si `caddy validate` da OK; si no valida,
# aborta dejando el Caddyfile original intacto).
#
# Parametrizable (cero hardcoding — un 2º entorno solo pisa estas env vars, sin editar el script):
#   UC_DEPLOY_HOST        alias SSH del VPS destino          (default: unreal-copilot)
#   UC_DEPLOY_PATH        path estable del código en el VPS   (default: /opt/uc-repos/copiloto)
#   UC_ENV_DIR            dir de EnvironmentFile del VPS      (default: /etc/unreal-copilot)
#   UC_VENV               venv Python del VPS                 (default: /opt/uc-copiloto-venv)
#   COPILOTO_WEB_PORT     puerto donde escucha uvicorn         (default: 8099)
#   UC_BASE_DOMAIN        dominio base (sslip.io del VPS)      (default: 178-105-191-1.sslip.io)
#   UC_COPILOTO_SUBDOMAIN subdominio nuevo del front-door      (default: copiloto)
#   UC_MP_SUBDOMAIN       subdominio existente de MercadoPago  (default: mp)
#   UC_SKIP_DRIFT_CHECK   saltea el guard de checkout-vs-main   (default: sin setear = guard activo)
#   UC_AUTH_URL           base pública de auth para el botón Google (VITE_AUTH_URL en el build de
#                         frontend) (default: https://copilotoemprendedor.duckdns.org)
set -euo pipefail

LOCAL="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Guard: un checkout desactualizado sube apps/copiloto/motor TAL CUAL el disco y regresiona en
# silencio código ya arreglado en origin/main -- sin conflicto de git, sin error (pasó el
# 2026-07-23: /actividad y /inteligencia/* volvieron a romperse por un deploy desde una rama vieja).
# Ver memoria/deploy-sh-no-valida-checkout-al-dia-con-main.md. Escape hatch UC_SKIP_DRIFT_CHECK=1
# para el caso legítimo de desplegar una rama de feature aislada a propósito.
#
# ⚠️ Cómo se mide importa (2026-07-28). La v1 usaba `git diff origin/main -- apps/copiloto motor`,
# que compara pasando por el ÍNDICE de la rama chequeada. Con checkout compartido —tres sesiones,
# cada una en su rama— eso da FALSO POSITIVO aunque el disco sea idéntico a main: los archivos que
# main tiene y el índice de la otra rama no, cuentan como borrados. Midió 1502 líneas de drift con
# el disco byte a byte igual a main (210 archivos verificados uno por uno).
# Y un guard que grita en el caso NORMAL enseña a saltearlo por reflejo: a las dos semanas nadie lo
# lee y vuelve el incidente que vino a prevenir. Un falso positivo no es "ruido": desarma el guard.
# La v2 arma un índice TEMPORAL desde origin/main y stagea el disco contra él, así la comparación es
# disco-vs-main sin que el índice real (de otra sesión) participe. Mismo mecanismo que ya se usa para
# commitear en checkout compartido. Verificado en las dos direcciones antes de instalarlo: disco==main
# -> 0; con una línea agregada a serve.py -> 9.
if [ -z "${UC_SKIP_DRIFT_CHECK:-}" ]; then
  git -C "$LOCAL" fetch origin main --quiet
  _idx="$(mktemp)"
  DRIFT="$(GIT_INDEX_FILE="$_idx" git -C "$LOCAL" read-tree origin/main 2>/dev/null \
    && GIT_INDEX_FILE="$_idx" git -C "$LOCAL" add -- apps/copiloto motor 2>/dev/null \
    && GIT_INDEX_FILE="$_idx" git -C "$LOCAL" diff --cached origin/main -- apps/copiloto motor | wc -l)"
  rm -f "$_idx"
  if [ "$DRIFT" -ne 0 ]; then
    echo "ABORT: el checkout local difiere de origin/main en apps/copiloto/motor ($DRIFT líneas de diff)." >&2
    echo "Desplegar así regresiona en silencio código ya arreglado en main. Rebaseá/mergeá primero," >&2
    echo "o si el drift es intencional corré con UC_SKIP_DRIFT_CHECK=1." >&2
    exit 1
  fi
fi
HOST="${UC_DEPLOY_HOST:-unreal-copilot}"
REMOTE="${UC_DEPLOY_PATH:-/opt/uc-repos/copiloto}"
ENVDIR="${UC_ENV_DIR:-/etc/unreal-copilot}"
VENV="${UC_VENV:-/opt/uc-copiloto-venv}"
WEB_PORT="${COPILOTO_WEB_PORT:-8099}"
BASE_DOMAIN="${UC_BASE_DOMAIN:-178-105-191-1.sslip.io}"
COPILOTO_SUBDOMAIN="${UC_COPILOTO_SUBDOMAIN:-copiloto}"
MP_SUBDOMAIN="${UC_MP_SUBDOMAIN:-mp}"
AUTH_URL="${UC_AUTH_URL-https://copilotoemprendedor.duckdns.org}"   # `-` (no `:-`): permite UC_AUTH_URL="" explícito. Mismo default que sync-web.sh:38.
MOTOR="motor"                                     # motor VENDORIZADO en el repo (Fase 2 graduación; antes: deploy/skeleton_kit/.../reference)
WORKER="deploy/worker"
WEB_UNIT="uc-copiloto-web.service"
WORKER_UNIT="uc-copiloto-worker.service"

echo "==> [1/7] sync worktree -> ${HOST}:${REMOTE} (clean; preserva apps/copiloto-web/{node_modules,dist} entre deploys)"
# rm QUIRÚRGICO: `apps/copiloto` (backend) + `deploy` + `motor` (vendorizado), NUNCA todo `apps/` -> no borra el frontend
# `apps/copiloto-web` (fix de la colisión histórica deploy.sh <-> sync-web.sh). Del frontend se limpia
# solo el source (preservando node_modules+dist para no reinstalar/reconstruir de cero cada deploy).
# `packages/core` (ADR-010): copiloto-web depende de @copiloto/core vía file:../../packages/core --
# sin sincronizarlo, el `npm install` del paso [frontend] de abajo no resuelve el import (gap
# detectado 2026-08-04, PR#237; mismo fix aplicado en sync-web.sh).
tar -C "$LOCAL" \
    --exclude='apps/copiloto-web/node_modules' --exclude='apps/copiloto-web/dist' --exclude='apps/copiloto-web/.vite' \
    --exclude='packages/core/node_modules' \
    -czf - apps/copiloto apps/copiloto-web packages/core "$MOTOR" "$WORKER" deploy/copiloto \
  | ssh "$HOST" "mkdir -p '$REMOTE' '$REMOTE/packages' && rm -rf '$REMOTE'/apps/copiloto '$REMOTE'/deploy '$REMOTE'/motor '$REMOTE'/packages/core && { [ -d '$REMOTE/apps/copiloto-web' ] && find '$REMOTE/apps/copiloto-web' -mindepth 1 -maxdepth 1 ! -name node_modules ! -name dist -exec rm -rf {} + || true; } && mkdir -p '$REMOTE' && tar -C '$REMOTE' -xzf -"

# ---------------------------------------------------------------------------------------------
# Sello de PROCEDENCIA (2026-07-31). El deploy es `tar | ssh`: en el VPS NO hay git, así que sin
# esto el árbol desplegado no declara de qué versión es y NADA puede verificarlo después — ni una
# sesión que audita, ni el grafo de código, ni el ciclo de autosanación, que necesita saber si el
# código que va a parchear es el MISMO que tiró el trauma. Un sanador que no puede distinguir "el
# grafo está al día" de "el grafo describe otra cosa" parchea a ciegas.
#
# Honesto por diseño: el gate de drift de arriba sólo verifica `apps/copiloto` y `motor` contra
# origin/main. Los otros 3 paths del tar van sin verificar, y el manifiesto lo dice en vez de
# sugerir que todo el árbol está anclado. Fail-open: si algo acá falla, el manifiesto queda con
# "indeterminado" y el deploy sigue — un sello que rompe el deploy sería peor que no tenerlo, pero
# un sello AUSENTE se leería como "no hay info" y uno que MIENTE se leería como verdad.
echo "==> [1.bis] sello de procedencia -> ${REMOTE}/DEPLOY-MANIFEST.json"
_sha="$(git -C "$LOCAL" rev-parse origin/main 2>/dev/null || echo indeterminado)"
_sucios="$(git -C "$LOCAL" status --porcelain -- apps/copiloto-web packages/core deploy/worker deploy/copiloto 2>/dev/null | wc -l | tr -d ' ')"
if [ -n "${UC_SKIP_DRIFT_CHECK:-}" ]; then _gate="SALTEADO (UC_SKIP_DRIFT_CHECK)"; else _gate="aplicado"; fi
_manifiesto="$(cat <<JSON
{
  "desplegado_en": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "origin_main_sha": "${_sha}",
  "gate_de_drift": "${_gate}",
  "paths_anclados_a_origin_main": ["apps/copiloto", "motor"],
  "paths_NO_verificados": ["apps/copiloto-web", "packages/core", "deploy/worker", "deploy/copiloto"],
  "archivos_sucios_en_paths_no_verificados": ${_sucios:-null},
  "nota": "El backend esta anclado a origin_main_sha por el gate de drift (deploy.sh). Los paths NO verificados salieron del working tree y pueden diferir de ese commit. Quien consuma esto para decidir (autosanacion, auditoria, grafo) debe tratar SOLO los paths anclados como identificables por SHA."
}
JSON
)"
printf '%s\n' "$_manifiesto" | ssh "$HOST" "cat > '$REMOTE/DEPLOY-MANIFEST.json'" \
  || echo "    (aviso: no se pudo escribir el sello de procedencia; el deploy sigue)" >&2

echo "==> [frontend] build PWA en el VPS (fetch-fonts + npm install + vite build, VITE_AUTH_URL=${AUTH_URL:-<vacío→sin botón Google>}) -> dist servido mismo-origen por _mount_spa (web.py)"
ssh "$HOST" bash -s -- "$REMOTE" "$AUTH_URL" <<'REMOTE_WEB'
set -euo pipefail
REMOTE="$1"; AUTH_URL="$2"
cd "$REMOTE/apps/copiloto-web"
# fuentes self-hosted reales (idempotente por tamaño -> reemplaza placeholders <2KB por los woff2 reales)
bash "$REMOTE/deploy/copiloto/fetch-fonts.sh"
npm install --no-audit --no-fund --loglevel=error
# Vite hornea las VITE_* del entorno al bundle -- sin esto, VITE_AUTH_URL queda sin definir y
# `oauth.ts::googleAuthUrl()` devuelve null (botón "Entrar con Google" oculto). CTA4: este deploy
# tiene su PROPIO paso de build, separado de sync-web.sh -- pasar AUTH_URL acá también, no alcanza
# con que sync-web.sh lo haga bien.
VITE_AUTH_URL="$AUTH_URL" npm run build
test -f dist/index.html
echo "frontend build OK -> $REMOTE/apps/copiloto-web/dist ($(du -sh dist | cut -f1))"
REMOTE_WEB

echo "==> [2/7] auth: repoint a la GoTrue DEDICADA — SOLO si el cutover ya se completó (marker); self-healing"
# Gate de seguridad (review A2): repointear apenas existe copiloto-gotrue.env puede apuntar el copiloto
# a una GoTrue VACÍA (deploy-gotrue.sh corrido pero migrate-and-cutover.sh no, o un DR fresco) → caída
# total de auth por un deploy que no pretendía tocar auth. El repoint procede SOLO si migrate-and-cutover.sh
# dejó el marker `.gotrue-cutover-done`; si falta, se SALTEA (aviso) y el deploy continúa (auth intacta).
# El repoint en sí lo hace repoint-env.sh (FUENTE ÚNICA, compartida con migrate-and-cutover.sh → sin drift).
ssh "$HOST" bash -s -- "$ENVDIR" "$REMOTE" <<'REMOTE_AUTH'
set -euo pipefail
ENVDIR="$1"; REMOTE="$2"
if [ ! -f "$ENVDIR/.gotrue-cutover-done" ]; then
  echo "AVISO [2/7]: falta $ENVDIR/.gotrue-cutover-done -> cutover a GoTrue dedicada NO completado; NO se repointea auth."
  echo "  Completá el cutover con deploy/copiloto/gotrue/migrate-and-cutover.sh. El resto del deploy continúa."
else
  UC_ENV_DIR="$ENVDIR" bash "$REMOTE/deploy/copiloto/gotrue/repoint-env.sh"
fi
REMOTE_AUTH

echo "==> [3/7] pin de deps (idempotente: pip no reinstala si ya satisface el rango)"
# python-multipart: dep de FastAPI para Form(...)/File(...) (/chat/audio, voz-backend) -- sin ella
# FastAPI levanta RuntimeError al arrancar ("Form data requires python-multipart to be installed").
ssh "$HOST" "'$VENV/bin/pip' install -q 'PyJWT>=2.8.0' 'fastapi>=0.110' 'uvicorn>=0.29' 'httpx>=0.27' 'pydantic>=2' 'python-multipart>=0.0.9'"

echo "==> [3.5/7] GROQ_API_KEY server-side (clinic-agent.env -> copiloto.env), idempotente, sin imprimir el valor"
# La voz de /chat/audio (voz-backend) reusa la MISMA key que ya usa el agente de agenda (clinic-
# management) para su STT -- vive server-side en ${ENVDIR}/clinic-agent.env (nunca en este repo ni
# en el chat). Copiarla a copiloto.env es la fuente de verdad de ESTE servicio -- si mañana rota,
# rotar en clinic-agent.env y re-correr este deploy la propaga, sin duplicar el secreto a mano.
ssh "$HOST" bash -s -- "$ENVDIR" <<'REMOTE_GROQ'
set -euo pipefail
ENVDIR="$1"
SRC="$ENVDIR/clinic-agent.env"
DST="$ENVDIR/copiloto.env"
[ -f "$DST" ] || { echo "FALTA $DST" >&2; exit 1; }
if [ ! -f "$SRC" ]; then
  echo "AVISO: no existe $SRC -- /chat/audio quedará SIN configurar (503 'voz no configurada'), el resto del front-door sigue OK" >&2
else
  SECRET="$(grep '^GROQ_API_KEY=' "$SRC" | head -1 | cut -d= -f2-)"
  if [ -z "$SECRET" ]; then
    echo "AVISO: $SRC no tiene GROQ_API_KEY -- /chat/audio quedará SIN configurar (503), el resto del front-door sigue OK" >&2
  else
    if grep -q '^GROQ_API_KEY=' "$DST"; then
      sed -i "s|^GROQ_API_KEY=.*|GROQ_API_KEY=${SECRET}|" "$DST"
    else
      printf 'GROQ_API_KEY=%s\n' "$SECRET" >> "$DST"
    fi
    unset SECRET
    chmod 600 "$DST"
    echo "GROQ_API_KEY: OK (presente en $DST, valor NO impreso)"
  fi
fi
REMOTE_GROQ

echo "==> [4/7] provision.py (idempotente: CREATE ... IF NOT EXISTS / DROP+CREATE policy / GRANT repetible)"
# ⚠️ `UC_RLS_FORCE=1` va acá y no es opcional (2026-07-31). Sin él, `provision.py` crea las tablas con
# RLS pero SIN `FORCE`, y la app se conecta con el rol DUEÑO — que Postgres exime de sus propias
# policies salvo FORCE. O sea: **toda tabla nueva nacería desprotegida**, en silencio, y el catálogo
# diría `rowsecurity=t` igual. Lo cazamos con `copiloto_traumas`, la primera tabla creada después de
# encender el RLS: llegó a producción con `FORCE=False` porque este paso no pasaba el flag.
#
# El flag existió sólo para el ORDEN del despliegue —activar FORCE antes de que el código que declara
# el tenant estuviera corriendo dejaría a la app viendo 0 filas—, y ese paso YA se hizo: el 2026-07-31
# se verificó por efecto que la GUC llega (canary HTTP) y se encendió sobre las 18 tablas. Desde
# entonces, desplegar sin el flag es un downgrade silencioso para cualquier tabla nueva.
ssh "$HOST" bash -s -- "$REMOTE" "$ENVDIR" "$VENV" <<'REMOTE_PROVISION'
set -euo pipefail
REMOTE="$1"; ENVDIR="$2"; VENV="$3"
set -a
. "$ENVDIR/fusion-pg.env"
set +a
cd "$REMOTE/apps/copiloto"
UC_RLS_FORCE="${UC_RLS_FORCE:-1}" "$VENV/bin/python" provision.py
REMOTE_PROVISION

echo "==> [4.5/7] ensure_mi_dia_schedules.py (idempotente: ScheduleAlreadyRunningError -> ya existía, no duplica)"
ssh "$HOST" bash -s -- "$REMOTE" "$ENVDIR" "$VENV" <<'REMOTE_MI_DIA_SCHEDULES'
set -euo pipefail
REMOTE="$1"; ENVDIR="$2"; VENV="$3"
set -a
. "$ENVDIR/fusion-pg.env"
. "$ENVDIR/copiloto.env"
set +a
cd "$REMOTE/deploy/worker"
"$VENV/bin/python" ensure_mi_dia_schedules.py
REMOTE_MI_DIA_SCHEDULES

echo "==> [4.6/7] ensure_autosanacion_schedules.py (Fase 3 — nace PAUSADO si el kill switch está activo)"
# Fail-open a propósito: un problema creando el Schedule del ciclo de auto-reparación NO puede
# abortar el deploy del copiloto. La feature es opcional y el resto de la app no depende de ella;
# tumbar un deploy entero por esto sería el mismo error de proporción que el worker que no arranca
# porque falta una API key opcional.
ssh "$HOST" bash -s -- "$REMOTE" "$ENVDIR" "$VENV" <<'REMOTE_AUTOSANACION_SCHEDULES' || \
  echo "    (aviso: no se pudo asegurar el Schedule de autosanación; el deploy sigue)" >&2
set -euo pipefail
REMOTE="$1"; ENVDIR="$2"; VENV="$3"
set -a
. "$ENVDIR/fusion-pg.env"
. "$ENVDIR/copiloto.env"
set +a
# El ciclo de autosanación es UNO para toda la app (2026-08-01) y corre con un rol propio
# (`copiloto_autosanacion`, BYPASSRLS) que ve la DLQ de todos los tenants. Ese rol se provisiona UNA
# vez con `deploy/copiloto/provision-rol-autosanacion.sh` —necesita el superusuario de la base, que
# el deploy no tiene ni debería tener— así que acá sólo se VERIFICA que esté. Sin el DSN el worker
# arranca igual y deja el ciclo apagado: avisar en el deploy es lo que evita que ese apagado pase
# desapercibido durante semanas.
if [ -z "${COPILOTO_AUTOSANACION_DSN:-}" ]; then
  echo "    ⚠️  falta COPILOTO_AUTOSANACION_DSN: el ciclo de autosanación queda APAGADO." >&2
  echo "        Corré deploy/copiloto/provision-rol-autosanacion.sh (una sola vez)." >&2
fi
cd "$REMOTE/deploy/worker"
# `apps/copiloto` en el path para que el script pueda leer el tope diario y avisar si los disparos
# del Schedule no alcanzan a agotarlo (es la incoherencia que vivió meses sin que nadie la notara:
# tope 5, un solo disparo). Sin este path el control nace mudo — imprimiría "OMITIDO" en cada
# deploy, que es la peor forma de un control: la que nunca protesta. `autosanacion_gates` sólo
# importa `os` y `dataclasses`, así que no arrastra nada al proceso del deploy.
PYTHONPATH="$REMOTE/apps/copiloto" "$VENV/bin/python" ensure_autosanacion_schedules.py
REMOTE_AUTOSANACION_SCHEDULES

echo "==> [4.7/7] ensure_grafo_sync_schedules.py (BETA-G0 — idempotente, fail-open como autosanación)"
# Mismo criterio que el bloque de arriba: el sync incremental evento→grafo es una feature opcional
# (Inteligencia de Negocio), no el camino crítico del chat. Un problema creando estos Schedules no
# puede tumbar el deploy del copiloto.
ssh "$HOST" bash -s -- "$REMOTE" "$ENVDIR" "$VENV" <<'REMOTE_GRAFO_SYNC_SCHEDULES' || \
  echo "    (aviso: no se pudo asegurar el Schedule de sync del grafo; el deploy sigue)" >&2
set -euo pipefail
REMOTE="$1"; ENVDIR="$2"; VENV="$3"
set -a
. "$ENVDIR/fusion-pg.env"
. "$ENVDIR/copiloto.env"
set +a
cd "$REMOTE/deploy/worker"
"$VENV/bin/python" ensure_grafo_sync_schedules.py
REMOTE_GRAFO_SYNC_SCHEDULES

echo "==> [4.9/7] gate de import: los entrypoints DEBEN importar antes de reiniciar nada"
# Por qué existe (incidente 2026-07-21, 15 x `ImportError: cannot import name 'make_consultar_anulacion'
# from 'web'` en producción): el paso [6/7] valida el Caddyfile ANTES de aplicarlo y aborta sin tocar
# nada, pero el paso [5/7] hacía `systemctl restart` SIN validar que el código nuevo siquiera importe.
# La asimetría era el bug: el smoke [7/7] detecta el servicio roto, pero DESPUÉS de haberlo reiniciado
# con código que no carga -> Restart=always lo deja en loop y el copiloto queda caído.
# Este gate corre con el MISMO cwd, PYTHONPATH, venv y EnvironmentFile que los units, así que un verde
# acá significa lo mismo que arrancar. Si falla: aborta por `set -e` con los servicios VIEJOS intactos.
# Importar es seguro: `serve.py:289` y `worker_b.py:301` tienen guard `if __name__ == "__main__"`, así
# que nada arranca al importarlos (verificado antes de escribir esto, no asumido).
ssh "$HOST" bash -s -- "$REMOTE" "$ENVDIR" "$VENV" <<'REMOTE_IMPORT_GATE'
set -euo pipefail
REMOTE="$1"; ENVDIR="$2"; VENV="$3"
cd "$REMOTE/apps/copiloto"
export PYTHONPATH="$REMOTE/motor:$REMOTE/deploy/worker"
# Mismos EnvironmentFile que los units; si alguno falta, el gate igual corre (un import que dependa de
# una env ausente fallaría también al arrancar -> es exactamente lo que queremos que salte acá).
set -a
for f in "$ENVDIR/copiloto.env" "$ENVDIR/fusion-pg.env" "$ENVDIR/fusion-supabase.env"; do
  [ -f "$f" ] && . "$f"
done
set +a
for m in serve worker_b; do
  if "$VENV/bin/python" -c "import $m" 2>/tmp/import-gate.err; then
    echo "import $m: OK"
  else
    echo "IMPORT GATE FALLO en '$m' -- abortando SIN reiniciar (los servicios viejos siguen arriba)" >&2
    cat /tmp/import-gate.err >&2
    exit 1
  fi
done
REMOTE_IMPORT_GATE

echo "==> [5/7] instalar units systemd (idempotente: copy+daemon-reload+enable --now, no duplica)"
ssh "$HOST" bash -s -- "$REMOTE" "$WEB_UNIT" "$WORKER_UNIT" <<'REMOTE_UNITS'
set -euo pipefail
REMOTE="$1"; WEB_UNIT="$2"; WORKER_UNIT="$3"
install -m 644 "$REMOTE/deploy/copiloto/$WEB_UNIT" "/etc/systemd/system/$WEB_UNIT"
install -m 644 "$REMOTE/deploy/copiloto/$WORKER_UNIT" "/etc/systemd/system/$WORKER_UNIT"
systemctl daemon-reload
systemctl enable "$WEB_UNIT" "$WORKER_UNIT"
# restart (NO solo enable --now): en un REDEPLOY los servicios YA corren, y `enable --now` no reinicia
# un servicio activo -> el código nuevo NO se cargaría. `restart` arranca si está parado y reinicia si
# está activo -> un redeploy siempre carga el código sincronizado. (Breve downtime por reinicio; OK para deploy.)
systemctl restart "$WEB_UNIT" "$WORKER_UNIT"
echo "--- systemctl is-active (post restart) ---"
systemctl is-active "$WEB_UNIT"
systemctl is-active "$WORKER_UNIT"
REMOTE_UNITS

echo "==> [6/7] Caddy: agregar vhost ${COPILOTO_SUBDOMAIN}.* + rewrite /callback en ${MP_SUBDOMAIN}.* (idempotente; valida ANTES de reload; aborta sin tocar si no valida)"
ssh "$HOST" python3 - "$BASE_DOMAIN" "$COPILOTO_SUBDOMAIN" "$MP_SUBDOMAIN" "$WEB_PORT" <<'REMOTE_CADDY'
import re
import shutil
import subprocess
import sys

base_domain, copiloto_sub, mp_sub, web_port = sys.argv[1:5]
path = "/etc/caddy/Caddyfile"
with open(path, encoding="utf-8") as f:
    content = f.read()

copiloto_host = f"{copiloto_sub}.{base_domain}"
mp_host = f"{mp_sub}.{base_domain}"
changed = False

if copiloto_host in content:
    print(f"= bloque {copiloto_host} ya existe (no-op)")
else:
    content = content.rstrip("\n") + f"\n\n{copiloto_host} {{\n    reverse_proxy 127.0.0.1:{web_port}\n}}\n"
    changed = True
    print(f"+ agregado bloque {copiloto_host} -> 127.0.0.1:{web_port}")

pattern = re.compile(r"(" + re.escape(mp_host) + r"\s*\{)(.*?)(\n\})", re.DOTALL)
m = pattern.search(content)
if not m:
    print(f"ERROR: no encontre el bloque {mp_host} en {path}", file=sys.stderr)
    sys.exit(1)

if "rewrite /callback /mp/callback" in m.group(2):
    print(f"= rewrite /callback ya presente en {mp_host} (no-op)")
else:
    new_body = "\n    rewrite /callback /mp/callback" + m.group(2)
    content = content[: m.start()] + m.group(1) + new_body + m.group(3) + content[m.end():]
    changed = True
    print(f"+ agregado 'rewrite /callback /mp/callback' en {mp_host}")

if not changed:
    print("Caddyfile sin cambios (ya aplicado previamente) -- no-op idempotente, sin reload")
    sys.exit(0)

tmp = path + ".new"
with open(tmp, "w", encoding="utf-8") as f:
    f.write(content)

result = subprocess.run(["caddy", "validate", "--config", tmp], capture_output=True, text=True)
if result.returncode != 0:
    print("CADDY VALIDATE FALLO -- abortando SIN aplicar (Caddyfile original intacto)", file=sys.stderr)
    print(result.stdout, file=sys.stderr)
    print(result.stderr, file=sys.stderr)
    sys.exit(1)

shutil.copy(path, path + ".bak")
shutil.move(tmp, path)
print("Caddyfile actualizado + validado OK (backup en Caddyfile.bak)")
REMOTE_CADDY

# El script python de arriba solo escribe/valida; el reload es un paso separado y explícito para
# que quede claro en el log qué exit code correspondió a qué (si el python abortó con exit!=0,
# `set -e` corta ANTES de llegar a este reload).
ssh "$HOST" systemctl reload caddy
echo "Caddy recargado."

echo "==> [7/7] Smoke (evidencia real, no autoevaluación)"
ssh "$HOST" bash -s -- "$WEB_UNIT" "$WORKER_UNIT" "$WEB_PORT" "$BASE_DOMAIN" <<'REMOTE_SMOKE'
set -euo pipefail
WEB_UNIT="$1"; WORKER_UNIT="$2"; WEB_PORT="$3"; BASE_DOMAIN="$4"
echo "--- systemctl is-active ---"
systemctl is-active "$WEB_UNIT"
systemctl is-active "$WORKER_UNIT"
echo "--- curl /healthz (127.0.0.1:$WEB_PORT) ---"
curl -sf "http://127.0.0.1:${WEB_PORT}/healthz"; echo
echo "--- curl / (SPA index servido mismo-origen por _mount_spa) ---"
curl -sf "http://127.0.0.1:${WEB_PORT}/" | head -c 200; echo
echo "--- caddy validate (post-reload sanity) ---"
caddy validate --config /etc/caddy/Caddyfile
echo "--- vhosts preexistentes siguen respondiendo (status code informativo, hermes/temporal usan basic_auth -> 401 esperado) ---"
curl -s -o /dev/null -w 'root: %{http_code}\n' "https://${BASE_DOMAIN}/" || true
curl -s -o /dev/null -w 'hermes: %{http_code}\n' "https://hermes.${BASE_DOMAIN}/" || true
curl -s -o /dev/null -w 'temporal: %{http_code}\n' "https://temporal.${BASE_DOMAIN}/" || true
REMOTE_SMOKE

echo "==> Deploy completo."
