#!/usr/bin/env bash
# test-inventario-ola.sh — el inventario que recibe auditoría no puede dar por entregado lo que no está.
#
# CASO REAL (A1, 2026-09-21). Auditoría encontró tres fallas del inventario de la Ola 1:
#   · BL-X5 (mitad BACKEND + mitad FRONTEND-2) salía «✅ sí» con un solo PR de web: el script contaba
#     CITAS en títulos, no mitades con diff.
#   · Las filas J (plan: Ola 2) se entregaron en la ventana de la Ola 1 y el inventario no las listaba:
#     sólo miraba la columna «Ola = N». Nadie las iba a medir.
#   · El comando prescripto `gate.sh --solo backend` corre 0 jobs y sale verde.
#
#   1. CONTROL POSITIVO — fila de dos mitades con PR que toca las dos capas → ✅
#   2. EL CASO X5      — fila de dos mitades, un solo PR de web        → ⚠️ mitad BACKEND, cuenta como falta
#   3. EL CASO J       — PR de la ventana cita una fila de otra ola    → aparece en §2.bis con su ola
#   4. CONTROL NEGATIVO — fila de esta ola no citada                   → NO CITADO, no aparece en §2.bis
#   5. El comando del gate no usa `--solo`
set -uo pipefail
# Nunca `productor | grep -q` acá: con pipefail, grep -q corta el pipe, el productor muere por
# SIGPIPE y el `if` miente (falso rojo; falso verde si está negado). Todo va con here-string.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INV="$SCRIPT_DIR/../inventario-ola.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

cat > "$TMP/plan.md" <<'PLAN'
# plan de prueba

### 8.1 BACKEND

| Ola | # | Ítem | Contrato | Nota |
|---|---|---|---|---|
| 1 | 1 | **BL-X5** (backend) textos | — | |
| 1 | 2 | **BL-C6** (backend) cuit | K-02 | |
| 2 | 3 | **BL-J6** cartera | K-04 | |

### 8.2 FRONTEND-1

| Ola | # | Ítem | Plataformas | Contrato | Nota |
|---|---|---|---|---|---|
| 1 | 1 | **BL-D3** tarjeta | mobile | — | |

### 8.3 FRONTEND-2

| Ola | # | Ítem | Plataformas | Contrato | Nota |
|---|---|---|---|---|---|
| 1 | 1 | **BL-X5** (web) textos | web | — | |
| 1 | 2 | **BL-C6** (FE) cuit | web + mobile | K-02 | |
| 2 | 3 | **BL-J6** (FE) chip | web + mobile | K-04 | |

### 8.4 AUDITORÍA
PLAN

cat > "$TMP/prs.json" <<'JSON'
[
 {"number": 521, "title": "feat(web): ARCA en textos (BL-X5)", "mergedAt": "2026-09-21T10:00:00Z",
  "mergeCommit": {"oid": "aaaaaaaa11"}, "files": [{"path": "apps/copiloto-web/src/x.ts"}]},
 {"number": 530, "title": "feat: cuit no vinculado (BL-C6)", "mergedAt": "2026-09-21T11:00:00Z",
  "mergeCommit": {"oid": "bbbbbbbb22"}, "files": [{"path": "apps/copiloto/afip_web.py"}, {"path": "packages/core/src/api/afip.ts"}]},
 {"number": 541, "title": "feat: cartera (BL-J6)", "mergedAt": "2026-09-21T12:00:00Z",
  "mergeCommit": {"oid": "cccccccc33"}, "files": [{"path": "apps/mobile/src/c.tsx"}]}
]
JSON

sal="$(PLAN="$TMP/plan.md" PRS_JSON_FILE="$TMP/prs.json" SHA_MAIN=deadbeef DESDE=2026-09-21 \
       bash "$INV" --ola 1 2>&1)"; rc=$?
fila() { grep -F "| \`$1\` |" <<< "$sal"; }

echo "── 0. corre ──"
[ "$rc" -eq 0 ] && ok "exit 0" || { fail "exit $rc"; echo "$sal" | tail -20; }

echo "── 1. CONTROL POSITIVO: dos mitades con diff en las dos capas ──"
# Sin este caso, un script que marcara ⚠️ a TODA fila de dos colas pasaría el caso 2 en verde.
if grep -qF "✅ sí (#530)" <<< "$(fila BL-C6)"; then ok "BL-C6 ✅ con #530 (backend + core)"; else fail "BL-C6: $(fila BL-C6)"; fi

echo "── 2. EL CASO X5: un solo PR de web para una fila de dos mitades ──"
if grep -qF "mitad BACKEND no tiene diff" <<< "$(fila BL-X5)"; then ok "BL-X5 acusa la mitad BACKEND"; else fail "BL-X5: $(fila BL-X5)"; fi
if grep -qF "✅" <<< "$(fila BL-X5)"; then fail "BL-X5 sigue saliendo ✅"; else ok "BL-X5 no sale ✅"; fi

echo "── 3. EL CASO J: fila de otra ola entregada en la ventana ──"
if grep -qF '| `BL-J6` | 2 | #541 |' <<< "$(sed -n '/## 2.bis/,/^## 3/p' <<< "$sal")"; then
  ok "BL-J6 en §2.bis con ola 2 y #541"
else
  fail "BL-J6 no aparece en §2.bis como adelantada"
fi

echo "── 4. CONTROL NEGATIVO: fila de esta ola sin PR ──"
if grep -qF "NO CITADO" <<< "$(fila BL-D3)"; then ok "BL-D3 NO CITADO"; else fail "BL-D3: $(fila BL-D3)"; fi
if grep -qF '`BL-D3`' <<< "$(sed -n '/## 2.bis/,/^## 3/p' <<< "$sal")"; then fail "BL-D3 se filtró a §2.bis"; else ok "§2.bis sólo trae filas de otras olas"; fi
if grep -q "o con una mitad sin diff: 2\." <<< "$sal"; then ok "cuenta 2 faltas (D3 + mitad de X5)"; else fail "conteo: $(grep 'mitad sin diff:' <<< "$sal")"; fi

echo "── 5. El comando del gate no es un falso verde ──"
if grep -q "gate.sh --solo" <<< "$(grep -v '^#' <<< "$sal" | grep 'gate.sh')"; then
  fail "sigue prescribiendo --solo"
else
  ok "prescribe el job sin guiones"
fi

echo
if [ "$fallos" -eq 0 ]; then echo "✅ test-inventario-ola: OK"; exit 0; fi
echo "❌ test-inventario-ola: $fallos fallo(s)"; exit 1
