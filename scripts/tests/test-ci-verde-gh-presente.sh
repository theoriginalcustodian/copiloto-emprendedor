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
#   6-11 (2026-10-06)  el `mergeStateStatus`: BLOCKED/BEHIND/DIRTY → exit 5 (antes exit 0
#        «VERDE»), UNSTABLE sigue verde, un estado desconocido → exit 2, y la lista de
#        esperados en blanco → exit 2 en vez de «6/0 jobs VERDE».
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

# --- Casos 2-4: gh PRESENTE, los TRES veredictos de `mergeable` -----------------------------
# El stub sale de `scripts/lib/gh-stub.sh` y DESPACHA por subcomando. El de antes era wildcard
# (contestaba el rollup a cualquier `--json`), y eso fue la causa medida de que #772 diera rojo
# con el código correcto: agregó `gh pr view --json mergeable,mergeStateStatus`, el stub le
# devolvió el array del rollup, el script no pudo leer el campo y salió por «no pude medir»
# (rc=2). Cinco días de CI rojo atribuidos al cambio. Un stub que adivina acusa al script de su
# propio hueco — este falla con rc=64 ante un campo no declarado.
#
# Los tres casos NO son redundantes: son los tres destinos del `case` de `ci-verde.sh:214+`, y
# dos de ellos eran INALCANZABLES con el stub viejo. El 4 (UNKNOWN) es el que importa más de lo
# que parece: GitHub calcula `mergeable` de forma asíncrona, así que UNKNOWN es el caso NORMAL
# en los primeros segundos de un PR. Si algún día cae en el exit 1 del rojo, el gate empieza a
# gritar sobre PRs sanos — y un guard que grita en el caso normal se desarma solo.
# shellcheck source=../lib/gh-stub.sh
. "$ROOT/scripts/lib/gh-stub.sh"
mkdir -p "$T/bin"
fabricar_gh_stub "$T/bin"

ROLLUP_6_VERDES='[{"name":"backend","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"core","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"web","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"mobile","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"lint","conclusion":"SUCCESS","status":"COMPLETED"},{"name":"drift","conclusion":"SUCCESS","status":"COMPLETED"}]'

# $1 nombre · $2 mergeable · $3 mergeStateStatus · $4 rc esperado · $5 patrón que debe aparecer
mide_veredicto() {
  local nombre="$1" mrg="$2" mst="$3" rc_esp="$4" pat="$5" out rc
  out="$T/out-${mrg}.txt"
  PATH="$T/bin:$PATH" \
    GH_STUB_ROLLUP="$ROLLUP_6_VERDES" GH_STUB_MERGEABLE="$mrg" GH_STUB_MERGESTATE="$mst" \
    bash "$ROOT/scripts/ci-verde.sh" 999 > "$out" 2>&1
  rc=$?
  if [ "$rc" -eq "$rc_esp" ] && grep -q "$pat" "$out"; then
    ok "$nombre"
  else
    mal "$nombre — rc=$rc (esperaba $rc_esp), salida: $(tr '\n' '|' < "$out" | cut -c1-140)"
  fi
}

mide_veredicto "2 gh presente + MERGEABLE -> exit 0, llega al veredicto con el rollup fabricado" \
  MERGEABLE CLEAN 0 "VERDE — se puede mergear"
mide_veredicto "3 CI verde pero CONFLICTING -> exit 4 propio, no se funde con el rojo del CI" \
  CONFLICTING DIRTY 4 "tiene CONFLICTOS"
mide_veredicto "4 CI verde y mergeable UNKNOWN -> exit 2 (no pude medir), NO el exit 1 del rojo" \
  UNKNOWN UNKNOWN 2 "no informa si el PR es mergeable"

# --- Casos 6-10: el COMODÍN `MERGEABLE/*` declaraba verde lo que el remoto NO deja mergear ----
# 🔴 MEDIDO por auditoría el 2026-10-06 sobre este mismo arnés: `ci-verde.sh:244` decidía con
# `case "$ms" in MERGEABLE/*)`, y el comodín ignoraba el `mergeStateStatus` entero —
# `MERGEABLE/BLOCKED`, `/BEHIND` y `/DIRTY` salían por **exit 0 con «VERDE — se puede mergear»**.
#
# ⚠️ POR QUÉ ESTA TABLA NO ES «UN INSTRUMENTO MÁS» (que es lo que el repo congela por regla): el
# caso no era alcanzable el día que se midió —sin protección de rama, BLOCKED y BEHIND no ocurren—
# y **`BLOCKED` es exactamente lo que GitHub devuelve cuando un ruleset exige PR**. O sea que
# activar la protección de `main` sin tocar el `case` convertía un guard AUSENTE en un FALSO VERDE,
# y peor, porque `mergear-pr.sh:46` DELEGA en este gate. El defecto no vivía en ninguna de las dos
# decisiones: vivía en el cruce. Por eso los dos cambios entraron en el mismo commit que esta tabla.
#
# Los casos 2, 3 y 4 de arriba son los controles que hacen que estos cinco midan al script y no al
# arnés: el canario YA se pone verde, rojo, 4 y 2 cuando corresponde.
mide_veredicto "6 MERGEABLE/BLOCKED -> exit 5, NO el 0 que decía «se puede mergear»" \
  MERGEABLE BLOCKED 5 "el REMOTO todavía no deja mergear"
mide_veredicto "7 MERGEABLE/BEHIND -> exit 5" \
  MERGEABLE BEHIND 5 "el REMOTO todavía no deja mergear"
mide_veredicto "8 MERGEABLE/DIRTY -> exit 5" \
  MERGEABLE DIRTY 5 "el REMOTO todavía no deja mergear"
# `UNSTABLE` es el caso NORMAL cuando falla un check NO requerido, y tiene que seguir pasando: un
# guard que grita en el caso normal se desarma solo. Si este caso se pone rojo, el gate empieza a
# frenar PRs sanos y alguien aprende a saltearlo — que es el daño que estamos evitando, no causando.
mide_veredicto "9 CONTROL: MERGEABLE/UNSTABLE sigue VERDE (check no requerido en rojo = caso normal)" \
  MERGEABLE UNSTABLE 0 "VERDE — se puede mergear"
# Un `mergeStateStatus` que el script NO conoce (GitHub puede agregar estados: el enum es suyo) no
# puede pasar como verde. Vacío = pregunta, no permiso.
mide_veredicto "10 MERGEABLE/<estado nuevo de GitHub> -> exit 2, no se declara verde lo no reconocido" \
  MERGEABLE ESTADO_QUE_GITHUB_INVENTE_MANANA 2 "no reconozco el estado de merge"

# --- Caso 11: el DENOMINADOR de los esperados (fila CIVERDEDENOM) -----------------------------
# `ESPERADOS="${2:-...}"` sólo cubre $2 AUSENTE: un $2 presente-pero-en-blanco deja la lista vacía,
# el bucle de jobs no itera ni una vez y el veredicto salía VERDE con «6/0 jobs». No era alcanzable
# (el único call-site real no pasa $2) y se tapa igual porque es la TERCERA aparición del mismo
# defecto en un día: `SMOKEDENOM`, el bucle de tests de `lint.sh`, y ésta.
out="$T/out-denom.txt"
PATH="$T/bin:$PATH" GH_STUB_ROLLUP="$ROLLUP_6_VERDES" GH_STUB_MERGEABLE=MERGEABLE \
  GH_STUB_MERGESTATE=CLEAN bash "$ROOT/scripts/ci-verde.sh" 999 " " > "$out" 2>&1
rc=$?
if [ "$rc" -eq 2 ] && grep -q "esperados está vacía" "$out"; then
  ok "11 lista de esperados en blanco -> exit 2, no el VERDE con denominador cero"
else
  mal "11 esperados vacíos dio rc=$rc: $(tr '\n' '|' < "$out" | cut -c1-140)"
fi

# --- Caso 5: CONTROL POSITIVO del stub -------------------------------------------------------
# Sin esto, los tres casos de arriba podrían estar pasando porque el stub contesta cualquier cosa
# plausible — que es el defecto que vinimos a matar. Acá se le pide un campo NO declarado y se
# exige que FALLE con 64: es el canario de que el stub discrimina de verdad.
if PATH="$T/bin:$PATH" GH_STUB_ROLLUP="$ROLLUP_6_VERDES" \
     gh pr view 999 --json inventado >/dev/null 2>&1; then
  mal "5 el stub contestó un --json NO declarado (inventado) — vuelve a ser wildcard"
else
  rc5=$?
  [ "$rc5" -eq 64 ] && ok "5 CONTROL: campo no declarado -> el stub falla con 64, no adivina" \
                    || mal "5 el stub falló con rc=$rc5, esperaba 64 (¿fallo por otra causa?)"
fi

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
