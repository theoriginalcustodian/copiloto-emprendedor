#!/usr/bin/env bash
# test-archivar-obligaciones.sh — el janitor no puede archivar lo que nadie acusó.
#
# El janitor existe porque archivar a mano falla bajo presión (abierto/ llegó a 136 el 2026-07-23).
# Pero su regla es "todo lo viejo es historia", y eso vale para un `dato_` — no para un producto
# que alguien tiene que leer.
#
# Caso real (2026-09-21): archivó dos `hallazgo_auditoria-a-planificacion_` a los 90 min, uno de
# 887 líneas, y planificación se enteró sólo porque auditoría se lo mencionó por otro canal. El
# hallazgo es el producto de la sesión más cara de la flota. Un `dato_` perdido cuesta un mensaje;
# un hallazgo perdido cuesta la auditoría entera **y no da síntoma**, porque el archivado no falla:
# archiva, silenciosamente, y el destinatario no sabe que había algo.
#
#   1. CONTROL POSITIVO  — dato_ viejo                    → se archiva (el janitor sigue siendo janitor)
#   2. hallazgo_ viejo                                    → se QUEDA
#   3. contrato_/pedido_/urgente_ viejos                  → se quedan (no regresión)
#   4. CONTROL NEGATIVO  — dato_ fresco                   → se queda
#   5. Idempotencia — dos corridas seguidas, mismo estado
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
JANITOR="$REPO_ROOT/scripts/archivar-buzon.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

B="$TMP/buzon"
mkdir -p "$B/abierto" "$B/en-curso" "$B/cerrado"

msg() {  # msg <nombre> <minutos-de-antiguedad>
  local f="$B/abierto/$1"
  printf '# fixture\n\ncontenido\n' > "$f"
  touch -d "-$2 minutes" "$f"
}

esta_en_abierto() { [ -e "$B/abierto/$1" ]; }
esta_archivado()  { [ -e "$B/cerrado/2026-09-21/$1" ]; }

VIEJO=200   # > TTL de 90 min
msg 2026-09-21_dato_planificacion-a-todos_ruido.md                        "$VIEJO"
msg 2026-09-21_hallazgo_auditoria-a-planificacion_delta-del-prototipo.md  "$VIEJO"
msg 2026-09-21_contrato_planificacion-a-backend_K-07.md                   "$VIEJO"
msg 2026-09-21_pedido_frontend1-a-backend_device.md                       "$VIEJO"
msg 2026-09-21_urgente_vigilancia-a-backend_sin-tomar.md                  "$VIEJO"
msg 2026-09-21_dato_planificacion-a-todos_recien-escrito.md               5

BUZON_DIR="$B" bash "$JANITOR" > "$TMP/salida.txt" 2>&1

echo "── 1. CONTROL POSITIVO: el dato_ viejo se archiva ──"
# Sin este caso, un janitor que dejara de archivar TODO pasaría los casos 2 y 3 en verde.
if esta_archivado 2026-09-21_dato_planificacion-a-todos_ruido.md; then
  ok "el janitor sigue archivando tráfico viejo"
else
  fail "el dato_ viejo no se archivó: el janitor dejó de hacer su trabajo"
fi

echo "── 2. El hallazgo_ viejo se QUEDA ──"
if esta_en_abierto 2026-09-21_hallazgo_auditoria-a-planificacion_delta-del-prototipo.md; then
  ok "un hallazgo sin acusar no es historia: es obligación abierta"
else
  fail "REGRESIÓN: archivó el producto de la auditoría sin que nadie lo leyera"
fi

echo "── 3. Las obligaciones de siempre siguen intactas ──"
for f in 2026-09-21_contrato_planificacion-a-backend_K-07.md \
         2026-09-21_pedido_frontend1-a-backend_device.md \
         2026-09-21_urgente_vigilancia-a-backend_sin-tomar.md; do
  if esta_en_abierto "$f"; then
    ok "se queda: ${f%%_*}… ${f#*_}"
  else
    fail "archivó una obligación: $f"
  fi
done

echo "── 4. CONTROL NEGATIVO: el tráfico fresco se queda ──"
if esta_en_abierto 2026-09-21_dato_planificacion-a-todos_recien-escrito.md; then
  ok "no archiva un hilo en curso"
else
  fail "archivó un mensaje de 5 minutos"
fi

echo "── 5. Idempotencia: la segunda corrida no cambia nada ──"
antes="$(ls -1 "$B/abierto" | sort; echo '--'; ls -1 "$B/cerrado/2026-09-21" 2>/dev/null | sort)"
BUZON_DIR="$B" bash "$JANITOR" >/dev/null 2>&1
despues="$(ls -1 "$B/abierto" | sort; echo '--'; ls -1 "$B/cerrado/2026-09-21" 2>/dev/null | sort)"
if [ "$antes" = "$despues" ]; then
  ok "correrlo dos veces deja el mismo estado"
else
  fail "no es idempotente: el estado cambió en la segunda corrida"
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ test-archivar-obligaciones: 8/8"
  exit 0
fi
echo "❌ test-archivar-obligaciones: $fallos fallo(s)"
exit 1
