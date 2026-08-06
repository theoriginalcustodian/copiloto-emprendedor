#!/usr/bin/env bash
# no-drift.sh — guard del ADR-001: la definición de la suite vive en scripts/ci/, no en tests.yml.
#
# POR QUÉ EXISTE
# El ADR-001 (2026-08-06) sacó los comandos de la suite de `.github/workflows/tests.yml` a
# `scripts/ci/*.sh`, para que GitHub sea un CONSUMIDOR de la definición y no su dueño. Ese cambio se
# erosiona en la primera urgencia: alguien agrega un `run: npx vitest ...` inline "sólo esta vez",
# y a partir de ahí hay DOS definiciones de la suite. Divergen en silencio — sin error, sin síntoma —
# hasta que el gate propio da verde sobre algo que el CI habría puesto rojo.
#
# Es el mismo bug que este repo ya pagó con la lista hardcodeada de 11 archivos de tests (ver el
# header de tests.yml): una lista se desactualiza sola y sigue dando verde.
#
# QUÉ **NO** PROHÍBE, y por qué importa
# No prohíbe todo `run:` inline. El job `backend` necesita pasos que son legítimamente específicos de
# GitHub: instalar deps, crear el rol NO-superuser y la compatibilidad Supabase sobre el contenedor
# `services: postgres`, que sólo existe dentro de Actions. Prohibir eso obligaría a meter setup de
# infraestructura de GitHub dentro de un script que también corre en la PC y en el VPS — el error
# opuesto, y peor.
#
# Lo que vigila es la EJECUCIÓN de la suite, que es lo que tiene que haber una sola vez.
#
# DOS REGLAS
#   1) DELEGACIÓN — cada job declarado debe invocar `bash scripts/ci/<job>.sh`.
#   2) NO-EJECUCIÓN INLINE — ningún `run:` puede invocar directamente un runner de tests/build
#      (pytest, vitest, jest, tsc, eslint, npm run build). Ésos van dentro de los scripts.
#
# CONTROL POSITIVO HORNEADO (`--self-test`)
# Un guard que nunca vio un rojo no está verificado: su rotura se ve idéntica a su funcionamiento —
# silencio en ambos casos. Por eso este script sabe fallar a pedido sobre fixtures sintéticos, y el
# job de CI lo corre en las DOS direcciones. Ver memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md
#
# Uso:
#   scripts/ci/no-drift.sh              # audita el tests.yml real
#   scripts/ci/no-drift.sh --self-test  # verifica que el guard SABE detectar (control positivo)
set -uo pipefail   # SIN -e: queremos juntar TODAS las violaciones, no abortar en la primera

JOBS=(backend core web mobile lint)
RUNNERS='pytest|vitest|jest|tsc --noEmit|npx tsc|eslint|npm run build'

auditar() {
  local wf="$1" fallas=0

  if [ ! -f "$wf" ]; then
    echo "  ERROR: no existe $wf"
    return 1
  fi

  # ── Regla 1: delegación ────────────────────────────────────────────────────────────────────────
  for j in "${JOBS[@]}"; do
    # el job puede no estar declarado en un fixture; sólo exigimos delegación si el job existe
    if grep -qE "^[[:space:]]+${j}:" "$wf"; then
      if ! grep -qE "bash[[:space:]]+scripts/ci/${j}\.sh" "$wf"; then
        echo "  ✗ job '${j}' declarado pero NO invoca 'bash scripts/ci/${j}.sh'"
        fallas=$((fallas+1))
      fi
    fi
  done

  # ── Regla 2: ningún runner inline ──────────────────────────────────────────────────────────────
  # Sólo miramos líneas de comando (`run:` y continuaciones de bloque), nunca comentarios `#`.
  local inline
  inline="$(grep -nE "${RUNNERS}" "$wf" | grep -vE '^[0-9]+:[[:space:]]*#' || true)"
  if [ -n "$inline" ]; then
    while IFS= read -r l; do
      echo "  ✗ runner ejecutado INLINE (va en scripts/ci/): ${l}"
      fallas=$((fallas+1))
    done <<< "$inline"
  fi

  return "$fallas"
}

# ── Control positivo: el guard tiene que SABER fallar ────────────────────────────────────────────
self_test() {
  local tmp err=0
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' RETURN

  # (a) fixture SANO → debe pasar
  cat > "$tmp/sano.yml" <<'FIX'
jobs:
  core:
    steps:
      - run: bash scripts/ci/core.sh
  web:
    steps:
      - run: bash scripts/ci/web.sh
FIX
  if auditar "$tmp/sano.yml" >/dev/null; then
    echo "  ok  fixture SANO -> pasa"
  else
    echo "  FALLA  el fixture sano deberia pasar y no pasa"; err=1
  fi

  # (b) fixture con runner INLINE → debe fallar
  cat > "$tmp/inline.yml" <<'FIX'
jobs:
  core:
    steps:
      - run: bash scripts/ci/core.sh
      - run: npx vitest run
FIX
  if auditar "$tmp/inline.yml" >/dev/null; then
    echo "  FALLA  no detecto un runner inline"; err=1
  else
    echo "  ok  runner INLINE -> detectado"
  fi

  # (c) fixture SIN delegación → debe fallar
  cat > "$tmp/sindeleg.yml" <<'FIX'
jobs:
  core:
    steps:
      - uses: actions/checkout@v4
FIX
  if auditar "$tmp/sindeleg.yml" >/dev/null; then
    echo "  FALLA  no detecto un job que no delega"; err=1
  else
    echo "  ok  job SIN delegar -> detectado"
  fi

  # (d) comentario que menciona un runner → NO debe fallar (la trampa del guard mudo al reves)
  cat > "$tmp/comentario.yml" <<'FIX'
jobs:
  core:
    steps:
      # historico: antes esto corria `npx vitest run` inline, ver ADR-001
      - run: bash scripts/ci/core.sh
FIX
  if auditar "$tmp/comentario.yml" >/dev/null; then
    echo "  ok  mencion en COMENTARIO -> no alarma"
  else
    echo "  FALLA  alarmo por un comentario (falso positivo)"; err=1
  fi

  return "$err"
}

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WF="${WORKFLOW_FILE:-$ROOT/.github/workflows/tests.yml}"

if [ "${1:-}" = "--self-test" ]; then
  echo "CONTROL POSITIVO del guard anti-drift:"
  if self_test; then
    echo "OK: el guard sabe detectar las 3 violaciones y no alarma por comentarios."
    exit 0
  fi
  echo "ROTO: el guard NO discrimina — arreglalo antes de confiar en su verde."
  exit 1
fi

echo "Guard anti-drift (ADR-001) sobre: $WF"
if auditar "$WF"; then
  echo "OK: la definicion de la suite vive en scripts/ci/. Sin drift."
  exit 0
fi
cat <<'MSG'

La suite volvio a definirse dentro del workflow. Mové el comando al scripts/ci/<job>.sh que
corresponda y dejá en tests.yml sólo `bash scripts/ci/<job>.sh`.

Setup especifico de GitHub (services, roles del contenedor efimero, instalacion de deps) SI puede
quedar inline: no es la suite. Lo que no puede quedar es la EJECUCION.

Por que importa: dos definiciones de la suite divergen en silencio, y el dia que diverjan el gate
propio va a dar verde sobre algo que el CI habria puesto rojo. -> ADR-001
MSG
exit 1
