#!/usr/bin/env bash
# Reporta los `a-todos` de abierto/ y quién declaró cerrarlos. **NO MUEVE NADA, a propósito.**
#
# ## Por qué existe, y por qué es un REPORTADOR y no un archivador
#
# Un `a-todos` queda en `abierto/` **por construcción**: `archivar-buzon.sh:66` exime las
# obligaciones (`contrato|pedido|urgente|hallazgo`) del TTL, y hace bien —una obligación emitida por
# una sesión es trabajo real—, pero la exención está escrita para un emisor que **cierra a mano**. Un
# broadcast no le responde a nadie: lo abre. Nadie se reconoce dueño, y el único que podría moverlo
# es el destinatario, que al hacerlo afirmaría haberlo atendido.
#
# Auditoría midió los dos criterios automáticos obvios (2026-09-30) y **los dos fallan**:
#
#   A) «sus contrato_/pedido_ salieron de abierto/» -> cobertura **0 de 10**. No es ceguera del
#      lector (sus dos controles pasan): un a-todos no responde a un contrato.
#   B) «los PRs que cita están mergeados» -> aplica a 6 de 10 y **falla hacia el SÍ**. Un PR mergeado
#      prueba que se escribió trabajo, no que el hallazgo murió: en un `hallazgo_` el PR citado suele
#      ser el que lo **reporta** (#611 es `docs(bl-p5)`, el insumo, no la cura). Con B el janitor
#      archiva un veredicto de «no cierra» mientras el cierre sigue abierto, y un a-todos archivado
#      por error **no vuelve a gritar nunca**.
#
# Por eso el criterio adoptado es **declarado**, no inferido: `CIERRA: <nombre>` en el cuerpo de un
# `cierre_`. Y por eso este script **no archiva**: con la cobertura de `CIERRA:` cerca de 0, un
# archivador movería **cero** archivos, que es indistinguible de un glob roto. Se convierte en
# archivador el día que la cobertura lo justifique, no antes.
#
# ## Exit codes: el «no pude medir» NO comparte código con el «no hay nada»
#
#   0 = MIDIÓ. Haya pendientes o no. Es un reportador: si pusiera el gate en rojo por un a-todos sin
#       cerrador sería una alarma permanente, y una alarma permanente es un instrumento apagado
#       (`el-guard-que-grita-en-el-caso-normal-se-desarma-solo`).
#   2 = NO PUDO MEDIR: el buzón no existe, o **el control positivo horneado se cayó** (o sea: el
#       lector está ciego y su «0 cerrables» no vale nada).
#
# ## El control positivo corre SIEMPRE, y ejercita el MISMO código
#
# `medir()` es una sola función; el control la llama sobre un fixture sintético con la respuesta
# conocida (un a-todos declarado y otro sin declarar) antes de tocar el buzón real. Si el fixture no
# sale como debe, el script sale 2 y NO reporta — porque un `0` de un lector ciego es una mentira que
# parece una buena noticia (`vacio-no-es-hallazgo-correr-el-control`).
#
# La lección que hizo falta pagar dos veces: **un guard condicionado a una lista no se prueba metiendo
# el cebo en la lista**. Acá el cebo del control no es «un a-todos raro»: es un `cierre_` que declara y
# otro que no, que es la distinción que el script tiene que saber hacer.
#
# Uso:
#   scripts/a-todos-sin-cierre.sh              # reporte legible
#   scripts/a-todos-sin-cierre.sh --quiet      # sólo la última línea (para composición)
#   BUZON_DIR=/ruta/fixture scripts/a-todos-sin-cierre.sh   # aislamiento de test
set -euo pipefail

QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/buzon-roles.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/buzon-roles.sh"

# `coordinacion/` NO está versionada y existe UNA sola vez: en el checkout principal. Derivarla del
# root de ESTE script dejaría al reportador ciego desde cualquier worktree (15 vivos, el caso NORMAL).
# Bloque idéntico a archivar-buzon.sh:46-57 / cola-check.sh: es el cuarto gemelo, a propósito — la
# alternativa era una lib nueva para 10 líneas que ya están probadas en tres consumidores.
resolver_buzon() {
  if [ -n "${BUZON_DIR:-}" ]; then
    printf '%s' "$BUZON_DIR"
  elif [ -d "$REPO_ROOT/coordinacion" ]; then
    printf '%s' "$REPO_ROOT/coordinacion"
  else
    local gc
    gc="$(git -C "$REPO_ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
    if [ -n "$gc" ]; then printf '%s' "$(dirname "$gc")/coordinacion"
    else printf '%s' "$REPO_ROOT/coordinacion"; fi
  fi
}

# declaraciones <buzon> — los nombres citados por un `CIERRA:` en el cuerpo de algún `cierre_`.
#
# 🔴 Sólo cuentan las declaraciones que viven en un `cierre_`: un `CIERRA:` escrito en el propio
# a-todos, o en un `dato_`, sería el archivo satisfaciéndose con su propio comentario
# (`el-guard-se-satisface-con-su-propio-comentario`). Y se excluye este script para que su propia
# documentación no se cuente como declaración.
declaraciones() {
  local bz="$1"
  find "$bz" -type f -name "*_cierre_*.md" 2>/dev/null -print0 \
    | xargs -0 -r grep -hoE '^\*\*CIERRA:\*\*[[:space:]]*`?[0-9][^`[:space:]]+\.md`?|^CIERRA:[[:space:]]*`?[0-9][^`[:space:]]+\.md`?' 2>/dev/null \
    | sed -E 's/^\**CIERRA:\**[[:space:]]*//; s/`//g' \
    | sort -u
}

# medir <buzon> — imprime una línea por a-todos de abierto/: "<estado>\t<nombre>\t<declarante>".
# El estado es CERRABLE (alguien lo declaró) o SIN-CIERRE. No mueve nada.
medir() {
  local bz="$1" decl f base dest examinados=0
  decl="$(declaraciones "$bz" || true)"
  [ -d "$bz/abierto" ] || return 0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    base="$(basename "$f")"
    examinados=$((examinados + 1))
    dest="$(destinatario_de_nombre "$base")"
    [ "$dest" = "todos" ] || continue
    if printf '%s\n' "$decl" | grep -qxF "$base"; then
      printf 'CERRABLE\t%s\n' "$base"
    else
      printf 'SIN-CIERRE\t%s\n' "$base"
    fi
  done < <(find "$bz/abierto" -maxdepth 1 -type f -name "*.md" 2>/dev/null | sort)
  printf 'EXAMINADOS\t%s\n' "$examinados"
}

# ── CONTROL POSITIVO horneado: ejercita medir() sobre un fixture con la respuesta conocida ─────────
control_positivo() {
  local tmp out
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN
  mkdir -p "$tmp/abierto" "$tmp/cerrado/2000-01-01"
  local vivo="2000-01-01_hallazgo_planificacion-a-todos_control-vivo.md"
  local muerto="2000-01-01_hallazgo_planificacion-a-todos_control-declarado.md"
  : > "$tmp/abierto/$vivo"
  : > "$tmp/abierto/$muerto"
  # un a-todos con destinatario NO-broadcast: el control de que no barremos de más
  : > "$tmp/abierto/2000-01-01_hallazgo_planificacion-a-backend_control-no-broadcast.md"
  printf '**CIERRA:** `%s`\n' "$muerto" > "$tmp/cerrado/2000-01-01/2000-01-01_cierre_x-a-planificacion_control.md"
  out="$(medir "$tmp")"

  printf '%s\n' "$out" | grep -qxF "$(printf 'CERRABLE\t%s' "$muerto")" || {
    echo "CONTROL POSITIVO CAÍDO: el lector no reconoce un CIERRA: que SÍ está. Su '0 cerrables' no vale." >&2; return 1; }
  printf '%s\n' "$out" | grep -qxF "$(printf 'SIN-CIERRE\t%s' "$vivo")" || {
    echo "CONTROL POSITIVO CAÍDO: el lector da por cerrado un a-todos que nadie declaró (fail-open)." >&2; return 1; }
  printf '%s\n' "$out" | grep -q "control-no-broadcast" && {
    echo "CONTROL POSITIVO CAÍDO: barrió un mensaje que NO es a-todos." >&2; return 1; }
  printf '%s\n' "$out" | grep -qxF "$(printf 'EXAMINADOS\t3')" || {
    echo "CONTROL POSITIVO CAÍDO: no examinó los 3 archivos del fixture." >&2; return 1; }
  return 0
}

if ! control_positivo; then
  echo "a-todos-sin-cierre: NO PUDE MEDIR (control positivo caído) — esto NO es «no hay pendientes»." >&2
  exit 2
fi

BUZON="$(resolver_buzon)"
if [ ! -d "$BUZON/abierto" ]; then
  echo "a-todos-sin-cierre: NO PUDE MEDIR — no existe '$BUZON/abierto'." >&2
  echo "  (coordinacion/ no está versionada: vive UNA sola vez, en el checkout principal)" >&2
  exit 2
fi

SALIDA="$(medir "$BUZON")"
EXAMINADOS="$(printf '%s\n' "$SALIDA" | awk -F'\t' '$1=="EXAMINADOS"{print $2}')"
CERRABLES="$(printf '%s\n' "$SALIDA" | { grep -c '^CERRABLE' || true; })"
SINCIERRE="$(printf '%s\n' "$SALIDA" | { grep -c '^SIN-CIERRE' || true; })"

if [ "$QUIET" -eq 0 ]; then
  printf '%s\n' "$SALIDA" | { grep '^CERRABLE' || true; } | while IFS=$'\t' read -r _ n; do
    echo "  CERRABLE   (alguien lo declaró con CIERRA:)  $n"
  done
  printf '%s\n' "$SALIDA" | { grep '^SIN-CIERRE' || true; } | while IFS=$'\t' read -r _ n; do
    echo "  SIN CIERRE (nadie lo declaró muerto)         $n"
  done
  echo "--- CONTROL: control positivo del lector OK (reconoce un CIERRA: real y no inventa cierres) ---"
fi

echo "a-todos en abierto/: ${CERRABLES} cerrables · ${SINCIERRE} sin cierre declarado · de ${EXAMINADOS:-0} archivos examinados · NADA MOVIDO"
exit 0
