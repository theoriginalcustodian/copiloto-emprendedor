#!/usr/bin/env bash
# Corre los tests de coordinación (`scripts/tests/test-*.sh`) **con denominador**.
#
# POR QUÉ ES UN SCRIPT PROPIO Y NO SIGUE ADENTRO DE `lint.sh` (2026-10-06, fila `LINTDENOM`).
# El bucle vivía en `scripts/ci/lint.sh:44`, después de eslint, `testid_paridad`, `idemkey_paridad`
# y el medidor del índice. Para ejercitar su caso interesante —el glob no matchea NADA— había que
# llegar hasta esa línea, y no se puede: los pasos de arriba necesitan npm y python del entorno.
# O sea que el guard era **no ejercitable en su propio camino de producción**, y el repo ya pagó
# por la alternativa: `test-sabotaje-exit-cobertura.sh` deja escrito que copiar el script a otro
# árbol es *«EXACTAMENTE la trampa que causó el incidente»*. Un control que necesita la trampa no
# controla nada.
#
# La salida es un entrypoint real, parametrizado por $1: el sujeto lo elige el ARGUMENTO, no dónde
# está el archivo. `lint.sh` lo llama sin argumentos (camino de producción) y el canario lo llama
# con un directorio de fixture. Mismo código, mismas dos ramas.
#
# EL DEFECTO QUE TAPA, y es la tercera aparición del mismo en un solo día —`SMOKEDENOM` en el smoke
# de la beta y `CIVERDEDENOM` en el gate de merges son las otras dos—: sin un esperado contra el
# que comparar, «corrieron todos» es vacuo. Si `scripts/tests/` se renombra o se mueve, el glob no
# matchea, el `[ -e "$t" ] || continue` se come el patrón literal **en silencio**, y lint sale
# VERDE habiendo corrido CERO tests: los 58 controles de coordinación dejan de existir sin un solo
# mensaje. Un instrumento que no mira nunca falla.
#
# EL ESPERADO NO ES UN NÚMERO A MANO: un `-lt 58` envejece con el próximo test que alguien agregue,
# y un umbral que envejece se convierte en el freno que todos saltean. El esperado es el conteo del
# directorio, y el invariante es `corridos == encontrados` con **piso de 1** — eso no envejece.
#
# SALIDA: 0 = todos corrieron y pasaron · 1 = algún test falló, o el denominador es cero (no hay
# tests donde debería haberlos), o corrieron menos de los encontrados.
#
# EXTENSIÓN 2026-10-07 (fila `CONTROLESDEPLOYSINGATE`, hallazgo de auditoría). El mecanismo era
# correcto y ya estaba parametrizado por `$1`; lo que le faltaba era alcance. Los 6 controles de
# `deploy/copiloto/` (`test_smokestdin_import.sh`, `test_guard_postrestart.sh`,
# `test_redeploy_mismo_sha.sh`, `test_durabilidad_bloque.sh`, `test_meclaves_check.py`,
# `test_caddy_converge.py`) quedaban afuera por DOS razones de forma, ninguna de fondo: el glob era
# `test-*.sh` con guion y los de deploy usan guion BAJO, y dos son `.py`. Medido: 0 invocadores en
# todo el árbol (control positivo del mismo barrido: `test-db.sh` 20+, `test-gotrue.sh` 8) y 0
# necesitan VPS. Por eso ahora el GLOB y el LABEL son argumentos, y el intérprete sale de la
# extensión — no de una segunda copia del bucle, que es la forma de que el denominador se bifurque.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR="${1:-$ROOT/scripts/tests}"
GLOBS="${2:-test-*.sh}"      # lista separada por espacios; `.py` corre con python3, el resto con bash
LABEL="${3:-de coordinación}"

# Enumeración ÚNICA: el denominador y el bucle leen la MISMA lista. Dos globs separados (uno para
# contar y otro para correr) es como `corridos == encontrados` deja de proteger.
encontrados=0
archivos=()
for g in $GLOBS; do
  for t in "$DIR"/$g; do [ -e "$t" ] && { archivos+=("$t"); encontrados=$((encontrados+1)); }; done
done

if [ "$encontrados" -lt 1 ]; then
  echo "❌ 0 tests en '$DIR' (globs: $GLOBS) — el glob no matcheó NADA." >&2
  echo "   Esto NO es «no hay tests»: es «no miré». ¿Se movió o se renombró el directorio?" >&2
  echo "   Antes de este guard (2026-10-06) este caso salía VERDE con cero controles corridos." >&2
  exit 1
fi

corridos=0
fallados=0
for t in "${archivos[@]}"; do
  echo "▶ $(basename "$t")"
  case "$t" in
    *.py) python3 "$t" || fallados=$((fallados+1)) ;;
    *)    bash    "$t" || fallados=$((fallados+1)) ;;
  esac
  corridos=$((corridos+1))
done

echo "--- CONTROL: $corridos de $encontrados tests $LABEL corridos · $fallados fallado(s) ---"

if [ "$corridos" -ne "$encontrados" ]; then
  echo "❌ corrieron $corridos de $encontrados: el bucle se saltó alguno." >&2
  exit 1
fi
[ "$fallados" -eq 0 ] || { echo "❌ $fallados test(s) $LABEL fallaron." >&2; exit 1; }
echo "✅ $corridos/$encontrados tests $LABEL en verde."
