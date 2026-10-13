#!/usr/bin/env bash
# test-graph-sync-saneado.sh — el saneado de graph-sync.sh, las guardas que lo acompañan y el
# `GIT_DIR` heredado de un hook. HERMÉTICO: repo temporal + origin local + stub de `uv`.
#
# El bug que cubre NO es "el checkout aborta" (se reprodujo el estado exacto del incidente y NO
# aborta: rc=0). Es que ni `checkout` ni `clean -fd` RESTAURAN un archivo trackeado borrado, así que
# el grafo ingiere un árbol incompleto y reporta éxito.
#
# 🔴 HISTORIA DE ESTE ARCHIVO (2026-10-13). Vivía en `scripts/test-graph-sync-saneado.sh` con CERO
# invocadores y con rutas `C:/Users/Admin/...` a propósito. Resultado medido al reabrirlo: **ROJO**
# (rc=8). Cuando se agregó la guarda de `repos.toml` al script, aborta ANTES del saneado, y el
# «BRIDGE falso» de este test no tenía `config/repos.toml`: las secciones que miden el saneado
# medían «no encuentro el repo». Además la sección de LOCK asumía que un lock con PID muerto se
# respeta («el chequeo es por EDAD»), premisa que el script abandonó el 2026-09-22 (ahora es por
# vida del dueño). Un test sin invocador no falla nunca: se pudre en silencio.
# Ahora vive en `scripts/tests/`, que `scripts/ci/tests-coordinacion.sh` recorre con denominador.
#
# Todo en un repo TEMPORAL con su propio `origin` (bare, local): ni red, ni `origin/main` del repo
# real, ni worktrees del repo real. Mismo mecanismo que `test-graph-sync-lock-y-drift.sh`.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TU="$(mktemp -d)"; T="$TU"      # TU = forma nativa del shell (la que entiende PATH); T = la de git/toml
# Git for Windows no crea worktrees bajo la forma MSYS (`/tmp/...`) — el setup fallaba en silencio y
# el test medía un árbol inexistente. `cygpath -m` da la forma mixta (`C:/Users/.../Temp/...`) que
# git y repos.toml entienden; en Linux (CI) no existe y el path ya es nativo.
command -v cygpath >/dev/null 2>&1 && T="$(cygpath -m "$T")"
VIVO=""
fallos=0
ok(){ echo "  ✅ $1"; }
mal(){ echo "  ❌ $1"; fallos=$((fallos+1)); }
limpiar(){
  [ -n "$VIVO" ] && kill "$VIVO" 2>/dev/null
  git -C "$T/repo" worktree remove --force "$T/wt-detached" >/dev/null 2>&1 || true
  git -C "$T/repo" worktree remove --force "$T/wt-con-rama" >/dev/null 2>&1 || true
  rm -rf "$T"
}
trap limpiar EXIT
echo "test-graph-sync-saneado"

# `uv` no participa de lo que se mide (saneado, guardas, lock: todo ANTERIOR a la ingesta), pero el
# script lo exige como dependencia y aborta antes. Stub antepuesto al PATH, y verificado.
# El control es por EFECTO (el stub se identifica), no por comparar paths: `command -v` devuelve la
# forma MSYS y `$T` es la mixta, y comparar formas distintas del mismo path da un rojo falso.
mkdir -p "$TU/bin"; printf '#!/usr/bin/env bash\necho STUB-UV\nexit 0\n' > "$TU/bin/uv"; chmod +x "$TU/bin/uv"
export PATH="$TU/bin:$PATH"     # `:` separa el PATH: la forma mixta `C:/...` lo partiría en dos entradas
[ "$(uv 2>/dev/null)" = "STUB-UV" ] \
  || { echo "  ❌ el stub de uv no quedó primero en el PATH — no mido nada"; exit 2; }

# --- fixture: origin local + repo con una copia del script (su $REPO pasa a ser éste) ------------
git init -q --bare -b main "$T/origin.git" || { echo "SETUP FALLO: no pude crear origin"; exit 1; }
R="$T/repo"; mkdir -p "$R/scripts" "$R/memoria"
cp "$ROOT/scripts/graph-sync.sh" "$R/scripts/graph-sync.sh"
for n in uno dos tres; do echo "contenido $n" > "$R/memoria/$n.md"; done
git -c init.defaultBranch=main init -q "$R"
git -C "$R" config user.email t@t; git -C "$R" config user.name t
git -C "$R" config core.autocrlf false   # sin esto, el fixture imprime ruido de CRLF en Windows
git -C "$R" add -A && git -C "$R" commit -qm base
git -C "$R" remote add origin "$T/origin.git"
git -C "$R" push -q origin main 2>/dev/null || { echo "SETUP FALLO: no pude pushear a origin"; exit 1; }
git -C "$R" fetch -q origin main

bridge_con() {  # bridge_con <path-del-worktree-del-grafo> -> imprime el path del bridge
  local B="$T/bridge"; rm -rf "$B"; mkdir -p "$B/config"
  { echo '[[repo]]'; echo 'name             = "copiloto-emprendedor"'; echo "path             = \"$1\""; } \
    > "$B/config/repos.toml"
  echo "$B"
}
correr(){  # correr <worktree> -> salida (stdout+stderr) del script; el rc lo deja en $?
  local W="$1" B; B="$(bridge_con "$W")"
  GRAPHITY_BRIDGE_PATH="$B" UC_GRAPH_WORKTREE="$W" timeout 60 bash "$R/scripts/graph-sync.sh" 2>&1
}
WT_OK="$T/wt-detached"; WT_RAMA="$T/wt-con-rama"

echo "== Fixture: worktree detached, ensuciado como el incidente =="
git -C "$R" worktree add -q --detach "$WT_OK" origin/main \
  || { echo "SETUP FALLO: no pude crear $WT_OK"; exit 1; }
victima="memoria/uno.md"
[ -f "$WT_OK/$victima" ] || { echo "SETUP FALLO: sin archivo de fixture"; exit 1; }
command rm "$WT_OK/$victima"                                # trackeado BORRADO -> ` D`
echo "basura" > "$WT_OK/archivo-untracked-de-prueba.txt"    # untracked         -> `??`
echo "  estado: $(git -C "$WT_OK" status --short | tr '\n' ' ')"

echo
echo "== CONTROL NEGATIVO A: 'clean -fd' NO restaura un trackeado borrado =="
if [ -z "$(git -C "$WT_OK" clean -nd -- "$victima")" ]; then
  ok "confirmado: clean no lo lista (sólo borra untracked)"
else
  mal "clean SÍ lo tocaría — la premisa del fix es falsa, revisar"
fi

echo
echo "== CONTROL NEGATIVO B: el 'checkout' del orden viejo TAMPOCO lo restaura =="
git -C "$WT_OK" checkout --detach origin/main --quiet 2>/dev/null; rc=$?
if [ $rc -eq 0 ] && [ ! -f "$WT_OK/$victima" ]; then
  ok "checkout devolvió 0 y el archivo SIGUE faltando — éste es el bug real"
elif [ $rc -ne 0 ]; then
  mal "el checkout abortó (rc=$rc): el fixture no reproduce el caso medido"
else
  mal "el checkout restauró el archivo: no hay bug que arreglar, revisar el diagnóstico"
fi

echo
echo "== CONTROL POSITIVO: el script con el fix deja el árbol ÍNTEGRO en origin/main =="
salida="$(correr "$WT_OK")"
esperado="$(git -C "$R" rev-parse origin/main)"
real="$(git -C "$WT_OK" rev-parse HEAD 2>/dev/null || echo _)"
[ "$real" = "$esperado" ] && ok "árbol en origin/main @ ${real:0:12}" \
                          || mal "árbol en ${real:0:12}, esperaba ${esperado:0:12} · $(echo "$salida" | tail -2 | tr '\n' '|' | cut -c1-200)"
[ -f "$WT_OK/$victima" ] && ok "el trackeado borrado fue RESTAURADO" \
                         || mal "sigue faltando '$victima'"
[ ! -f "$WT_OK/archivo-untracked-de-prueba.txt" ] && ok "el untracked fue BORRADO" \
                                                  || mal "el untracked sobrevivió"
# Control de integridad, que es el punto: el árbol debe quedar SIN diferencias contra origin/main.
sucio="$(git -C "$WT_OK" status --porcelain)"
[ -z "$sucio" ] && ok "árbol limpio: 0 diferencias contra origin/main" \
                || mal "el árbol quedó sucio: $(echo "$sucio" | tr '\n' ' ')"

echo
echo "== GUARDA 2: un worktree CON RAMA debe abortar SIN destruir =="
git -C "$R" worktree add -q -b test-graphsync-rama "$WT_RAMA" origin/main \
  || { echo "SETUP FALLO: no pude crear $WT_RAMA"; exit 1; }
echo "trabajo sin commitear" > "$WT_RAMA/WIP-no-me-borres.txt"
salida_g="$(correr "$WT_RAMA")"; rc=$?
if [ $rc -ne 0 ] && echo "$salida_g" | grep -q "tiene la rama"; then
  ok "abortó nombrando la rama (rc=$rc)"
else
  mal "NO abortó (rc=$rc) — la guarda no protege worktrees de trabajo"
fi
[ -f "$WT_RAMA/WIP-no-me-borres.txt" ] && ok "el WIP sobrevivió intacto" \
                                       || mal "💥 el WIP fue DESTRUIDO — la guarda falló"

echo
echo "== LOCK: dueño VIVO -- la segunda corrida sale 0 SIN tocar el árbol =="
# El lock se respeta por VIDA del dueño (graph-sync.sh, adquirir_lock), no por edad: la premisa
# anterior de este test —un PID inexistente «vale» por reciente— el script la abandonó.
sleep 300 & VIVO=$!
LOCKDIR_OK="${WT_OK}.sync.lock"
rm -rf "$LOCKDIR_OK"; mkdir -p "$LOCKDIR_OK"; echo "$VIVO" > "$LOCKDIR_OK/pid"
echo "marca-de-que-no-me-tocaron" > "$WT_OK/marca-pre-lock.txt"
antes="$(git -C "$WT_OK" rev-parse HEAD)"
salida_lock="$(UC_GRAPH_LOCK="$LOCKDIR_OK" correr "$WT_OK")"; rc_lock=$?
despues="$(git -C "$WT_OK" rev-parse HEAD)"
if [ $rc_lock -eq 0 ] && echo "$salida_lock" | grep -q "otro sync está corriendo"; then
  ok "salió 0 avisando que el lock está ocupado"
else
  mal "no detectó el lock ocupado (rc=$rc_lock): $(echo "$salida_lock" | tail -1 | cut -c1-120)"
fi
[ "$antes" = "$despues" ] && ok "HEAD del árbol NO se movió (no tocó nada)" \
                           || mal "el HEAD cambió igual -- el lock no frenó el sync"
[ -f "$WT_OK/marca-pre-lock.txt" ] && ok "la marca de archivo sigue -- el árbol no fue saneado" \
                                    || mal "el árbol fue saneado a pesar del lock ocupado"

echo
echo "== CONTROL NEGATIVO: sin el chequeo de lock, el saneo se ejecuta IGUAL con contención real =="
# El lockdir de arriba sigue ocupado. Las mismas 3 operaciones del script SIN pasar por
# adquirir_lock: si esto avanza igual, nada del filesystem frena la contención por sí solo — es el
# chequeo explícito el que protege. Si también saliera «protegido», el positivo de arriba no
# estaría midiendo el lock.
git -C "$WT_OK" reset --hard --quiet
git -C "$WT_OK" clean -qfd
git -C "$WT_OK" checkout --detach origin/main --quiet
despues_directo="$(git -C "$WT_OK" rev-parse HEAD)"
[ "$despues_directo" = "$esperado" ] \
  && ok "sin el chequeo, el saneo SÍ avanza con el lock ocupado -- el gate del script es lo que protege" \
  || mal "el saneo directo no avanzó -- el negativo no reproduce, revisar el fixture"
kill "$VIVO" 2>/dev/null; VIVO=""

echo
echo "== LOCK HUÉRFANO: dueño MUERTO no deja la corrida siguiente trabada =="
MUERTO="$(bash -c 'echo $$')"          # pid de un proceso que ya terminó
rm -rf "$LOCKDIR_OK"; mkdir -p "$LOCKDIR_OK"; echo "$MUERTO" > "$LOCKDIR_OK/pid"
echo "otra-marca" > "$WT_OK/marca-huerfano.txt"
salida_huerfano="$(UC_GRAPH_LOCK="$LOCKDIR_OK" correr "$WT_OK")"
real2="$(git -C "$WT_OK" rev-parse HEAD 2>/dev/null || echo _)"
if echo "$salida_huerfano" | grep -q "lock huérfano"; then
  ok "detectó el lock huérfano (dueño muerto)"
else
  mal "no detectó el lock huérfano: $(echo "$salida_huerfano" | tail -1 | cut -c1-120)"
fi
[ "$real2" = "$esperado" ] && [ ! -f "$WT_OK/marca-huerfano.txt" ] \
  && ok "la corrida siguiente NO quedó trabada -- saneó y sincronizó igual" \
  || mal "quedó trabada: HEAD en ${real2:0:12}, esperaba ${esperado:0:12}"
[ ! -d "$LOCKDIR_OK" ] && ok "el lockdir se liberó al terminar" \
                        || mal "el lockdir quedó huérfano DE NUEVO tras la corrida"
rm -rf "$LOCKDIR_OK"

echo
echo "== GIT_DIR HEREDADO: reproducido -- gana sobre -C sin neutralizarlo =="
# Cada worktree tiene su propio git-dir; setear GIT_DIR a ESE path desde afuera es exactamente lo
# que un hook hereda de quien pushea.
GITDIR_DE_WTRAMA="$(git -C "$WT_RAMA" rev-parse --absolute-git-dir)"
GITDIR_DE_WTOK="$(git -C "$WT_OK" rev-parse --absolute-git-dir)"
rama_leida_sin_fix="$(GIT_DIR="$GITDIR_DE_WTRAMA" git -C "$WT_OK" symbolic-ref --quiet --short HEAD 2>/dev/null || echo '(vacío)')"
if [ "$rama_leida_sin_fix" = "test-graphsync-rama" ]; then
  ok "reproducido: con GIT_DIR ajeno seteado, -C NO alcanza -- leyó '$rama_leida_sin_fix' en vez del HEAD real de \$WT_OK (detached)"
else
  mal "no reprodujo (leyó '$rama_leida_sin_fix') -- GIT_DIR no ganó sobre -C acá, revisar el diagnóstico"
fi

echo
echo "== GIT_DIR HEREDADO -- CONTROL POSITIVO: con el unset, el sync PASA aunque herede GIT_DIR ajeno =="
# Simula el hook real: alguien pushea desde \$WT_RAMA y ESO dispara el sync sobre \$WT_OK. Se ensucia
# antes, para que «sincronizó igual» pruebe una ACCIÓN y no un árbol que ya estaba bien.
echo "ensucio-de-nuevo" > "$WT_OK/marca-gitdir.txt"
GIT_DIR="$GITDIR_DE_WTRAMA" GIT_WORK_TREE="$WT_RAMA" correr "$WT_OK" >/dev/null 2>&1
real3="$(git -C "$WT_OK" rev-parse HEAD 2>/dev/null || echo _)"
[ "$real3" = "$esperado" ] && [ ! -f "$WT_OK/marca-gitdir.txt" ] \
  && ok "sincronizó y saneó igual -- el GIT_DIR heredado no lo desvió" \
  || mal "el sync se desvió con GIT_DIR heredado (HEAD ${real3:0:12}, marca=$([ -f "$WT_OK/marca-gitdir.txt" ] && echo sigue || echo no)) -- el unset no cubre este camino"

echo
echo "== GIT_DIR HEREDADO -- CONTROL NEGATIVO: la guarda de rama SIGUE protegiendo aunque herede GIT_DIR ajeno =="
# Misma herencia simulada, pero el hook dispara el sync sobre \$WT_RAMA — que SÍ tiene una rama real.
# Si el unset «arregla» tanto que apaga esta protección, cambiamos un falso positivo por una
# pérdida de datos real.
salida_gitdir_guarda="$(GIT_DIR="$GITDIR_DE_WTOK" GIT_WORK_TREE="$WT_OK" correr "$WT_RAMA")"; rc_guarda=$?
if [ $rc_guarda -ne 0 ] && echo "$salida_gitdir_guarda" | grep -q "tiene la rama"; then
  ok "abortó nombrando la rama real de \$WT_RAMA (rc=$rc_guarda) -- la protección sigue viva"
else
  mal "NO abortó (rc=$rc_guarda) -- el fix rompió la guarda real, revisar"
fi
[ -f "$WT_RAMA/WIP-no-me-borres.txt" ] && ok "el WIP de \$WT_RAMA sigue intacto" \
                                        || mal "💥 el WIP fue DESTRUIDO"

echo
[ "$fallos" = "0" ] && echo "RESULTADO: ✅ todo verde" || echo "RESULTADO: ❌ $fallos fallo(s)"
exit "$fallos"
