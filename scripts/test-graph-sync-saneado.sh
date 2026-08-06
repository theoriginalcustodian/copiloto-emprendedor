#!/usr/bin/env bash
# Test del saneado de graph-sync.sh. NO toca el worktree real del grafo ni Graphity: usa worktrees
# temporales propios y un BRIDGE falso (el script muere al llegar al sync, DESPUÉS de sanear y
# verificar el árbol — que es justo lo que medimos).
#
# El bug que cubre NO es "el checkout aborta" (se reprodujo el estado exacto del incidente y NO
# aborta: rc=0). Es que ni `checkout` ni `clean -fd` RESTAURAN un archivo trackeado borrado, así que
# el grafo ingiere un árbol incompleto y reporta éxito.
set -uo pipefail
REPO="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
# Ruta WINDOWS a propósito: `mktemp -d` devuelve /tmp/... (MSYS) y `git worktree add` de Git for
# Windows no crea ahí — el setup fallaba en silencio y el test medía un árbol inexistente.
TMP="${TMPDIR_WIN:-C:/Users/Admin/AppData/Local/Temp/claude-test-graphsync}"
rm -rf "$TMP"; BRIDGE_FAKE="$TMP/bridge"; mkdir -p "$BRIDGE_FAKE" || exit 1
WT_OK="$TMP/wt-detached"; WT_RAMA="$TMP/wt-con-rama"
fallos=0
ok(){ echo "  ✅ $1"; }
mal(){ echo "  ❌ $1"; fallos=$((fallos+1)); }

limpiar(){
  git -C "$REPO" worktree remove --force "$WT_OK"   >/dev/null 2>&1 || true
  git -C "$REPO" worktree remove --force "$WT_RAMA" >/dev/null 2>&1 || true
  git -C "$REPO" branch -D test-graphsync-rama      >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap limpiar EXIT

correr(){ GRAPHITY_BRIDGE_PATH="$BRIDGE_FAKE" UC_GRAPH_WORKTREE="$1" \
          bash "$REPO/scripts/graph-sync.sh" 2>&1; }

echo "== Fixture: worktree detached, ensuciado como el incidente =="
git -C "$REPO" worktree add --detach "$WT_OK" origin/main >/dev/null \
  || { echo "SETUP FALLO: no pude crear $WT_OK"; exit 1; }
victima="$(git -C "$WT_OK" ls-files 'memoria/*.md' | head -1)"
[ -n "$victima" ] || { echo "SETUP FALLO: sin archivo de fixture"; exit 1; }
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
esperado="$(git -C "$REPO" rev-parse origin/main)"
real="$(git -C "$WT_OK" rev-parse HEAD 2>/dev/null || echo _)"
[ "$real" = "$esperado" ] && ok "árbol en origin/main @ ${real:0:12}" \
                          || mal "árbol en ${real:0:12}, esperaba ${esperado:0:12}"
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
git -C "$REPO" worktree add -b test-graphsync-rama "$WT_RAMA" origin/main >/dev/null \
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
echo "== LOCK: dos corridas concurrentes -- la segunda sale 0 SIN tocar el árbol =="
LOCKDIR_OK="${WT_OK}.sync.lock"
rm -rf "$LOCKDIR_OK"; mkdir -p "$LOCKDIR_OK"
echo "99999999" > "$LOCKDIR_OK/pid"   # PID que casi seguro no existe -- el chequeo es por EDAD, no por vida del proceso
echo "marca-de-que-no-me-tocaron" > "$WT_OK/marca-pre-lock.txt"
antes="$(git -C "$WT_OK" rev-parse HEAD)"
salida_lock="$(UC_GRAPH_LOCK="$LOCKDIR_OK" correr "$WT_OK")"; rc_lock=$?
despues="$(git -C "$WT_OK" rev-parse HEAD)"
if [ $rc_lock -eq 0 ] && echo "$salida_lock" | grep -q "otro sync está corriendo"; then
  ok "salió 0 avisando que el lock está ocupado"
else
  mal "no detectó el lock ocupado (rc=$rc_lock): $salida_lock"
fi
[ "$antes" = "$despues" ] && ok "HEAD del árbol NO se movió (no tocó nada)" \
                           || mal "el HEAD cambió igual -- el lock no frenó el sync"
[ -f "$WT_OK/marca-pre-lock.txt" ] && ok "la marca de archivo sigue -- el árbol no fue saneado" \
                                    || mal "el árbol fue saneado a pesar del lock ocupado"

echo
echo "== CONTROL NEGATIVO: sin el chequeo de lock, el saneo se ejecuta IGUAL con contención real =="
# El lockdir de arriba sigue ocupado. Corremos las mismas 3 operaciones del script pero SIN pasar
# por adquirir_lock -- si esto avanza igual, confirma que nada del filesystem frena la contención
# por sí solo: es el chequeo explícito el que protege, no un efecto colateral. Si este control
# también saliera "protegido", el control positivo de arriba no estaría midiendo el lock.
git -C "$WT_OK" reset --hard --quiet
git -C "$WT_OK" clean -qfd
git -C "$WT_OK" checkout --detach origin/main --quiet
despues_directo="$(git -C "$WT_OK" rev-parse HEAD)"
esperado_directo="$(git -C "$REPO" rev-parse origin/main)"
[ "$despues_directo" = "$esperado_directo" ] \
  && ok "sin el chequeo, el saneo SÍ avanza con el lock ocupado -- el gate del script es lo que protege" \
  || mal "el saneo directo no avanzó -- el negativo no reproduce, revisar el fixture"

echo
echo "== LOCK HUÉRFANO: proceso muerto no deja la corrida siguiente trabada =="
rm -rf "$LOCKDIR_OK"; mkdir -p "$LOCKDIR_OK"
echo "99999999" > "$LOCKDIR_OK/pid"
sleep 2
salida_huerfano="$(UC_GRAPH_LOCK="$LOCKDIR_OK" UC_GRAPH_LOCK_MAX_AGE=1 correr "$WT_OK")"
esperado2="$(git -C "$REPO" rev-parse origin/main)"
real2="$(git -C "$WT_OK" rev-parse HEAD 2>/dev/null || echo _)"
if echo "$salida_huerfano" | grep -q "lock huérfano"; then
  ok "detectó el lock huérfano por antigüedad"
else
  mal "no detectó el lock huérfano: $salida_huerfano"
fi
[ "$real2" = "$esperado2" ] && ok "la corrida siguiente NO quedó trabada -- sincronizó igual" \
                             || mal "quedó trabada: HEAD en ${real2:0:12}, esperaba ${esperado2:0:12}"
[ ! -d "$LOCKDIR_OK" ] && ok "el lockdir se liberó al terminar" \
                        || mal "el lockdir quedó huérfano DE NUEVO tras la corrida"
rm -rf "$LOCKDIR_OK"

echo
echo "== GIT_DIR HEREDADO: reproducido -- gana sobre -C sin neutralizarlo =="
# $WT_RAMA (con rama real) y $WT_OK (detached, ya sincronizado) siguen vivos de las secciones
# anteriores. Cada worktree tiene su propio git-dir: "rev-parse --absolute-git-dir" desde adentro
# de uno da el path que git usa para identificarlo -- setear GIT_DIR a ESE path desde afuera es
# exactamente lo que un hook hereda de quien pushea.
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
# Simula el hook real: alguien pushea desde \$WT_RAMA (GIT_DIR de esa rama queda en el entorno) y
# ESO dispara el sync sobre \$WT_OK (el worktree del grafo, detached). Con el unset del fix, el
# script debe ignorar ese GIT_DIR heredado y sincronizar igual.
GIT_DIR="$GITDIR_DE_WTRAMA" GIT_WORK_TREE="$WT_RAMA" correr "$WT_OK" >/dev/null 2>&1
esperado3="$(git -C "$REPO" rev-parse origin/main)"
real3="$(git -C "$WT_OK" rev-parse HEAD 2>/dev/null || echo _)"
[ "$real3" = "$esperado3" ] && ok "sincronizó igual -- el GIT_DIR heredado no lo desvió" \
                             || mal "el sync se desvió con GIT_DIR heredado -- el unset no cubre este camino"

echo
echo "== GIT_DIR HEREDADO -- CONTROL NEGATIVO: la guarda de rama SIGUE protegiendo aunque herede GIT_DIR ajeno =="
# Mismo herencia simulada, pero ahora el hook (imaginario) dispara el sync sobre \$WT_RAMA -- que
# SÍ tiene una rama real. La guarda tiene que seguir abortando: si el unset "arregla" tanto que
# también apaga esta protección, cambiamos un falso positivo por una pérdida de datos real.
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
