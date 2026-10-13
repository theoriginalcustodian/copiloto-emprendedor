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
# «NO PUDE MEDIR» (rc=2 + la marca) NO es un defecto del codigo bajo prueba: es una dependencia
# ausente en ESTE arbol (p.ej. `node_modules` para el control de tipos). Contarlo como fallo hacia
# que un arbol sin `npm install` tuviera la pata `lint` roja para siempre, y un rojo que aparece
# siempre deja de leerse: se saltea. Pero tampoco se ignora en silencio — se CUENTA y se NOMBRA en
# la linea de CONTROL, porque un control que no midio es cobertura perdida, no cobertura verde.
MARCA_NO_MEDIDO='NO PUDE MEDIR'
no_medidos=0
nombres_no_medidos=()
clasificar_rc() {   # $1=rc  $2=ruta del test  $3=archivo con su salida
  local rc="$1" t="$2" out="$3"
  if [ "$rc" -eq 0 ]; then return 0; fi
  if [ "$rc" -eq 2 ] && grep -qF "$MARCA_NO_MEDIDO" "$out"; then
    no_medidos=$((no_medidos+1)); nombres_no_medidos+=("$(basename "$t")"); return 0
  fi
  if [ "$rc" -eq 2 ]; then
    echo "   ↑ $(basename "$t") salio 2 pero NO imprimio «$MARCA_NO_MEDIDO»: se cuenta como FALLO." >&2
  fi
  fallados=$((fallados+1)); nombres_fallados+=("$(basename "$t")")
  return 0
}
# Contar SIN nombrar obliga a releer el log entero para saber quien fallo: 1104 lineas en la
# corrida del 2026-10-12, y el culpable no imprime nada distinguible porque cada test tiene su
# propio formato de salida. Contar es el denominador; NOMBRAR es lo que hace accionable el rojo.
nombres_fallados=()
for t in "${archivos[@]}"; do
  echo "▶ $(basename "$t")"
  case "$t" in
    *.py)
      # FAIL-CLOSED (2026-10-07, defecto propio cazado por CI): un `.py` estilo pytest —funciones
      # `test_*` y NINGÚN bloque `__main__`— corrido como `python archivo.py` importa, define las
      # funciones y **sale 0 sin ejecutar una sola aserción**. Es un falso verde idéntico a un pase,
      # y la extensión del archivo no dice con qué runner se corre. Acá se niega y nombra dónde va.
      if grep -q '^if __name__ ==' "$t"; then
        salida_tmp="$(mktemp)"
        python3 "$t" 2>&1 | tee "$salida_tmp"
        clasificar_rc "${PIPESTATUS[0]}" "$t" "$salida_tmp"
        rm -f "$salida_tmp"
      else
        echo "❌ $(basename "$t") es un test de pytest (sin bloque __main__): como script saldría VERDE sin ejecutar nada." >&2
        echo "   Va en la suite de pytest (scripts/ci/backend.sh), no en este bucle." >&2
        fallados=$((fallados+1)); nombres_fallados+=("$(basename "$t") [pytest mal ubicado]")
      fi
      ;;
    *)
      # `tee` + PIPESTATUS[0] y no una captura muda: la salida se sigue viendo en vivo (pipear un
      # proceso largo por `tail` borra la evidencia del fallo) y el rc medido es el del TEST, no el
      # del pipe — el pipe se come el exit code.
      salida_tmp="$(mktemp)"
      bash "$t" 2>&1 | tee "$salida_tmp"
      clasificar_rc "${PIPESTATUS[0]}" "$t" "$salida_tmp"
      rm -f "$salida_tmp"
      ;;
  esac
  corridos=$((corridos+1))
done

echo "--- CONTROL: $corridos de $encontrados tests $LABEL corridos · $fallados fallado(s) · $no_medidos no medido(s) ---"
if [ "$no_medidos" -ne 0 ]; then
  echo "⚠️ $no_medidos control(es) NO pudieron medir en este arbol (dependencia ausente, no un defecto):" >&2
  for n in "${nombres_no_medidos[@]}"; do echo "   ⚠️ $n" >&2; done
fi
if [ "$no_medidos" -eq "$corridos" ]; then
  echo "❌ NINGUNO de los $corridos controles pudo medir: el verde no acreditaria nada." >&2
  exit 1
fi
# Bajo CI, «no pude medir» es ROJO. Mismo criterio que `.github/workflows/tests.yml` ya declara
# para la profundidad del clone —«bajo CI, historia ausente es regresion, no entorno»— y es lo que
# impide que este cambio abra un punto ciego: en la PC una dependencia ausente es el entorno, pero
# en el UNICO lugar donde la medicion acredita algo, un control que no corrio es cobertura perdida
# que saldria verde. Hoy no deberia dispararse nunca (`scripts/ci/lint.sh:8` instala antes de
# llamar a este bucle), y eso es exactamente la condicion que vigila: si alguien le saca el
# `npm install`, el gate lo dice en vez de pasar a verde con el control de tipos apagado.
if [ -n "${CI:-}" ] && [ "$no_medidos" -ne 0 ]; then
  echo "❌ bajo CI un control que NO pudo medir es una REGRESION del entorno del job, no un" >&2
  echo "   detalle local: lo que no se midio NO esta verde. Revisa que el job instale su" >&2
  echo "   dependencia (npm install en scripts/ci/lint.sh) antes de este bucle." >&2
  exit 1
fi

if [ "$corridos" -ne "$encontrados" ]; then
  echo "❌ corrieron $corridos de $encontrados: el bucle se saltó alguno." >&2
  exit 1
fi
if [ "$fallados" -ne 0 ]; then
  echo "❌ $fallados test(s) $LABEL fallaron:" >&2
  for n in "${nombres_fallados[@]}"; do echo "   ✗ $n" >&2; done
  echo "   Corrélo solo: bash $DIR/<nombre>" >&2
  exit 1
fi
echo "✅ $corridos/$encontrados tests $LABEL en verde."
