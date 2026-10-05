#!/usr/bin/env bash
# test-canario-no-vive-detras-del-guard.sh — el CONTROL POSITIVO del instrumento vivía DETRÁS del
# guard que él mismo debía acreditar.
#
# 🔴 EL CASO (medido por auditoría el 2026-10-05, a las dos puntas). Con UN documento del buzón sin
# clasificar, `contar-veredictos.py --canario` salía **`rc=8`**; con el documento clasificado, `rc=0`
# y «CANARIO OK: los 5 brazos tienen control». El canario vive en `main` (~:2212) y el guard de
# `sin_clasificar` vive en `descubrir_documentos` (~:856), que corre ANTES — así que un solo archivo
# sin clasificar no bloqueaba sólo la cifra: bloqueaba **la prueba de que el lector funciona**.
#
# Y ese falso rojo es PEOR que el de la cifra: quien lo ve concluye «el instrumento está roto», no
# «falta clasificar un doc» — y un instrumento declarado roto desactiva todo el trabajo que acredita.
# [[un-control-de-ceguera-ubicado-despues-del-guard-que-dispara]]
#
# 🔴 LO QUE SE MIDE ES QUE EL CANARIO *LLEGUE A CORRER*, NO QUE APRUEBE. La distinción no es
# cosmética: sobre el corpus fixture el canario corre y **REPRUEBA** (`rc=5`), porque el fixture
# escribe una sola forma (`tabla`) y los otros 4 brazos —`campo`, `bullet`, `reclasif`,
# `tabla-partida`— no se ejercitan. Eso NO es un fallo de este test: es el control positivo de que
# el canario discrimina. Un canario que diera verde sobre un corpus de una sola forma sería un
# adorno. Queda registrado aparte: el canario no es acreditable en CI con el fixture actual, y
# ningún gate lo invoca (medido: 0 llamadores en `scripts/ci/`).
#
# 🔴 Y LO QUE ESTE TEST PROTEGE NO ES EL FIX, ES EL GUARD. Degradar el guard bajo `--canario` está a
# un `sed` de distancia de degradarlo SIEMPRE, y el síntoma sería ninguno: la cifra seguiría
# saliendo, con un documento sin clasificar adentro inflándola en silencio. Por eso el caso 2 es el
# que manda: **sin** `--canario`, un doc sin clasificar tiene que seguir dando `rc=8`.
set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTADOR="$REPO_ROOT/scripts/evidencia/contar-veredictos.py"
[ -f "$CONTADOR" ] || { echo "no existe $CONTADOR"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

PY="$(command -v python || command -v python3)"
if [ -z "$PY" ]; then
  echo "  ⏭️  sin python en el PATH — salteado (no es un verde: es una medición que no se hizo)"
  exit 0
fi
echo "test-canario-no-vive-detras-del-guard"

# El corpus es un FIXTURE, no el buzón vivo — mismo motivo que `test-contar-veredictos-padron.sh`:
# `coordinacion/` no está versionada, es compartida entre cuatro sesiones, y en CI no existe.
CORPUS="$("$PY" "$REPO_ROOT/scripts/evidencia/fabricar-corpus-fixture.py" "$TMP" 2> "$TMP/fx.err")"
if [ -z "$CORPUS" ] || [ ! -d "$CORPUS" ]; then
  fail "no pude fabricar el corpus fixture: $(head -3 "$TMP/fx.err")"
  echo "❌ 1 fallo(s)"; exit 1
fi
export COPILOTO_COORD="$CORPUS"

corrio_el_canario() { grep -q 'CANARIO POR BRAZO' "$1"; }

# ── Caso 1: CONTROL — con el corpus limpio el canario LLEGA A CORRER. ────────────────────────
"$PY" "$CONTADOR" --canario > "$TMP/limpio.out" 2> "$TMP/limpio.err"; rc_limpio=$?
if corrio_el_canario "$TMP/limpio.out"; then
  ok "1 CONTROL: corpus limpio → el canario corre (rc=$rc_limpio)"
else
  fail "1 CONTROL: con el corpus limpio el canario NO llegó a correr (rc=$rc_limpio) — el resto no mide nada: $(head -2 "$TMP/limpio.err")"
  echo "❌ $fallos fallo(s)"; exit 1
fi

# ── Caso 2: CONTROL POSITIVO DEL CANARIO — sobre una sola forma tiene que REPROBAR. ─────────
# Si esto diera verde, el canario estaría aprobando brazos que el corpus no ejercita: un sello.
if [ "$rc_limpio" -eq 5 ] && grep -q 'CANARIO FALLA' "$TMP/limpio.err"; then
  ok "2 CONTROL POSITIVO: sobre el fixture de UNA forma el canario REPRUEBA (rc=5) — discrimina"
elif [ "$rc_limpio" -eq 0 ]; then
  fail "2 CONTROL POSITIVO: el canario APROBÓ un corpus de una sola forma (rc=0). O el fixture ganó las 5 formas —y entonces este caso hay que actualizarlo— o el canario dejó de discriminar y es un adorno"
else
  fail "2 CONTROL POSITIVO: esperaba rc=5 con «CANARIO FALLA», obtuve rc=$rc_limpio"
fi

# ── El fixture del defecto: un documento que produce veredictos y NO está clasificado. ───────
# Nombre con fecha imposible y rol inventado a propósito: nadie lo confunde con un documento real
# del buzón, igual que el id fuera del padrón en los ejemplos del formato.
SUCIO="$CORPUS/abierto/2099-01-01_cierre_fixture-a-fixture_DOC-SIN-CLASIFICAR-DEL-TEST.md"
{
  echo "# FIXTURE DEL TEST — documento SIN CLASIFICAR a propósito"
  echo
  echo "No es un documento real. Existe para que el guard de \`sin_clasificar\` dispare."
  echo
  echo "| sujeto | plataforma | veredicto | nota |"
  echo "|---|---|---|---|"
  # Las filas se copian de un documento que el fixture ya escribió: así los ids son siempre del
  # padrón vigente y este test no hardcodea ninguno.
  grep -hoE '^\| `[a-z0-9-]+` \| web \| COHERENTE' "$CORPUS/abierto"/*.md 2>/dev/null \
    | head -2 | sed 's/$/ | fixture del test |/'
} > "$SUCIO"

filas="$(grep -cE '^\| `' "$SUCIO" || true)"
if [ "${filas:-0}" -lt 1 ]; then
  fail "CONTROL DEL FIXTURE: no pude copiar ninguna fila de veredicto al doc sucio — los casos 3 y 4 no probarían nada"
  echo "❌ $fallos fallo(s)"; exit 1
fi
ok "CONTROL DEL FIXTURE: el doc sin clasificar trae $filas fila(s) de veredicto"

# ── Caso 3: EL QUE MANDA. Sin `--canario`, el guard sigue firme: rc=8. ───────────────────────
"$PY" "$CONTADOR" --json > "$TMP/sucio.out" 2> "$TMP/sucio.err"; rc_sucio=$?
if [ "$rc_sucio" -eq 8 ]; then
  ok "3 EL QUE MANDA: sin \`--canario\`, un doc sin clasificar sigue dando rc=8 (el guard NO se desarmó)"
else
  fail "3 EL QUE MANDA: esperaba rc=8 y obtuve rc=$rc_sucio — el fix degradó el guard SIEMPRE, no sólo en modo canario"
fi
if grep -q 'SIN CLASIFICAR' "$TMP/sucio.err"; then
  ok "3 y el rc viene con su motivo (SIN CLASIFICAR), no desnudo"
else
  fail "3 el rc=8 no nombró el motivo — dos causas distintas comparten el código de salida"
fi

# ── Caso 4: EL FIX. Con `--canario`, el mismo corpus sucio deja correr al canario. ───────────
"$PY" "$CONTADOR" --canario > "$TMP/can.out" 2> "$TMP/can.err"; rc_can=$?
if corrio_el_canario "$TMP/can.out" && [ "$rc_can" -ne 8 ]; then
  ok "4 EL FIX: con \`--canario\` y un doc sin clasificar, el canario LLEGA A CORRER (rc=$rc_can, ya no 8)"
else
  fail "4 EL FIX: el canario sigue muriendo detrás del guard (rc=$rc_can): $(head -2 "$TMP/can.err")"
fi

# ── Caso 5: el degradado es RUIDOSO. Un fail-open silencioso es el que nadie descubre. ──────
if grep -q 'DEGRADA este guard a aviso' "$TMP/can.err"; then
  ok "5 el degradado AVISA en stderr (no es un fail-open mudo)"
else
  fail "5 el canario pasó el guard sin decir que había un doc sin clasificar — fail-open silencioso"
fi

# ── Caso 6: el veredicto del canario NO cambia por el doc sucio. Si cambiara, el modo canario ──
# estaría midiendo otra cosa que el modo normal y los dos no serían comparables.
if [ "$rc_can" -eq "$rc_limpio" ]; then
  ok "6 el veredicto del canario es el mismo con y sin el doc sucio (rc=$rc_can) — mide el LECTOR, no el corpus"
else
  fail "6 el doc sucio cambió el veredicto del canario ($rc_limpio → $rc_can): el modo canario mide otra cosa"
fi

echo
if [ "$fallos" = 0 ]; then
  echo "TODO VERDE -- el canario llega a correr con el corpus sucio Y el guard sigue dando rc=8 sin él"
  exit 0
fi
echo "$fallos check(s) fallaron"
exit 1
