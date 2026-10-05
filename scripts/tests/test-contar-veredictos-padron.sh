#!/usr/bin/env bash
# test-contar-veredictos-padron.sh — el padrón de ids TIENE que participar de la cuenta.
#
# EL DEFECTO (medido 2026-09-29): `medir(txt, ids, armas)` recibía el padrón y no lo usaba en
# ninguna línea de su cuerpo. Con el padrón VACÍO el resultado era idéntico byte a byte — 21 sujetos
# y 26 hits en el lote A, con 54 ids, con 27 y con 0. O sea que ningún `id` se validaba contra nada:
# un typo del documento (`facutra`) entraba como sujeto legítimo, y la cifra que ese script existe
# para dar —«N de 54»— no se computaba en ninguna parte.
#
# Lo que lo dejó vivir es lo que este test cierra: `universo_de_sujetos()` tenía su propio control
# (`CONTROL DEL UNIVERSO FALLA` si extraía <15 ids) protegiendo un valor que NADIE consumía. Un
# control sobre un dato inerte da verde con toda razón y no significa nada. Y el canario de 5 brazos
# probaba las FORMAS del parser: el padrón era un sexto brazo sin canario.
#
# Por qué este test es EXTERNO y no otro control horneado: el contador ya tenía tres controles
# adentro y ninguno pudo ver esto, porque todos miran hacia adentro del parser. Además el canario
# nuevo vive DENTRO del script, así que sin este archivo sólo correría cuando alguien lo ejecute a
# mano — `ci/lint.sh:33` levanta `scripts/tests/test-*.sh` por glob, así que acá sí lo corre el gate.
#
#   1. CONTROL POSITIVO: el contador corre limpio y da la cifra «de los 54»
#   2. el universo es 54 (la spec), no 27 (la matriz) — C3-13
#   3. la cobertura reporta los 28 ciegos y `plan` como retirado — C3-13 / C3-14
#   4. CANARIO DEL CANARIO: si el padrón se vuelve inerte otra vez, el script FALLA
#   5. CONTROL NEGATIVO del ratchet: un ciego nuevo tiene que romper el gate
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTADOR="$REPO_ROOT/scripts/evidencia/contar-veredictos.py"

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

# 🔴 EL CORPUS DEL GATE ES UN FIXTURE, NO EL BUZON VIVO (LINTALCANCE, 2026-10-05).
#
# Hasta hoy este test corria el contador contra `coordinacion/`: un corpus vivo, compartido entre
# cuatro sesiones y NO versionado. Eso mezclaba dos cosas que el gate tiene que separar — los
# ratchets de CODIGO (que el commit determina) y el ratchet de ESTADO «hay un documento sin
# clasificar» (que lo determina quien emitio ultimo). Consecuencias medidas el mismo dia:
#
#   · tres veces en una hora, una emision de OTRA sesion puso rojo el `lint` de TODAS las ramas;
#   · el mismo `lint.sh` daba distinto segun la rama (5 sin clasificar en una, 1 en otra), porque
#     la clasificacion vive en el codigo de cada rama y el corpus es uno;
#   · en CI `coordinacion/` no existe, asi que esto salteaba ENTERO por el rc=2 — un gate que no
#     mide en el unico lugar donde es obligatorio, y cuyo SKIP se leia como verde.
#
# El ratchet de estado NO se perdio: vive en `scripts/evidencia/auditar-corpus-vivo.sh`, que corre
# en el ciclo de vigilancia de planificacion —la duena de clasificar— y puede ponerse rojo sin
# trabar el merge de nadie. Que el gate conserve su poder de deteccion sobre el fixture lo prueba
# el caso 6; sin ese control, aislar el corpus seria indistinguible de desactivar el ratchet.
CORPUS="$("$PY" "$REPO_ROOT/scripts/evidencia/fabricar-corpus-fixture.py" "$TMP" 2> "$TMP/fx.err")"
if [ -z "$CORPUS" ] || [ ! -d "$CORPUS" ]; then
  fail "no pude fabricar el corpus fixture: $(head -3 "$TMP/fx.err")"
  echo "❌ 1 fallo(s)"; exit 1
fi
export COPILOTO_COORD="$CORPUS"

"$PY" "$CONTADOR" --json > "$TMP/base.json" 2> "$TMP/base.err"; rc_base=$?
if [ "$rc_base" -ne 0 ]; then
  # Ya NO hay skip por rc=2. El corpus lo fabrica este test, asi que «no puedo medir» dejo de ser un
  # estado legitimo del entorno y pasa a ser un defecto: o el fixture no sirve, o la spec/matriz del
  # commit no se leen. Ninguna de las dos es un verde.
  fail "el contador no corre contra el fixture (rc=$rc_base): $(head -3 "$TMP/base.err")"
  echo "❌ 1 fallo(s)"; exit 1
fi

echo "── Caso 1: CONTROL POSITIVO — corre y da la cifra «de los 54»"
# Accessor por RUTA (`a.b.c`), no `eval`: las expresiones serían literales de este mismo archivo,
# pero dejar un `eval` sobre argv en un repo público es un patrón que alguien copia a un contexto
# donde el argumento sí viene de afuera. El sufijo `#len` pide la longitud y `#join` une una lista.
leer() { "$PY" -c "
import json, sys
ruta, pedido = sys.argv[2], ''
if '#' in ruta:
    ruta, pedido = ruta.split('#', 1)
v = json.load(open(sys.argv[1], encoding='utf-8'))
for k in ruta.split('.'):
    v = v[k]
print(len(v) if pedido == 'len' else ','.join(v) if pedido == 'join' else v)
" "$1" "$2" 2>/dev/null; }

# C3-15: la clave de `lotes` pasó de `lote_A`/`lote_B` (fijas, dos docs elegidos a mano) al
# BASENAME del documento descubierto. Se busca por patrón para que el test no dependa del nombre
# exacto del archivo — que se renombra y se archiva — ni del esquema de la clave.
n_a="$("$PY" -c "
import json, sys
d = json.load(open(sys.argv[1], encoding='utf-8'))
print(sum(v['ids_del_criterio_con_veredicto'] for k, v in d['lotes'].items() if sys.argv[2] in k))
" "$TMP/base.json" "lote-A" 2>/dev/null)"
n_b="$("$PY" -c "
import json, sys
d = json.load(open(sys.argv[1], encoding='utf-8'))
print(sum(v['ids_del_criterio_con_veredicto'] for k, v in d['lotes'].items() if sys.argv[2] in k))
" "$TMP/base.json" "lote-B" 2>/dev/null)"
if [ -n "$n_a" ] && [ "$n_a" -gt 0 ] 2>/dev/null && [ "$n_b" -gt 0 ] 2>/dev/null; then
  ok "la cifra del criterio existe y es >0 en los dos lotes (A=$n_a · B=$n_b de 54)"
else
  fail "no hay cifra «de los 54»: A='$n_a' B='$n_b'"
fi

echo "── Caso 2: el universo sale de la SPEC (54), no de la matriz (27)"
univ="$(leer "$TMP/base.json" "cobertura_del_instrumento.ids_del_criterio")"
[ "$univ" = "54" ] \
  && ok "universo = 54 ids, los del criterio" \
  || fail "universo = '$univ' (esperaba 54): volvió a salir del instrumento y no de la spec"

echo "── Caso 3: la cobertura reporta los ciegos y los retirados"
ciegos="$(leer "$TMP/base.json" "cobertura_del_instrumento.ciegos#len")"
capta="$(leer "$TMP/base.json" "cobertura_del_instrumento.ids_que_la_matriz_captura")"
if [ "$ciegos" -gt 0 ] 2>/dev/null && [ "$(( ciegos + capta ))" = "54" ]; then
  ok "la aritmética de cobertura cierra: $capta capturados + $ciegos ciegos = 54"
else
  fail "la cobertura no cierra: $capta + $ciegos ≠ 54"
fi
retir="$(leer "$TMP/base.json" "cobertura_del_instrumento.retirados_de_la_spec_que_la_matriz_conserva#join")"
[ "$retir" = "plan" ] \
  && ok "reporta \`plan\` como retirado de la spec (C3-14: el diff es bidireccional)" \
  || fail "los retirados son '$retir' (esperaba 'plan')"

# Para los casos 4 y 5 hay que correr una copia PARCHEADA del contador, y no alcanza con copiarla a
# `$TMP`: el script resuelve sus rutas con `RAIZ = Path(__file__).resolve().parents[2]`, así que una
# copia suelta busca la spec en un árbol que no existe y aborta antes de llegar al canario. El primer
# intento falló así, y el fail-closed del propio contador fue lo que lo dijo con precisión en vez de
# devolver un 0 — «no encontré <la spec>» y no «0 ids». Por eso se le arma el árbol mínimo que
# `parents[2]` espera; el buzón lo sigue tomando de su ruta absoluta, que no depende de RAIZ.
FAKE="$TMP/arbol"
mkdir -p "$FAKE/docs/copiloto-emprendedor" "$FAKE/scripts/evidencia"
cp "$REPO_ROOT/docs/copiloto-emprendedor/2026-09-22-BL-P5-pantallas-del-prototipo-spec-vision-propuesta.md"    "$FAKE/docs/copiloto-emprendedor/" 2>/dev/null
cp "$REPO_ROOT/scripts/evidencia/criterio3-matriz.mjs" "$FAKE/scripts/evidencia/" 2>/dev/null
# CONTROL DEL PROPIO FIXTURE: la copia sin parchear TIENE que correr verde acá. Sin esto, un rojo de
# los casos 4/5 sería indistinguible de un árbol mal armado — que es exactamente lo que ya pasó.
cp "$CONTADOR" "$FAKE/scripts/evidencia/base.py"
if "$PY" "$FAKE/scripts/evidencia/base.py" --json > /dev/null 2> "$TMP/fixture.err"; then
  ok "el árbol mínimo del fixture sirve (la copia sin parchear corre verde)"
else
  fail "el fixture no sirve, los casos 4 y 5 no prueban nada: $(head -2 "$TMP/fixture.err" | tr '
' ' ')"
fi

echo "── Caso 4: CANARIO DEL CANARIO — si el padrón vuelve a ser inerte, el script falla"
# Se rompe el padrón del MISMO modo que estaba roto: se ignora `ids` en el cruce. Si el script sigue
# saliendo 0, su canario no vale nada. Sin este caso, el canario del contador es una promesa.
cp "$CONTADOR" "$FAKE/scripts/evidencia/inerte.py"
"$PY" - "$FAKE/scripts/evidencia/inerte.py" <<'PYEOF'
import io, sys
p = sys.argv[1]
t = io.open(p, encoding="utf-8").read()
# el cruce con el padrón, neutralizado: la métrica deja de depender de `ids`
# Se neutraliza el cruce DENTRO de `ids_del_criterio()`, que es el camino que usan tanto el reporte
# como el canario. Parchear sólo la línea del reporte no alcanzaba: el canario cruzaba por su cuenta
# y seguía viendo bajar la cifra — así se descubrió que el canario no ejercitaba el camino real.
a = 'return sorted({c.split("·")[0] for c in con} & set(ids))'
assert a in t, "el test no encontró el cruce con el padrón: cambió de forma, actualizá el test"
t = t.replace(a, 'return sorted({c.split("·")[0] for c in con})', 1)
io.open(p, "w", encoding="utf-8", newline="\n").write(t)
PYEOF
if [ "$?" != "0" ]; then
  fail "no pude fabricar la versión inerte (el ancla cambió): el canario queda sin control positivo"
elif "$PY" "$FAKE/scripts/evidencia/inerte.py" --json > /dev/null 2> "$TMP/inerte.err"; then
  fail "el canario NO caza el padrón inerte: la versión sin cruce salió VERDE"
else
  # 🔴 HALLAZGO del 2026-09-29, y es del script, no de este test: romper el cruce con el padrón hace
  # que `descubrir_documentos` (C3-15) deje de filtrar por padrón, así que aparecen candidatos nuevos
  # y el gate de CLASIFICACIÓN aborta (exit 8) ANTES de que el canario del padrón llegue a correr
  # (exit 7). La rotura SÍ se caza —que es lo que este caso existe para probar— pero el mensaje
  # apunta al lugar equivocado: dice «clasificá estos 3 documentos» cuando lo roto es el cruce.
  # Se aceptan los dos motivos y el orden queda escrito acá, porque es lo que hace diagnosticable el
  # próximo rojo. Un gate que absorbe la señal de otro no es un gate de más: es un gate que manda al
  # que lo lee a arreglar lo que no está roto.
  if grep -qE "CANARIO DEL PADRON FALLA|SIN CLASIFICAR" "$TMP/inerte.err"; then
    motivo="$(grep -oE "CANARIO DEL PADRON FALLA|SIN CLASIFICAR" "$TMP/inerte.err" | head -1)"
    ok "con el padrón inerte el script falla (vía «$motivo»)"
  else
    fail "falló por otra razón: $(head -2 "$TMP/inerte.err" | tr '\n' ' ')"
  fi
fi

echo "── Caso 5: CONTROL NEGATIVO del ratchet — un ciego nuevo rompe el gate"
# Se le saca un id al ratchet declarado: el gate tiene que verlo como regresión de cobertura. Es lo
# que prueba que CIEGOS_DECLARADOS es un piso vivo y no una lista decorativa.
cp "$CONTADOR" "$FAKE/scripts/evidencia/ratchet.py"
"$PY" - "$FAKE/scripts/evidencia/ratchet.py" <<'PYEOF'
import io, re, sys
p = sys.argv[1]
t = io.open(p, encoding="utf-8").read()
m = re.search(r'CIEGOS_DECLARADOS = \{(.*?)\}', t, re.S)
assert m, "no encontré CIEGOS_DECLARADOS"
cuerpo = m.group(1)
# le saco el primero de la lista: ahora es un ciego NO declarado
nuevo = re.sub(r'"[a-z0-9()-]+",\s*', '', cuerpo, count=1)
t = t.replace(m.group(0), 'CIEGOS_DECLARADOS = {' + nuevo + '}', 1)
io.open(p, "w", encoding="utf-8", newline="\n").write(t)
PYEOF
if "$PY" "$FAKE/scripts/evidencia/ratchet.py" --json > /dev/null 2> "$TMP/ratchet.err"; then
  fail "el ratchet NO es un piso: quitarle un ciego declarado salió verde"
else
  if grep -q "COBERTURA: REGRESIÓN" "$TMP/ratchet.err"; then
    ok "un ciego fuera del ratchet rompe el gate (el piso está vivo)"
  else
    fail "rompió por otra razón: $(head -2 "$TMP/ratchet.err" | tr '\n' ' ')"
  fi
fi

echo "── Caso 6: el CORPUS se descubre, y los descartados llevan motivo (C3-15)"
n_docs="$(leer "$TMP/base.json" "corpus.documentos_medidos")"
if [ -n "$n_docs" ] && [ "$n_docs" -ge 10 ] 2>/dev/null; then
  ok "el corpus se descubre por glob: $n_docs documentos medidos (antes eran 2 fijos)"
else
  fail "el corpus tiene $n_docs documentos: el descubrimiento volvió a quedar fijo"
fi

# ── Helpers del fixture para los gates de clasificacion ───────────────────────────────────────
# ANTES: estos cuatro casos parcheaban el CODIGO (sacaban o movian una clasificacion) y esperaban
# que el BUZON VIVO tuviera un documento con la propiedad exacta que el gate caza — 12 ids citados,
# 0 veredictos cerrados, un conflicto en `card`. Dos fragilidades en una: dependian del corpus de un
# dia Y de que una clave concreta siguiera existiendo en el fuente. La segunda ya cobro: el comentario
# del caso 8 contaba que su version anterior sacaba una entrada de un dict que despues quedo vacio, y
# el fixture dejo de fabricar el caso mientras el gate parecia roto.
#
# AHORA cada caso FABRICA su documento en un corpus propio y lo declara en una copia del contador.
# Ejercita el MECANISMO —el predicado del gate— y no un dato del dia. Los predicados se midieron
# antes de escribir esto, no se dedujeron del docstring:
#   · veredicto fuera del vocabulario, sin tokens del vocabulario en el texto -> exit 9  (NO MIDE)
#   · veredicto fuera del vocabulario, con un token suelto en la prosa        -> exit 10 (NO SE LEE)
#   · dos documentos que le dan veredictos incompatibles al mismo id          -> exit 11 (CONFLICTO)
# El corpus base del fixture sale rc=0 (medido arriba), asi que cada rojo es atribuible al documento
# que el caso agrega: sin ese control negativo, un fixture ya roto "dispararia" por otra causa.
corpus_nuevo() {   # $1 = etiqueta -> imprime la ruta de un corpus fixture recien fabricado
  "$PY" "$REPO_ROOT/scripts/evidencia/fabricar-corpus-fixture.py" "$TMP/c-$1" 2>> "$TMP/fx.err"
}
declarar() {       # $1 = destino .py · $2 = clave a agregar a MEDICIONES_DECLARADAS
  "$PY" - "$CONTADOR" "$1" "$2" <<'PYEOF'
import io, sys
src, dst, clave = sys.argv[1], sys.argv[2], sys.argv[3]
t = io.open(src, encoding="utf-8").read()
anc = "MEDICIONES_DECLARADAS = {\n"
assert t.count(anc) == 1, "no encontre MEDICIONES_DECLARADAS: cambio de forma"
io.open(dst, "w", encoding="utf-8", newline="\n").write(
    t.replace(anc, anc + '    "%s",\n' % clave, 1))
PYEOF
}
CAB='| sujeto | plataforma | veredicto | nota |'
SEP='|---|---|---|---|'

echo "── Caso 7: CONTROL POSITIVO del gate de clasificación — un candidato sin clasificar ROMPE"
# Sin este caso, «un documento sin clasificar rompe el gate» es una promesa: un `sys.exit(8)` que
# nunca se ejercita es indistinguible de un `pass`. Y acá importa doble, porque este gate es lo único
# que impide que descubrir documentos por glob sume texto normativo — y sumarlo **se vería como
# progreso**, que es el falso verde más caro de todos.
C7="$(corpus_nuevo sinclas)"
D7="2026-10-05_dato_fixture-a-planificacion_SIN-CLASIFICAR.md"
printf '# fixture\n\n%s\n%s\n| `factura` | web | DESVIO | nadie me clasifico |\n' "$CAB" "$SEP" \
  > "$C7/abierto/$D7"
if COPILOTO_COORD="$C7" "$PY" "$CONTADOR" --json > /dev/null 2> "$TMP/sinclas.err"; then
  fail "el gate NO caza un documento sin clasificar: salió VERDE con un candidato suelto"
elif grep -q "SIN CLASIFICAR" "$TMP/sinclas.err"; then
  ok "un candidato sin clasificar rompe el gate, y por el motivo correcto (exit 8)"
else
  fail "rompió por otra razón: $(head -2 "$TMP/sinclas.err")"
fi

echo "── Caso 8: CONTROL POSITIVO de «MEDICIÓN QUE NO MIDE» (exit 9) — el MAL clasificado"
# `sin_clasificar` (caso 7) caza al que nadie clasificó. Éste caza al que está clasificado MAL, que
# es el único camino por el que un documento analítico entra al corpus como medición. El predicado es
# «0 veredictos del vocabulario CERRADO y 0 tokens del vocabulario en el texto»: un token en rol de
# veredicto que el vocabulario no reconoce (`APROBADO`) lo reproduce sin depender de ningún documento.
C8="$(corpus_nuevo nomide)"
D8="2026-10-05_dato_fixture-a-planificacion_NO-MIDE.md"
printf '# fixture\n\n%s\n%s\n| `factura` | web | APROBADO | sin token del vocabulario |\n' "$CAB" "$SEP" \
  > "$C8/abierto/$D8"
if declarar "$FAKE/scripts/evidencia/rol.py" "$D8" 2> "$TMP/decl8.err"; then
  if COPILOTO_COORD="$C8" "$PY" "$FAKE/scripts/evidencia/rol.py" --json > /dev/null 2> "$TMP/rol.err"; then
    fail "el gate NO caza un analítico declarado como medición: salió VERDE"
  elif grep -q "MEDICION QUE NO MIDE" "$TMP/rol.err"; then
    ok "un analítico declarado medición rompe el gate, por el motivo correcto (exit 9)"
  else
    fail "rompió por otra razón: $(head -2 "$TMP/rol.err")"
  fi
else
  fail "el fixture del caso 8 no pudo declarar la clave: $(head -1 "$TMP/decl8.err")"
fi

echo "── Caso 9: CONTROL POSITIVO de «MEDICIÓN QUE NO SE LEE» (exit 10) — rol vs lectura"
# El predicado de «no mide» (cero veredictos cerrados) es EXACTAMENTE el síntoma del bug del emoji en
# `limpiar()`. Sin partirlo, el gate acusaba de «no mide» a documentos que medían y no se leían — un
# gate cuyo predicado es el síntoma de un bug abierto convierte el bug en veredicto de rol. Este caso
# fija la separación, y la única diferencia con el 8 es UNA línea de prosa con un token del
# vocabulario: si los dos exits se volvieran a fusionar, acá saldría «NO MIDE» y el caso lo diría.
C9="$(corpus_nuevo nolee)"
D9="2026-10-05_dato_fixture-a-planificacion_NO-SE-LEE.md"
printf '# fixture\n\nEste COHERENTE quedó en la prosa y el parser no lo atribuyó a ningún sujeto.\n\n%s\n%s\n| `factura` | web | APROBADO | con vocabulario suelto |\n' "$CAB" "$SEP" \
  > "$C9/abierto/$D9"
if declarar "$FAKE/scripts/evidencia/lectura.py" "$D9" 2> "$TMP/decl9.err"; then
  if COPILOTO_COORD="$C9" "$PY" "$FAKE/scripts/evidencia/lectura.py" --json > /dev/null 2> "$TMP/lect.err"; then
    fail "el gate NO distingue «no se lee»: salió VERDE con 0 cerrados y vocabulario en el texto"
  elif grep -q "MEDICION QUE NO SE LEE" "$TMP/lect.err"; then
    ok "0 cerrados + vocabulario en el texto sale por LECTURA, no por ROL (exit 10)"
  else
    fail "rompió por otra razón: $(head -2 "$TMP/lect.err")"
  fi
else
  fail "el fixture del caso 9 no pudo declarar la clave: $(head -1 "$TMP/decl9.err")"
fi

echo "── Caso 10: CONTROL POSITIVO del CONTRASTE id→veredictos (exit 11) — el falso COHERENTE"
# Es el único control que caza un COHERENTE falso, y un COHERENTE falso desactiva trabajo sin dejar
# rastro (un DESVÍO falso cuesta una recaptura y se descubre). Si el ratchet se rompe, el contraste se
# degrada a una línea de reporte que nadie atiende.
#
# El id es `agenda` y no `factura` A PROPÓSITO: `factura` está entre los 12 conflictos YA declarados,
# así que un conflicto suyo no sería «nuevo» y el caso saldría verde midiendo otra cosa. Se elige un
# id que el fixture mide COHERENTE y que nadie declaró en conflicto.
C10="$(corpus_nuevo confl)"
D10="2026-10-05_dato_fixture-a-planificacion_CONFLICTO.md"
printf '# fixture\n\n%s\n%s\n| `agenda` | web | DESVIO | contradice al resto del fixture |\n' "$CAB" "$SEP" \
  > "$C10/abierto/$D10"
if declarar "$FAKE/scripts/evidencia/confl.py" "$D10" 2> "$TMP/decl10.err"; then
  if COPILOTO_COORD="$C10" "$PY" "$FAKE/scripts/evidencia/confl.py" --json > /dev/null 2> "$TMP/confl.err"; then
    fail "el ratchet de conflictos NO caza uno sin declarar: salió VERDE"
  elif grep -q "CONFLICTO NUEVO" "$TMP/confl.err"; then
    ok "un conflicto de veredictos sin declarar rompe el gate (exit 11)"
  else
    fail "rompió por otra razón: $(head -2 "$TMP/confl.err")"
  fi
else
  fail "el fixture del caso 10 no pudo declarar la clave: $(head -1 "$TMP/decl10.err")"
fi

echo "── Caso 11: el contraste publica QUÉ DOCUMENTO dijo cada veredicto (CONTRASTEDOCS)"
# CONTROL NEGATIVO medido antes del fix: el JSON decia `"bi": ["COHERENTE","DESVÍO"]` — las CLAVES
# del mapa veredicto->documentos, con los documentos tirados. Se ve QUE choca y no QUIEN lo dijo, y
# sin el documento no hay a quien pedirle la linea de cierre: faltaba justo la pieza que vuelve
# accionable al dato. Auditoria tuvo que reconstruirlo desde `lotes` para poder trabajar.
# Este caso afirma la ESTRUCTURA, no un id del dia: cualquier conflicto sirve.
C11="$(corpus_nuevo contradocs)"
if J="$(COPILOTO_COORD="$C11" "$PY" "$CONTADOR" --json 2> "$TMP/c11.err")"; then
  if printf '%s' "$J" | "$PY" -c '
import json, sys
c = json.load(sys.stdin)["contraste"]
d = c["conflictos_declarados"]
assert isinstance(d, dict), "conflictos_declarados dejo de ser un dict por id"
for i, f in d.items():
    assert "veredictos" in f, "%s no publica el mapa veredicto->documentos" % i
    for v, docs in f["veredictos"].items():
        assert isinstance(docs, list) and docs, "%s/%s quedo sin documentos" % (i, v)
        assert all(x.endswith(".md") for x in docs), "%s/%s no son nombres de documento: %r" % (i, v, docs)
    for k in ("resolucion", "dirimido", "dirimido_el", "hipotesis_compartida"):
        assert k in f, "%s no publica %s" % (i, k)
r = c["resolucion"]
for k in ("total", "dirimidos", "sin_dirimir", "hipotesis_compartida", "declaraciones_distintas"):
    assert k in r, "el resumen no publica %s" % k
assert r["sin_dirimir"] >= 0, "sin_dirimir negativo (%s): cubos solapados restados dos veces" % r["sin_dirimir"]
assert r["total"] == len(d), "el total (%s) no coincide con las filas (%s)" % (r["total"], len(d))
' 2> "$TMP/c11b.err"; then
    ok "cada conflicto publica sus documentos por veredicto, y el resumen cierra"
  else
    fail "la estructura del contraste no cumple: $(head -2 "$TMP/c11b.err")"
  fi
else
  fail "el contador no corrió sobre el fixture del caso 11: $(head -2 "$TMP/c11.err")"
fi

echo "── Caso 12: «dirimido» se lee en los DOS idiomas que el registro ya usaba"
# 🔴 LO QUE ESTE CASO IMPIDE QUE VUELVA. La primera version de este lector invento un TERCER idioma
# (`DIRIMIDO:` como prefijo) y conto `dirimidos: 1` de 12, mientras NUEVE textos declaraban
# `[DIRIMIDO 2026-09-30]` adentro. Un lector que habla su propio idioma no reporta «no entiendo»:
# reporta «no hay declaracion», que se lee igual que «nadie lo dirimio». Es el caso del registro en
# varios idiomas con un lector de uno, pagado por el parche que venia a arreglar otra cosa.
# El caso NO cita la cifra del dia (envejece): afirma que las DOS formas se leen y que la fecha sale.
for forma in "[DIRIMIDO 2026-09-29] texto" "DIRIMIDO el 2026-09-29 por auditoria"; do
  if printf '%s' "$forma" | "$PY" -c '
import re, sys
rx = re.compile(r"\[?DIRIMID[OA](?:\s+el)?\s+(\d{4}-\d{2}-\d{2})")
t = sys.stdin.read()
m = rx.search(t)
assert m, "la forma %r no se reconoce" % t
assert m.group(1) == "2026-09-29", "la fecha salio %r" % m.group(1)
' 2> "$TMP/c12.err"; then
    ok "se lee: ${forma:0:26}…"
  else
    fail "forma no reconocida ($forma): $(head -1 "$TMP/c12.err")"
  fi
done
# Y el regex del test tiene que ser EL MISMO del contador, no una copia que derive: se compara.
if grep -q 'DIRIMIDO_RX = re.compile' "$CONTADOR" && \
   "$PY" -c '
import ast, io, re, sys
t = io.open(sys.argv[1], encoding="utf-8").read()
m = re.search(r"DIRIMIDO_RX = re\.compile\((.+?)\)\n", t, re.S)
assert m, "no encontre DIRIMIDO_RX"
pat = ast.literal_eval(m.group(1).strip())
assert re.compile(pat).search("[DIRIMIDO 2026-09-29]"), "el patron del contador no lee la forma con corchetes"
assert re.compile(pat).search("DIRIMIDO el 2026-09-29"), "el patron del contador no lee la forma con `el`"
' "$CONTADOR" 2> "$TMP/c12b.err"; then
  ok "el patrón que usa el CONTADOR lee las dos formas (no una copia del test)"
else
  fail "el patrón del contador no cubre las dos formas: $(head -2 "$TMP/c12b.err")"
fi

echo "── Caso 13: CONTROL POSITIVO del ratchet — un DIRIMIDO sin fecha ROMPE (exit 12)"
# Sin este caso, el ratchet del idioma es una promesa. El modo de falla que vigila es SILENCIOSO —un
# cuarto idioma se leeria como «sin resolucion»— y el unico sintoma seria una cifra que baja sin que
# nadie toque el registro. El fixture inyecta el idioma nuevo A PROPOSITO sobre una copia del
# contador: ejercita el mecanismo, no el estado del dia.
C13="$(corpus_nuevo idioma)"
if "$PY" - "$CONTADOR" "$FAKE/scripts/evidencia/idioma.py" <<'PYEOF'
import io, re, sys
src, dst = sys.argv[1], sys.argv[2]
t = io.open(src, encoding="utf-8").read()
anc = 'CONFLICTOS_CONOCIDOS = {\n'
assert t.count(anc) == 1, "CONFLICTOS_CONOCIDOS cambio de forma"
# Un idioma NUEVO: dice DIRIMIDO y no trae fecha legible. Es exactamente lo que el ratchet caza.
inyectado = anc + '    "agenda": "DIRIMIDO ayer por quien corresponda, sin fecha",\n'
io.open(dst, "w", encoding="utf-8", newline="\n").write(t.replace(anc, inyectado, 1))
PYEOF
then
  if COPILOTO_COORD="$C13" "$PY" "$FAKE/scripts/evidencia/idioma.py" --json > /dev/null 2> "$TMP/c13.err"; then
    fail "el ratchet NO caza un DIRIMIDO sin fecha: salió VERDE con un idioma nuevo"
  elif grep -q "DIRIMIDO EN OTRO IDIOMA" "$TMP/c13.err"; then
    ok "un DIRIMIDO sin fecha legible rompe el gate, por el motivo correcto (exit 12)"
  else
    fail "rompió por otra razón: $(head -2 "$TMP/c13.err")"
  fi
else
  fail "el fixture del caso 13 no pudo inyectar el idioma nuevo"
fi

# ── Helper: agrega líneas al final del PRIMER documento del corpus fixture ────────────────────
# Devuelve por stdout el id que ese documento mide, para que el caso afirme contra un dato REAL del
# fixture y no contra un id elegido a mano (un id a mano envejece cuando cambia el padrón).
marcar_doc() {   # marcar_doc <corpus> <texto a appendear, con {ID} sustituido por el id elegido>
  local corpus="$1" texto="$2"
  "$PY" - "$corpus" "$texto" <<'PYEOF'
import io, re, sys
corpus, texto = sys.argv[1], sys.argv[2]
docs = sorted((io.open(p, encoding="utf-8").read(), p) for p in
              __import__("pathlib").Path(corpus, "abierto").glob("*.md"))
t, p = docs[0]
ids = re.findall(r"^\| `([^`]+)` \|", t, re.M)
assert ids, "el documento del fixture no trae filas con sujeto"
io.open(p, "a", encoding="utf-8", newline="\n").write("\n" + texto.replace("{ID}", ids[0]) + "\n")
print(ids[0])
PYEOF
}

echo "── Caso 14: la marca canónica RETIRA el veredicto del cruce, y el retiro queda auditable"
# El mecanismo que faltaba en CONFLICTOSINDUENO: el ROL DUEÑO marca en SU documento y la cifra lo
# refleja. Lo que este caso impide es el modo de falla que ya se midió — frontend1 cerró su mitad en
# prosa el 05/10, correcta y verificada línea por línea, y la cifra siguió diciendo 12 porque la
# nota estaba en un idioma que el instrumento no lee. El trabajo del dueño no llegaba al reporte.
C14="$(corpus_nuevo superado)"
ID14="$(marcar_doc "$C14" '<!-- SUPERADO 2026-10-05 por fixture: 1 ids -->
<!-- SUPERADO-IDS: {ID} -->')"
if J14="$(COPILOTO_COORD="$C14" "$PY" "$CONTADOR" --json 2> "$TMP/c14.err")"; then
  if printf '%s' "$J14" | "$PY" -c '
import json, sys
idq = sys.argv[1]
lotes = json.load(sys.stdin)["lotes"]
tocados = [d for d in lotes.values() if d.get("superados")]
assert len(tocados) == 1, "esperaba 1 documento con superados, hay %d" % len(tocados)
d = tocados[0]
assert d["superados"] == [idq], "superados=%r, esperaba [%r]" % (d["superados"], idq)
assert idq not in d["veredictos_por_id"], "%s sigue en el cruce despues de marcarlo superado" % idq
n = d["superado_nota"]
assert n.get("rol") == "fixture" and n.get("fecha") == "2026-10-05", "la nota no identifica quien y cuando: %r" % n
' "$ID14" 2> "$TMP/c14b.err"; then
    ok "un id marcado por su dueño sale del cruce, y queda quién/cuándo/cuáles"
  else
    fail "el retiro no cumple: $(head -2 "$TMP/c14b.err")"
  fi
else
  fail "el contador no corrió con la marca canónica: $(head -2 "$TMP/c14.err")"
fi

echo "── Caso 15: CONTROL del CONTEO — declarar 3 y listar 1 ROMPE"
# Es LO QUE SEPARA esto de una heurística, y por eso tiene caso propio. Sin el conteo, una coma de
# más o un id mal tipeado retira (o deja de retirar) un veredicto EN SILENCIO — y retirar de más
# oculta un conflicto, o sea fabrica el COHERENTE falso que todo este contraste existe para cazar.
# Un mecanismo cuyo modo de falla es «desactiva trabajo sin dejar rastro» necesita el control adentro.
C15="$(corpus_nuevo conteo)"
marcar_doc "$C15" '<!-- SUPERADO 2026-10-05 por fixture: 3 ids -->
<!-- SUPERADO-IDS: {ID} -->' > /dev/null
if COPILOTO_COORD="$C15" "$PY" "$CONTADOR" --json > /dev/null 2> "$TMP/c15.err"; then
  fail "el conteo mentido NO rompe: declaró 3 y listó 1, y salió VERDE"
elif grep -q "EL CONTEO NO CIERRA" "$TMP/c15.err"; then
  ok "declarar una cantidad distinta de la lista rompe, y lo dice"
else
  fail "rompió por otra razón: $(head -2 "$TMP/c15.err")"
fi

echo "── Caso 16: un id superado FUERA DEL PADRÓN rompe (no se retira lo que el criterio no mide)"
C16="$(corpus_nuevo fuerapadron)"
marcar_doc "$C16" '<!-- SUPERADO 2026-10-05 por fixture: 1 ids -->
<!-- SUPERADO-IDS: pantalla-que-no-existe -->' > /dev/null
if COPILOTO_COORD="$C16" "$PY" "$CONTADOR" --json > /dev/null 2> "$TMP/c16.err"; then
  fail "un id superado fuera del padrón NO rompe: se retiró algo que el criterio no mide"
elif grep -q "IDS FUERA DEL PADRON" "$TMP/c16.err"; then
  ok "un id que no está en el padrón rompe: o está mal escrito, o no se mide"
else
  fail "rompió por otra razón: $(head -2 "$TMP/c16.err")"
fi

echo "── Caso 17: CANARIO — una superación EN PROSA se REPORTA y NO rompe"
# El canario del circuito, no el circuito. Detecta que hay trabajo del rol dueño que el instrumento
# no está contando, y NO retira nada: parsear esa prosa retiraría un veredicto de más el día que una
# explicación mencione un id al pasar (en la nota real conviven los ids en backticks con los NOMBRES
# de los documentos que los reemplazan, y esos nombres contienen `card-cobro`, `card-presu`,
# `factura` adentro). Y NO rompe el gate a propósito: el documento es de otra sesión, así que un rojo
# acá le factura a quien corre el gate lo que causó otro — el defecto de LINTALCANCE, ya pagado.
C17="$(corpus_nuevo prosa)"
ID17="$(marcar_doc "$C17" '> **Superado (2026-10-05), mismo rol (fixture).** La fila de `{ID}` quedó
> reemplazada por una medición posterior más fina.')"
if J17="$(COPILOTO_COORD="$C17" "$PY" "$CONTADOR" --json 2> "$TMP/c17.err")"; then
  if printf '%s' "$J17" | "$PY" -c '
import json, sys
idq = sys.argv[1]
lotes = json.load(sys.stdin)["lotes"]
pr = [d for d in lotes.values() if d.get("superado_nota", {}).get("en_prosa_no_leida")]
assert len(pr) == 1, "el canario vio %d documentos con superacion en prosa, esperaba 1" % len(pr)
assert not pr[0]["superados"], "la prosa RETIRO %r: se parseo lo que no se debe parsear" % pr[0]["superados"]
assert idq in pr[0]["veredictos_por_id"], "%s salio del cruce por una nota en prosa" % idq
' "$ID17" 2> "$TMP/c17b.err"; then
    ok "la prosa se reporta, no retira, y no rompe el gate de nadie"
  else
    fail "el canario no cumple: $(head -2 "$TMP/c17b.err")"
  fi
else
  fail "una superación en prosa ROMPIÓ el gate: $(head -2 "$TMP/c17.err")"
fi

echo
if [ "$fallos" = "0" ]; then
  echo "✅ TODO VERDE — el padrón participa, el corpus se descubre, los gates tienen control, y el contraste dice QUIÉN dijo cada veredicto"
  exit 0
fi
echo "❌ $fallos fallo(s)"
exit 1
