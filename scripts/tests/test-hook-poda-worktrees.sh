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
git -C "$TMP" -c user.email=t@t -c user.name=t commit -q --allow-empty -m init 2>/dev/null
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

# ── 4. Sin el guión en NINGÚN worktree: sale 0 **y lo dice** ──────────────────────────────────────
# Hasta el 2026-10-19 este caso sólo exigía `exit 0` y el hook salía MUDO («rama vieja: no es un
# error»). Medido ese día: el checkout COMPARTIDO —el cwd primario del proyecto— estaba atrasado y
# no tenía el guión, así que el mecanismo quedaba apagado justo donde arranca la mayoría de las
# sesiones, y nadie se enteraba. Un exit 0 silencioso en el caso de activación del guard es
# indistinguible de un barrido que corrió y no encontró nada. Ahora el silencio ES el defecto.
rm -f "$MARCA"
mv "$TMP/scripts/poda-worktrees-en-background.sh" "$TMP/scripts/_guardado.sh"
salida4="$( cd "$TMP" && CLAUDE_PROJECT_DIR="$TMP" node "$HOOK" 2>&1 )"
rc=$?
mv "$TMP/scripts/_guardado.sh" "$TMP/scripts/poda-worktrees-en-background.sh"
if [ "$rc" -eq 0 ]; then ok "sin el guión: sale 0, no rompe el arranque"
else fail "salió $rc sin el guión: un hook de higiene no puede impedir arrancar una sesión"; fi
if printf '%s' "$salida4" | grep -q 'NO corrió'; then ok "sin el guión: AVISA en vez de callarse"
else fail "salió mudo sin el guión: un mecanismo apagado se lee igual que uno que no encontró nada"; fi

# ── 4.bis POSITIVO del caso medido el 2026-10-19 ──────────────────────────────────────────────────
# El guión está en OTRO worktree y no en el cwd. Cubre las DOS mitades del defecto: (a) que el hook
# lo ENCUENTRE derivando de `git worktree list` en vez de declararlo contra el cwd, y (b) que le pase
# como raíz el worktree que SÍ lo tiene — el runner hace `cd "$REPO"` y corre
# `scripts/podar-worktrees.sh` RELATIVO a eso, así que apuntar al checkout atrasado ejecutaba la
# versión VIEJA del janitor: la de bases declaradas, que miró 0 directorios y reportó tres ceros.
rm -f "$MARCA"
VIEJOTMP="$TMP/_atrasado"
git -C "$TMP" worktree add -q --detach "$VIEJOTMP" HEAD 2>/dev/null
if [ -d "$VIEJOTMP" ]; then
  rm -rf "$VIEJOTMP/scripts" "$TMP/LLAMADO.txt" "$VIEJOTMP/LLAMADO.txt"
  ( cd "$VIEJOTMP" && CLAUDE_PROJECT_DIR="$VIEJOTMP" node "$HOOK" >/dev/null 2>&1 )
  for _ in $(seq 1 25); do [ -f "$TMP/LLAMADO.txt" ] && break; sleep 0.4; done
  if [ -f "$TMP/LLAMADO.txt" ]; then ok "guión ausente en el cwd pero presente en otro worktree: lo DERIVA y lanza"
  else fail "no lo encontró en otro worktree: el hook queda apagado en todo checkout atrasado"; fi
  # Este control sólo CONCLUYE si hubo lanzamiento: sin él, "$VIEJOTMP/LLAMADO.txt" no existe y un
  # `! -f` pasaría por ausencia — verde justamente por el defecto que el control de arriba acusa.
  # Medido: con el hook de 11c02fb3 (que no lanza) esta aserción daba ✅ y tapaba la mitad del caso.
  if [ ! -f "$TMP/LLAMADO.txt" ]; then
    echo "  ⏭  no hubo lanzamiento: la raíz no se puede medir (NO es ✅; el fallo es el de arriba)"
  elif [ ! -f "$VIEJOTMP/LLAMADO.txt" ]; then
    ok "le pasa la raíz del worktree que TIENE el guión, no el cwd atrasado"
  else
    fail "corrió con el cwd atrasado como raíz: ejecutaría la versión VIEJA del janitor"
  fi
  git -C "$TMP" worktree remove --force "$VIEJOTMP" 2>/dev/null
else
  echo "  ⏭  no se pudo crear el worktree de prueba — 4.bis se saltea (entorno, no defecto)"
fi

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
