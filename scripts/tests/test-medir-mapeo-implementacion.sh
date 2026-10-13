#!/usr/bin/env bash
# test-medir-mapeo-implementacion.sh — el medidor de implementación del mapeo, contra FIXTURES.
#
# SUJETO: `scripts/evidencia/medir-mapeo-implementacion.py`.
#
# POR QUÉ EXISTE (2026-10-13). Al operador se le dio **13 de 54 (24 %)** como «% implementado del
# sprint». La cifra salía de `contar-veredictos.py`, que mide OTRO sujeto (criterio 3 / BL-Q3-v2) y
# cuyo corpus se descubre con `rglob` sobre `coordinacion/` — mientras los tres docs de veredictos
# del mapeo viven en `docs/copiloto-emprendedor/`. Fuera de ese árbol no llegan ni a candidatos, así
# que su ratchet de «candidato sin clasificar» tampoco los veía: un instrumento con cuatro ratchets
# ciego por el DIRECTORIO. El medidor nuevo existe para esa pregunta, y este test es su control
# EXTERNO — los controles horneados miran hacia adentro del parser, igual que allá.
#
# CORPUS = FIXTURE, no el repo vivo (misma razón que `test-contar-veredictos-padron.sh`): un test
# que mide los docs reales cambia de resultado cada vez que una sesión corrige un veredicto, y su
# rojo no sería atribuible al código del commit.
#
#   1. POSITIVO           fixture coherente -> rc=0 y las TRES cifras exactas. Sin el 1, todos los
#                         negativos de abajo pasarían con un script que diga «no» a todo.
#   2. ENMIENDA CUMPLE    el DoD admite «resuelta en código O enmienda fundada»: un fixture de puras
#                         enmiendas tiene cumple_dod>0 y cerrada_en_codigo=0. Es la distinción que
#                         el operador pidió y la que una sola cifra borra.
#   3. HUECO CON NOMBRE   un id del padrón sin veredicto -> rc=3 y lo NOMBRA (no un total inmóvil).
#   4. UNIVERSO           el doc declara 3 y hay 2 ids -> rc=2. No se mide con universo que no cuadra.
#   5. DOC SIN PARSER     un `*veredicto*.md` que el parser no sabe leer -> rc=2, y lo nombra.
#   6. POSITIVO POR BRAZO doc presente que aporta CERO ids -> rc=2 (cambió de formato).
#  10. PENDIENTE NO CUMPLE  una fila con una divergencia atada a una dependencia (o sin cerrar)
#                        NO cumple el DoD, ni con un OK al lado: el DoD es por fila y exige
#                        que NINGUNA divergencia quede sin veredicto.
#   7. CANARIO            `--canario` sobre el fixture: los 3 brazos tienen que bajar la métrica.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SUT="$REPO_ROOT/scripts/evidencia/medir-mapeo-implementacion.py"

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }
echo "test-medir-mapeo-implementacion"

PY="$(command -v python || command -v python3)"
if [ -z "$PY" ]; then
  echo "  ⏭️  sin python en el PATH — salteado (no es un verde: es una medición que no se hizo)"
  exit 0
fi
if [ ! -f "$SUT" ]; then
  echo "  ❌ no existe el sujeto: $SUT"; exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ── fixture: 2 + 2 + 2 = 6 filas ──────────────────────────────────────────────────────────────
armar() {  # armar <dir>  (crea un fixture coherente y completo)
  local D="$1/docs/copiloto-emprendedor"; mkdir -p "$D"
  cat > "$D/2026-10-12-contratos-del-mapeo.md" <<'FIN'
# Contratos del mapeo prototipo -> nativo

## backend + nativa — 2 renglones

| id | dueno | DoD binario | por que esta capa |
|---|---|---|---|
| `bk-uno` | backend + frontend | resuelta en el codigo, o enmienda fundada | contrato primero |
| `bk-dos` | backend + frontend | resuelta en el codigo, o enmienda fundada | contrato primero |

## nativa-con-device — 2 renglones

| id | dueno | DoD binario | por que esta capa |
|---|---|---|---|
| `dv-uno` | frontend (device) | resuelta en el codigo, o enmienda fundada | lo tactil |
| `dv-dos` | frontend (device) | resuelta en el codigo, o enmienda fundada | lo tactil |

## nativa-sin-device — 2 renglones

| id | dueno | DoD binario | por que esta capa |
|---|---|---|---|
| `sd-uno` | frontend | resuelta en el codigo, o enmienda fundada | UI pura |
| `sd-dos` | frontend | resuelta en el codigo, o enmienda fundada | UI pura |

## Como se usa esto
FIN
  # brazo chat: `sd-uno` resuelta en codigo
  printf '# veredicto bloque chat\n\n## Fila por fila\n\n### 1 \xc2\xb7 `sd-uno` \xe2\x80\x94 \xe2\x9c\x85 + \xf0\x9f\x93\x9d\n\ncuerpo\n' \
    > "$D/2026-10-13-veredicto-bloque-chat-fixture.md"
  # brazo cascara: `sd-dos` enmienda fundada
  printf '# veredictos cascara\n\n| fila | divergencia | veredicto |\n|---|---|---|\n| `sd-dos` | el label difiere | **E** el prototipo es una hoja de estados, motivo escrito |\n' \
    > "$D/2026-10-13-veredictos-bloque-cascara-fixture.md"
  # brazo device: uno DESVIO, uno COHERENTE
  printf '# veredictos device\n\n| # | fila | v1 | v2 | nota |\n|---|---|---|---|---|\n| 1 | `dv-uno` | DESV\xc3\x8dO | DESV\xc3\x8dO | sin reloj |\n| 2 | `dv-dos` | COHERENTE | COHERENTE | |\n' \
    > "$D/2026-10-13-veredictos-device15-fixture.md"
}

correr() { MAPEO_RAIZ="$1" "$PY" -I "$SUT" "${@:2}" 2>&1; }
campo()  { grep -oE "\"$2\": *[0-9]+" <<< "$1" | grep -oE '[0-9]+'; }

# ── 1 · POSITIVO ──────────────────────────────────────────────────────────────────────────────
A="$TMP/sano"; armar "$A"
out="$(correr "$A" --json)"; rc=$?
if [ "$rc" = "0" ] \
   && [ "$(campo "$out" padron)" = "6" ] \
   && [ "$(campo "$out" cumple_dod)" = "3" ] \
   && [ "$(campo "$out" cerrada_en_codigo)" = "1" ] \
   && [ "$(campo "$out" con_veredicto)" = "4" ] \
   && [ "$(campo "$out" fuera_de_este_corpus)" = "2" ]; then
  ok "1 fixture coherente -> rc=0 · padrón 6 · DoD 3 · código 1 · medidas 4 · fuera 2"
else
  fail "1 rc=$rc · las cifras no son las esperadas (el positivo acredita a los negativos): $(head -c 300 <<< "$out")"
fi

# ── 2 · ENMIENDA FUNDADA CUMPLE EL DoD, y no es lo mismo que código ───────────────────────────
B="$TMP/enmiendas"; armar "$B"
printf '# veredicto bloque chat\n\n### 1 \xc2\xb7 `sd-uno` \xe2\x80\x94 \xf0\x9f\x93\x9d\n' \
  > "$B/docs/copiloto-emprendedor/2026-10-13-veredicto-bloque-chat-fixture.md"
out="$(correr "$B" --json)"; rc=$?
cod="$(campo "$out" cerrada_en_codigo)"; dod="$(campo "$out" cumple_dod)"
if [ "$rc" = "0" ] && [ "$cod" = "0" ] && [ "$dod" = "3" ]; then
  ok "2 puras enmiendas -> cumple_dod=3 y cerrada_en_codigo=0 (las dos cifras NO son la misma)"
else
  fail "2 rc=$rc · cumple_dod=$dod cerrada_en_codigo=$cod · esperaba 3 y 0: una sola cifra borra la distinción"
fi

# ── 3 · HUECO CON NOMBRE ──────────────────────────────────────────────────────────────────────
C="$TMP/hueco"; armar "$C"
rm "$C/docs/copiloto-emprendedor/2026-10-13-veredictos-bloque-cascara-fixture.md"
out="$(correr "$C")"; rc=$?
if [ "$rc" = "3" ] && grep -q 'sd-dos' <<< "$out"; then
  ok "3 id sin veredicto -> rc=3 y lo nombra (\`sd-dos\`)"
else
  fail "3 rc=$rc · un id del padrón sin medición no salió como hueco con nombre: $(head -c 300 <<< "$out")"
fi

# ── 4 · UNIVERSO QUE NO CUADRA ────────────────────────────────────────────────────────────────
D="$TMP/universo"; armar "$D"
F="$D/docs/copiloto-emprendedor/2026-10-12-contratos-del-mapeo.md"
"$PY" -I -c "import io,sys; p=sys.argv[1]; t=io.open(p,encoding='utf-8').read(); t=t.replace('nativa-sin-device — 2 renglones','nativa-sin-device — 3 renglones'); io.open(p,'w',encoding='utf-8').write(t)" "$F"
out="$(correr "$D")"; rc=$?
if [ "$rc" = "2" ] && grep -q 'no cuadra' <<< "$out"; then
  ok "4 el doc declara 3 y hay 2 -> rc=2 (no mide con un universo que no cuadra)"
else
  fail "4 rc=$rc · midió igual con el padrón desalineado: $(head -c 300 <<< "$out")"
fi

# ── 5 · DOC SIN PARSER — no se ignora en silencio ─────────────────────────────────────────────
E="$TMP/sinparser"; armar "$E"
printf '# veredictos de otra cosa\n\n| x | y |\n' \
  > "$E/docs/copiloto-emprendedor/2026-11-01-veredictos-de-un-bloque-nuevo.md"
out="$(correr "$E")"; rc=$?
if [ "$rc" = "2" ] && grep -q 'NO sabe leer' <<< "$out"; then
  ok "5 doc de veredictos sin parser -> rc=2 y lo nombra (no suma ni descarta en silencio)"
else
  fail "5 rc=$rc · un doc nuevo quedó invisible, que es el defecto que este medidor existe para no repetir"
fi

# ── 6 · CONTROL POSITIVO POR BRAZO — doc presente, cero ids ───────────────────────────────────
G="$TMP/brazomudo"; armar "$G"
printf '# veredictos cascara con el formato cambiado\n\nahora es prosa, sin tabla ni **R**\n' \
  > "$G/docs/copiloto-emprendedor/2026-10-13-veredictos-bloque-cascara-fixture.md"
out="$(correr "$G")"; rc=$?
if [ "$rc" = "2" ] && grep -q "brazo 'cascara'" <<< "$out"; then
  ok "6 brazo con doc presente y 0 ids -> rc=2 y nombra el brazo (cambió de formato)"
else
  fail "6 rc=$rc · un brazo mudo pasó como «ese bloque no tiene filas»: $(head -c 300 <<< "$out")"
fi

# ── 7 · CANARIO ───────────────────────────────────────────────────────────────────────────────
out="$(correr "$A" --canario)"; rc=$?
if [ "$rc" = "0" ] && ! grep -q 'NO SE MOVIO' <<< "$out"; then
  ok "7 --canario: los 3 brazos bajan la métrica al romperse"
else
  fail "7 rc=$rc · hay un brazo cuya rotura no mueve nada, o sea sin control: $(head -c 300 <<< "$out")"
fi

# ── 8 · `backend + nativa` CON veredicto versionado ENTRA ─────────────────────────────────────
# El par importa entero y el caso 1 ya es el NEGATIVO (los dos `bk-*` sin doc -> fuera=2), asi que
# aca falta el POSITIVO. Sin este caso, «fuera» era indistinguible de «fuera por pertenecer al
# grupo» — que es como estuvo escrito hasta el 2026-10-13, y entonces el DoD que planificacion le
# bajo a frontend1 («el medidor mueve `onb-cumplida` a medida») no se cumplia con NINGUN documento.
# Lo cazo ella midiendo, no este test: por eso existe ahora.
H="$TMP/bkconveredicto"; armar "$H"
printf '# veredicto bloque chat\n\n### 1 \xc2\xb7 `sd-uno` \xe2\x80\x94 \xe2\x9c\x85\n\n### 2 \xc2\xb7 `bk-uno` \xe2\x80\x94 \xe2\x9c\x85 + \xf0\x9f\x93\x9d\n\ncuerpo\n' \
  > "$H/docs/copiloto-emprendedor/2026-10-13-veredicto-bloque-chat-fixture.md"
out="$(correr "$H" --json)"; rc=$?
if [ "$rc" = "0" ] \
   && [ "$(campo "$out" fuera_de_este_corpus)" = "1" ] \
   && [ "$(campo "$out" con_veredicto)" = "5" ] \
   && [ "$(campo "$out" cerrada_en_codigo)" = "2" ] \
   && [ "$(campo "$out" cumple_dod)" = "4" ]; then
  ok "8 backend+nativa CON veredicto versionado -> entra (fuera 2->1, medidas 4->5, codigo 1->2)"
else
  fail "8 rc=$rc · una fila backend+nativa con doc versionado no entro, o entro sin contarse: $(head -c 300 <<< "$out")"
fi

# ── 9 · …y una MENCIONADA SIN simbolos no entra por la puerta de atras ────────────────────────
# El riesgo del fix: si el guard mira solo «¿hay entrada?» y no «¿tiene simbolos?», un doc que
# menciona el id sin veredicto cae al `else` y sale ENMIENDA-FUNDADA por AUSENCIA de evidencia —
# el degradado prudente que envenena la medicion. Tiene que quedar FUERA, no cumplir el DoD.
I="$TMP/bkmudo"; armar "$I"
printf '# veredicto bloque chat\n\n### 1 \xc2\xb7 `sd-uno` \xe2\x80\x94 \xe2\x9c\x85\n\n### 2 \xc2\xb7 `bk-uno` \xe2\x80\x94 sin veredicto todavia\n' \
  > "$I/docs/copiloto-emprendedor/2026-10-13-veredicto-bloque-chat-fixture.md"
out="$(correr "$I" --json)"; rc=$?
if [ "$rc" = "0" ] && [ "$(campo "$out" fuera_de_este_corpus)" = "2" ]; then
  ok "9 backend+nativa mencionada SIN simbolos -> sigue fuera (no cumple el DoD por ausencia)"
else
  fail "9 rc=$rc · fuera=$(campo "$out" fuera_de_este_corpus) · un id mencionado sin veredicto se conto: $(head -c 300 <<< "$out")"
fi


# -- 10 - una divergencia PENDIENTE no cumple el DoD, ni siquiera con un OK al lado -------------
# El DoD es POR FILA: «cada divergencia ... resuelta O enmienda fundada. NINGUNA queda sin
# veredicto». Hasta el 2026-10-13 el clasificador era `CERRADA-EN-CODIGO if OK else
# ENMIENDA-FUNDADA`, o sea «enmienda fundada» era el ELSE: una fila con dependencia pendiente
# cumplia el DoD, y con un OK al lado salia incluso CERRADA-EN-CODIGO. Medido en origin/main
# 159f883b: 7 filas asi, y `card-factura` decia TEXTUAL en su doc «NO se cumple».
# El caso pone OK + CADENA en la MISMA fila: es la mitad que el `else` no podia ver.
J="$TMP/pendiente"; armar "$J"
printf '# veredicto bloque chat\n\n### 1 \xc2\xb7 `sd-uno` \xe2\x80\x94 \xe2\x9c\x85 + \xe2\x9b\x93 atada a la dependencia\n\ncuerpo\n' \
  > "$J/docs/copiloto-emprendedor/2026-10-13-veredicto-bloque-chat-fixture.md"
out="$(correr "$J" --json)"; rc=$?
if [ "$rc" = "0" ] \
   && [ "$(campo "$out" pendiente_declarada)" = "1" ] \
   && [ "$(campo "$out" cumple_dod)" = "2" ] \
   && [ "$(campo "$out" cerrada_en_codigo)" = "0" ] \
   && [ "$(campo "$out" con_veredicto)" = "4" ]; then
  ok "10 fila con divergencia PENDIENTE -> no cumple el DoD (DoD 3->2, codigo 1->0, sigue medida)"
else
  fail "10 rc=$rc · pend=$(campo "$out" pendiente_declarada) dod=$(campo "$out" cumple_dod) cod=$(campo "$out" cerrada_en_codigo) · una dependencia pendiente se conto como cumplida: $(head -c 300 <<< "$out")"
fi
[ "$fallos" -eq 0 ] && echo "  OK (10/10)" || { echo "  $fallos fallo(s)"; exit 1; }
