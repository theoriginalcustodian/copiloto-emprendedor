#!/usr/bin/env bash
# test-graph-sync-lock-y-drift.sh — las dos guardas que este script no tenía.
#
# Por qué existe (2026-09-22): `graph-sync.sh` escribe `$WT` y el bridge LEE el `path` de su
# repos.toml. Dos configs independientes del mismo árbol, y nada verificaba que coincidieran: el
# 2026-08-19 el default de `WT` cambió y la del bridge no, así que durante más de un mes el bridge
# leyó un árbol que nadie actualizaba. Quedó invisible porque el hook sólo sincroniza cuando
# `origin/main` ≠ marcador; el día que el atajo dejó de aplicar, el sync abortó TODO push del repo.
#
# Y el lock guardaba el PID del dueño desde siempre SIN LEERLO NUNCA: la única prueba de vida era la
# edad (600 s). El primer sync completo tras el drift ingirió >17 min — con la regla vieja, la sesión
# siguiente le roba el lock a un sync vivo y las dos reescriben el mismo árbol y el mismo checkpoint.
#
#   1. POSITIVO  el repo no está en repos.toml            → aborta (sin esa entrada no hay qué ingerir)
#   2. POSITIVO  bridge y script apuntan a árboles distintos → aborta nombrando LOS DOS paths
#   3. NEGATIVO  paths alineados                          → NO dice DRIFT (llega a la guarda siguiente)
#   4. REGRESIÓN lock viejo con dueño VIVO                → NO se lo roba  ← el bug que motiva el fix
#   5. POSITIVO  lock con dueño MUERTO                    → lo toma sin esperar a que venza la edad
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"; kill %1 2>/dev/null' EXIT
fallos=0
ok()  { printf '  ✅ %s\n' "$1"; }
mal() { printf '  ❌ %s\n' "$1"; fallos=$((fallos+1)); }
echo "test-graph-sync-lock-y-drift"

# Fixture: copia del script en un repo propio, para que su $REPO sea ÉSTE y no el repo real (mismo
# mecanismo que test-gate-hook-secretos.sh). Sin remoto: cualquier `fetch` de más muere solo.
R="$T/repo"; mkdir -p "$R/scripts"
cp "$ROOT/scripts/graph-sync.sh" "$R/scripts/graph-sync.sh"
git -c init.defaultBranch=main init -q "$R"
git -C "$R" config user.email t@t; git -C "$R" config user.name t
echo x > "$R/f"; git -C "$R" add f; git -C "$R" commit -qm base

bridge_con() {  # bridge_con <path-del-repo-en-repos.toml> [nombre]
  local B="$T/bridge"; rm -rf "$B"; mkdir -p "$B/config"
  { echo '[[repo]]'
    echo "name             = \"${2:-copiloto-emprendedor}\""
    echo "path             = \"$1\""
  } > "$B/config/repos.toml"
  echo "$B"
}
correr() {  # correr <BRIDGE> <WT> [env extra...] -> rc, salida en $T/out
  local B="$1" W="$2"; shift 2
  env GRAPHITY_BRIDGE_PATH="$B" UC_GRAPH_WORKTREE="$W" "$@" \
      timeout 25 bash "$R/scripts/graph-sync.sh" > "$T/out" 2>&1
  echo $?
}

# 1 — el repo no figura en repos.toml
rc="$(correr "$(bridge_con "$R" otro-repo)" "$T/wt")"
[ "$rc" -ne 0 ] && grep -q "no encuentro el repo" "$T/out" \
  && ok "1 repo ausente en repos.toml -> aborta" \
  || mal "1 rc=$rc · siguió sin saber qué ingerir: $(tail -1 "$T/out" | cut -c1-70)"

# 2 — DRIFT: el bridge lee un árbol distinto del que este script escribe
rc="$(correr "$(bridge_con "C:/gfw-src/otro-arbol")" "$T/wt")"
[ "$rc" -ne 0 ] && grep -q "DRIFT de configuración" "$T/out" \
  && grep -q "otro-arbol" "$T/out" && grep -q "$T/wt" "$T/out" \
  && ok "2 drift -> aborta nombrando los dos paths" \
  || mal "2 rc=$rc · el drift pasó: $(tail -1 "$T/out" | cut -c1-70)"

# 3 — CONTROL NEGATIVO: alineados no hay drift. Se apunta $WT al propio checkout a propósito, para
# que la guarda SIGUIENTE aborte: así se prueba que pasó el drift sin ejecutar nada pesado.
rc="$(correr "$(bridge_con "$R")" "$R")"
! grep -q "DRIFT de configuración" "$T/out" && grep -q "checkout de trabajo" "$T/out" \
  && ok "3 control: alineados NO dispara drift (aborta la guarda siguiente)" \
  || mal "3 falso positivo de drift con los paths iguales"

# Worktree válido para llegar al lock: detached, sin node_modules (guardas 2 y 3).
WT="$T/wt-ok"; git -C "$R" worktree add -q --detach "$WT" HEAD 2>/dev/null
LOCK="$WT.sync.lock"
sleep 300 & VIVO=$!
MUERTO="$(bash -c 'echo $$')"          # pid de un proceso que ya terminó
lock_con() { rm -rf "$LOCK"; mkdir -p "$LOCK"; echo "$1" > "$LOCK/pid"; touch -d '2 hours ago' "$LOCK"; }

# 4 — REGRESIÓN: dueño VIVO, lock mucho más viejo que LOCK_MAX_AGE -> no se lo roba
lock_con "$VIVO"
rc="$(correr "$(bridge_con "$WT")" "$WT" UC_GRAPH_LOCK_MAX_AGE=1)"
[ "$rc" -eq 0 ] && grep -q "otro sync está corriendo" "$T/out" && [ "$(cat "$LOCK/pid")" = "$VIVO" ] \
  && ok "4 lock viejo con dueño VIVO -> respeta el turno, no lo roba" \
  || mal "4 rc=$rc · le robó el lock a un sync vivo (pid ahora=$(cat "$LOCK/pid" 2>/dev/null))"

# 5 — dueño MUERTO: lo toma, y sin esperar a que venza la edad
lock_con "$MUERTO"
rc="$(correr "$(bridge_con "$WT")" "$WT" UC_GRAPH_LOCK_MAX_AGE=99999)"
grep -q "lock huérfano" "$T/out" \
  && ok "5 lock con dueño MUERTO -> lo toma sin esperar la edad" \
  || mal "5 un dueño muerto dejó el sync trabado: $(grep -m1 'graph-sync' "$T/out" | cut -c1-70)"

# 6 - REGRESION: la forma MSYS de Git-Bash (/c/x) y la de Windows (C:/x) son el MISMO path. Sin
# reconciliarlas, exportar UC_GRAPH_WORKTREE desde una terminal dispara un drift falso -- y un guard
# que grita en el caso normal se desarma solo. Lo cazo el control negativo del propio guard.
WIN="$(cd "$WT" && pwd -W 2>/dev/null || echo '')"
if [ -n "$WIN" ]; then
  rm -rf "$LOCK"
  rc="$(correr "$(bridge_con "$WIN")" "$WT")"
  ! grep -q "DRIFT de configuración" "$T/out"     && ok "6 forma MSYS vs forma Windows del mismo árbol -> NO es drift"     || mal "6 falso positivo: '$WIN' y '$WT' son el mismo path"
else
  # Fuera de Git-Bash no hay dos formas del mismo path: el caso no aplica, y marcarlo rojo sería un
  # falso negativo del test que enseñaría a ignorarlo en el CI de Linux.
  printf '  ·  6 n/a fuera de Git-Bash (no hay forma MSYS que reconciliar)\n'
fi

# 7 - la bitácora ATRIBUYE: dos causas distintas dejan motivos distintos. Sin esto, «el marcador no
# avanzó» tiene cuatro explicaciones y ninguna forma de separarlas media hora después.
BIT="$T/bitacora.log"; rm -f "$BIT"
rm -rf "$LOCK"; correr "$(bridge_con "C:/gfw-src/no-existe-jamas")" "$WT" UC_GRAPH_LOG="$BIT" >/dev/null
lock_con "$VIVO";  correr "$(bridge_con "$WT")" "$WT" UC_GRAPH_LOG="$BIT" >/dev/null
if grep -q "motivo=drift-de-config" "$BIT" && grep -q "motivo=contencion-otro-sync" "$BIT"; then
  ok "7 la bitácora distingue drift de contención (2 líneas, 2 motivos)"
else
  mal "7 la bitácora no atribuye: $(tr '
' '|' < "$BIT" | cut -c1-90)"
fi

git -C "$R" worktree remove --force "$WT" 2>/dev/null
[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
