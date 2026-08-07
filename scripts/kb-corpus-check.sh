#!/usr/bin/env bash
# kb-corpus-check.sh — gate del corpus de la KB de usuario, ANTES de ingestar al RAG.
#
# Verifica los ítems A2 y A3 del DoD del sprint de soporte:
#   A2 · jerarquía de headers real (el chunker es header-aware; sin headers el chunk pierde el
#        "de qué habla" y el retrieval trae vecinos irrelevantes)
#   A3 · cero PII y cero datos de tenant (el corpus va a un índice compartido)
#   +  · cero marcadores <!-- VERIFICAR --> pendientes (un doc que describe lo que no existe le
#        miente al usuario y contamina el índice)
#
# 🐤 CONTROL POSITIVO HORNEADO: antes de auditar el corpus real, el script se corre contra un
# archivo sembrado a propósito con los tres defectos. Si ese archivo NO es detectado, el gate está
# roto y aborta — sin esto, un patrón mal escrito daría "0 problemas" y se leería como luz verde.
# Un vacío del propio instrumento no es un hallazgo (memoria/vacio-no-es-hallazgo-correr-el-control).
#
# Uso:  bash scripts/kb-corpus-check.sh [ruta_corpus]
# Exit: 0 = corpus apto para ingest · 1 = hay hallazgos · 2 = el gate está roto (control falló)

set -uo pipefail

CORPUS="${1:-docs/copiloto-emprendedor/kb-usuario}"
ROJO=$'\033[31m'; VERDE=$'\033[32m'; AMAR=$'\033[33m'; FIN=$'\033[0m'

# Patrones de PII / datos que no pueden viajar a un índice compartido.
PAT_PII='[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|\b([0-9]{1,3}\.){3}[0-9]{1,3}\b|[A-Za-z]:\\\\|/opt/|/home/[a-z]|\.duckdns\.org|\b[A-Za-z0-9_-]{20,}\.(key|pem)\b'

auditar_archivo() {
  # $1 = archivo · imprime una línea por hallazgo · devuelve la cantidad por stdout en la última línea
  local f="$1" hallazgos=0
  local h1 h2 verif pii

  h1=$(grep -c '^# '  "$f" || true)
  h2=$(grep -c '^## ' "$f" || true)
  verif=$(grep -c '<!-- *VERIFICAR' "$f" || true)
  pii=$(grep -conE "$PAT_PII" "$f" || true)

  if [ "$h1" -eq 0 ]; then
    echo "  ${ROJO}✗${FIN} $f — sin título \`# \` (el título participa del ranking)"
    hallazgos=$((hallazgos+1))
  fi
  if [ "$h2" -lt 3 ]; then
    echo "  ${ROJO}✗${FIN} $f — sólo $h2 secciones \`## \` (mínimo 3: cada una debe poder responder sola)"
    hallazgos=$((hallazgos+1))
  fi
  if [ "$verif" -gt 0 ]; then
    echo "  ${AMAR}⚠${FIN} $f — $verif marcador(es) VERIFICAR sin resolver"
    hallazgos=$((hallazgos+1))
  fi
  if [ "$pii" -gt 0 ]; then
    echo "  ${ROJO}✗${FIN} $f — $pii línea(s) con posible PII / ruta / host"
    hallazgos=$((hallazgos+1))
  fi
  echo "__HALLAZGOS__$hallazgos"
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. CONTROL POSITIVO — el canario. Si el gate no lo caza, el gate no sirve.
# ─────────────────────────────────────────────────────────────────────────────
CANARIO="$(mktemp -d)/canario.md"
cat > "$CANARIO" <<'CANARIO_EOF'
Documento sin titulo, con una sola seccion.

## Unica seccion
Escribile a soporte@ejemplo.com o entra por 10.0.0.1 y mira /opt/cosas.
<!-- VERIFICAR: esto no se comprobo contra el codigo -->
CANARIO_EOF

detectados=$(auditar_archivo "$CANARIO" | tail -1 | sed 's/__HALLAZGOS__//')
rm -rf "$(dirname "$CANARIO")"

if [ "${detectados:-0}" -lt 4 ]; then
  echo "${ROJO}🚨 EL GATE ESTÁ ROTO${FIN} — el canario tiene 4 defectos sembrados y detectó $detectados."
  echo "   Un corpus 'limpio' según este script NO sería evidencia de nada. Arreglá los patrones antes de usarlo."
  exit 2
fi
echo "${VERDE}🐤 control positivo OK${FIN} — el canario con 4 defectos fue detectado ($detectados/4)"

# ─────────────────────────────────────────────────────────────────────────────
# 2. El corpus real
# ─────────────────────────────────────────────────────────────────────────────
if [ ! -d "$CORPUS" ]; then
  echo "${ROJO}✗${FIN} no existe el corpus: $CORPUS"
  exit 1
fi

mapfile -t ARCHIVOS < <(find "$CORPUS" -name '*.md' ! -name '00-indice.md' | sort)
TOTAL=${#ARCHIVOS[@]}

if [ "$TOTAL" -eq 0 ]; then
  echo "${ROJO}✗${FIN} el corpus está VACÍO ($CORPUS) — y eso no es 'sin hallazgos', es que no hay nada que auditar"
  exit 1
fi

echo
echo "Auditando $TOTAL documento(s) en $CORPUS"
echo

TOTAL_HALLAZGOS=0
for f in "${ARCHIVOS[@]}"; do
  salida=$(auditar_archivo "$f")
  n=$(echo "$salida" | tail -1 | sed 's/__HALLAZGOS__//')
  echo "$salida" | grep -v '__HALLAZGOS__' || true
  TOTAL_HALLAZGOS=$((TOTAL_HALLAZGOS + n))
done

echo
echo "── Resumen ──"
echo "  documentos auditados : $TOTAL   ← el DENOMINADOR: un gate que mira 0 archivos nunca falla"
echo "  hallazgos            : $TOTAL_HALLAZGOS"

if [ "$TOTAL_HALLAZGOS" -gt 0 ]; then
  echo "${ROJO}✗ el corpus NO está listo para ingestar.${FIN}"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# 3. Segundo eje: TRUNCADO al chunkear — otro gate, sobre el mismo corpus
# ─────────────────────────────────────────────────────────────────────────────
# 2026-08-07: este script dijo «corpus apto para ingest» con 0 hallazgos, y fusion encontró que
# 8 de 17 documentos PERDÍAN contenido al ingestar (6.563 chars) porque secciones acumulativas
# —«Preguntas frecuentes», «Errores frecuentes»— pasan el cap de 1800 del chunker.
#
# Los tres ejes de arriba (headers, PII, marcadores) estaban impecables. El truncado es OTRO eje,
# y el gate no lo miraba: afirmaba más de lo que medía. Un instrumento que no mira un eje no falla
# en ese eje — CONFIRMA. Por eso el veredicto final ahora exige los dos.
VALIDADOR="$(dirname "$0")/validar_chunking_kb.py"
if [ ! -f "$VALIDADOR" ]; then
  echo "${ROJO}✗ falta $VALIDADOR${FIN} — sin el eje de truncado este gate NO puede declarar el corpus apto."
  echo "  (Ese es justamente el fallo del 2026-08-07: declarar 'apto' midiendo sólo tres ejes.)"
  exit 1
fi

echo
echo "── Segundo eje: truncado al chunkear ──"
if ! python "$VALIDADOR" "$CORPUS"; then
  echo "${ROJO}✗ el corpus pierde contenido al ingestar.${FIN} Partí las secciones largas antes del ingest."
  exit 1
fi

echo
echo "${VERDE}✓ corpus apto para ingest — los DOS ejes en verde${FIN} (forma + truncado)."
echo "  Siguiente paso del DoD: A5 — spike de retrieval ANTES del ingest masivo."
exit 0
