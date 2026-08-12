#!/usr/bin/env bash
# Test del rótulo de transcripts en no-ocio-check.sh.
#
# EL BUG (2026-08-12): `etiqueta_transcript` leía sólo `tail -c 400000`. La marca que asigna la
# identidad es el prompt del cron, que llega al principio y se repite; a medida que la sesión
# produce, esa marca queda fuera de la ventana. Resultado invertido: **cuanto más trabaja una
# sesión, antes se vuelve invisible para el vigilante**. Medido sobre los transcripts vivos ese día,
# backend (128 MB) y frontend (23 MB) daban los DOS `0/0/0` por ventana — el instrumento estaba
# ciego a las únicas dos sesiones que existe para vigilar, a minutos de un dead-man falso.
#
# Los casos 1 y 4 son los controles que impiden que el arreglo degenere: que el rótulo siga saliendo
# cuando la marca está cerca del final (no se rompió lo que andaba) y que planificación siga
# ganando el desempate (escanear entero no la convierte en backend por hablar de backend).
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$RAIZ/scripts/no-ocio-check.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { echo "  ✅ $1"; }
fail() { echo "  ❌ $1"; fallos=$((fallos + 1)); }

# Extrae la función del script sin ejecutarlo (el script hace mediciones reales al correr).
# Si el sed no encuentra la función, abortamos: un test que no encuentra su sujeto no puede
# reportar verde (control positivo del propio test).
FUNC="$TMP/func.sh"
sed -n '/^etiqueta_transcript()/,/^}/p' "$SCRIPT" > "$FUNC"
if ! grep -q 'etiqueta_transcript()' "$FUNC"; then
  echo "❌ ABORTA: no se pudo extraer etiqueta_transcript de $SCRIPT"
  exit 1
fi
# shellcheck disable=SC1090
source "$FUNC"

# Relleno de N KB que NO contiene ninguna marca de rol.
relleno() { head -c "$1" /dev/zero | tr '\0' 'x'; }

echo "TEST rótulo de transcript — la sesión verbosa no puede volverse invisible"

# ── Caso 1 · CONTROL POSITIVO: marca cerca del final, transcript chico ────────────────────────
f="$TMP/chico.jsonl"
{ relleno 1000; echo; echo 'Vigía de coordinación (sesión FRONTEND).'; } > "$f"
r="$(etiqueta_transcript "$f")"
[ "$r" = "FRONTEND" ] && ok "1 control positivo: marca visible → FRONTEND" \
                      || fail "1 control positivo: esperaba FRONTEND, dio '$r'"

# ── Caso 2 · EL BUG: marca al principio, >400 KB de trabajo después ───────────────────────────
f="$TMP/verboso.jsonl"
{ echo 'Control de SESIONES OCIOSAS (sesión FRONTEND) — cada 3 min.'; relleno 600000; } > "$f"
r="$(etiqueta_transcript "$f")"
[ "$r" = "FRONTEND" ] && ok "2 EL BUG: marca fuera de los últimos 400 KB → sigue FRONTEND" \
                      || fail "2 EL BUG: la sesión verbosa quedó sin rotular ('$r') — el vigilante está ciego"

# ── Caso 3 · MISMO BUG, backend: es el caso de 128 MB que lo destapó ──────────────────────────
f="$TMP/verboso-be.jsonl"
{ echo 'Monitor de PARÁLISIS (sesión BACKEND).'; relleno 600000; } > "$f"
r="$(etiqueta_transcript "$f")"
[ "$r" = "BACKEND" ] && ok "3 EL BUG (backend): marca sepultada → sigue BACKEND" \
                     || fail "3 EL BUG (backend): esperaba BACKEND, dio '$r'"

# ── Caso 4 · NO-REGRESIÓN del desempate: planificación habla DE las otras y sigue siendo ella ──
# Escanear el archivo entero acumula menciones ajenas; el desempate `pl >= b && pl >= fr` tiene que
# seguir sosteniéndose. Sin este caso, "arreglar el rótulo" podría convertir a planificación en
# backend por el solo hecho de escribirle.
f="$TMP/plan.jsonl"
{ for _ in $(seq 1 5);  do echo 'le escribo a la sesión BACKEND y a la sesión FRONTEND'; done
  for _ in $(seq 1 12); do echo 'Vigía de coordinación (sesión PLANIFICACIÓN) v3.'; done
  relleno 500000; } > "$f"
r="$(etiqueta_transcript "$f")"
[ "$r" = "PLANIFICACION" ] && ok "4 no-regresión: planificación gana el desempate" \
                           || fail "4 no-regresión: esperaba PLANIFICACION, dio '$r'"

# ── Caso 5 · SIN MARCA: cae al fallback por conducta, no inventa un rol ────────────────────────
f="$TMP/sin-cron.jsonl"
{ echo 'toqué apps/mobile/src/pantalla.tsx y packages/core/src/api.ts'; } > "$f"
r="$(etiqueta_transcript "$f")"
[ "$r" = "FRONTEND" ] && ok "5 fallback por conducta sigue vivo (ventana del final, a propósito)" \
                      || fail "5 fallback: esperaba FRONTEND por conducta, dio '$r'"

echo
if [ "$fallos" -eq 0 ]; then echo "✅ 5/5 OK"; exit 0; fi
echo "❌ $fallos caso(s) fallando"; exit 1
