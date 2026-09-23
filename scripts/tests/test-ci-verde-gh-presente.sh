#!/usr/bin/env bash
# test-ci-verde-gh-presente.sh — `ci-verde.sh` medía "falta gh" como si fuera un rollup real.
#
# Por qué existe (2026-09-23, mismo molde que `command -v uv` en graph-sync.sh / #676). El pedido
# que originó este test midió 8 scripts que invocan `gh`; re-contado acá con el patrón real (no
# comentarios, no strings de un allowlist) da 4 invocadores genuinos: `inventario-ola.sh`,
# `podar-worktrees.sh` y `ramas-huerfanas.sh` YA tenían `command -v gh`; sólo `ci-verde.sh` — el
# que decide si un PR se mergea — no lo tenía. Sin la guarda, `gh` ausente hace que
# `gh pr view ...` falle con "comando no encontrado" y el script cae en el MISMO `exit 1` que usa
# para "NO VERDE — no mergear": un entorno sin `gh` (el runner de GitHub, ver #676) y un PR con CI
# roto son indistinguibles. Con la guarda, la ausencia sale por `exit 2`, un código propio.
#
#   1. POSITIVO  gh AUSENTE del PATH  → exit 2, mensaje "no está en el PATH", NUNCA llega a `gh pr view`
#   2. NEGATIVO  gh PRESENTE (stub)   → NO sale por 2 (llega a medir el rollup real)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { printf '  ✅ %s\n' "$1"; }
mal() { printf '  ❌ %s\n' "$1"; fallos=$((fallos+1)); }
echo "test-ci-verde-gh-presente"

# --- Caso 1: gh AUSENTE ---------------------------------------------------------------------
# BASH_BIN se resuelve ANTES de recortar el PATH e invoca por ruta absoluta: así el PATH
# restringido sólo tiene que cumplir UNA cosa (no traer `gh`), sin tener que además resolver
# `bash`. Primer intento fue `dirname(sh):dirname(cat)`, que en el runner de GitHub Actions
# falló -- ahí /usr/bin trae sh, cat Y gh juntos, así que la "exclusión" reincluía a gh sin
# querer (cazado por el control positivo de abajo: "el aislamiento no tomó", no un falso OK).
# El segundo intento symlinkeaba `bash` a un bindir propio, y ESO rompió en Windows/Git Bash:
# MSYS resuelve su DLL (msys-2.0.dll) relativa a la ruta real del .exe, así que un symlink en
# otro directorio lo deja sin poder cargar. Ruta absoluta + PATH vacío evita los dos.
BASH_BIN="$(command -v bash)"
PATH_SIN_GH=""
# Control de que el aislamiento tomó efecto: si `gh` siguiera visible acá, el caso 1 mediría
# la máquina real, no el guard (memoria/instrumento-que-no-mira-nunca-falla.md).
if PATH="$PATH_SIN_GH" command -v gh >/dev/null 2>&1; then
  echo "  ❌ gh sigue visible en el PATH recortado — el aislamiento no tomó, no mido nada"; exit 2
fi

out="$T/out1.txt"
PATH="$PATH_SIN_GH" "$BASH_BIN" "$ROOT/scripts/ci-verde.sh" 999 > "$out" 2>&1
rc=$?
if [ "$rc" -eq 2 ] && grep -q "no está en el PATH" "$out"; then
  ok "1 gh ausente -> exit 2 con mensaje, sin intentar medir"
else
  mal "1 gh ausente dio rc=$rc, salida: $(tr '\n' '|' < "$out" | cut -c1-120)"
fi

# --- Caso 2: gh PRESENTE (stub) -------------------------------------------------------------
# El stub no simula el CI: sólo satisface `command -v gh` y devuelve un rollup fabricado con
# los 6 jobs de tests.yml en SUCCESS, para que el script LLEGUE al veredicto en vez de abortar
# antes por falta de la herramienta — lo único falso es `gh`, igual que el stub de `uv`.
mkdir -p "$T/bin"
cat > "$T/bin/gh" <<'STUB'
#!/usr/bin/env bash
echo '[{"name":"backend","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"core","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"web","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"mobile","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"lint","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"drift","conclusion":"SUCCESS","status":"COMPLETED"}]'
STUB
chmod +x "$T/bin/gh"

out2="$T/out2.txt"
PATH="$T/bin:$PATH" bash "$ROOT/scripts/ci-verde.sh" 999 > "$out2" 2>&1
rc2=$?
if [ "$rc2" -ne 2 ] && grep -q "VERDE — se puede mergear" "$out2"; then
  ok "2 gh presente (stub) -> llega a medir, veredicto VERDE con el rollup fabricado"
else
  mal "2 gh presente dio rc=$rc2, salida: $(tr '\n' '|' < "$out2" | cut -c1-120)"
fi

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
