#!/usr/bin/env bash
# deploy/copiloto/habilitar-admin-operador.sh — abre al operador la consola `/admin/*` de prod,
# corriendo DESDE CUALQUIER CARPETA y sin depender del estado del checkout donde vive este archivo.
#
# POR QUÉ EXISTE (2026-10-16). `asignar-claim-admin.sh` ya hace el trabajo y es idempotente; este
# wrapper NO lo reimplementa — resuelve las tres cosas que impiden pegarlo y correrlo tal cual:
#
#   1. EL CWD. El canónico se invoca por path relativo, así que exige `cd` al repo primero. Acá el
#      repo se deriva de la UBICACIÓN DE ESTE ARCHIVO (`BASH_SOURCE`), no del cwd ni de una ruta
#      hardcodeada: pegá la línea desde donde estés.
#   2. EL ÁRBOL VIEJO. Este repo tiene 144 worktrees y un checkout COMPARTIDO cuyo HEAD está
#      atrasado; correr un instrumento desde ahí ya dio dos realidades distintas para la misma
#      orden (medido 2026-10-08 → `memoria/el-checkout-compartido-sirve-comandos-viejos.md`). Así
#      que el instrumento se lee del PIN de `origin/main` con `git show`, nunca del working tree.
#      Es el mismo criterio de `scripts/vigia.sh`, que no se reusa acá a propósito: su aislamiento
#      es una whitelist de instrumentos de COORDINACIÓN, y un otorgamiento de privilegios no es eso.
#   3. GIT BASH EN WINDOWS. El canónico pasa paths POSIX absolutos (`/etc/unreal-copilot`,
#      `/opt/uc-repos/...`) como ARGUMENTOS de `ssh ... bash -s --`, y MSYS los reescribe a
#      `C:/Program Files/Git/etc/...` antes de que salgan de la máquina
#      (`memoria/git-bash-mangla-paths-con-punto-y-fabrica-handoffs-falsos.md`). Acá se exporta
#      `MSYS_NO_PATHCONV=1` / `MSYS2_ARG_CONV_EXCL='*'` para que lleguen literales.
#
# IDEMPOTENTE, y no por promesa propia: el canónico escribe el claim con un PUT **merge** contra la
# Admin API de GoTrue (no un toggle) y aborta si al final el claim no quedó seteado. Correr esto N
# veces deja el mismo estado final y la N-ésima no desactiva nada.
#
# LO QUE NO HACE: no crea cuentas (el usuario tiene que existir en GoTrue por signup normal) y no
# toca datos de negocio de ningún tenant — el claim habilita `/admin/*`, que opera la APP.
#
# USO
#   bash <repo>/deploy/copiloto/habilitar-admin-operador.sh 341lin@gmail.com
#   bash <repo>/deploy/copiloto/habilitar-admin-operador.sh 341lin@gmail.com --dry-run
#
# `--dry-run` hace TODO menos otorgar: resuelve el repo, refresca el pin, extrae el instrumento,
# verifica que parsee y exporta el fix de MSYS. Existe porque el único paso que no se puede ensayar
# es el que escribe, y lo demás tiene que ser verificable sin otorgar nada.
#
# CONTRATO DE SALIDA
#   0 = otorgado (o ya lo tenía)   ·   2 = uso incorrecto / repo no resuelto
#   3 = el pin no entregó el instrumento   ·   4 = el instrumento del pin NO parsea (no corrió nada)
# Un código FUERA de esta lista no viene de acá: es el canónico o el ssh.
set -euo pipefail

# `UC_ADMIN_INSTRUMENTO` y `UC_ADMIN_REF` son los GANCHOS DE TEST, y existen por una razón
# concreta: sin ellos, los códigos 3 y 4 de este contrato no se pueden ejercitar sin mutar el repo,
# y un rechazo que nunca se vio disparar es indistinguible de uno ausente. No son una puerta: lo que
# nombran se lee igual del PIN de `main` (código ya revisado y mergeado), nunca del working tree.
INSTRUMENTO="${UC_ADMIN_INSTRUMENTO:-deploy/copiloto/asignar-claim-admin.sh}"
YO='deploy/copiloto/habilitar-admin-operador.sh'
REF="${UC_ADMIN_REF:-origin/main}"

EMAIL=''
DRY=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY=1 ;;
    --*)       echo "flag desconocido: $a" >&2; exit 2 ;;
    *)         [ -z "$EMAIL" ] && EMAIL="$a" ;;
  esac
done
[ -n "$EMAIL" ] || { echo "uso: $(basename "$0") <email> [--dry-run]" >&2; exit 2; }
case "$EMAIL" in *@*.*) : ;; *) echo "'$EMAIL' no tiene forma de email" >&2; exit 2 ;; esac

# ── 1. el repo sale de DÓNDE ESTÁ ESTE ARCHIVO, no del cwd
AQUI="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(git -C "$AQUI" rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$REPO" ] || { echo "no pude resolver el repo desde '$AQUI' (¿este archivo quedó fuera del repo?)" >&2; exit 2; }

# ── 2. el pin. Si no se puede refrescar, se AVISA; no se cae callado a la copia local, porque un
#      degradado silencioso al caso benigno es justo lo que envenena la medición.
_rama="${REF#origin/}"
if ! git -C "$REPO" fetch -q origin "$_rama" 2>/dev/null; then
  echo "⚠️  no pude refrescar $REF (¿sin red?) — sigo con la copia LOCAL de $REF, que puede estar atrasada" >&2
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git -C "$REPO" show "$REF:$INSTRUMENTO" > "$TMP/instrumento.sh" 2>/dev/null \
  || { echo "$REF no tiene '$INSTRUMENTO'" >&2; exit 3; }
[ -s "$TMP/instrumento.sh" ] || { echo "'$INSTRUMENTO' salió VACÍO del pin $REF" >&2; exit 3; }
bash -n "$TMP/instrumento.sh" \
  || { echo "el instrumento del pin NO parsea: no salgo a la red con eso" >&2; exit 4; }

# Este wrapper también puede estar viejo. No se auto-reejecuta (sería un salto más por un archivo
# que no decide nada), pero lo DICE: el que decide es el instrumento, y ése ya viene del pin.
if ! git -C "$REPO" show "$REF:$YO" 2>/dev/null | diff -q - "${BASH_SOURCE[0]}" >/dev/null 2>&1; then
  echo "ℹ️  este wrapper difiere del de $REF (o todavía no está allá); el instrumento igual sale del pin" >&2
fi

# ── 3. Git Bash: que los paths POSIX lleguen literales al otro lado del ssh
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

_lineas="$(wc -l < "$TMP/instrumento.sh" | tr -d ' ')"
_sha="$(git -C "$REPO" rev-parse --short "$REF" 2>/dev/null || echo '?')"
echo "repo=$REPO"
echo "pin=$REF@$_sha · instrumento=$INSTRUMENTO ($_lineas líneas, parsea) · email=$EMAIL"

if [ "$DRY" = "1" ]; then
  echo "DRY-RUN: todo listo y NO se otorgó nada. Quitá --dry-run para ejecutar."
  exit 0
fi

echo "──────── ejecutando el instrumento del pin ────────"
bash "$TMP/instrumento.sh" "$EMAIL"
