#!/usr/bin/env bash
# test-foco-check.sh — control POSITIVO end-to-end de scripts/foco-check.sh.
#
# POR QUÉ EXISTE: en su primera corrida real foco-check dio verde sobre CERO commits. Un verde sobre
# cero sujetos no prueba nada (memoria: instrumento-que-no-mira-nunca-falla · vacio-no-es-hallazgo).
# Sus controles internos prueban el clasificador de strings, NO la cadena git log -> clasificación ->
# exit code. Este test fabrica un repo con los tres casos y exige el veredicto correcto de cada uno.
#
# Repo temporal: no toca el checkout compartido (CANON 9).
set -uo pipefail
REPO_REAL=$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fallos=0
ok()   { echo "  ✅ $1"; }
malo() { echo "  ❌ $1"; fallos=$((fallos+1)); }

cd "$T" || exit 1
git init -q .; git config user.email t@t; git config user.name t; git config commit.gpgsign false
mkdir -p docs/copiloto-emprendedor scripts apps/copiloto memoria
cp "$REPO_REAL/scripts/foco-check.sh" scripts/
cat > docs/copiloto-emprendedor/ALCANCE-CIERRE-BETA.md <<'DOC'
**SHA base del cierre:** `PLACEHOLDER` · **INICIO DEL CIERRE:** `2000-01-01 00:00`
<!-- ALCANCE-CERRADO:INICIO -->
A3 | BL-V31 | frontend1 | guard | apps/x.tsx
A7 | DRIVECERO | backend | drive | apps/copiloto/services/drive.py
<!-- ALCANCE-CERRADO:FIN -->
DOC
echo base > base.txt; git add -A >/dev/null; git commit -qm "chore: base"
BASE=$(git rev-parse HEAD)
sed -i "s/PLACEHOLDER/$BASE/" docs/copiloto-emprendedor/ALCANCE-CIERRE-BETA.md
git add docs scripts >/dev/null; git commit -qm "fix(BL-V31): el commit EN ALCANCE"

# caso 1 -- sólo el commit en alcance => exit 0
salida=$(bash scripts/foco-check.sh 2>&1); ex=$?
[ "$ex" = "0" ] && ok "un commit que cita un id => exit 0" || malo "commit en alcance dio exit $ex: $salida"
echo "$salida" | grep -qE 'EN ALCANCE.*: *1' && ok "lo cuenta como en-alcance" || malo "no lo contó: $salida"

# caso 2 -- auto-referencial (sólo toca scripts/ y memoria/, sin citar id)
echo x >> memoria/nota.md; git add memoria/nota.md >/dev/null
git commit -qm "docs(memoria): anotar el hallazgo del barrido"
salida=$(bash scripts/foco-check.sh 2>&1); ex=$?
[ "$ex" = "1" ] && ok "auto-referencial sin id => exit 1" || malo "auto-referencial dio exit $ex"
echo "$salida" | grep -qE 'AUTO-REFERENCIAL.*: *1' && ok "lo clasifica auto-referencial" || malo "mal clasificado: $salida"

# caso 3 -- desvío de PRODUCTO (toca apps/ sin citar id): la clase más grave
echo y >> apps/copiloto/otra_cosa.py; git add apps >/dev/null
git commit -qm "fix(otro-frente): arreglar algo que la auditoria encontro"
salida=$(bash scripts/foco-check.sh 2>&1); ex=$?
[ "$ex" = "1" ] && ok "desvío de producto => exit 1" || malo "desvío dio exit $ex"
echo "$salida" | grep -qE 'DESVÍO.*: *1' && ok "lo clasifica DESVÍO (no auto-referencial)" || malo "mal clasificado: $salida"
echo "$salida" | grep -q "arreglar algo que la auditoria encontro" && ok "nombra el commit culpable" || malo "no lo nombra"

# caso 4 -- el modo del cron: --quiet debe CALLAR si no hay desvío, y HABLAR si hay
git checkout -q "$BASE" -- . 2>/dev/null || true
q=$(bash scripts/foco-check.sh --quiet 2>&1)
[ -n "$q" ] && ok "--quiet habla cuando hay desvío" || malo "--quiet calló habiendo desvío (el cron no se enteraría)"

# caso 4.bis -- el reporte DECLARA de dónde leyó la lista. Sin esto, el defecto que invalidó la v1
# (leer el doc del disco donde corre, con 24 worktrees que tienen versiones distintas) es invisible:
# el gate reporta un número de ids y nadie sabe de qué archivo salió.
echo "$salida" | grep -qE 'alcance cerrado de .* @ ' && ok "el reporte declara la FUENTE de la lista" || malo "el reporte no dice de dónde leyó la lista"

# caso 5 -- fail-closed: lista vacía NO es luz verde
sed -i '/^A3 |/d; /^A7 |/d' docs/copiloto-emprendedor/ALCANCE-CIERRE-BETA.md
bash scripts/foco-check.sh >/dev/null 2>&1; ex=$?
[ "$ex" = "2" ] && ok "lista cerrada vacía => exit 2 (instrumento sin sujeto, no verde)" || malo "lista vacía dio exit $ex, debería ser 2"

echo
[ "$fallos" = "0" ] && { echo "test-foco-check: TODO VERDE"; exit 0; } || { echo "test-foco-check: $fallos FALLO(S)"; exit 1; }
