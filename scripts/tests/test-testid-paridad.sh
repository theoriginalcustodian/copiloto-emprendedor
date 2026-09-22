#!/usr/bin/env bash
# Test de testid_paridad.py v2 (BL-Q1): paridad POR PANTALLA, trinquete (excepción stale -> rojo),
# ids dinámicos como "no medidos" (nunca par ni falta), y fail-closed clásico.
# Corre sobre un árbol fixture (mktemp), nunca sobre el repo real.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHK="$ROOT/scripts/ci/testid_paridad.py"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { echo "  ✅ $1"; }
mal() { echo "  ❌ $1"; fallos=$((fallos+1)); }

mkdir -p "$T/apps/mobile/src/modules/gastos" "$T/apps/copiloto-web/src/modules/gastos" \
         "$T/apps/mobile/src/modules/ingresos" "$T/apps/copiloto-web/src/modules/ingresos" \
         "$T/apps/mobile/src/modules/clientes" "$T/apps/copiloto-web/src/modules/clientes" \
         "$T/scripts/ci"

# --- fixture NEGATIVO: mismo id, misma pantalla (modules/gastos), en las dos plataformas ---------
cat > "$T/apps/mobile/src/modules/gastos/Pantalla.tsx" <<'EOF'
<Boton testID="gastos-boton-guardar" />
EOF
cat > "$T/apps/copiloto-web/src/modules/gastos/Pantalla.tsx" <<'EOF'
<button data-testid="gastos-boton-guardar" />
EOF
cat > "$T/scripts/ci/testid-paridad-excepciones.json" <<'EOF'
{"excepciones": {}}
EOF

python3 "$CHK" --root "$T" --check >/dev/null 2>&1
rc=$?
[ "$rc" = 0 ] && ok "paridad completa (mismo id, misma pantalla) -> verde" \
  || mal "debería dar verde sin drift (rc=$rc)"

# --- (4) POR PANTALLA: mismo id string, pero en pantallas DISTINTAS de cada plataforma -----------
# gastos (mobile) vs ingresos (web) -- v1 los hubiera dado por buenos (set global); v2 NO.
cat > "$T/apps/mobile/src/modules/gastos/Pantalla.tsx" <<'EOF'
<Boton testID="gastos-boton-guardar" />
<Chip testID="id-cruzado" />
EOF
cat > "$T/apps/copiloto-web/src/modules/ingresos/Pantalla.tsx" <<'EOF'
<button data-testid="id-cruzado" />
EOF

python3 "$CHK" --root "$T" --check >/tmp/bl-q1-cruzado.$$ 2>&1
rc=$?
if [ "$rc" = 1 ] && grep -q "modules/gastos::id-cruzado" /tmp/bl-q1-cruzado.$$ \
                 && grep -q "modules/ingresos::id-cruzado" /tmp/bl-q1-cruzado.$$; then
  ok "por pantalla: mismo id en pantallas distintas NO se da por bueno -> rojo, dos claves nombradas"
else
  mal "debería marcar drift en AMBAS pantallas por separado (rc=$rc)"
fi
rm -f /tmp/bl-q1-cruzado.$$
# vuelvo al estado limpio para lo que sigue
rm -f "$T/apps/copiloto-web/src/modules/ingresos/Pantalla.tsx"

# --- CONTROL POSITIVO: agrego un id sólo en mobile, sin excepción --------------------------------
cat > "$T/apps/mobile/src/modules/gastos/Pantalla.tsx" <<'EOF'
<Boton testID="gastos-boton-guardar" />
<Chip testID="gastos-chip-solo-mobile" />
EOF

python3 "$CHK" --root "$T" --check >/tmp/bl-q1-salida.$$ 2>&1
rc=$?
if [ "$rc" = 1 ] && grep -q "modules/gastos::gastos-chip-solo-mobile" /tmp/bl-q1-salida.$$; then
  ok "control positivo: id sin contraparte y sin excepción -> rojo, y nombra pantalla::id"
else
  mal "control positivo debería fallar nombrando pantalla::id (rc=$rc)"
fi
rm -f /tmp/bl-q1-salida.$$

# --- (2) el id nuevo NO se tapa aunque haya un baseline grande con OTRAS excepciones válidas ------
cat > "$T/scripts/ci/testid-paridad-excepciones.json" <<'EOF'
{"excepciones": {
  "modules/gastos::otra-excepcion-vieja-1": {"falta_en": "web", "fecha": "2026-01-01", "motivo": "no existe -- probará el trinquete"},
  "modules/gastos::otra-excepcion-vieja-2": {"falta_en": "web", "fecha": "2026-01-01", "motivo": "no existe -- probará el trinquete"}
}}
EOF
python3 "$CHK" --root "$T" --check >/tmp/bl-q1-nuevo.$$ 2>&1
rc=$?
if [ "$rc" = 1 ] && grep -q "gastos-chip-solo-mobile" /tmp/bl-q1-nuevo.$$; then
  ok "control positivo: id nuevo no se tapa por un baseline con OTRAS excepciones declaradas"
else
  mal "un id nuevo debería seguir marcando aunque el baseline no esté vacío (rc=$rc)"
fi
rm -f /tmp/bl-q1-nuevo.$$

# --- (1) TRINQUETE, caso A: excepción cuyo id ya NO EXISTE en ningún lado ------------------------
cat > "$T/scripts/ci/testid-paridad-excepciones.json" <<'EOF'
{"excepciones": {
  "modules/gastos::gastos-chip-solo-mobile": {"falta_en": "web", "fecha": "2026-09-22", "motivo": "test"},
  "modules/gastos::id-que-ya-no-existe": {"falta_en": "web", "fecha": "2026-01-01", "motivo": "viejo"}
}}
EOF
python3 "$CHK" --root "$T" --check >/tmp/bl-q1-stale-a.$$ 2>&1
rc=$?
if [ "$rc" = 1 ] && grep -q "STALE" /tmp/bl-q1-stale-a.$$ && grep -q "id-que-ya-no-existe" /tmp/bl-q1-stale-a.$$; then
  ok "trinquete A: excepción de un id que ya no existe en ningún lado -> rojo, 'sacala del baseline'"
else
  mal "trinquete A debería fallar nombrando el id fantasma (rc=$rc)"
fi
rm -f /tmp/bl-q1-stale-a.$$

# --- (1) TRINQUETE, caso B: excepción cuyo id YA TIENE su par en la misma pantalla ----------------
cat > "$T/apps/copiloto-web/src/modules/gastos/Pantalla.tsx" <<'EOF'
<button data-testid="gastos-boton-guardar" />
<span data-testid="gastos-chip-solo-mobile" />
EOF
python3 "$CHK" --root "$T" --check >/tmp/bl-q1-stale-b.$$ 2>&1
rc=$?
if [ "$rc" = 1 ] && grep -q "STALE" /tmp/bl-q1-stale-b.$$ && grep -q "gastos-chip-solo-mobile" /tmp/bl-q1-stale-b.$$; then
  ok "trinquete B: excepción cuyo id ya tiene par real -> rojo, 'sacala del baseline'"
else
  mal "trinquete B debería fallar: la excepción quedó obsoleta al aparecer el par (rc=$rc)"
fi
rm -f /tmp/bl-q1-stale-b.$$
# vuelvo al estado unilateral para lo que sigue
cat > "$T/apps/copiloto-web/src/modules/gastos/Pantalla.tsx" <<'EOF'
<button data-testid="gastos-boton-guardar" />
EOF

# el mismo drift, ahora con SÓLO su excepción real -> vuelve a verde
cat > "$T/scripts/ci/testid-paridad-excepciones.json" <<'EOF'
{"excepciones": {"modules/gastos::gastos-chip-solo-mobile": {"falta_en": "web", "fecha": "2026-09-22", "motivo": "test"}}}
EOF
python3 "$CHK" --root "$T" --check >/dev/null 2>&1
rc=$?
[ "$rc" = 0 ] && ok "id unilateral con excepción declarada (pantalla::id) -> verde" \
  || mal "una excepción declarada debería dar verde (rc=$rc)"

# --- (FORMA) clave de excepción sin 'pantalla::id' -------------------------------------------------
cat > "$T/scripts/ci/testid-paridad-excepciones.json" <<'EOF'
{"excepciones": {"gastos-chip-solo-mobile": {"falta_en": "web", "fecha": "2026-09-22", "motivo": "clave sin pantalla"}}}
EOF
python3 "$CHK" --root "$T" --check >/tmp/bl-q1-forma.$$ 2>&1
rc=$?
if [ "$rc" = 1 ] && grep -q "FORMA" /tmp/bl-q1-forma.$$; then
  ok "clave de excepción sin 'pantalla::id' -> rojo (FORMA)"
else
  mal "una clave sin 'pantalla::id' debería fallar como FORMA (rc=$rc)"
fi
rm -f /tmp/bl-q1-forma.$$
cat > "$T/scripts/ci/testid-paridad-excepciones.json" <<'EOF'
{"excepciones": {"modules/gastos::gastos-chip-solo-mobile": {"falta_en": "web", "fecha": "2026-09-22", "motivo": "test"}}}
EOF

# --- (3) ids dinámicos: se cuentan como "no medidos", nunca como par ni como falta ----------------
cat > "$T/apps/mobile/src/modules/ingresos/Pantalla.tsx" <<'EOF'
<Boton testID={`ingresos-dinamico-${id}`} />
<Chip testID={variable} />
EOF
cat > "$T/apps/copiloto-web/src/modules/ingresos/Pantalla.tsx" <<'EOF'
<button data-testid={`ingresos-dinamico-${id}`} />
EOF
salida="$(python3 "$CHK" --root "$T" --check 2>&1)"
rc=$?
if [ "$rc" = 0 ] && echo "$salida" | grep -q "3 usos de id dinamico NO medidos (2 mobile / 1 web)"; then
  ok "ids dinámicos no cuentan como par ni como falta -- se reportan aparte (3 no medidos)"
else
  mal "los ids dinámicos deberían reportarse como no medidos sin afectar el veredicto (rc=$rc): $salida"
fi
inv_dyn="$(python3 "$CHK" --root "$T" --inventario 2>&1)"
echo "$inv_dyn" | python3 -c "
import json, sys
d = json.load(sys.stdin)
assert d['no_medidos']['total_mobile'] == 2, d
assert d['no_medidos']['total_web'] == 1, d
print('ok')
" >/tmp/bl-q1-dyn-check.$$ 2>&1
if grep -q "^ok$" /tmp/bl-q1-dyn-check.$$; then
  ok "--inventario reporta no_medidos por plataforma (2 mobile / 1 web)"
else
  mal "--inventario debería reportar no_medidos correctos: $(cat /tmp/bl-q1-dyn-check.$$)"
fi
rm -f /tmp/bl-q1-dyn-check.$$
rm -f "$T/apps/mobile/src/modules/ingresos/Pantalla.tsx" "$T/apps/copiloto-web/src/modules/ingresos/Pantalla.tsx"

# --- FAIL-CLOSED: excepciones ausente --------------------------------------------------------------
rm -f "$T/scripts/ci/testid-paridad-excepciones.json"
python3 "$CHK" --root "$T" --check >/dev/null 2>&1
rc=$?
[ "$rc" = 1 ] && ok "fail-closed: archivo de excepciones ausente -> rojo" \
  || mal "excepciones ausente debería fallar, no dar verde (rc=$rc)"

# --- FAIL-CLOSED: excepciones ilegible (JSON roto) --------------------------------------------------
echo "{ esto no es json" > "$T/scripts/ci/testid-paridad-excepciones.json"
python3 "$CHK" --root "$T" --check >/dev/null 2>&1
rc=$?
[ "$rc" = 1 ] && ok "fail-closed: excepciones ilegible -> rojo" \
  || mal "JSON roto debería fallar, no dar verde (rc=$rc)"

# --- FAIL-CLOSED: excepciones vacío de forma (sin la clave 'excepciones') --------------------------
echo "{}" > "$T/scripts/ci/testid-paridad-excepciones.json"
python3 "$CHK" --root "$T" --check >/dev/null 2>&1
rc=$?
[ "$rc" = 1 ] && ok "fail-closed: JSON válido pero sin la clave 'excepciones' -> rojo" \
  || mal "estructura inválida debería fallar, no dar verde (rc=$rc)"

# --- (hallazgo PR #616) un id que sólo aparece en el arnés de TEST no cuenta -----------------------
# `sonda-cierre`/`entrada-stub` eran ids de `*.test.tsx` sin contraparte de UI real: contarlos
# producía un falso rojo que nadie puede resolver del lado de UI. Cubrimos las tres formas del
# arnés: `.test.tsx`, `.spec.tsx` y `__tests__/` (esta última con nombre de archivo normal).
# (el bloque fail-closed de arriba dejó el archivo de excepciones roto a propósito -- restaurarlo,
# perdonando el mismo drift residual de gastos que el resto del fixture todavía tiene)
cat > "$T/scripts/ci/testid-paridad-excepciones.json" <<'EOF'
{"excepciones": {"modules/gastos::gastos-chip-solo-mobile": {"falta_en": "web", "fecha": "2026-09-22", "motivo": "test"}}}
EOF
mkdir -p "$T/apps/mobile/src/modules/clientes/__tests__"
cat > "$T/apps/mobile/src/modules/clientes/Pantalla.test.tsx" <<'EOF'
<View testID="sonda-cierre" />
EOF
cat > "$T/apps/mobile/src/modules/clientes/Otra.spec.tsx" <<'EOF'
<View testID="entrada-stub" />
EOF
cat > "$T/apps/mobile/src/modules/clientes/__tests__/Harness.tsx" <<'EOF'
<View testID="harness-carpeta" />
EOF
python3 "$CHK" --root "$T" --check >/tmp/bl-q1-arnes.$$ 2>&1
rc=$?
if [ "$rc" = 0 ] && ! grep -qE "sonda-cierre|entrada-stub|harness-carpeta" /tmp/bl-q1-arnes.$$; then
  ok "id que sólo vive en .test.tsx/.spec.tsx/__tests__/ NO cuenta como drift (verde, sin nombrarlo)"
else
  mal "un id de arnés de test no debería aparecer en el veredicto (rc=$rc): $(cat /tmp/bl-q1-arnes.$$)"
fi
inv_arnes="$(python3 "$CHK" --root "$T" --inventario 2>&1)"
if ! echo "$inv_arnes" | grep -qE "sonda-cierre|entrada-stub|harness-carpeta"; then
  ok "--inventario tampoco lista ids del arnés de test (ni en drift ni en no_medidos)"
else
  mal "--inventario no debería mencionar ids del arnés de test"
fi
rm -f /tmp/bl-q1-arnes.$$
rm -rf "$T/apps/mobile/src/modules/clientes"

# --- --inventario no toca disco fuera del root fixture y es JSON válido ----------------------------
salida="$(python3 "$CHK" --root "$T" --inventario 2>&1)"
echo "$salida" | python3 -c "import json,sys; json.load(sys.stdin)" >/dev/null 2>&1 \
  && ok "--inventario emite JSON válido" || mal "--inventario debería emitir JSON válido"

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
