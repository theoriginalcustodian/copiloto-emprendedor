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
[ "$fallos" = "0" ] && echo "RESULTADO: ✅ todo verde" || echo "RESULTADO: ❌ $fallos fallo(s)"
exit "$fallos"
