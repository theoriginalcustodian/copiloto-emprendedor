#!/usr/bin/env bash
# auditar-corpus-vivo.sh — el ratchet de ESTADO del buzón, FUERA del gate de merge (LINTALCANCE).
#
# POR QUÉ EXISTE. `contar-veredictos.py` mezclaba dos ratchets de naturaleza distinta:
#
#   · de CÓDIGO  — el parser lee las formas, el padrón se cruza, la cobertura cierra. Lo determina
#                  el commit, así que su lugar es el gate: `test-contar-veredictos-padron.sh`, que
#                  desde hoy corre contra un corpus fixture (`fabricar-corpus-fixture.py`).
#   · de ESTADO  — «hay un documento del buzón sin clasificar» (exits 8/9/10/11). Lo determina quien
#                  emitió último, sobre `coordinacion/`: vivo, compartido entre cuatro sesiones y no
#                  versionado. ESO es lo que vive acá.
#
# Correr el segundo dentro del gate de merge salió tres veces rojo en una hora el 2026-10-05, la
# última por un `hallazgo_` de auditoría a los minutos de publicarse: commits intactos, `lint` rojo
# en las CUATRO ramas, y el trabajo de todas frenado por una emisión ajena. Un gate cuyo veredicto
# depende de un estado que el commit no controla no es un gate — es ruido con autoridad de bloqueo.
#
# LO QUE ESTE SCRIPT NO HACE, y es el punto: no bloquea a nadie. Corre en el ciclo de vigilancia de
# PLANIFICACIÓN —la dueña de clasificar— vía `vigilancia-check.sh`, cada 3 minutos. Un documento sin
# clasificar le llega a quien puede resolverlo en minutos, en vez de aparecer como un rojo de CI en
# la rama de alguien que no tiene ni la autoridad ni el contexto para arreglarlo.
#
# Contrato (el mismo que las otras piezas del gancho):
#   exit 0 = sin novedades   ·   exit 1 = alarma, y su stdout ES el reporte
#   --quiet  sólo imprime si hay algo que atender
#
# ⚠️ `rc=2` («no veo el buzón») es ALARMA, no silencio. Acá el buzón SIEMPRE existe: este script lo
# corre la sesión que vive en el checkout compartido. Si no lo ve, el que falla es el instrumento —y
# un instrumento que no mira nunca falla, que es el modo exacto en que este gate ya se desactivó una
# vez (salteaba entero en CI por rc=2 y el SKIP se leía como verde).
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONTADOR="${CONTADOR_PY:-$REPO_ROOT/scripts/evidencia/contar-veredictos.py}"

QUIET=0
for arg in "$@"; do
  [ "$arg" = "--quiet" ] && QUIET=1
done

PY="$(command -v python || command -v python3)"
if [ -z "$PY" ]; then
  echo "CORPUS: no pude medir — sin python en el PATH. Un 0 de acá sería del instrumento."
  exit 1
fi

# Se corre SIN COPILOTO_COORD a propósito: el default del contador es el buzón real, y éste es el
# único consumidor que lo quiere así. Si alguien lo exportó en el entorno, se respeta (sirve para
# los tests), pero no se fija acá para que el script no mienta sobre qué corpus miró.
err="$(mktemp)"; trap 'rm -f "$err"' EXIT
"$PY" "$CONTADOR" --json > /dev/null 2> "$err"; rc=$?

if [ "$rc" -eq 0 ]; then
  [ "$QUIET" = "1" ] || echo "CORPUS: sin novedades — todo documento con veredictos está clasificado."
  exit 0
fi

# El CÓDIGO DE SALIDA elige el mensaje, no un grep del texto: los mensajes del contador cambian de
# forma (ya pasó — un skip que grepeaba «ABORTA: no encontré» quedó muerto sin dar síntoma cuando el
# refactor dejó de imprimirlo) y el número es el contrato estable.
case "$rc" in
  8)  motivo="un documento con veredictos SIN CLASIFICAR (o un declarado que el glob ya no encuentra)";;
  9)  motivo="un documento declarado MEDICIÓN que no mide (clasificado mal: cita o dictamina)";;
  10) motivo="un documento que MIDE y no se LEE — es un defecto del parser, no una reclasificación";;
  11) motivo="un id con veredictos INCOMPATIBLES que nadie declaró (un COHERENTE falso posible)";;
  2)  motivo="NO SE PUDO MEDIR el corpus (buzón, spec o matriz ausentes) — el instrumento, no el dato";;
  *)  motivo="el contador salió con rc=$rc";;
esac

echo "📋 CORPUS DEL BUZÓN (exit $rc): $motivo."
echo "   Dueña: PLANIFICACIÓN (clasificar es su trabajo). NO bloquea el merge de nadie."
sed -n '1,8p' "$err" | sed 's/^/   /'
echo "   Arreglo: clasificar en \`contar-veredictos.py\` — MEDICIONES_DECLARADAS si MIDE el criterio,"
echo "   NO_SON_MEDICION **con el motivo** si cita o dictamina. Después: $(basename "$0")"
exit 1
