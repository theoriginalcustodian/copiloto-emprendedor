#!/usr/bin/env bash
# Test de idemkey_paridad.py (PARID): paridad mobile<->web del patrón "idemKey deriva de mensajeId".
# Corre sobre un árbol fixture (mktemp), nunca sobre el repo real.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHK="$ROOT/scripts/ci/idemkey_paridad.py"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { echo "  ✅ $1"; }
mal() { echo "  ❌ $1"; fallos=$((fallos+1)); }

mkdir -p "$T/apps/mobile/src/modules/gastos" "$T/apps/copiloto-web/src/modules/gastos" \
         "$T/apps/mobile/src/modules/clientes" "$T/apps/copiloto-web/src/modules/clientes" \
         "$T/scripts/ci"

FORM_GASTO_DERIVA='const idemKey = useRef(mensajeId != null ? `gasto:${mensajeId}` : generarId());'
FORM_CLIENTE_SIN_DERIVAR='res = await crearCliente(datos, { idemKey: claveAlta.current });'

# --- fixture NEGATIVO: ambos derivan (gasto) + ambos sin derivar (cliente) -> verde -----------
echo "$FORM_GASTO_DERIVA" > "$T/apps/mobile/src/modules/gastos/FormularioGasto.tsx"
echo "$FORM_GASTO_DERIVA" > "$T/apps/copiloto-web/src/modules/gastos/FormularioGasto.tsx"
echo "$FORM_CLIENTE_SIN_DERIVAR" > "$T/apps/mobile/src/modules/clientes/FormularioCliente.tsx"
echo "$FORM_CLIENTE_SIN_DERIVAR" > "$T/apps/copiloto-web/src/modules/clientes/FormularioCliente.tsx"
cat > "$T/scripts/ci/idemkey-paridad-excepciones.json" <<'EOF'
{"excepciones": {}}
EOF

salida="$(python3 "$CHK" --root "$T" --check 2>&1)"; rc=$?
if [ "$rc" = 0 ] && echo "$salida" | grep -q "FormularioCliente.tsx"; then
  ok "paridad completa (deriva/deriva + sin_derivar/sin_derivar) -> verde, y reporta el gap conocido"
else
  mal "debería dar verde sin drift, informando FormularioCliente como sin derivar (rc=$rc): $salida"
fi

# --- CONTROL POSITIVO: saco la derivación de un lado (mobile, gasto) -----------------------------
# Es el escenario real del DoD: "sacá la derivación de UNO de los 4, mostrá el test en rojo
# nombrando ese archivo, restaurá". Acá se ejercita sobre el fixture, no sobre el repo real.
echo 'res = await crearGasto(datos, { idemKey: claveGesto.current });' \
  > "$T/apps/mobile/src/modules/gastos/FormularioGasto.tsx"

salida="$(python3 "$CHK" --root "$T" --check 2>&1)"; rc=$?
if [ "$rc" = 1 ] && echo "$salida" | grep -q "FormularioGasto.tsx" \
                 && echo "$salida" | grep -q "mobile=sin_derivar"; then
  ok "control positivo: mobile deja de derivar -> rojo, nombra FormularioGasto.tsx y el estado que cambió"
else
  mal "control positivo debería fallar nombrando el archivo y el estado (rc=$rc): $salida"
fi

# restauro para lo que sigue
echo "$FORM_GASTO_DERIVA" > "$T/apps/mobile/src/modules/gastos/FormularioGasto.tsx"

# --- formulario nuevo, un solo lado (sin gemelo) --------------------------------------------------
mkdir -p "$T/apps/mobile/src/modules/ingresos"
echo "$FORM_GASTO_DERIVA" | sed 's/gasto/ingreso/' > "$T/apps/mobile/src/modules/ingresos/FormularioIngreso.tsx"

salida="$(python3 "$CHK" --root "$T" --check 2>&1)"; rc=$?
if [ "$rc" = 1 ] && echo "$salida" | grep -q "FormularioIngreso.tsx" && echo "$salida" | grep -q "falta el gemelo en web"; then
  ok "quinto formulario de un solo lado (sin gemelo) -> rojo, nombra el archivo y la plataforma que falta"
else
  mal "debería fallar nombrando el formulario unilateral y 'falta el gemelo en web' (rc=$rc): $salida"
fi
rm -rf "$T/apps/mobile/src/modules/ingresos"

# --- Formulario ajeno al patrón (sin idemKey en ningún lado) -> fuera de alcance, no rompe --------
mkdir -p "$T/apps/mobile/src/modules/ajustes" "$T/apps/copiloto-web/src/modules/ajustes"
echo 'export function FormularioAjustes() { return null; }' > "$T/apps/mobile/src/modules/ajustes/FormularioAjustes.tsx"

salida="$(python3 "$CHK" --root "$T" --check 2>&1)"; rc=$?
if [ "$rc" = 0 ]; then
  ok "formulario sin idemKey en ningún lado no entra al universo -> no genera drift"
else
  mal "un formulario ajeno al patrón no debería romper el gate (rc=$rc): $salida"
fi
rm -rf "$T/apps/mobile/src/modules/ajustes" "$T/apps/copiloto-web/src/modules/ajustes"

# --- trinquete: excepción declarada que ya no es drift real (stale) ------------------------------
cat > "$T/scripts/ci/idemkey-paridad-excepciones.json" <<'EOF'
{"excepciones": {"FormularioGasto.tsx": {"motivo": "ya no aplica", "fecha": "2026-01-01"}}}
EOF
salida="$(python3 "$CHK" --root "$T" --check 2>&1)"; rc=$?
if [ "$rc" = 1 ] && echo "$salida" | grep -q "STALE"; then
  ok "trinquete: excepción sobre un par que hoy está en paridad -> rojo (sacala del baseline)"
else
  mal "una excepción stale debería fallar el gate, no perdonarse en silencio (rc=$rc): $salida"
fi

# --- fail-closed: archivo de excepciones ausente --------------------------------------------------
rm -f "$T/scripts/ci/idemkey-paridad-excepciones.json"
python3 "$CHK" --root "$T" --check >/dev/null 2>&1
rc=$?
[ "$rc" = 1 ] && ok "fail-closed: sin archivo de excepciones -> rojo aunque no haya drift real" \
  || mal "debería fallar cerrado sin el archivo de excepciones (rc=$rc)"

echo
if [ "$fallos" = 0 ]; then
  echo "✅ test-idemkey-paridad: todo verde"
else
  echo "❌ test-idemkey-paridad: $fallos fallo(s)"
  exit 1
fi
