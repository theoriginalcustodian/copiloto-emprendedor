#!/usr/bin/env bash
# Padrón de ids AUTORIZADOS — UNA sola definición, consumida por el gate y por el goal.
#
# Por qué es una lib y no está copiada en los dos: el mismo defecto ya vivió dos veces en
# este repo y el fix llegó a una sola mitad (memoria/el-mismo-defecto-vivia-dos-veces-*).
# Acá viven el patrón de id y el descubrimiento del padrón; nadie los redefine.
#
# Se descubre por glob sobre lo versionado, NO se hardcodea. Dos fuentes, unidas:
#   1) el working tree del worktree actual
#   2) origin/main  — porque un worktree parado en una rama vieja NO tiene los docs nuevos:
#      medido 2026-10-08, el ARRANQUE del sprint mobile estaba en main y ausente del
#      checkout, así que todos los ids M-* se habrían reportado como FANTASMA.
# El padrón es un hecho compartido del repo, no del branch donde estás parado.

RE_ID='\b(BL-[A-Z0-9]+|DEC-[0-9]+|M-[0-9]+)\b'

# Patrón de nombre de los docs-padrón. `-acta-` va anclado con guiones a propósito:
# `*acta*` matcheaba «comp-ACTA-cion» (2026-07-22-compactacion-a-umbral-investigacion.md),
# metiendo un doc de investigación al padrón. Un glob laxo infla el padrón con ruido y
# un padrón inflado aprueba cualquier cosa.
RE_DOC_PADRON='(backlog|-acta-|ARRANQUE)'

padron_texto() {
  local raiz="${1:-.}" f
  # (1) working tree
  while IFS= read -r f; do [ -f "$f" ] && cat "$f"; done < <(
    find "$raiz/docs/copiloto-emprendedor" -maxdepth 1 -name '*.md' 2>/dev/null \
      | grep -E "$RE_DOC_PADRON" || true)
  # (2) origin/main (tolerante: si el ref no existe, no pasa nada)
  while IFS= read -r f; do
    [ -n "$f" ] && git -C "$raiz" show "origin/main:$f" 2>/dev/null
  done < <(git -C "$raiz" ls-tree -r --name-only origin/main -- docs/copiloto-emprendedor 2>/dev/null \
      | grep -E "$RE_DOC_PADRON" || true)
}


# ── EL TABLERO VIVO, tercera fuente (2026-10-13) ────────────────────────────────────────────────
# MEDIDO, y es la causa de que este gate no mida nada: los ids del tablero AUTORIZADO
# (`coordinacion/PLAN.md`, bloque COLA-VIVA) son palabras en MAYUSCULA -- `SNIPPETMIENTE`,
# `DURABGATE`, `GUARDSOLOWEB` -- y `RE_ID` solo admite `BL-*`/`DEC-*`/`M-*`. Consecuencia en los
# dos consumidores:
#   · `goal.sh set SNIPPETMIENTE` => RECHAZADO (fail-closed, correcto) => 0 de 59 worktrees con
#     orden declarada. La adopcion cero NO era disciplina: la norma era INSATISFACIBLE.
#   · `atribucion.sh` no podia ver una cita del id real: `ids_citados_en` existe por el caso que el
#     fix de `goal.sh` HABILITA -- un commit que cite `SNIPPETMIENTE` (ya un goal valido) habria
#     caido en SIN-ID, o en FANTASMA si el patron fuera laxo.
#
# 🔴 LO QUE NO SE SOSTUVO, y lo dejo escrito porque ya lo habia inferido mal: supuse que el 84% de
# no atribuido de los ultimos 25 commits de main lo causaba este vocabulario. MEDIDO despues:
# **0 de 25 asuntos citan un id del tablero** (los 2 unicos que citan algo citan `BL-O6` y
# `BL-X6`), asi que el 84% es REAL -- las sesiones no citan id en el asunto-- y este cambio no lo
# mueve. El numero se queda como problema de conducta, no de instrumento.
#
# El tablero NO se versiona a proposito (`coordinacion/` esta en .gitignore: si se versionara,
# `git worktree add` lo duplicaria por worktree y el mensaje de una sesion no existiria para la
# otra). Que una fuente del padron viva fuera del repo seria inaceptable para un gate de CI --
# mediria al equipo y no al commit-- pero los DOS consumidores de esta lib son LOCALES de sesion:
# `scripts/goal.sh` y `.githooks/pre-push` (verificado: `atribucion.sh` no aparece en
# `.github/workflows`). Fuera de esta maquina el tablero no existe y la fuente se calla: el padron
# degrada EXACTAMENTE al de hoy (las dos fuentes versionadas), nunca a vacio.
#
# Los ids del tablero entran como LISTA CERRADA, no como regex: un patron laxo de palabra en
# mayuscula haria que cualquier `TODO`/`RLS` del asunto de un commit se lea como cita de id, y un
# padron inflado aprueba cualquier cosa (es la advertencia que este archivo ya se hizo con el glob
# de los docs).
RE_ID_TABLERO='^[A-Z][A-Z0-9]{4,}$'

# Ruta del tablero, o vacio si no hay. 🔴 DEUDA DECLARADA (duena: planificacion, 2026-10-13):
# esta es la QUINTA copia de 'donde vive el buzon' -- las otras cuatro estan en `mi-buzon.sh:28`,
# `a-todos-sin-cierre.sh:63`, `escaladores-buzon.sh:52` y `no-ocio-check.sh:37`. Medidas hoy: las
# cuatro son SEMANTICAMENTE equivalentes (misma precedencia), asi que no hay divergencia viva, pero
# cuatro definiciones de la misma pregunta son el defecto que ya pago este repo con
# `roles_declarados_en` (una de dos mitades lo honraba). Colapsarlas a una sola toca los crones de
# las tres sesiones, asi que va en su propio PR. DISPARADOR: el proximo cambio a cualquiera de las
# cuatro.
padron_tablero() {
  local raiz="${1:-.}" p gc
  p="${UC_PADRON_TABLERO:-${COLA_PLAN:-}}"
  if [ -z "$p" ]; then
    if [ -f "$raiz/coordinacion/PLAN.md" ]; then
      p="$raiz/coordinacion/PLAN.md"
    else
      gc="$(git -C "$raiz" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
      [ -n "$gc" ] && p="$(dirname "$gc")/coordinacion/PLAN.md"
    fi
  fi
  [ -n "${p:-}" ] && [ -f "$p" ] && printf '%s' "$p"
  return 0
}

# Ids del bloque COLA-VIVA del tablero. Mismos marcadores que lee `cola-check.sh`: si el bloque no
# esta, no hay ids -- no se adivina leyendo todas las tablas del archivo.
padron_tablero_ids() {
  local p
  p="$(padron_tablero "${1:-.}")"
  [ -n "$p" ] || return 0
  awk '/COLA-VIVA:INICIO/{on=1;next} /COLA-VIVA:FIN/{on=0} on' "$p" \
    | grep -E '[|]' | sed -E 's/[[:space:]]*[|].*//; s/^[[:space:]]+//; s/[[:space:]]+$//' \
    | grep -E "$RE_ID_TABLERO" | sort -u
}

# Que ids CITA un texto (asunto de commit, linea ATRIBUCION:). UNA definicion para los dos
# consumidores: los `BL-*`/`DEC-*`/`M-*` por regex, y los del tablero por coincidencia de palabra
# contra la lista cerrada. El texto llega por stdin.
ids_citados_en() {
  local raiz="${1:-.}" txt id
  txt="$(cat)"
  {
    printf '%s' "$txt" | grep -ohE "$RE_ID" || true
    while IFS= read -r id; do
      [ -z "$id" ] && continue
      printf '%s' "$txt" | grep -qE "(^|[^A-Z0-9-])$id([^A-Z0-9-]|$)" && printf '%s\n' "$id"
    done < <(padron_tablero_ids "$raiz")
  } | sort -u
}

# Lista ordenada y unica de ids autorizados: lo versionado MAS el tablero vivo.
padron_ids() { { padron_texto "${1:-.}" | grep -ohE "$RE_ID"; padron_tablero_ids "${1:-.}"; } | sort -u; }

# Dónde vive un id: devuelve  <path>:<línea>|<texto de la línea>  o vacío si no está.
# Busca primero en el working tree (path clickeable) y después en origin/main.
padron_donde() {
  local id="$1" raiz="${2:-.}" f hit
  while IFS= read -r f; do
    [ -f "$f" ] || continue
    hit="$(grep -nE "(^|[^A-Z0-9-])$id([^A-Z0-9-]|$)" "$f" | grep -E ':[[:space:]]*\|' | head -1)"
    [ -z "$hit" ] && hit="$(grep -nE "(^|[^A-Z0-9-])$id([^A-Z0-9-]|$)" "$f" | head -1)"
    if [ -n "$hit" ]; then
      printf '%s:%s|%s\n' "${f#$raiz/}" "${hit%%:*}" "$(printf '%s' "${hit#*:}" | sed 's/^[[:space:]]*//')"
      return 0
    fi
  done < <(find "$raiz/docs/copiloto-emprendedor" -maxdepth 1 -name '*.md' 2>/dev/null | grep -E "$RE_DOC_PADRON" || true)
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    hit="$(git -C "$raiz" show "origin/main:$f" 2>/dev/null | grep -nE "(^|[^A-Z0-9-])$id([^A-Z0-9-]|$)" | grep -E ':[[:space:]]*\|' | head -1)"
    if [ -n "$hit" ]; then
      printf 'origin/main:%s:%s|%s\n' "$f" "${hit%%:*}" "$(printf '%s' "${hit#*:}" | sed 's/^[[:space:]]*//')"
      return 0
    fi
  done < <(git -C "$raiz" ls-tree -r --name-only origin/main -- docs/copiloto-emprendedor 2>/dev/null | grep -E "$RE_DOC_PADRON" || true)
  # (3) el tablero vivo. Va ultimo a proposito: si un id esta en los dos, gana el doc versionado,
  # que es el que tiene DoD escrito.
  # 🔴 El id tiene que estar en la LISTA CERRADA antes de buscar la linea. La primera version de
  # esta rama greppeaba el archivo ENTERO, y el caso 11 de `test-goal.sh` la caza: `goal.sh` acepto
  # `OTROFUERA`, una fila que vive FUERA del bloque COLA-VIVA. O sea el padron pasaba a ser
  # «cualquier palabra con forma de id en cualquier parte de PLAN.md» -- exactamente la inflacion
  # contra la que este archivo advierte. El consumidor (`goal.sh:34`) decide por `padron_donde`, no
  # por `padron_ids`: una lib con dos puertas tiene que cerrar las dos.
  local tab
  tab="$(padron_tablero "$raiz")"
  if [ -n "$tab" ] && padron_tablero_ids "$raiz" | grep -qxF "$id"; then
    hit="$(grep -nE "(^|[^A-Z0-9-])$id([^A-Z0-9-]|$)" "$tab" | head -1)"
    if [ -n "$hit" ]; then
      printf '%s:%s|%s
' "${tab}" "${hit%%:*}" "$(printf '%s' "${hit#*:}" | sed 's/^[[:space:]]*//' | cut -c1-200)"
      return 0
    fi
  fi
  return 1
}
