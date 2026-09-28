#!/usr/bin/env bash
# Control POSITIVO del brazo `pageerror` de `criterio3-matriz.mjs`.
#
# Para qué: ese brazo quedó `[PARCIAL]` — se sabía que NO dispara cuando no hay excepción, no se
# sabía que dispare cuando la hay. Un guard probado sólo hacia el «no» no tiene control positivo
# (`memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md`).
#
# Tres corridas sobre `?ver=cuenta` (aserción `#s-cuenta.on`), una por canario:
#   C0  sin inyección                  -> debe PASAR y escribir 1 PNG   (control NEGATIVO)
#   C1  excepción diferida 300 ms      -> debe ABORTAR citando `pageerror`, 0 PNG
#   C2  el TypeError real de 3472-3474 -> ABORTA: la pregunta es CUÁL de los dos mensajes gana
#
# ⚠️ C0 no es decorativo: es lo que distingue «el brazo dispara» de «el entorno está roto». La
# primera corrida dio EXIT=1 en los TRES canarios por un `MODULE_NOT_FOUND`, y sin C0 eso se leía
# como «C1 y C2 abortan ⇒ el brazo funciona» — un falso POSITIVO del control. Ver
# `memoria/vacio-no-es-hallazgo-correr-el-control.md`.
#
# El runner NO está versionado a propósito: se GENERA acá desde el archivo canónico, así el control
# siempre corre contra la versión vigente de `protoFoto` y no contra una copia congelada que
# caducaría en silencio (que es el modo de falla que este mismo frente ya pagó).
set -u
EV="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$EV/../.." && pwd)"
REF="${MATRIZ_REF:-docs/registro-a5-y-memoria}"          # rama/commit con el generador vigente
TRABAJO="${TRABAJO:-$EV/.canario-tmp}"
mkdir -p "$TRABAJO"

: "${NODE_PATH:?exportá NODE_PATH al dir que contiene playwright-core}"
: "${CHROME_PATH:?exportá CHROME_PATH al chromium FULL (el headless-shell bundled puede faltar)}"
export EVIDENCIA_OUT="${EVIDENCIA_OUT:-$TRABAJO/evidencia}"
mkdir -p "$EVIDENCIA_OUT"

# --- controles del entorno ANTES de medir: un 0/1 por entorno roto no es un hallazgo ---
node -e "require('playwright-core')" 2>/dev/null || { echo "ABORT(9): playwright-core no resuelve desde NODE_PATH"; exit 9; }
[ -f "$CHROME_PATH" ] || { echo "ABORT(9): no existe CHROME_PATH=$CHROME_PATH"; exit 9; }
echo "controles del entorno OK (playwright-core + chromium full)"

# --- el cuerpo de protoFoto sale del archivo canónico, sin editarlo: corte + un export ---
SRC="$TRABAJO/criterio3-matriz.mjs"
git -C "$REPO" show "$REF:scripts/evidencia/criterio3-matriz.mjs" > "$SRC" || {
  echo "ABORT(9): no pude leer criterio3-matriz.mjs de $REF"; exit 9; }
CORTE=$(grep -n '^}' "$SRC" | awk -F: '$1>50{print $1; exit}')
[ -n "$CORTE" ] || { echo "ABORT(9): no encontré el cierre de protoFoto"; exit 9; }
head -"$CORTE" "$SRC" > "$TRABAJO/protofoto-aislada.mjs"
printf '\nexport { protoFoto };\n' >> "$TRABAJO/protofoto-aislada.mjs"
cp "$EV/pwa-lib.mjs" "$TRABAJO/pwa-lib.mjs"          # protoFoto importa chromium/OUT de acá
grep -q 'function protoFoto' "$TRABAJO/protofoto-aislada.mjs" || {
  echo "ABORT(9): el corte en la línea $CORTE no dejó protoFoto adentro"; exit 9; }
echo "protoFoto aislada de $REF con corte en la línea $CORTE (cuerpo sin editar)"

cat > "$TRABAJO/run-protofoto.mjs" <<'EOF'
// Llama SOLO a protoFoto: el loop top-level del generador haría login a prod y no hace falta.
import { protoFoto } from './protofoto-aislada.mjs';
try {
  await protoFoto(process.argv[2], 'canario', { ancho: 390, alto: 844 });
  console.log('RESULTADO: NO abortó (capturó)');
} catch (e) {
  console.log('RESULTADO: ABORTÓ — mensaje textual:');
  console.log(`  >> ${String(e.message).split('\n').join(' ')}`);
  process.exit(1);
}
EOF

for C in 0 1 2; do
  PUERTO=$((8140 + C))
  RAIZ="$REPO/Prototipo frontend/odobi-ui" CANARIO=$C PUERTO=$PUERTO \
    node "$EV/server-canario.mjs" > "$TRABAJO/srv-c$C.log" 2>&1 &
  SRV=$!
  sleep 2
  # la inyección tiene que LLEGAR en el HTML servido: si no, el canario no existe y el verde es falso
  HAY=$(curl -s "http://127.0.0.1:$PUERTO/prototipo/" | grep -c "CANARIO-1-PAGEERROR-INOCUO\|getElementById(.s-cuenta.)" || true)
  echo
  echo "=== CANARIO $C (:$PUERTO) · inyección presente en el HTML servido: $HAY ==="
  PROTO_PORT=$PUERTO node "$TRABAJO/run-protofoto.mjs" "${ID:-cuenta}"
  echo "PNG escritos: $(find "$EVIDENCIA_OUT" -name '*.png' | wc -l)"
  find "$EVIDENCIA_OUT" -name '*.png' -delete
  kill $SRV 2>/dev/null
done
echo
echo "Esperado: C0 captura 1 PNG · C1 aborta por pageerror, 0 PNG · C2 aborta, 0 PNG."
echo "Si C0 NO captura, lo de arriba mide el entorno y no el brazo."
