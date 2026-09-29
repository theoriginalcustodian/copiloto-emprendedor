#!/usr/bin/env bash
# Cruce del criterio 3: el padrón de 54 contra TODO lo que ya tiene veredicto, por cualquier vía.
#
# Por qué existe, y es el corazón del asunto:
#   `criterio3-padron.sh` cruza la spec contra el INSTRUMENTO (`criterio3-matriz.mjs`) y da 37 huecos.
#   Ese número SOBREESTIMA el hueco real, porque el criterio 3 no se mide sólo con el instrumento:
#   FE1 y FE2 midieron decenas de ids por otras vías, declaradas en el campo `medido_contra:`
#   (`servido@`, `proto@`, `leido@`, `reconstruido@`), y esos veredictos viven en los cierres del
#   buzón — que NO están versionados y por eso no aparecen en ningún barrido del repo.
#   Mirar sólo el instrumento es recortar el campo de visión, y el recorte no hace perder el
#   hallazgo: lo AGRANDA. Ver `memoria/el-instrumento-tambien-CONDENA-no-solo-absuelve.md`.
#
# Qué hace: extrae los ids con veredicto de los cierres (la FUENTE, no una lista copiada a mano),
# los cruza contra el padrón de la spec, y emite las cuatro poblaciones disjuntas con su conteo.
# No juzga ninguna fila: dice CUÁLES están medidas y por qué vía. El veredicto es de la capa 2.
#
# Uso:  ./scripts/evidencia/criterio3-cruce.sh [--tsv]
# Exit: 0 = cruce hecho · 1 = control falló (el cruce no es confiable) · 2 = falta una fuente
set -uo pipefail

FORMATO="md"; [ "${1:-}" = "--tsv" ] && FORMATO="tsv"

REPO_PPAL="C:/Proyectos/Claude/Claude code/copiloto-emprendedor"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BUZON="$REPO_PPAL/coordinacion"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

# ── El padrón, reutilizando el script que ya lo establece (no se re-implementa) ────────────────────
bash "$AQUI/scripts/evidencia/criterio3-padron.sh" --tsv > "$TMP/padron.tsv" 2>"$TMP/padron.err" || {
  echo "✗ el padrón no se pudo establecer — no se cruza nada. Su error:" >&2; cat "$TMP/padron.err" >&2; exit 2; }
cut -f1 "$TMP/padron.tsv" | sort -u > "$TMP/spec.txt"
awk -F'\t' '$5=="MEDIBLE_HOY"{print $1}'          "$TMP/padron.tsv" | sort -u > "$TMP/instrumento.txt"
awk -F'\t' '$5=="NO_MEDIBLE_DECLARADO"{print $1}' "$TMP/padron.tsv" | sort -u > "$TMP/declarados.txt"

# ── Los cierres: se localizan, no se asumen. Una ruta supuesta del buzón crea un stub vacío y el
# cruce sale «no hay veredictos» — que es el fallo silencioso más caro de este repo.
find "$BUZON" -type f -name '*BL-Q3-v2-lote-*' 2>/dev/null | sort > "$TMP/cierres.txt"
N_CIERRES=$(wc -l < "$TMP/cierres.txt" | tr -d ' ')
[ "$N_CIERRES" -ge 2 ] || { echo "✗ esperaba al menos 2 cierres de lote (A y B); encontré $N_CIERRES. No es 'cero veredictos': es una fuente faltante." >&2; exit 2; }

# Los ids salen de las FILAS de tabla de los cierres: `| \`id\` | …`. Se toma el primer campo con
# backticks, que es donde vive el id, y se recorta el sufijo de camino («(camino A)», «(listado)»).
# Contar la palabra sueltaanywhere daría falsos positivos: «cuenta» aparece en «no se cuentan» y
# «hablar» en «Cómo hablarle» (`memoria/contar-un-simbolo-no-dice-en-que-rol-aparece.md`).
while IFS= read -r f; do
  # lote B: filas de tabla  ->  `| `id` | ...`
  grep -hoE '^\| *`[a-z0-9()-]+`' "$f" 2>/dev/null | sed 's/^| *//'
  # lote A: un header por fila  ->  `### `id` ...`  <- ESTO faltaba, y valia 15 ids
  grep -hoE '^#{2,4} *`[a-z0-9()-]+`' "$f" 2>/dev/null | sed 's/^#* *//'
done < "$TMP/cierres.txt" | tr -d '|` ' | awk 'NF' | sort -u > "$TMP/con_veredicto.txt"

# Los declarados PENDIENTE_DEVICE viven en tabla y en prosa; se buscan por su token, no por la fila.
while IFS= read -r f; do
  grep -h 'PENDIENTE_DEVICE' "$f" 2>/dev/null | grep -oE '`[a-z0-9-]+`' | tr -d '`'
done < "$TMP/cierres.txt" | sort -u > "$TMP/pd_bruto.txt"
# Precedencia: un veredicto propio gana sobre una mencion de PENDIENTE_DEVICE en la misma linea.
# La version laxa cruzaba de linea y le adjudicaba PENDIENTE_DEVICE a `chat` y `fact-hitl`,
# que tienen veredicto propio en el lote A.
comm -23 "$TMP/pd_bruto.txt" "$TMP/con_veredicto.txt" > "$TMP/pend_device.txt"

# ── CONTROLES, antes de cualquier conteo ──────────────────────────────────────────────────────────
# POSITIVO: dos ids que OTRO barrido ya ubicó en los cierres. Si mi extractor no los ve, está roto y
# el 0 que produciría se leería como «no hay veredictos» en vez de «no miré».
# Y uno de CADA cierre: `afip` solo existe en el lote A, `reveal` solo en el lote B. Con dos ids
# del mismo documento el control pasa aunque el otro no se lea — fue exactamente lo que paso.
for c in afip reveal; do
  grep -qx "$c" "$TMP/con_veredicto.txt" || {
    echo "✗ CONTROL POSITIVO FALLÓ: '$c' no salió de los cierres y otro barrido lo ubicó ahí." >&2
    echo "  El extractor de filas está roto; el cruce NO es confiable." >&2; exit 1; }
done
# NEGATIVO: un id inventado no puede aparecer.
grep -qx 'zznomatchzz' "$TMP/con_veredicto.txt" 2>/dev/null && { echo "✗ CONTROL NEGATIVO FALLÓ" >&2; exit 1; }
# DE PERTENENCIA: un id con veredicto que NO esté en la spec es un dato, no un error — puede ser un
# id medido que la spec no reconoce (o un sufijo mal recortado). Se reporta, no se descarta en silencio.
comm -13 "$TMP/spec.txt" "$TMP/con_veredicto.txt" > "$TMP/fuera_de_spec.txt"

# ── Las poblaciones ───────────────────────────────────────────────────────────────────────────────
comm -12 "$TMP/spec.txt" "$TMP/con_veredicto.txt" > "$TMP/medidos.txt"
cat "$TMP/medidos.txt" "$TMP/pend_device.txt" | sort -u > "$TMP/cubiertos.txt"
comm -23 "$TMP/spec.txt" "$TMP/cubiertos.txt" > "$TMP/sin_nada.txt"

n() { wc -l < "$1" | tr -d ' '; }
N_SPEC=$(n "$TMP/spec.txt"); N_MED=$(n "$TMP/medidos.txt"); N_PD=$(n "$TMP/pend_device.txt")
N_NADA=$(n "$TMP/sin_nada.txt"); N_INSTR=$(n "$TMP/instrumento.txt"); N_FUERA=$(n "$TMP/fuera_de_spec.txt")

if [ "$FORMATO" = "md" ]; then
  echo "| población | cuántos | ids |"
  echo "|---|---|---|"
  printf '| **con veredicto en los cierres** | %s | %s |\n' "$N_MED" "$(paste -sd' ' < "$TMP/medidos.txt")"
  printf '| **PENDIENTE_DEVICE declarado** | %s | %s |\n' "$N_PD" "$(paste -sd' ' < "$TMP/pend_device.txt")"
  printf '| **sin veredicto ni declaración** | %s | %s |\n' "$N_NADA" "$(paste -sd' ' < "$TMP/sin_nada.txt")"
  printf '| medibles por el instrumento (se solapan) | %s | %s |\n' "$N_INSTR" "$(paste -sd' ' < "$TMP/instrumento.txt")"
  [ "$N_FUERA" -gt 0 ] && printf '| ⚠️ con veredicto pero FUERA de la spec | %s | %s |\n' "$N_FUERA" "$(paste -sd' ' < "$TMP/fuera_de_spec.txt")"
else
  awk '{print $0"\tCON_VEREDICTO"}'  "$TMP/medidos.txt"
  awk '{print $0"\tPENDIENTE_DEVICE"}' "$TMP/pend_device.txt"
  awk '{print $0"\tSIN_NADA"}'       "$TMP/sin_nada.txt"
fi

{
  echo
  echo "EXAMINADOS: $N_SPEC ids de la spec · $N_CIERRES cierres leídos"
  echo "CUBIERTOS (veredicto o declaración): $(n "$TMP/cubiertos.txt") de $N_SPEC"
  echo "SIN NADA: $N_NADA"
  echo "FUERA DE LA SPEC (dato, no error): $N_FUERA"
  echo "— el numerador del criterio NO es el de ninguna fila sola: es la unión, y por eso este cruce existe."
} >&2
exit 0
