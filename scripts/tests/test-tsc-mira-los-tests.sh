#!/usr/bin/env bash
# Control de CEGUERA del chequeo de tipos: ¿tsc MIRA los archivos de test de cada proyecto TS?
#
# Por qué existe (2026-10-13, barrido de ceguera pedido por planificación tras C-D3). El tsconfig de
# `packages/core` excluía `src/**/*.test.ts` desde el andamiaje, así que `core.sh` corría
# `tsc --noEmit` sobre 0 de 57 tests y salía VERDE: los fixtures con formas que el tipo declara
# imposibles (`connect_path`, `presupuesto_id`, `'homologacion'` donde el tipo dice 'dev'|'prod'),
# un `apiBase` que ningún lector usa y 100 `arr[0].x` sin guarda convivieron meses sin síntoma —vitest
# transpila con esbuild y NO tipa—. Medido: 154 errores de tipos al incluirlos. Es la misma clase del
# fixture FACTURA_C: el test pasa porque ejercita una forma que el contrato no admite. El hermano web
# ya había pagado esto (`web.sh`: `tsc --noEmit` sobre un tsconfig de `"files": []` miraba 0 archivos).
#
# Un instrumento que no mira nunca falla, así que acá se mide el DENOMINADOR y no sólo el veredicto:
#   1. por proyecto, los `*.test.ts(x)` que tsc LISTA == los que hay en disco (piso de 1).
#      El esperado sale de `find`, no de un número a mano: un `-lt 57` envejece con el próximo test.
#   2. CONTROL POSITIVO sobre el camino de producción de core (`npx tsc --noEmit` en el paquete): con
#      un error de tipo inyectado en un test, tsc tiene que CORTAR y nombrar el archivo. Sin esto,
#      volver a agregar el `exclude` dejaría el gate verde sobre un árbol sin tipar.
set -uo pipefail

# La raiz sale del CWD, NO del archivo. Este control corre `npx tsc` DENTRO del arbol, asi que
# necesita los `node_modules` de ese arbol: derivada de `BASH_SOURCE`, la copia pinneada que corre
# `scripts/vigia.sh` mediria el arbol del PIN y no el que se quiere verificar — el mismo defecto que
# `vigia.sh` documenta para `gate.sh`. Por eso la salida IMPRIME la raiz medida: una cifra sin arbol
# se deja citar para cualquier arbol.
if [ -n "${TSC_RAIZ:-}" ]; then                   # costura de test
  RAIZ="$TSC_RAIZ"
elif RAIZ="$(git rev-parse --show-toplevel 2>/dev/null)" && [ -n "$RAIZ" ]; then
  :
else
  RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
fi
echo "ARBOL MEDIDO: $RAIZ"
fallos=0
ok()   { echo "  ✅ $1"; }
malo() { echo "  ❌ $1"; fallos=$((fallos+1)); }

if [ ! -d "$RAIZ/node_modules" ]; then
  # rc=2, NO 1. Con `exit 1` esto era indistinguible de «un control fallo»: el agregador
  # (`scripts/ci/tests-coordinacion.sh`) cuenta cualquier rc!=0 como fallo.
  #
  # ALCANCE MEDIDO, y la primera version de este comentario lo exageraba: decia que la pata `lint`
  # de `gate.sh` quedaba roja en toda PC. FALSO - `scripts/ci/lint.sh:8` corre `npm install` ANTES
  # de llamar al agregador (:70), asi que por ese camino los `node_modules` siempre estan. El
  # defecto real es el CAMINO DIRECTO: correr este test suelto, o el agregador con sus argumentos,
  # sin pasar por `lint.sh` - que es exactamente lo que hace una sesion verificando una fila, y lo
  # que haria `scripts/vigia.sh`. Ahi el rc=1 acusaba a este control de un defecto inexistente.
  # Dejar escrito el alcance exagerado habria sido peor que no comentar: un comentario que declara
  # un dano (o una proteccion) ciega la busqueda del proximo lector.
  # Dos causas distintas no pueden compartir el codigo de salida: el mensaje elige una, y el falso
  # rojo es el que ensena a saltear el gate.
  # La marca textual es parte del contrato: el agregador exige rc=2 *y* esta frase, y un rc=2 sin
  # ella se cuenta como FALLO (fail-closed), para que un script que se rompe y casualmente sale 2
  # no se cuele por la puerta del caso benigno.
  echo "⚠️ NO PUDE MEDIR: sin node_modules en $RAIZ — este control necesita el tsc del repo (npm install)." >&2
  exit 2
fi

echo "== 1. DENOMINADOR: los tests que tsc lista == los que hay en disco =="
# $1=etiqueta  $2=dir del proyecto  $3=args de tsc que eligen el proyecto
contar() {
  local etiqueta="$1" dir="$2"; shift 2
  local listados en_disco
  listados="$(cd "$dir" && npx tsc "$@" --noEmit --listFilesOnly 2>/dev/null | grep -E '\.test\.tsx?$' | grep -v node_modules | wc -l | tr -d ' ')"
  en_disco="$(cd "$dir" && find . -path ./node_modules -prune -o \( -name '*.test.ts' -o -name '*.test.tsx' \) -print | wc -l | tr -d ' ')"
  if [ "$en_disco" -lt 1 ]; then
    malo "$etiqueta: 0 tests en disco bajo $dir — el control no mira nada (¿se movió el árbol?)"
  elif [ "$listados" -eq "$en_disco" ]; then
    ok "$etiqueta: tsc mira $listados de $en_disco tests"
  else
    malo "$etiqueta: tsc mira $listados de $en_disco tests — hay $((en_disco - listados)) sin tipar (¿un \`exclude\` en el tsconfig?)"
  fi
}
contar "core"   "$RAIZ/packages/core"
contar "mobile" "$RAIZ/apps/mobile"
contar "web"    "$RAIZ/apps/copiloto-web" -p tsconfig.app.json

echo "== 2. CONTROL POSITIVO: un error de tipo inyectado en un test de core tiene que cortar el tsc =="
CANARIO="$RAIZ/packages/core/src/__canario-ceguera-tipos.test.ts"
trap 'rm -f "$CANARIO"' EXIT
# Va dentro de `src/` a propósito: es el camino real de producción (`core.sh`), el que un `exclude`
# re-agregado dejaría ciego. Un tsconfig auxiliar no ejercitaría ese camino.
printf "import { it } from 'vitest';\n\nconst n: number = 'esto no es un número';\n\nit('canario', () => { void n; });\n" > "$CANARIO"
salida="$(cd "$RAIZ/packages/core" && npx tsc --noEmit 2>&1)"
rc=$?
if [ "$rc" -ne 0 ] && printf '%s' "$salida" | grep -q '__canario-ceguera-tipos.test.ts'; then
  ok "tsc cortó (rc=$rc) y nombró el test inyectado"
else
  malo "tsc NO cortó con un error de tipo inyectado en un test (rc=$rc): el chequeo de tipos no mira los tests"
fi
rm -f "$CANARIO"

echo "== 3. contraparte: sin el canario, el árbol de core tipa limpio (si no, el punto 2 no concluye) =="
if (cd "$RAIZ/packages/core" && npx tsc --noEmit >/dev/null 2>&1); then
  ok "tsc --noEmit en packages/core: rc=0"
else
  malo "tsc --noEmit en packages/core NO sale 0 sin el canario: hay errores de tipos reales en el árbol"
fi

if [ "$fallos" -ne 0 ]; then
  echo "❌ $fallos control(es) fallaron"
  exit 1
fi
echo "✅ el chequeo de tipos mira los tests de core, mobile y web, y corta ante un error inyectado"
