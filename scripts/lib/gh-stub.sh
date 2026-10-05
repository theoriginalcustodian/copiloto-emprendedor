#!/usr/bin/env bash
# gh-stub.sh — fabrica un stub de `gh` que DESPACHA por subcomando, en vez de contestar lo mismo a
# todo. Se usa con `source`; su única función es `fabricar_gh_stub <dir>`.
#
# 🔴 POR QUÉ EXISTE (STUBGH, 2026-10-05). La cifra de la primera versión de este header —«5 stubs
# wildcard, 4 de ellos en `test-ci-verde-veredicto-monotono.sh`»— estaba INCOMPLETA, y el modo en
# que falló vale más que el número: dejaba 1 solo fuera de ese archivo, el de
# `test-ci-verde-gh-presente.sh`, que es el que este helper arregló. El de
# `test-mergear-pr-veredicto-en-el-remoto.sh` NO ESTABA CONTADO, así que el fix lo dejó vivo y #772
# siguió rojo con el header afirmando cobertura. Un inventario que nombra el hueco no lo tapa, y uno
# que lo cuenta mal hace creer que sí. Recuento MEDIDO hoy (`grep -rn 'bin/gh' scripts/tests/`):
#   · `test-ci-verde-gh-presente.sh`              -> migrado al helper (`3de96b14`)
#   · `test-mergear-pr-veredicto-en-el-remoto.sh` -> migrado al helper (este commit)
#   · `test-ci-verde-veredicto-monotono.sh`       -> 4 stubs a mano (casos 2,3,4,5) + un generador
#     `stub_gh` que SÍ despacha (`*check-runs*`/`*mergeable*`) pero cuyo `*)` devuelve `[]`. DEUDA
#     DECLARADA, no olvido: fila `STUBGH-4` en `coordinacion/PLAN.md`. Los 4 salen por ROJO antes
#     de pedir `mergeable`, así que hoy no mienten; mentirán el día que `ci-verde.sh` pida un campo
#     antes del rojo. El `*)` del stub de `git` de ese test NO cuenta: no es un `gh`. Un stub que ignora sus argumentos y escupe siempre el
# rollup es indistinguible de un `gh` real MIENTRAS el script bajo prueba sólo pida el rollup. El
# día que pide otra cosa, recibe el rollup igual — y el script no falla por su propio defecto, falla
# porque el instrumento le mintió.
#
# Pasó exactamente eso: #772 agregó a `ci-verde.sh` la medición de `mergeable`, y el stub de
# `test-ci-verde-gh-presente.sh` le devolvió el array del rollup a `gh pr view --json
# mergeable,mergeStateStatus`. El script no pudo leer el campo y salió por «no pude medir» (rc=2),
# así que el test dio ROJO con el código correcto. Cinco días de CI rojo atribuidos al cambio.
#
# ⚠️ EL PUNTO DEL DISEÑO, y es lo contrario de lo que haría un stub cómodo: ante un `--json` que NO
# tiene parametrizado, este stub **falla ruidosamente** (rc=64 y mensaje a stderr) en vez de devolver
# algo plausible. Un stub que adivina convierte «el script pide un campo nuevo» en un fallo del
# script. Si tu test necesita un campo más, lo declarás; no lo heredás por descuido.
#
# Parametrización por env del proceso que CORRE el stub (no de quien lo fabrica), así un mismo stub
# sirve para varios casos del mismo test:
#   GH_STUB_ROLLUP      JSON de [{name,conclusion,status}]  (para --json statusCheckRollup)
#   GH_STUB_MERGEABLE   MERGEABLE | CONFLICTING | UNKNOWN
#   GH_STUB_MERGESTATE  CLEAN | DIRTY | BLOCKED | UNSTABLE | UNKNOWN
#   GH_STUB_HEADOID     sha del head
#   GH_STUB_CHECKRUNS   JSON de check_runs (para `gh api .../check-runs`)
#   GH_STUB_LOG         archivo donde se registra cada invocación, una por línea
#   GH_STUB_STATE       OPEN | MERGED | CLOSED              (para --json state)
#   GH_STUB_MERGECOMMIT sha del merge commit                (para --json mergeCommit)
#   GH_STUB_MERGE_RC    rc de `gh pr merge` (default 0)
#   GH_STUB_MERGE_TESTIGO  archivo donde `gh pr merge` deja constancia de su invocación
#   GH_STUB_MERGE_STDERR   lo que `gh pr merge` imprime (default: el fallo REAL de hoy —
#                          «failed to run git: fatal: main is already used by worktree», que `gh`
#                          tira al intentar el checkout local DESPUES de haber mergeado: el merge
#                          está hecho y el rc miente. Es el caso que hay que poder ejercitar.)
#
# El stub NO implementa `--jq`: devuelve el JSON crudo y deja que el script bajo prueba corra su
# propio `--jq`... lo cual `gh` hace del lado del cliente, así que para los casos que lo usan el
# stub aplica el filtro mínimo necesario con `python`. Ver `_jq_min`.

fabricar_gh_stub() {
  local dir="${1:?fabricar_gh_stub <dir>}"
  mkdir -p "$dir"
  cat > "$dir/gh" <<'STUB'
#!/usr/bin/env bash
# Stub de `gh` generado por scripts/lib/gh-stub.sh — despacha por subcomando. NO adivina.
set -uo pipefail
[ -n "${GH_STUB_LOG:-}" ] && printf '%s\n' "$*" >> "$GH_STUB_LOG"

args="$*"
# El campo pedido sale del argumento que sigue a `--json`, no de un grep del comando entero: un
# `--jq '.mergeable'` también contiene la palabra y elegiría la rama equivocada.
campos=""; filtro=""; prev=""
for a in "$@"; do
  [ "$prev" = "--json" ] && campos="$a"
  [ "$prev" = "--jq" ]   && filtro="$a"
  prev="$a"
done

# `gh --jq` filtra del lado del CLIENTE, asi que el stub tiene que aplicarlo o el script recibe un
# objeto donde esperaba un array. Se soportan los filtros que los scripts de este repo usan de
# verdad, uno por uno; cualquier otro falla con 64 — mismo criterio que los campos --json:
# declarar, no adivinar.
_jq_min() {
  python -c "
import json,sys
d=json.loads(sys.stdin.read() or 'null'); f=sys.argv[1]
if 'statusCheckRollup' in f:
    print(json.dumps([{k:c.get(k) for k in ('name','conclusion','status')} for c in d['statusCheckRollup']]))
elif 'mergeable' in f and 'mergeStateStatus' in f:
    print((d.get('mergeable') or 'UNKNOWN')+'/'+(d.get('mergeStateStatus') or 'UNKNOWN'))
elif f.strip() in ('.headRefOid','.headRefName'):
    print(d.get(f.strip()[1:]) or '')
else:
    sys.stderr.write('[gh-stub] filtro --jq no soportado: '+f+chr(10)); sys.exit(64)
" "$1"
}

case "$1" in
  pr)
    # `pr merge` NO lleva --json, asi que se despacha por el SUBCOMANDO antes de mirar los campos.
    # Sin esta rama caia en la de `campos` vacios y salia 64: correcto como fail-closed, inutil para
    # un test que necesita ejercitar el merge.
    if [ "${2:-}" = "merge" ]; then
      [ -n "${GH_STUB_MERGE_TESTIGO:-}" ] && printf '%s
' "$args" >> "$GH_STUB_MERGE_TESTIGO"
      printf '%s
' "${GH_STUB_MERGE_STDERR:-failed to run git: fatal: main is already used by worktree}"
      exit "${GH_STUB_MERGE_RC:-0}"
    fi
    case "$campos" in
      *statusCheckRollup*)
        : "${GH_STUB_ROLLUP:?[gh-stub] el test pidió statusCheckRollup y no declaró GH_STUB_ROLLUP}"
        if [ -n "$filtro" ]; then
          echo "{\"statusCheckRollup\":$GH_STUB_ROLLUP}" | _jq_min "$filtro"
        else
          echo "{\"statusCheckRollup\":$GH_STUB_ROLLUP}"
        fi ;;
      *mergeable*|*mergeStateStatus*)
        # El `--jq` NO es decorativo acá: `ci-verde.sh:58` lee el resultado como `MERGEABLE/CLEAN`
        # y su `case` no matchea un objeto JSON, así que cae en la rama UNKNOWN -> exit 2. La
        # primera version de este stub devolvia el objeto crudo y los casos 2 y 3 del test daban
        # rc=2 — el MISMO defecto en especie que este helper vino a matar, en el helper mismo.
        # Lo cazo el control positivo del test, no yo.
        _mrg="{\"mergeable\":\"${GH_STUB_MERGEABLE:-MERGEABLE}\",\"mergeStateStatus\":\"${GH_STUB_MERGESTATE:-CLEAN}\"}"
        if [ -n "$filtro" ]; then printf '%s' "$_mrg" | _jq_min "$filtro"; else printf '%s
' "$_mrg"; fi ;;
      *headRefOid*)
        : "${GH_STUB_HEADOID:?[gh-stub] el test pidió headRefOid y no declaró GH_STUB_HEADOID}"
        if [[ "$args" == *--jq* ]]; then echo "$GH_STUB_HEADOID"; else echo "{\"headRefOid\":\"$GH_STUB_HEADOID\"}"; fi ;;
      *headRefName*)
        echo "${GH_STUB_HEADREF:-rama-de-fixture}" ;;
      *state*)
        echo "${GH_STUB_STATE:-OPEN}" ;;
      *mergeCommit*)
        echo "${GH_STUB_MERGECOMMIT:-abc1234567}" ;;
      "")
        echo "[gh-stub] \`gh pr $2\` sin --json no está implementado: $args" >&2; exit 64 ;;
      *)
        echo "[gh-stub] campo --json NO declarado: '$campos'. Agregalo a scripts/lib/gh-stub.sh o" >&2
        echo "          declará su env — un stub que adivina acusa al script de su propio hueco." >&2
        exit 64 ;;
    esac ;;
  api)
    case "$args" in
      *check-runs*)
        : "${GH_STUB_CHECKRUNS:?[gh-stub] el test pidió check-runs y no declaró GH_STUB_CHECKRUNS}"
        echo "$GH_STUB_CHECKRUNS" ;;
      *) echo "[gh-stub] endpoint de api no declarado: $args" >&2; exit 64 ;;
    esac ;;
  *)
    echo "[gh-stub] subcomando no declarado: '$1' ($args)" >&2; exit 64 ;;
esac
STUB
  chmod +x "$dir/gh"
}
