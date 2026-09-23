#!/usr/bin/env bash
# test-escalador-avance-en-abierto.sh — el avance_/cierre_ de un frente cuenta aunque esté en abierto/.
#
# CAUSA RAÍZ (22/09): `avance_mas_reciente_epoch` sólo miraba cerrado/<fecha>/ («el avance_ nace
# archivado»). FE2 dejó su avance_ y su cierre_ en abierto/ y el escalador reportó su frente «92min sin
# avance» 3 min después de que mergeara. Una alarma falsa sobre una sesión que produce entrena a
# ignorar el escalador.
#
# El escalador toma como edad de un en-curso/ el más nuevo entre mtime y ctime (el `mv` de la toma).
# El ctime no se puede atrasar, así que un shim de `stat` devuelve el mtime cuando se le pide %Z.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ESC="${ESCALADOR:-$REPO_ROOT/scripts/escaladores-buzon.sh}"
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-escalador-avance-en-abierto"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
STAT_REAL="$(command -v stat)"
mkdir -p "$TMP/bin"
cat > "$TMP/bin/stat" <<SHIM
#!/usr/bin/env bash
args=(); for a in "\$@"; do [ "\$a" = "%Z" ] && a="%Y"; args+=("\$a"); done
exec "$STAT_REAL" "\${args[@]}"
SHIM
chmod +x "$TMP/bin/stat"

# buzon <nombre> [archivo-fresco ...] — contrato de frontend2 en en-curso/ con 120 min; los archivos
# extra se crean frescos (rutas relativas al buzón).
buzon() {
  local b="$TMP/$1"; shift
  mkdir -p "$b/abierto" "$b/en-curso" "$b/cerrado/2026-09-22"
  local c="$b/en-curso/2026-09-22_contrato_planificacion-a-frontend2_BL-Q3-prueba.md"
  printf '# contrato de prueba\n' > "$c"; touch -d '-120 minutes' "$c"
  for f in "$@"; do printf 'x\n' > "$b/$f"; done
  echo "$b"
}
correr() { PATH="$TMP/bin:$PATH" bash "$ESC" --dry-run "$1" 2>&1; }
alarma() { grep -q "EN-CURSO SIN AVANCE.*frontend2" <<< "$1"; }

echo "── 1. CONTROL POSITIVO: sin avance, el contrato de 120 min escala ──"
s="$(correr "$(buzon b1)")"
alarma "$s" && ok "escala el frente sin avance" || fail "no escaló un en-curso de 120 min sin avance: $s"

echo "── 2. avance_ fresco del frente en abierto/ → no escala ──"
s="$(correr "$(buzon b2 abierto/2026-09-22_avance_frontend2-a-planificacion_x.md)")"
alarma "$s" && fail "escaló con un avance_ de 0 min en abierto/: $s" || ok "el avance_ en abierto/ cuenta"

echo "── 3. cierre_ fresco del frente en abierto/ → no escala ──"
s="$(correr "$(buzon b3 abierto/2026-09-22_cierre_frontend2-a-planificacion_x.md)")"
alarma "$s" && fail "escaló con un cierre_ de 0 min en abierto/: $s" || ok "el cierre_ en abierto/ cuenta"

echo "── 4. avance_ fresco en cerrado/ (comportamiento previo) → no escala ──"
s="$(correr "$(buzon b4 cerrado/2026-09-22/2026-09-22_avance_frontend2-a-planificacion_x.md)")"
alarma "$s" && fail "escaló con un avance_ archivado de 0 min: $s" || ok "el avance_ en cerrado/ sigue contando"

echo "── 5. NEGATIVO: el avance_ de OTRO frente no tapa el silencio ──"
s="$(correr "$(buzon b5 abierto/2026-09-22_avance_frontend1-a-planificacion_x.md)")"
alarma "$s" && ok "sigue escalando frontend2" || fail "el avance_ de frontend1 tapó el silencio de frontend2"

echo "── 6. NEGATIVO: un avance_ DIRIGIDO al frente no es un reporte suyo ──"
s="$(correr "$(buzon b6 abierto/2026-09-22_avance_planificacion-a-frontend2_x.md)")"
alarma "$s" && ok "sigue escalando frontend2" || fail "un avance_ hacia frontend2 contó como reporte de frontend2"

echo
[ "$fallos" -eq 0 ] && { echo "✅ test-escalador-avance-en-abierto: OK"; exit 0; }
echo "❌ test-escalador-avance-en-abierto: $fallos fallo(s)"; exit 1
