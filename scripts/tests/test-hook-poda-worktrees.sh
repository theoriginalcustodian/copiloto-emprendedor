#!/usr/bin/env bash
# test-hook-poda-worktrees.sh — el hook SessionStart que dispara la poda.
#
# POR QUÉ ESTE TEST EXISTE, y es distinto del de `podar-worktrees.sh`: aquél verifica las guardas del
# que BORRA; éste verifica que algo lo LLAME. Es la mitad que faltaba — `podar-worktrees.sh` tenía su
# test verde desde agosto y aun así acumuló 145 worktrees, porque un test del script no prueba que el
# script se invoque. Es la cuarta vez que este repo paga «CERO invocadores» (CONTROLESDEPLOYSINGATE,
# DURABGATE, MAPEOSINGATE).
#
# AISLAMIENTO: el caso positivo NO corre la poda real. Monta un repo git temporal con un
# `poda-worktrees-en-background.sh` de juguete, así se ejercita la cadena hook→guión sin que un test
# pueda borrar el worktree de nadie.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK="$REPO_ROOT/scripts/hooks/podar_worktrees_al_arrancar.mjs"

fallos=0
corridos=0
ok()   { printf '  ✅ %s\n' "$1"; corridos=$((corridos + 1)); }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

echo "test-hook-poda-worktrees"

[ -f "$HOOK" ] || { fail "no existe el hook $HOOK"; echo; echo "❌ $fallos fallo(s)"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "  ⏭  sin node en el PATH — se saltea (no es rojo de entorno)"; exit 0; }

node --check "$HOOK" >/dev/null 2>&1 && ok "el hook parsea" || fail "el hook NO parsea (sintaxis)"

# ── Entorno aislado ───────────────────────────────────────────────────────────────────────────────
TMP="$(mktemp -d)"
limpiar() { rm -rf "$TMP" 2>/dev/null; }
trap limpiar EXIT
git -C "$TMP" init -q 2>/dev/null
mkdir -p "$TMP/scripts"
# guión de juguete: deja constancia de haber sido llamado y escribe la marca como el real
cat > "$TMP/scripts/poda-worktrees-en-background.sh" <<'JUGUETE'
#!/usr/bin/env bash
echo "llamado" > "$1/LLAMADO.txt"
printf '{"cuando":"%s","podados":0}\n' "$(date -Iseconds)" > "$3"
JUGUETE
COMUN="$(git -C "$TMP" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"
MARCA="$COMUN/poda-worktrees-ultima.json"

# ── 1. POSITIVO: sin marca previa, el hook LANZA ──────────────────────────────────────────────────
# Sin este caso, el test del throttle (3) pasaría igual si el hook no lanzara NUNCA: verde por
# ausencia, que es exactamente la falla que este repo ya pagó.
rm -f "$MARCA" "$TMP/LLAMADO.txt"
( cd "$TMP" && CLAUDE_PROJECT_DIR="$TMP" node "$HOOK" >/dev/null 2>&1 )
for _ in $(seq 1 25); do [ -f "$TMP/LLAMADO.txt" ] && break; sleep 0.4; done
[ -f "$TMP/LLAMADO.txt" ] && ok "sin marca previa: LANZA el guión" \
  || fail "sin marca previa NO lanzó — el hook no dispara nada (la poda jamás correría)"

# ── 2. No bloquea ─────────────────────────────────────────────────────────────────────────────────
# Un SessionStart que tarda los ~42 s de la poda real es un guard que molesta en el caso normal, y
# esos se desarman solos. Por eso el lanzamiento es detached y el hook tiene que volver enseguida.
rm -f "$MARCA" "$TMP/LLAMADO.txt"
ini=$(date +%s%N)
( cd "$TMP" && CLAUDE_PROJECT_DIR="$TMP" node "$HOOK" >/dev/null 2>&1 )
ms=$(( ($(date +%s%N) - ini) / 1000000 ))
[ "$ms" -lt 3000 ] && ok "no bloquea el arranque (${ms} ms < 3000)" \
  || fail "el hook tardó ${ms} ms: a ese costo alguien lo va a desactivar"

# ── 3. NEGATIVO: con marca reciente, NO lanza (throttle) ──────────────────────────────────────────
sleep 1
printf '{"cuando":"%s","podados":0}\n' "$(date -Iseconds)" > "$MARCA"
rm -f "$TMP/LLAMADO.txt"
( cd "$TMP" && CLAUDE_PROJECT_DIR="$TMP" node "$HOOK" >/dev/null 2>&1 )
sleep 2
[ ! -f "$TMP/LLAMADO.txt" ] && ok "marca reciente: NO relanza (throttle)" \
  || fail "relanzó con marca reciente: N sesiones que arrancan juntas disparan N barridos"

# ── 4. Ceguera: sin el guión, el hook no puede romper el arranque ─────────────────────────────────
rm -f "$MARCA"
mv "$TMP/scripts/poda-worktrees-en-background.sh" "$TMP/scripts/_guardado.sh"
( cd "$TMP" && CLAUDE_PROJECT_DIR="$TMP" node "$HOOK" >/dev/null 2>&1 )
rc=$?
mv "$TMP/scripts/_guardado.sh" "$TMP/scripts/poda-worktrees-en-background.sh"
[ "$rc" -eq 0 ] && ok "sin el guión (rama vieja): sale 0, no rompe el arranque" \
  || fail "salió $rc sin el guión: un hook de higiene no puede impedir arrancar una sesión"

# ── 5. CANARIO del parseo de la cifra ─────────────────────────────────────────────────────────────
# Si esto se rompe, el hook informa «0 podados» aunque haya borrado 2: la poda se vuelve invisible y
# un borrado que nadie ve es indistinguible de un bug. Se mide contra la salida REAL del script.
real='  ✅ podado: wt-a [rama/a]
🧹 2 podado(s) · 0 conservado(s) por negativa de git · 1 protegido(s) por las guardas'
n=$(printf '%s' "$real" | grep -oE '[0-9]+ podado' | grep -oE '[0-9]+' | head -1)
[ "$n" = "2" ] && ok "la cifra se extrae de la salida real (2)" \
  || fail "extrajo '$n' de una salida con 2 podados: la poda quedaría invisible"
n0=$(printf '%s' '🧹 0 podado(s) · 0 conservado(s)' | grep -oE '[0-9]+ podado' | grep -oE '[0-9]+' | head -1)
[ "$n0" = "0" ] && ok "control negativo: 0 podados extrae 0" || fail "extrajo '$n0' en vez de 0"

echo
if [ "$fallos" -eq 0 ]; then echo "✅ test-hook-poda-worktrees: $corridos control(es) OK"; exit 0; fi
echo "❌ test-hook-poda-worktrees: $fallos fallo(s)"; exit 1
