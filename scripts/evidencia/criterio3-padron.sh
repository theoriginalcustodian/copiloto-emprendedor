#!/usr/bin/env bash
# Padrón del criterio 3: cruza el UNIVERSO de la fuente contra lo que el generador SABE medir.
#
# Por qué existe (y por qué el universo NO sale del generador):
#   El criterio 3 del Cierre A exige la matriz re-medida «para toda pantalla `spec` de BL-P5». Ese
#   universo vive en la SPEC (54 ids). El generador `criterio3-matriz.mjs` conoce un subconjunto:
#   su default son 7 ids y su tabla `CAMINO` tiene 17. Si el padrón se sacara del generador, los ids
#   que le faltan no aparecerían como huecos: **desaparecerían**, y «17 de 17 ✅» se leería como
#   cierre cumplido. Sacándolo de la fuente, cada faltante sale como HUECO CON NOMBRE.
#   Ver `memoria/instrumento-que-no-mira-nunca-falla.md` y
#   `memoria/vacio-no-es-hallazgo-correr-el-control.md`.
#
# Qué NO hace: no captura, no navega, no juzga. Es capa 0 — determinista y de cero tokens.
# El veredicto de cada fila es de la capa 2 (auditoría). Acá sólo se establece CONTRA QUÉ se mide.
#
# Uso:  ./scripts/evidencia/criterio3-padron.sh [--sha <ref>] [--tsv]
#       --sha  ref de git contra la que leer la spec y el generador (default: origin/main)
#       --tsv  emite la grilla como TSV en vez de markdown (para alimentar otro script)
#
# Exit: 0 = padrón extraído y verificado · 1 = el padrón NO se pudo establecer (no se mide nada) ·
#       2 = no se pudo leer la fuente (precondición faltante), que NO es lo mismo que «no hay ids».
set -uo pipefail

REF="origin/main"
FORMATO="md"
while [ $# -gt 0 ]; do
  case "$1" in
    --sha) REF="${2:?--sha necesita una ref}"; shift 2 ;;
    --tsv) FORMATO="tsv"; shift ;;
    *) echo "uso: $0 [--sha <ref>] [--tsv]" >&2; exit 2 ;;
  esac
done

SPEC="docs/copiloto-emprendedor/2026-09-22-BL-P5-pantallas-del-prototipo-spec-vision-propuesta.md"
GEN="scripts/evidencia/criterio3-matriz.mjs"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO" || { echo "no pude entrar al repo" >&2; exit 2; }

# El checkout compartido sirve refs viejas (medido el 21/09: local 11 merges atrás). Se mide contra
# el remoto, siempre, y el SHA resuelto se imprime para que el dictamen lo pueda citar.
git fetch -q origin main 2>/dev/null || true
SHA="$(git rev-parse "$REF" 2>/dev/null)" || { echo "✗ no pude resolver '$REF'" >&2; exit 2; }

leer() { MSYS_NO_PATHCONV=1 git show "$SHA:$1" 2>/dev/null; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
leer "$SPEC" > "$TMP/spec.md" || true
leer "$GEN"  > "$TMP/gen.mjs" || true
[ -s "$TMP/spec.md" ] || { echo "✗ la spec no existe en $REF:$SPEC — precondición faltante, no 'cero ids'" >&2; exit 2; }
[ -s "$TMP/gen.mjs" ] || { echo "✗ el generador no existe en $REF:$GEN" >&2; exit 2; }

# ── FUENTE: los ids `spec` de BL-P5 ────────────────────────────────────────────────────────────────
# La tabla es de DOS columnas de ids por fila: `| id | ítem | | id | ítem |`, o sea los campos 2 y 5.
# Se delimita por su propio encabezado hasta el `###` siguiente: un rango de líneas fijo se
# desincroniza en silencio cuando la spec crece (`memoria/el-instrumento-tambien-CONDENA...`).
# La primera celda de la tabla NO es un id: es `*(vacío)* Mi día`, o sea la HOME (`?ver=` sin valor).
# La spec SI la cuenta dentro de los 54 (27 filas x 2 columnas = 54 celdas, y §3 declara «54 ids»),
# asi que se normaliza a un id sintetico. Se llama `(home)` y NO `(vacio)`: hasta el 2026-09-29 se
# llamaba asi y colisionaba visualmente con `vacio` (BL-W5, spec :43), que es OTRO id — el estado
# vacio de Mi dia. Le costo un turno a frontend2, que no podia saber cual de los dos nombres salia
# del documento y cual lo fabricaba este script. Un id sintetico tiene que VERSE sintetico.
awk '/^### spec/{d=1; next} /^### /{d=0} d' "$TMP/spec.md" \
  | awk -F'|' 'NF>=6 {print $2; print $5}' \
  | sed -e 's/`//g' -e 's/^ *//' -e 's/ *$//' \
  | awk 'NF' \
  | sed -e 's/^\*(vacío)\* *Mi día$/(home)/' \
  | grep -vE '^(\?ver=|---|:?-+:?)$' \
  | sort -u > "$TMP/padron.txt"

# ── PARSER: qué sabe el generador ─────────────────────────────────────────────────────────────────
claves() { awk "/^const $1 *= *\{/,/^\};/" "$TMP/gen.mjs" | grep -oE "^  '?[a-z0-9()-]+'?:" | tr -d " ':" | sort -u; }
claves CAMINO       > "$TMP/camino.txt"
claves PROTO_VISTA  > "$TMP/proto.txt"
claves MEDIBILIDAD  > "$TMP/medib.txt"
# El default del generador: los ids que corre si nadie pasa SOLO_IDS.
grep -oE "SOLO_IDS \?\? '[^']+'" "$TMP/gen.mjs" | sed "s/.*'\(.*\)'/\1/" | tr ',' '\n' | awk 'NF' | sort -u > "$TMP/default.txt"

N_PADRON=$(wc -l < "$TMP/padron.txt" | tr -d ' ')
N_CAMINO=$(wc -l < "$TMP/camino.txt" | tr -d ' ')
N_PROTO=$(wc -l < "$TMP/proto.txt" | tr -d ' ')
N_MEDIB=$(wc -l < "$TMP/medib.txt" | tr -d ' ')
N_DEFAULT=$(wc -l < "$TMP/default.txt" | tr -d ' ')

# ── CONTROLES, horneados: sin esto un 0 se lee como «no hay» en vez de «no miré» ───────────────────
# POSITIVO: la spec declara 54 ids en su propio encabezado. Si el extractor no los saca, es el
# extractor el que falla, no la spec — y el padrón no se puede establecer.
ESPERADOS="$(grep -oE '^### spec — [0-9]+ ids' "$TMP/spec.md" | grep -oE '[0-9]+' | head -1)"
ESPERADOS="${ESPERADOS:-0}"
# POSITIVO 2: dos ids que TIENEN que estar en los tres conjuntos (existen y se miden hoy).
for control in ingresos cuenta; do
  grep -qx "$control" "$TMP/padron.txt" || { echo "✗ CONTROL POSITIVO FALLÓ: '$control' no salió del padrón — el extractor está roto, no la spec" >&2; exit 1; }
  grep -qx "$control" "$TMP/camino.txt" || { echo "✗ CONTROL POSITIVO FALLÓ: '$control' no salió de CAMINO — el extractor de claves está roto" >&2; exit 1; }
done
# NEGATIVO: un id inventado no puede aparecer en ningún conjunto.
if grep -qx 'zznomatchzz' "$TMP/padron.txt" "$TMP/camino.txt" 2>/dev/null; then
  echo "✗ CONTROL NEGATIVO FALLÓ: el extractor inventa ids" >&2; exit 1
fi

# ── LA GRILLA: una fila por id del padrón, con el hueco NOMBRADO ──────────────────────────────────
emitir_fila() {
  local id="$1" c p m estado
  grep -qx "$id" "$TMP/camino.txt" && c="sí" || c="—"
  grep -qx "$id" "$TMP/proto.txt"  && p="sí" || p="—"
  grep -qx "$id" "$TMP/medib.txt"  && m="declarado" || m="—"
  # ORDEN: «¿se puede medir?» ANTES de «¿por dónde se llega?». Invertido, un id que el generador
  # declara NO medible por captura sale como MEDIBLE_HOY sólo porque tiene camino — y el conteo de
  # medibles queda inflado. Es el mismo orden que `criterio3-matriz.mjs:82` documenta haber
  # corregido, y mi primera versión lo tenía al revés: el defecto que audito es fácil de repetir.
  if [ "$m" = "declarado" ]; then estado="NO_MEDIBLE_DECLARADO"
  elif [ "$c" = "sí" ]; then estado="MEDIBLE_HOY"
  else estado="SIN_CAMINO"; fi
  if [ "$FORMATO" = "tsv" ]; then printf '%s\t%s\t%s\t%s\t%s\n' "$id" "$c" "$p" "$m" "$estado"
  else printf '| `%s` | %s | %s | %s | **%s** |\n' "$id" "$c" "$p" "$m" "$estado"; fi
}

if [ "$FORMATO" = "md" ]; then
  echo "# Padrón del criterio 3 — medido, no citado"
  echo
  echo "- **SHA medido:** \`$SHA\` (ref \`$REF\`)"
  echo "- **Universo (fuente \`$SPEC\`):** **$N_PADRON** ids · la spec declara **$ESPERADOS**"
  echo "- **El generador (\`$GEN\`) sabe:** \`CAMINO\` **$N_CAMINO** · \`PROTO_VISTA\` **$N_PROTO** · \`MEDIBILIDAD\` **$N_MEDIB** · default **$N_DEFAULT**"
  echo
  echo "| id | CAMINO (app) | PROTO_VISTA | MEDIBILIDAD | estado |"
  echo "|---|---|---|---|---|"
fi
while IFS= read -r id; do [ -n "$id" ] && emitir_fila "$id"; done < "$TMP/padron.txt"

# ── El conteo va SIEMPRE, y dice cuántos se examinaron, no sólo el resultado ───────────────────────
SIN_CAMINO=$(comm -23 "$TMP/padron.txt" "$TMP/camino.txt" | wc -l | tr -d ' ')
HUERFANOS=$(comm -13 "$TMP/padron.txt" "$TMP/camino.txt" | wc -l | tr -d ' ')
# Los que tienen camino PERO están declarados no medibles por captura no se miden: el generador los
# saltea (`criterio3-matriz.mjs:83`). Contarlos como medibles infla el numerador del criterio.
NO_MEDIBLES_CON_CAMINO=$(comm -12 "$TMP/camino.txt" "$TMP/medib.txt" | wc -l | tr -d ' ')
MEDIBLES_REALES=$(( N_CAMINO - NO_MEDIBLES_CON_CAMINO ))
{
  echo
  echo "EXAMINADOS: $N_PADRON de $ESPERADOS ids de la spec"
  echo "MEDIBLES_REALES (CAMINO y no declarados no-medibles): $MEDIBLES_REALES"
  echo "NO_MEDIBLE_DECLARADO (tienen camino pero el generador los saltea): $NO_MEDIBLES_CON_CAMINO"
  comm -12 "$TMP/camino.txt" "$TMP/medib.txt" | sed 's/^/  ⊘ /'
  echo "con CAMINO (bruto, NO es el numerador del criterio): $N_CAMINO"
  echo "SIN_CAMINO (huecos con nombre): $SIN_CAMINO"
  echo "EN_CAMINO_PERO_FUERA_DEL_PADRON: $HUERFANOS"
  [ "$HUERFANOS" -gt 0 ] && comm -13 "$TMP/padron.txt" "$TMP/camino.txt" | sed 's/^/  · /'
} >&2

# El veredicto es el EXIT CODE, no el texto (`memoria/el-pipe-se-come-el-exit-code.md`).
# Falla si el padrón no coincide con lo que la spec declara: eso invalida la medición entera, porque
# no se sabe contra qué universo se está midiendo.
if [ "$ESPERADOS" -gt 0 ] && [ "$N_PADRON" -ne "$ESPERADOS" ]; then
  echo "✗ PADRÓN INCONSISTENTE: extraje $N_PADRON y la spec declara $ESPERADOS. No se mide nada hasta resolverlo." >&2
  exit 1
fi
echo "✓ padrón establecido: $N_PADRON de $ESPERADOS · SHA $SHA" >&2
exit 0
