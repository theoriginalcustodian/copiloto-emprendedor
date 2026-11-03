#!/usr/bin/env bash
# test-escalador-frente-con-dos-duenos.sh — un contrato con DOS dueños se apaga con el avance_ de
# cualquiera de los dos.
#
# CAUSA RAÍZ (2026-11-03): `avance_mas_reciente_epoch` anclaba el frente como LITERAL en el glob
# (`avance_${frente}-a-*`). Para `frontend1-y-frontend2` eso busca un nombre que no existe NUNCA
# —cada dueño reporta con SU rol—, así que devolvía 0 y el frente no podía apagar su propia alarma.
# Medido ese día: `EN-CURSO SIN AVANCE` sonó 125 min sobre la pasada de device mientras había 11
# `avance_frontend1*` en el buzón. Un guard que grita en el caso normal se desarma solo.
#
# Lo que el fix NO debe romper es el caso de un solo dueño, que es el 95 % — por eso los casos 1, 5
# y 6 son los mismos de `test-escalador-avance-en-abierto` con el frente simple: si el fix cambiara
# su resultado, el arreglo habría costado la precisión que el escalador ya tenía.
#
# La fixture es la de ese test (mismo shim de `stat`: el escalador toma el más nuevo entre mtime y
# ctime, y el ctime no se puede atrasar).
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ESC="${ESCALADOR:-$REPO_ROOT/scripts/escaladores-buzon.sh}"
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-escalador-frente-con-dos-duenos"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
STAT_REAL="$(command -v stat)"
mkdir -p "$TMP/bin"
cat > "$TMP/bin/stat" <<SHIM
#!/usr/bin/env bash
args=(); for a in "\$@"; do [ "\$a" = "%Z" ] && a="%Y"; args+=("\$a"); done
exec "$STAT_REAL" "\${args[@]}"
SHIM
chmod +x "$TMP/bin/stat"

# buzon <nombre> <frente> [archivo-fresco ...] — contrato del frente en en-curso/ con 120 min.
buzon() {
  local b="$TMP/$1" frente="$2"; shift 2
  mkdir -p "$b/abierto" "$b/en-curso" "$b/cerrado/2026-11-03"
  local c="$b/en-curso/2026-11-03_contrato_planificacion-a-${frente}_SM-ZZ-prueba.md"
  printf '# contrato de prueba\n' > "$c"; touch -d '-120 minutes' "$c"
  for f in "$@"; do printf 'x\n' > "$b/$f"; done
  echo "$b"
}
correr() { PATH="$TMP/bin:$PATH" bash "$ESC" --dry-run "$1" 2>&1; }
alarma() { grep -q "EN-CURSO SIN AVANCE" <<< "$1"; }

echo "── 1. CONTROL POSITIVO: dos dueños, NINGÚN avance → escala ──"
s="$(correr "$(buzon b1 frontend1-y-frontend2)")"
alarma "$s" && ok "escala el frente compuesto mudo" || fail "no escaló un compuesto de 120 min sin avance: $s"

echo "── 2. EL CASO MEDIDO: avance_ de frontend1 apaga el compuesto ──"
s="$(correr "$(buzon b2 frontend1-y-frontend2 abierto/2026-11-03_avance_frontend1-a-planificacion_x.md)")"
alarma "$s" && fail "el avance_ de un dueño NO apagó el compuesto (el defecto): $s" || ok "el avance_ de frontend1 cuenta"

echo "── 3. SIMÉTRICO: el avance_ del OTRO dueño también lo apaga ──"
s="$(correr "$(buzon b3 frontend1-y-frontend2 abierto/2026-11-03_avance_frontend2-a-planificacion_x.md)")"
alarma "$s" && fail "el avance_ de frontend2 no apagó el compuesto: $s" || ok "el avance_ de frontend2 cuenta"

echo "── 4. NEGATIVO: un avance_ de un rol que NO es dueño no lo apaga ──"
s="$(correr "$(buzon b4 frontend1-y-frontend2 abierto/2026-11-03_avance_backend-a-planificacion_x.md)")"
alarma "$s" && ok "sigue escalando: backend no es dueño" || fail "el avance_ de backend tapó el silencio de un frente ajeno"

echo "── 5. NO-REGRESIÓN: un dueño ÚNICO sin avance sigue escalando ──"
s="$(correr "$(buzon b5 frontend2)")"
alarma "$s" && ok "el frente simple mudo sigue sonando" || fail "el fix apagó el caso de un solo dueño: $s"

echo "── 6. NO-REGRESIÓN: un dueño único CON su avance sigue callado ──"
s="$(correr "$(buzon b6 frontend2 abierto/2026-11-03_avance_frontend2-a-planificacion_x.md)")"
alarma "$s" && fail "el frente simple con avance escaló: $s" || ok "el frente simple con avance sigue callado"

echo "── 7. NEGATIVO del parser: un frente que no contiene NINGÚN rol conocido no se vuelve mudo ──"
s="$(correr "$(buzon b7 inventado-xz9)")"
alarma "$s" && ok "un frente desconocido sigue escalando (no cae en silencio)" || fail "un frente desconocido dejó de escalar: $s"

echo
[ "$fallos" -eq 0 ] && { echo "✅ test-escalador-frente-con-dos-duenos: OK"; exit 0; }
echo "❌ test-escalador-frente-con-dos-duenos: $fallos fallo(s)"; exit 1
