#!/usr/bin/env bash
# test-stage-backend-cubre-los-paths-de-pytest.sh — todo path que `scripts/ci/backend.sh` le pasa a
# pytest tiene que VIAJAR en el tar de `sync-test-backend.sh`, o la suite del VPS no corre NADA.
#
# 🔴 EL CASO (medido por auditoría el 2026-10-07, y el defecto era MÍO). `ce66aa79` agregó
# `../../deploy/copiloto/test_{meclaves_check,caddy_converge}.py` a la invocación de pytest de
# `backend.sh` — correcto en sí: esos dos controles necesitan pytest y `lint` corre python stdlib.
# Pero el tar de `sync-test-backend.sh:94` empaquetaba `apps/copiloto motor deploy/worker scripts`,
# **sin `deploy/copiloto`**, y el VPS corre `$STAGE/scripts/ci/backend.sh`. Medido en un stage
# reproducido con el mismo set de paths: los dos archivos AUSENTES (control positivo que discrimina:
# `scripts/ci/backend.sh` y `apps/copiloto/web.py` presentes).
#
# 🔴 Y EL DAÑO NO ES «fallan los dos nuevos»: pytest con un path inexistente sale **rc=4 con
# `no tests ran`** — medido, contra un control positivo de rc=0 con el path presente. O sea la suite
# ENTERA de backend (apps/copiloto + motor) pasaba a **0 tests ejecutados** en el camino canónico del
# gate (`gate.sh:213` → `sync-test-backend.sh` → `$STAGE/scripts/ci/backend.sh`, ADR-001).
#
# 🔴 LO PEOR ES LA ASIMETRÍA. GitHub Actions corre el MISMO `backend.sh` pero con
# `actions/checkout@v4`, o sea el árbol COMPLETO: ahí los dos archivos existen y el job sale **VERDE**.
# El gate propio —la fuente de verdad del ADR-001— salía ROJO con 0 tests, y su síntoma
# (`file or directory not found` dentro de un pipe de ssh) **invita a culpar al VPS**, no al path.
# Atestación verde + gate real rojo es exactamente el escenario que el ADR-001 vino a evitar.
# [[el-test-que-no-usa-el-camino-de-produccion-no-puede-verlo-fallar]]
#
# 🔴 ESTE TEST NO PROTEGE EL FIX DE LOS CUATRO ARCHIVOS: protege la REGLA. Agregar un path nuevo a la
# invocación de pytest seguirá estando a un token de distancia, y el síntoma vuelve a ser un rojo que
# parece del VPS. Por eso lo que se compara es «pedidos ⊆ cubiertos», no una lista de nombres.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# Los dos lados se pueden apuntar a otro archivo: es lo que permite el control positivo contra una
# versión histórica (`git show <sha>:... > tmp`) y verificar que este test HABRÍA cazado el defecto.
BACKEND="${UC_BACKEND_SH:-$REPO_ROOT/scripts/ci/backend.sh}"
SYNC="${UC_SYNC_SH:-$REPO_ROOT/deploy/copiloto/sync-test-backend.sh}"
for f in "$BACKEND" "$SYNC"; do
  [ -f "$f" ] || { echo "no existe $f"; exit 1; }
done

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

# ── el verificador. Imprime los pedidos NO cubiertos; rc=0 sólo si todos lo están.
# rc=2 reservado al lector vacío: si no se leyó ni un pedido, el test no midió nada y eso es un
# fallo, no un verde ([[instrumento-que-no-mira-nunca-falla]]).
verificar() {
  local backend="$1" sync="$2" motor lista pedidos p tok cubierto faltan=0 n=0

  # paths que backend.sh pide FUERA de su CWD (`apps/copiloto`): los `../../X`
  pedidos="$(grep -oE '\.\./\.\./[A-Za-z0-9_./-]+' "$backend" | sed 's|^\.\./\.\./||' | sort -u)"

  # la lista de paths del tar: desde el `-czf -` hasta el `| ssh` (el comando es MULTILÍNEA, y leer
  # sólo la primera línea fue justamente el modo de perder los paths que se agregan abajo), con
  # $MOTOR resuelto desde el propio script en vez de hardcodear "motor".
  motor="$(sed -n 's/^MOTOR=\("\?\)\([A-Za-z0-9_./-]*\)\1.*/\2/p' "$sync" | head -1)"
  lista="$(sed -n '/-czf - /,/| ssh/p' "$sync" | tr '\n' ' ' | sed 's/\\/ /g; s/.*-czf - //; s/| ssh.*//')"
  lista="${lista//\"\$MOTOR\"/$motor}"
  lista="${lista//\$MOTOR/$motor}"

  for p in $pedidos; do
    n=$((n + 1)); cubierto=0
    for tok in $lista; do
      case "$tok" in ''|'-'*|'|'*) continue ;; esac
      if [ "$p" = "$tok" ] || case "$p" in "$tok"/*) true ;; *) false ;; esac; then
        cubierto=1; break
      fi
    done
    [ "$cubierto" -eq 1 ] || { printf '     NO viaja al stage: %s\n' "$p"; faltan=$((faltan + 1)); }
  done

  [ "$n" -gt 0 ] || { echo "     el lector no encontró NINGÚN path pedido: no se midió nada"; return 2; }
  printf '     pedidos leídos: %s · no cubiertos: %s\n' "$n" "$faltan"
  [ "$faltan" -eq 0 ]
}

echo "[1] REAL — todo lo que backend.sh le pasa a pytest viaja en el tar"
if verificar "$BACKEND" "$SYNC"; then
  ok "pedidos ⊆ paths del tar"
else
  fail "hay paths que backend.sh pide y el stage del VPS no tiene ⇒ pytest sale rc=4, 0 tests"
fi

echo "[2] MUTANTE del tar — saco deploy/copiloto del empaquetado: tiene que dar ROJO"
sed 's|^  deploy/copiloto/.*\\$|  \\|' "$SYNC" > "$TMP/sync-mutante.sh"
if grep -q 'deploy/copiloto/test_' "$TMP/sync-mutante.sh"; then
  fail "el mutante no mutó (el sed no matcheó): el caso 2 no prueba nada"
elif verificar "$BACKEND" "$TMP/sync-mutante.sh" >"$TMP/out2" 2>&1; then
  sed 's/^/     /' "$TMP/out2"
  fail "sin deploy/copiloto en el tar el chequeo salió VERDE: no discrimina"
else
  sed 's/^/     /' "$TMP/out2"
  ok "lo nombra y falla (el verificador ve la ausencia)"
fi

echo "[3] CANARIO del lector vacío — un backend.sh sin ningún ../../ no puede salir verde"
sed 's|\.\./\.\./|RUTA_BORRADA/|g' "$BACKEND" > "$TMP/backend-sin-paths.sh"
verificar "$TMP/backend-sin-paths.sh" "$SYNC" >"$TMP/out3" 2>&1
rc3=$?
sed 's/^/     /' "$TMP/out3"
if [ "$rc3" -eq 2 ]; then
  ok "rc=2: el lector avisa que no midió nada, en vez de aprobar por vacío"
else
  fail "con 0 pedidos leídos el verificador devolvió rc=$rc3 (debía ser 2)"
fi

echo "[4] el tar NO sube ningún .env al stage — medido por EFECTO, no leyendo el flag"
# Este tar sale del DISCO, no de git: un `.env` que git ignora viaja igual. Y `deploy/copiloto/` es
# donde la convención los pone (ahí vive `gotrue/.env.gotrue.template`). Medido el 2026-10-07: hoy no
# hay ninguno en ningún worktree, así que esto protege contra la exposición FUTURA — que es justo la
# que no da síntoma, porque el stage funciona igual con el secreto adentro.
FIX="$TMP/fixture"; mkdir -p "$FIX/deploy/copiloto/gotrue"
printf 'SECRETO_DE_FIXTURE=no-es-real\n' > "$FIX/deploy/copiloto/.env"
printf 'SECRETO_DE_FIXTURE=no-es-real\n' > "$FIX/deploy/copiloto/gotrue/.env.gotrue"
printf '# fixture\n' > "$FIX/deploy/copiloto/meclaves_check.py"
# los --exclude REALES del script, parseados SÓLO del comando `tar` y no de todo el archivo. Dos
# causas, las dos medidas acá:
#   · un sed con `\(--exclude=.*\)` es greedy y se quedaba con UNO solo, el último ⇒ `grep -o`;
#   · grepear el archivo entero recogía el `--exclude='.env*'` **del comentario que lo explica**, así
#     que el mutante (sacar el flag del tar) seguía dando VERDE: el caso se satisfacía con la prosa
#     que lo describe ([[el-guard-se-satisface-con-su-propio-comentario]]). Por eso el universo es el
#     bloque del comando, de `^tar -C` a `| ssh`, con las líneas de comentario descartadas.
EXC="$(sed -n '/^tar -C/,/| ssh/p' "$SYNC" | grep -v '^[[:space:]]*#' \
       | grep -oE "\-\-exclude='[^']*'" | tr '\n' ' ')"
# `eval` y no `tar $EXC`: el script escribe `--exclude='.env*'` y las comillas las procesa BASH. Sin
# eval, tar recibe el apóstrofe COMO PARTE del patrón, no excluye nada, y el caso 4 acusa al fix por
# un defecto del test — medido: con comillas literales los 2 `.env` viajaban; con eval, ninguno.
salida="$(cd "$FIX" && eval "tar $EXC -cf - deploy/copiloto" 2>/dev/null | tar -tf - 2>/dev/null)"
envs="$(printf '%s\n' "$salida" | grep -c '\.env')"
pys="$(printf '%s\n' "$salida" | grep -c '\.py$')"
printf '     excludes parseados: %s\n' "${EXC:-<NINGUNO>}"
printf '     en el tar: %s con .env · %s con .py\n' "$envs" "$pys"
if [ -z "$EXC" ]; then
  fail "no pude parsear ningún --exclude del script: el caso 4 no probó nada"
elif [ "$pys" -eq 0 ]; then
  fail "el control POSITIVO falló: el tar tampoco llevó el .py, así que el 0 de .env no prueba nada"
elif [ "$envs" -gt 0 ]; then
  fail "$envs archivo(s) .env viajarían al stage del VPS"
else
  ok "los .env quedan afuera y el .py sí viaja (el 0 discrimina)"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ 4/4 — el stage cubre todo lo que la suite pide, y ningún .env viaja"
  exit 0
fi
echo "❌ $fallos/4 fallaron"
exit 1
