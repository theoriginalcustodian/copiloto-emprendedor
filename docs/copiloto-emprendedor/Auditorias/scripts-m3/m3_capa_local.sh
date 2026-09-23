#!/usr/bin/env bash
# M-3 / H-A4-1 · FASE 1 — ¿la capa LOCAL (pre-push → gitleaks) frena un secreto?
#
# QUÉ MIDE Y QUÉ NO
#   Mide SÓLO la capa local, empujando a un remoto **bare en disco**. No toca GitHub: nada se publica.
#   La capa server-side (push protection) exige un push real al repo público y su caso non-provider se
#   predice que PASA — o sea, publicaría por diseño. Esa mitad va aparte y con decisión explícita.
#
# LOS TRES CASOS (uno solo no atribuye: un "pasó" puede ser el control roto, el cebo no reconocido,
# o un hook que ni llama al scanner)
#   A  proveedor    · árbol AL DÍA → debe ABORTAR. Si pasa, el instrumento está ciego: se para acá.
#   B  non-provider · árbol AL DÍA → mide si gitleaks cubre lo genérico, que es lo que usa el repo.
#   C  proveedor    · árbol BASE VIEJA (pre-#601, hook sin scanner) → control NEGATIVO: debe PASAR.
#   Sin C, un "abortó" no prueba que el freno venga del hook que creemos.
#
# LA SEGUNDA CAUSA SUFICIENTE, Y CÓMO SE NEUTRALIZA SIN TOCAR EL HOOK
#   El pre-push tiene DOS motivos de aborto: el scanner (líneas 15-16) y graph-sync (fail-closed, más
#   abajo). Un "ABORTA" de graph-sync no diría nada sobre secretos, y además mutaría el grafo — estado
#   compartido del que esta sesión no es dueña. El hook trae un atajo propio: si origin/main coincide
#   con el marcador del bridge, sale exit 0 sin sincronizar. Así que el origin de los clones de prueba
#   es un **bare local fijado en el SHA del marcador**: el hook corre BYTE POR BYTE como en producción,
#   el scanner se ejercita de verdad, y graph-sync nunca llega a correr. Se verifica en el log.
#
# CLONES, NO WORKTREES: no aparecen en `git worktree list`, así que no ensucian el cruce entre sesiones.
# MATERIAL: sintético y aleatorio, generado acá. Ninguna credencial viva ni de las que pasaron por chat.
# IDEMPOTENTE: reusa lo que exista; --limpiar borra todo lo que creó.
set -uo pipefail
# OJO: NO exportar MSYS_NO_PATHCONV=1 acá. La primera corrida lo hacía, y el hook lo heredaba: gitleaks
# es un binario Windows nativo y recibía el $ROOT en formato MSYS (/c/gfw-src/...), con lo cual no podía
# cargar .gitleaks.toml y salía FTL. Como gitleaks usa rc=1 TANTO para "hallazgo" como para "config
# rota" (medido: ambos 1), secretos-check.sh lo anunciaba como "encontró posibles secretos" y los casos
# A y B abortaban sin haber escaneado nada. La variable que puse para no fabricar ceros fabricó un
# falso positivo. Donde de verdad hace falta (pathspec de git) va inline, en ese comando y nada más;
# y el push usa el nombre de rama, sin refspec con ":", así no necesita la variable.

REPO="C:/Proyectos/Claude/Claude code/copiloto-emprendedor"
LAB="C:/gfw-src/_m3"
BARE="$LAB/bare.git"
C_ALDIA="$LAB/aldia"
C_VIEJO="$LAB/viejo"
OUT="$(cd "$(dirname "$0")" && pwd)"
RESULT="$OUT/RESULT.md"
BRIDGE="${GRAPHITY_BRIDGE_PATH:-C:/Proyectos/Claude/Claude code/graphify-graphity-bridge}"
MARCADOR="$BRIDGE/.bridge/last-synced-copiloto-emprendedor.sha"

log() { echo "[m3 $(date +%H:%M:%S)] $*"; }
morir() { log "ERROR: $*"; exit 2; }

if [ "${1:-}" = "--limpiar" ]; then
  log "limpiando $LAB"; rm -rf "$LAB"; log "listo"; exit 0
fi

# ── sujeto, fijado a SHAs inmutables ─────────────────────────────────────────
REMOTO="$(git -C "$REPO" ls-remote origin main | cut -f1)"
[ -n "$REMOTO" ] || morir "no pude leer el remoto con ls-remote"
# `git log` SIN ref arranca en HEAD, y el checkout compartido está ~141 commits atrás: así devolvía
# vacío y parecía que el commit no existía. El ref va explícito. MSYS_NO_PATHCONV sólo acá, por el pathspec.
SHA_601="$(MSYS_NO_PATHCONV=1 git -C "$REPO" log origin/main --format=%H -S'secretos-check' --reverse -- .githooks/pre-push | head -1)"
[ -n "$SHA_601" ] || morir "no ubico el commit que agrego el scanner al hook (medi sobre HEAD en vez de origin/main?)"
SHA_VIEJO="$(git -C "$REPO" rev-parse "$SHA_601~1")"
log "remoto real origin/main = $REMOTO"
log "scanner nace en $SHA_601 · base vieja = $SHA_VIEJO"

# El SHA del marcador manda: es el unico valor de origin/main con el que el hook toma el atajo.
leer_marcador() { cat "$MARCADOR" 2>/dev/null || echo ninguno; }
SHA_ANCLA="$(leer_marcador)"
[ "$SHA_ANCLA" != "ninguno" ] || morir "el bridge no tiene marcador: no puedo anclar el atajo del grafo"
git -C "$REPO" cat-file -e "$SHA_ANCLA^{commit}" 2>/dev/null || morir "el SHA del marcador ($SHA_ANCLA) no existe localmente"
git -C "$REPO" merge-base --is-ancestor "$SHA_601" "$SHA_ANCLA" || morir "el ancla $SHA_ANCLA es ANTERIOR a #601: su hook no tendria scanner y el caso A no mediria nada"
log "ancla (marcador del grafo) = $SHA_ANCLA — posterior a #601 OK"

# ── laboratorio: bare + dos clones ───────────────────────────────────────────
mkdir -p "$LAB"
if [ ! -d "$BARE" ]; then
  log "creando bare local (--shared: no copia objetos)"
  git clone --bare --shared -q "$REPO" "$BARE" || morir "fallo el clone bare"
fi

alinear_ancla() {   # el atajo del grafo solo se activa si origin/main == marcador
  local m; m="$(leer_marcador)"
  [ "$m" != "ninguno" ] || morir "el marcador desaparecio a mitad de la corrida"
  git -C "$REPO" cat-file -e "$m^{commit}" 2>/dev/null || morir "el marcador cambio a un SHA que no tengo: $m"
  git -C "$BARE" update-ref refs/heads/main "$m" || morir "no pude fijar main en el bare"
  echo "$m"
}
SHA_ANCLA="$(alinear_ancla)"

# El binario de gitleaks se cachea en $ROOT/.tools/ — o sea, DENTRO de cada checkout. Un clon nuevo
# intenta bajarlo, y acá la descarga falla (curl 23, error de ESCRITURA: 112 GB libres, no es disco;
# el candidato es el antivirus sobre un .exe de escaneo). Se copia el que otro worktree ya bajó, en vez
# de la env var GITLEAKS_BIN: así el camino queda idéntico al de producción. La verificación de versión
# no se saltea — la hace el propio secretos-check.sh contra GL_VERSION.
sembrar_binario() {   # $1 = clon destino
  local d="$1" donante
  ls "$d"/.tools/gitleaks-*/gitleaks.exe >/dev/null 2>&1 && return 0
  # profundidad 4 desde C:/gfw-src: <worktree>/.tools/gitleaks-<ver>/gitleaks.exe
  donante="$(find "C:/gfw-src" -maxdepth 5 -path '*/.tools/gitleaks-*' -name 'gitleaks.exe' 2>/dev/null | head -1)"
  [ -n "$donante" ] || morir "no hay gitleaks cacheado para copiar y la descarga falla (curl 23)"
  mkdir -p "$d/.tools"
  cp -r "$(dirname "$donante")" "$d/.tools/" || morir "no pude copiar el binario a $d"
  log "  binario de gitleaks copiado desde $donante"
}

preparar_clon() {   # $1=dir  $2=sha a checkoutear
  local d="$1" sha="$2" n s
  if [ ! -d "$d" ]; then
    log "clonando $d @ ${sha:0:12}"
    git clone --shared --no-checkout -q "$REPO" "$d" || morir "fallo el clone $d"
    git -C "$d" checkout -q --detach "$sha" || morir "fallo el checkout de $sha en $d"
    git -C "$d" remote set-url origin "$BARE"
    git -C "$d" config core.hooksPath .githooks   # como indica el propio hook: "Activar (por clone)"
    git -C "$d" config user.name  "M3 Adversarial"
    git -C "$d" config user.email "m3@local.test"
  else
    log "clon ya existe: $d"
  fi
  n="$(grep -c 'secretos-check' "$d/.githooks/pre-push" 2>/dev/null || true)"
  s="$(grep -c '^#!' "$d/.githooks/pre-push" 2>/dev/null || true)"
  log "  hook en $(basename "$d"): menciones de secretos-check = ${n:-0} (control positivo shebang: ${s:-0})"
  sembrar_binario "$d"
}
preparar_clon "$C_ALDIA" "$SHA_ANCLA"
preparar_clon "$C_VIEJO" "$SHA_VIEJO"

# ── material sintetico ───────────────────────────────────────────────────────
rnd() { LC_ALL=C tr -dc "$2" </dev/urandom | head -c "$1"; }
AWS_ID="AKIA$(rnd 16 'A-Z0-9')"
AWS_SECRET="$(rnd 40 'A-Za-z0-9/+')"
GENERICO="$(rnd 28 'A-Za-z0-9')"

sembrar_proveedor() {
  {
    echo "# cebo sintetico M-3 — generado al azar, NO es una credencial real"
    echo "aws_access_key_id = $AWS_ID"
    echo "aws_secret_access_key = $AWS_SECRET"
  } > "$1/m3-cebo.txt"
  echo "m3-cebo.txt"
}
sembrar_generico() {
  {
    echo "# cebo sintetico M-3 — clase non-provider: secretos propios del repo"
    echo "DB_PASSWORD=$GENERICO"
    echo "UC_INTERNAL_TOKEN=$GENERICO"
    echo "DATABASE_URL=postgresql://copiloto:$GENERICO@127.0.0.1:5432/copiloto"
  } > "$1/.env.m3"
  echo ".env.m3"
}
# Para el caso D: contenido SIN nada parecido a un secreto. Si el push aborta igual, el motivo sólo
# puede ser que el escaner no pudo correr — que es justo la promesa "fail-closed" que se quiere medir.
sembrar_inocuo() {
  {
    echo "# archivo inocuo M-3 — ni una forma de credencial acá"
    echo "hola mundo"
  } > "$1/m3-cebo.txt"
  echo "m3-cebo.txt"
}

# ── CONTROL DEL MATERIAL: el detector del repo reconoce el cebo? ─────────────
log "control del material: corriendo el propio secretos-check.sh --arbol"
sembrar_proveedor "$C_ALDIA" >/dev/null
( cd "$C_ALDIA" && bash scripts/secretos-check.sh --arbol ) >"$OUT/control-material.log" 2>&1
MAT_RC=$?
rm -f "$C_ALDIA/m3-cebo.txt"
log "control del material rc=$MAT_RC (1 = lo detecto)"
if [ "$MAT_RC" != "1" ]; then
  {
    echo "# M-3 fase 1 — ABORTADO en el control del material"
    echo
    echo "\`secretos-check.sh --arbol\` salio **rc=$MAT_RC** sobre un cebo de proveedor sembrado a proposito."
    echo "Si el detector no reconoce el cebo, un \"paso\" posterior no significa nada: no se concluye"
    echo "nada sobre H-A4-1 y la capa local queda **sin medir**."
    echo
    echo "Log: \`control-material.log\`"
  } > "$RESULT"
  morir "el detector NO marco el cebo (rc=$MAT_RC). El test no vale. Ver control-material.log"
fi
log "OK: el detector ve el cebo"

# ── los tres casos ───────────────────────────────────────────────────────────
correr_caso() {   # $1=id $2=clon $3=fn_sembrar $4=esperado [$5=env extra para el push]
  local id="$1" d="$2" fn="$3" esperado="$4" envx="${5:-}"
  local rama="m3-$id-$(date +%H%M%S)" plog="$OUT/push-$id.log" archivo rc llego obs attr ok
  SHA_ANCLA="$(alinear_ancla)"   # re-anclar: otra sesion pudo sincronizar el grafo mientras tanto
  rm -f "$d/m3-cebo.txt" "$d/.env.m3"
  archivo="$("$fn" "$d")"
  echo "### caso $id · ancla=$SHA_ANCLA · archivo=$archivo" > "$plog"
  ( cd "$d" && git checkout -q -B "$rama" && git add -f "$archivo" \
      && git commit -q -m "test(m3): cebo sintetico $id" ) >>"$plog" 2>&1
  if [ $? -ne 0 ]; then echo "PREP_FALLIDA|$id|$esperado|-|-|-|-"; return; fi
  if [ -n "$envx" ]; then
    ( cd "$d" && env $envx git push origin "$rama" ) >>"$plog" 2>&1
  else
    ( cd "$d" && git push origin "$rama" ) >>"$plog" 2>&1
  fi
  rc=$?
  # veredicto por EFECTO, no por exit code
  llego=no; git -C "$BARE" show-ref --verify --quiet "refs/heads/$rama" && llego=si
  obs=ABORTA; [ "$llego" = si ] && obs=PASA
  # atribucion: que causa explica lo observado
  attr="-"
  grep -qi 'grafo ya sincronizado' "$plog" && attr="atajo-grafo(ok)"
  grep -qi 'gitleaks encontro\|gitleaks encontró' "$plog" && attr="scanner:hallazgo"
  grep -qi 'no es gitleaks\|no pude bajar\|SO no soportado' "$plog" && attr="scanner:roto(fail-closed)"
  # Va DESPUÉS de "hallazgo" a propósito, y lo pisa: gitleaks devuelve rc=1 tanto si encontró algo como
  # si no pudo cargar su config (medido: ambos 1), y secretos-check.sh anuncia las dos cosas como
  # "encontró posibles secretos". Sin esta línea, un escáner mal configurado se lee como una detección.
  grep -qi 'unable to load\|FTL' "$plog" && attr="scanner:ERROR-CONFIG(no escaneo)"
  grep -qi 'no encuentro el bridge\|no esta en el PATH\|sincronizando el grafo' "$plog" && attr="GRAFO(!)"
  ok="FALLA"; [ "$obs" = "$esperado" ] && ok="OK"
  ( cd "$d" && git checkout -q --detach HEAD && git branch -D "$rama" ) >/dev/null 2>&1
  echo "$ok|$id|$esperado|$obs|$attr|rc=$rc|ref_en_bare=$llego"
}

log "corriendo los tres casos (puede tardar: gitleaks quiza se descargue)"
R_A="$(correr_caso "A-proveedor-aldia"     "$C_ALDIA" sembrar_proveedor ABORTA)"; log "A -> $R_A"
R_B="$(correr_caso "B-generico-aldia"      "$C_ALDIA" sembrar_generico  ABORTA)"; log "B -> $R_B"
R_C="$(correr_caso "C-proveedor-baseVieja" "$C_VIEJO" sembrar_proveedor PASA)";   log "C -> $R_C"
# D: archivo INOCUO + escaner inutilizable. El hook promete "hallazgo o escaner roto => el push aborta";
# la segunda mitad de esa promesa nunca se habia ejercitado. Con contenido inocuo, un aborto solo puede
# atribuirse al escaner caido, no a una deteccion.
R_D="$(correr_caso "D-inocuo-scannerRoto" "$C_ALDIA" sembrar_inocuo ABORTA "GITLEAKS_BIN=C:/gfw-src/_m3/no-existe-gitleaks.exe")"; log "D -> $R_D"

REMOTO_FIN="$(git -C "$REPO" ls-remote origin main | cut -f1)"

# ── informe ──────────────────────────────────────────────────────────────────
{
  echo "# M-3 fase 1 — la capa LOCAL (pre-push → gitleaks), contra un bare en disco"
  echo
  echo "**Nada salio de la maquina.** El remoto de los tres pushes es \`$BARE\`; GitHub no se toco."
  echo "La capa server-side (H-A4-1 propiamente) es otra fase: su caso non-provider *publica por diseno*."
  echo
  echo "## Sujeto"
  echo
  echo "| que | SHA |"
  echo "|---|---|"
  echo "| \`origin/main\` remoto al abrir | \`$REMOTO\` |"
  echo "| \`origin/main\` remoto al cerrar | \`$REMOTO_FIN\` |"
  echo "| arbol AL DIA ejercitado (= marcador del grafo) | \`$SHA_ANCLA\` |"
  echo "| el scanner nace en (#601) | \`$SHA_601\` |"
  echo "| arbol BASE VIEJA ejercitado | \`$SHA_VIEJO\` |"
  if [ "$REMOTO" != "$REMOTO_FIN" ]; then
    echo
    echo "> El remoto se movio durante la corrida. No invalida nada: lo que se ejercita son **hooks de arboles fijados por SHA**, no el estado de \`main\`."
  fi
  echo
  echo "## Por que el arbol al dia es el del marcador, y no el ultimo main"
  echo
  echo "El pre-push tiene **dos** causas suficientes de aborto: el scanner y \`graph-sync\` (fail-closed)."
  echo "Un aborto del segundo no diria nada sobre secretos, y ademas mutaria el grafo — estado compartido"
  echo "del que esta sesion no es duena. El hook trae su propio atajo: si \`origin/main\` coincide con el"
  echo "marcador del bridge, sale \`exit 0\` sin sincronizar. Por eso el \`origin\` de los clones es un bare"
  echo "fijado en ese SHA: **el hook corre intacto, byte por byte**, el scanner se ejercita de verdad y"
  echo "\`graph-sync\` nunca llega. La columna *atribucion* lo verifica en cada fila."
  echo
  echo "## Control del material (va antes de todo)"
  echo
  echo "\`secretos-check.sh --arbol\` sobre el cebo de proveedor → **rc=1: lo detecta**. Sin esto, un"
  echo "\"paso\" seria el cero de un detector ciego, no evidencia. Log: \`control-material.log\`."
  echo
  echo "## Resultado"
  echo
  echo "| | caso | esperado | observado | atribucion | detalle |"
  echo "|---|---|---|---|---|---|"
  for r in "$R_A" "$R_B" "$R_C" "$R_D"; do
    IFS='|' read -r ok id esp obs attr rc ll <<< "$r"
    echo "| $ok | \`$id\` | $esp | **$obs** | $attr | $rc · $ll |"
  done
  echo
  echo "El veredicto de cada fila sale de si la ref llego al bare (\`show-ref\`), **no** del exit code de"
  echo "\`git push\`. Logs por caso: \`push-*.log\`."
} > "$RESULT"

log "listo -> $RESULT"
cat "$RESULT"
