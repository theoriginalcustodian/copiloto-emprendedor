#!/usr/bin/env bash
# Tests de `scripts/a-todos-sin-cierre.sh` — el reportador de `a-todos` sin cerrador declarado.
#
# ## El caso 2 es el que este test existe para que no vuelva
#
# La primera corrida real del script salió **rc=1 sin una sola línea de salida**: con 0 cerrables,
# `grep` sale 1 y `pipefail` mataba el script — o sea justo en el **caso NORMAL** (hoy el corpus real
# tiene 0 cerrables de 6). Y el control positivo horneado **pasó igual**, porque su fixture SÍ tiene
# un cerrable: cubrió la mitad que yo sospechaba y la otra quedó muda. Por eso acá el caso vacío es un
# caso de primera clase y no una nota al pie.
#
# ## El caso 7 es el que hace que el `exit 2` valga algo
#
# Un `exit 2` que nunca se ejercita es indistinguible de uno que no funciona. El caso 7 copia el
# script a un directorio con una **lib CIEGA** al lado (el mismo truco del canario del alfabeto:
# inyectar un lector ciego, no un dato raro) y exige `exit 2`. Sin eso, el día que el parseo de
# nombres se rompa el script diría «0 sin cierre» y sonaría a buena noticia.
set -uo pipefail

SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/scripts/a-todos-sin-cierre.sh"
# ⚠️ La precondición se mide con `-r`, NO con `-x`, y eso lo enseñó un rojo de CI: el repo versiona
# TODOS sus .sh en modo 100644 y `lint.sh:46` los invoca con `bash "$t"`, así que el bit de ejecución
# no es la convención. Pedirlo hacía un guard que pasaba en Git Bash (donde `-x` da true para
# cualquier .sh, sin importar el modo del índice) y fallaba en el runner Linux — verde local, rojo
# donde importa. Cada caso de abajo corre `bash "$SCRIPT"`: la ejecutabilidad nunca hizo falta.
[ -r "$SCRIPT" ] || { echo "FALLA: no existe o no se puede leer $SCRIPT"; exit 1; }

fallos=0
check() { # check <descripcion> <esperado> <obtenido>
  if [ "$2" = "$3" ]; then echo "  ok   $1"
  else echo "  FALLA $1 -- esperaba [$2], obtuve [$3]"; fallos=$((fallos + 1)); fi
}

nuevo_buzon() { local d; d="$(mktemp -d)"; mkdir -p "$d/abierto" "$d/en-curso" "$d/cerrado/2000-01-01"; printf '%s' "$d"; }
A_TODOS="2000-01-01_hallazgo_planificacion-a-todos_sujeto-de-prueba.md"

echo "== 1. buzon inexistente -> exit 2 (NO PUDE MEDIR), no exit 0"
BUZON_DIR=/ruta/que/no/existe bash "$SCRIPT" --quiet >/dev/null 2>&1
check "rc" "2" "$?"

echo "== 2. buzon SIN ningun a-todos -> exit 0 y reporta 0 (el caso que mataba al script)"
bz="$(nuevo_buzon)"
: > "$bz/abierto/2000-01-01_dato_backend-a-planificacion_cualquiera.md"
out="$(BUZON_DIR="$bz" bash "$SCRIPT" --quiet 2>&1)"; rc=$?
check "rc" "0" "$rc"
check "dice 0 sin cierre" "si" "$(printf '%s' "$out" | grep -q '0 sin cierre declarado' && echo si || echo no)"
check "dice que examino 1" "si" "$(printf '%s' "$out" | grep -q 'de 1 archivos examinados' && echo si || echo no)"
rm -rf "$bz"

echo "== 3. un a-todos sin CIERRA: -> SIN CIERRE"
bz="$(nuevo_buzon)"; : > "$bz/abierto/$A_TODOS"
out="$(BUZON_DIR="$bz" bash "$SCRIPT" 2>&1)"; rc=$?
check "rc" "0" "$rc"
check "1 sin cierre" "si" "$(printf '%s' "$out" | grep -qE '0 cerrables .+ 1 sin cierre declarado' && echo si || echo no)"
rm -rf "$bz"

echo "== 4. un a-todos CON CIERRA: en un cierre_ -> CERRABLE"
bz="$(nuevo_buzon)"; : > "$bz/abierto/$A_TODOS"
printf '**CIERRA:** `%s`\n' "$A_TODOS" > "$bz/cerrado/2000-01-01/2000-01-01_cierre_x-a-planificacion_z.md"
out="$(BUZON_DIR="$bz" bash "$SCRIPT" 2>&1)"; rc=$?
check "rc" "0" "$rc"
check "1 cerrable" "si" "$(printf '%s' "$out" | grep -qE '1 cerrables .+ 0 sin cierre declarado' && echo si || echo no)"
rm -rf "$bz"

echo "== 5. el CIERRA: en un dato_ (no en un cierre_) NO cuenta"
bz="$(nuevo_buzon)"; : > "$bz/abierto/$A_TODOS"
printf '**CIERRA:** `%s`\n' "$A_TODOS" > "$bz/abierto/2000-01-01_dato_x-a-planificacion_z.md"
out="$(BUZON_DIR="$bz" bash "$SCRIPT" --quiet 2>&1)"
check "sigue sin cierre" "si" "$(printf '%s' "$out" | grep -q '0 cerrables' && echo si || echo no)"
rm -rf "$bz"

echo "== 6. el CIERRA: escrito en el PROPIO a-todos NO se autocierra"
bz="$(nuevo_buzon)"
printf '**CIERRA:** `%s`\n' "$A_TODOS" > "$bz/abierto/$A_TODOS"
out="$(BUZON_DIR="$bz" bash "$SCRIPT" --quiet 2>&1)"
check "no se satisface con su propio cuerpo" "si" "$(printf '%s' "$out" | grep -q '0 cerrables' && echo si || echo no)"
rm -rf "$bz"

echo "== 7. LECTOR CIEGO -> exit 2, no un '0 sin cierre' tranquilizador"
sandbox="$(mktemp -d)"; mkdir -p "$sandbox/scripts/lib"
cp "$SCRIPT" "$sandbox/scripts/"
# lib ciega: misma API, siempre devuelve vacio. Es el equivalente del monkeypatch del canario.
cat > "$sandbox/scripts/lib/buzon-roles.sh" <<'LIBCIEGA'
BUZON_ROL_RE='[a-z0-9-]+'
destinatario_de_nombre() { printf ''; }
emisor_de_nombre() { printf ''; }
LIBCIEGA
bz="$(nuevo_buzon)"; : > "$bz/abierto/$A_TODOS"
BUZON_DIR="$bz" bash "$sandbox/scripts/a-todos-sin-cierre.sh" --quiet >/dev/null 2>&1
check "rc con lector ciego" "2" "$?"
rm -rf "$sandbox" "$bz"

echo "== 9. un cierre_/dato_/avance_ dirigido a TODOS informa: no pide cerrador ni entra a la lista"
# Lo cazó la primera corrida real: el `cierre_` que estrenaba la convención se listaba a sí mismo como
# «sin cierre declarado». Sólo las obligaciones (contrato|pedido|urgente|hallazgo) piden un cerrador.
bz="$(nuevo_buzon)"
: > "$bz/abierto/2000-01-01_cierre_planificacion-a-todos_informa-algo.md"
: > "$bz/abierto/2000-01-01_dato_planificacion-a-todos_informa-otra-cosa.md"
: > "$bz/abierto/2000-01-01_avance_planificacion-a-todos_y-otra-mas.md"
: > "$bz/abierto/$A_TODOS"   # el control positivo: la obligacion SI tiene que salir
out="$(BUZON_DIR="$bz" bash "$SCRIPT" --quiet 2>&1)"
check "los 3 informativos no entran, la obligacion si" "si" "$(printf '%s' "$out" | grep -qE '0 cerrables .+ 1 sin cierre declarado' && echo si || echo no)"
check "examino los 4 igual (el filtro no lo vuelve ciego)" "si" "$(printf '%s' "$out" | grep -q 'de 4 archivos examinados' && echo si || echo no)"
rm -rf "$bz"

echo "== 8. el corpus REAL: el rc es la medicion; si NO existe, el veredicto honesto es 2"
# ⚠️ ESTE CASO TENÍA DOS CEGUERAS, y la segunda se cobró el 2026-10-05.
#
# `coordinacion/` está GITIGNOREADA y vive UNA sola vez, en el checkout principal. En el runner de CI
# no existe, y ahí el `exit 2` («no pude medir») ES la respuesta correcta — no una falla del script.
# Exigir 0 fijo fabricaba un rojo de CI que no era un hallazgo, el mismo filo que `lint.sh:36-39` ya
# nombra para `contar-veredictos.py`. Eso ya estaba previsto acá, y sigue.
#
# 🔴 Lo que NO estaba previsto: el corpus PRESENTE y MUTANDO. Este caso comparaba **dos corridas
# consecutivas sobre el buzón VIVO**, que cuatro sesiones escriben en paralelo. Un archivo que nace
# entre las dos lecturas da `85` y `84`, y el test lo denuncia como «no es idempotente» — acusando al
# CÓDIGO de lo que hizo el CORPUS. Pasó con un `pedido_` mío (mtime 10:58:43) y puso en rojo el
# pre-push de un repo PÚBLICO, que es justo donde un falso rojo enseña el `--no-verify`, con gitleaks
# colgando del mismo hook. Diseñar con cuidado contra el riesgo temido (corpus ausente) dejó ciego el
# caso normal: el corpus está, y cambia mientras lo medís.
#
# El arreglo es separar las dos preguntas, porque son de naturaleza distinta: el `rc` sobre el corpus
# real es un dato de ESTADO —y es estable ante archivos nuevos, porque el script los reporta en vez
# de fallar—, mientras la IDEMPOTENCIA es una propiedad del CÓDIGO y se prueba sobre corpus
# congelado. Eso es el caso 8.bis.
real="$(bash "$SCRIPT" --quiet 2>&1)"; rc=$?
if [ "$rc" = "2" ]; then
  check "sin corpus real -> 2 y lo DICE (no un 0 tranquilizador)" "si" "$(printf '%s' "$real" | grep -q 'NO PUDE MEDIR' && echo si || echo no)"
  echo "  nota  corpus real ausente (el caso de CI): se midió el «no pude medir»"
else
  check "rc sobre el buzon real" "0" "$rc"
  check "el corpus real no lo deja mudo" "si" "$(printf '%s' "$real" | grep -q 'archivos examinados' && echo si || echo no)"
fi

echo "== 8.bis la IDEMPOTENCIA, sobre corpus CONGELADO (con el control que prueba que la comparacion ve)"
# Corpus sintético: obligaciones `a-todos` con y sin cerrador, informativos, y dirigidos a una sola
# sesión — nombres variados para que el orden de recorrido tenga de qué variar. Nada se copia del
# buzón real: `nuevo_buzon` lo fabrica en un temp, así que nadie puede escribirlo mientras se mide.
# Eso es lo único que hace válida la comparación de dos lecturas.
bz="$(nuevo_buzon)"
for n in hallazgo pedido contrato urgente; do
  : > "$bz/abierto/2000-01-01_${n}_planificacion-a-todos_congelado-${n}.md"
done
CONCIERRE="2000-01-01_pedido_planificacion-a-todos_congelado-con-cerrador.md"
: > "$bz/abierto/$CONCIERRE"
printf '**CIERRA:** `%s`\n' "$CONCIERRE" > "$bz/cerrado/2000-01-01/2000-01-01_cierre_backend-a-todos_cierra-el-de-arriba.md"
for n in cierre dato avance; do
  : > "$bz/abierto/2000-01-01_${n}_planificacion-a-todos_informa-${n}.md"
done
for s in backend frontend1 frontend2 auditoria; do
  : > "$bz/abierto/2000-01-01_pedido_planificacion-a-${s}_no-es-a-todos.md"
done
a="$(BUZON_DIR="$bz" bash "$SCRIPT" --quiet 2>&1)"
b="$(BUZON_DIR="$bz" bash "$SCRIPT" --quiet 2>&1)"
check "idempotente sobre corpus congelado" "$a" "$b"
check "y mirO los 12 (no es igual por no haber mirado nada)" "si" "$(printf '%s' "$a" | grep -q 'de 12 archivos examinados' && echo si || echo no)"
# CONTROL POSITIVO de la comparación: si un archivo nace entre dos lecturas, la salida CAMBIA. Es la
# causa exacta del falso rojo, ejercitada a propósito — y es lo que vuelve informativo al «iguales»
# de arriba. Sin este control, un script que imprimiera siempre lo mismo pasaría el caso 8.bis.
: > "$bz/abierto/2000-01-01_pedido_planificacion-a-todos_llego-mientras-media.md"
c="$(BUZON_DIR="$bz" bash "$SCRIPT" --quiet 2>&1)"
check "CONTROL: un archivo nuevo SI cambia la salida (por eso el buzon vivo no se compara)" "no" "$([ "$a" = "$c" ] && echo si || echo no)"
rm -rf "$bz"

echo
echo
if [ "$fallos" -eq 0 ]; then echo "TODOS OK (10 casos)"; exit 0
else echo "$fallos FALLA(S)"; exit 1; fi
