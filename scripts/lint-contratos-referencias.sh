#!/usr/bin/env bash
# lint-contratos-referencias.sh — un contrato_ nuevo debe llevar al menos UNA referencia RICA.
#
# POR QUÉ (context engineering, 2026-07-26): la prosa es ambigua; un artefacto concreto no.
# El contrato del hito C bajó con el shape JSON sacado del cliente que ya lo consume y la
# implementación salió sin ida y vuelta; los cuatro incidentes del 2026-07-21 fueron costuras
# donde cada lado leyó la misma prosa y entendió mitades distintas. Regla nueva del formato:
# todo contrato_/addendum_ baja con ≥1 artefacto — shape/JSON, test esperado, ejemplo de
# request/response, o path a un mockup/doc real. La prosa explica; el artefacto define.
#
# QUÉ CUENTA como referencia rica (cualquiera):
#   - un bloque cercado (```) de ≥3 líneas — shape, test, request, SQL, lo que sea ejecutable/parseable
#   - un path a artefacto real: docs/..., _evidencia/..., *.png, *.html, mockup
#
# GRANDFATHER: sólo lintea contratos con fecha >= 2026-07-26 (los anteriores ya están tomados
# o cerrados; re-exigirles formato retroactivo sería ruido sin acción posible).
#
# Uso:  scripts/lint-contratos-referencias.sh [--quiet]
#       BUZON_DIR=/tmp/fixture scripts/lint-contratos-referencias.sh   # para test
# Exit: 0 = todos los contratos nuevos llevan artefacto · 1 = alguno es prosa pura (lista a stdout).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUZON="${BUZON_DIR:-$REPO_ROOT/coordinacion}"
DESDE="${LINT_DESDE:-2026-07-26}"
QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

violaciones=()

for dir in "$BUZON/abierto" "$BUZON/en-curso"; do
  [ -d "$dir" ] || continue
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    fecha="${base:0:10}"
    # sólo archivos con prefijo de fecha válido y >= DESDE (comparación lexicográfica sirve en ISO)
    case "$fecha" in
      [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;;
      *) continue ;;
    esac
    [ "$fecha" \< "$DESDE" ] && continue

    # ¿bloque cercado de >=3 líneas? — contar líneas entre pares de ```
    tiene_bloque=$(awk '
      /^```/ { if (in_b) { if (n >= 3) found = 1; in_b = 0 } else { in_b = 1; n = 0 }; next }
      in_b { n++ }
      END { print found ? 1 : 0 }
    ' "$f")

    # ¿path a artefacto real?
    # ⚠️ La segunda alternativa —path de CÓDIGO— se agregó el 2026-08-12 porque el detector premiaba
    # enlazar un doc y castigaba citar el código, que es exactamente al revés del canon (§3: todo
    # diseño abre con inventario `path:línea`). Caso medido: el contrato de `TarjetaIngresoPropuesto`
    # apuntaba a `apps/mobile/src/modules/ingresos/FormularioIngreso.tsx:255` y
    # `.../chat/TarjetaIngresoPropuesto.tsx:56` — la forma MÁS precisa de señalar un artefacto en este
    # repo — y salía «PROSA PURA» en cada ciclo. Frontend lo ejecutó igual y cerró PR #433, así que el
    # instrumento estaba desmentido por el resultado.
    # Va anclado a los directorios reales del repo y exige extensión: así una mención en prosa
    # («tocá el módulo de ingresos») sigue sin contar, que es lo que el lint existe para cazar.
    tiene_artefacto=$(grep -c -E 'docs/[A-Za-z0-9_/.-]+|_evidencia/|\.(png|html)\b|mockup|(apps|scripts|motor|deploy)/[A-Za-z0-9_/.-]+\.(tsx|ts|py|sh|js|jsx|sql|yml)' "$f" || true)

    if [ "$tiene_bloque" -eq 0 ] && [ "$tiene_artefacto" -eq 0 ]; then
      violaciones+=("PROSA PURA: $base — sin bloque cercado ni path a artefacto. El contrato define con un shape/test/ejemplo, no sólo describe.")
    fi
    # El tipo del mensaje es POSICIONAL (`<fecha>_<tipo>_…`), no una palabra suelta en el nombre.
    # El glob va anclado por eso: `*contrato_*` matcheaba por substring y se comía las alertas que
    # el escalador autogenera con el nombre del contrato huérfano embebido en el suyo
    # (`…_urgente_vigilancia-a-backend_contrato-sin-tomar-<nombre del contrato>.md`). Ésas nunca
    # traen bloque cercado, así que la violación era permanente e inarreglable: el instrumento se
    # acusaba a sí mismo, y una alarma que suena siempre enseña a saltear la lista entera.
    # Cubierto por scripts/tests/test-lint-contratos-glob-por-tipo.sh (control positivo incluido:
    # un glob que no matchee nada tiene que dar rojo, no verde).
  done < <(find "$dir" -maxdepth 1 \( -name '????-??-??_contrato_*' -o -name '????-??-??_addendum_*' \) -name '*.md' -print0 2>/dev/null)
done

if [ "${#violaciones[@]}" -gt 0 ]; then
  printf '%s\n' "${violaciones[@]}"
  exit 1
fi
[ "$QUIET" = "1" ] || echo "LINT CONTRATOS: los contratos desde $DESDE llevan referencia rica."
exit 0
