#!/usr/bin/env bash
# Control POSITIVO del guard read-only de `scripts/evidencia/contar-filas-prod.sh`.
#
# Por qué existe: un mecanismo roto hacia el «no» no da síntoma. El guard de ese script podría estar
# desarmado (un grep mal escrito, un `-E` perdido) y nadie lo notaría, porque en el uso normal el SQL
# nunca contiene verbos de escritura: el camino feliz sale verde con el guard presente o ausente.
# Esto inyecta el caso hostil a propósito y exige que CORTE.
#
# ⚠️ Y LO QUE ESTE ARCHIVO NO VIO DURANTE 5 DÍAS
# ----------------------------------------------
# Sus 6 controles estuvieron verdes desde el 2026-10-11 mientras el script era **incapaz de correr**:
# mandaba el SQL a un `psql` que no existe en el VPS (`exit 127`). Los 6 medían RECHAZOS y ARMADO, y
# ninguno salía a la red — que es el único lugar donde se ve un binario ausente. No fue un control
# mal escrito: fue un corpus completo en una dimensión y vacío en la otra.
# **Verde acá no significa que el script funcione**, significa que rechaza lo que debe. Que LLEGUE lo
# acredita una corrida real, que no puede vivir en CI (sin llave ni red) y por eso se cita en el PR.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ORIGINAL="$RAIZ/scripts/evidencia/contar-filas-prod.sh"
# El mutante se escribe DENTRO de `scripts/` y no en /tmp: desde el 2026-10-16 el script sourcea
# `scripts/lib/db-prod.sh` relativo a su propia ubicación, así que una copia en /tmp no resuelve
# `../lib` y sale con exit 1 ANTES de llegar al guard. Va en `scripts/` y no en `scripts/evidencia/`
# porque el mutante queda un nivel más abajo: desde un subdirectorio de `evidencia/`, `../lib` apunta
# a `evidencia/lib`, que no existe. Eso daba dos controles en rojo que no acusaban al guard sino a la
# ruta: un falso rojo que parece prudencia. El trap lo borra.
TMP="$(mktemp -d "$RAIZ/scripts/.tmp-test-XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

fallos=0
vistos=0
ok()   { echo "  ✅ $1"; vistos=$((vistos+1)); }
malo() { echo "  ❌ $1"; fallos=$((fallos+1)); vistos=$((vistos+1)); }

echo "== 1. el camino normal pasa (si esto falla, el resto no significa nada) =="
if bash "$ORIGINAL" --dry-run >/dev/null 2>&1; then
  ok "--dry-run sale 0"
else
  malo "--dry-run NO sale 0: el script está roto, el control no puede concluir nada"
fi

echo "== 2. CONTROL POSITIVO: con un verbo de escritura inyectado, tiene que cortar con exit 3 =="
# Se inyecta en el manifiesto `CONTEOS`, que es la única superficie de cambio legítima: simula
# exactamente la edición futura descuidada contra la que el guard protege. Va por python y no por
# sed/heredoc a propósito: un escape que pasa por una capa extra llega como byte invisible, y eso ya
# se pagó (un `\b` que llegó al disco como \x08 y dejó un gate rojo contra un texto correcto).
python -I - "$ORIGINAL" "$TMP/inyectado.sh" <<'PY'
import io, sys
orig, dest = sys.argv[1], sys.argv[2]
s = io.open(orig, encoding='utf-8').read()
ancla = "    ('gastos', 'copiloto_gastos', None, None),"
assert ancla in s, 'el ancla de inyeccion no existe: el test quedo rancio respecto del script'
hostil = "    ('hostil', 'copiloto_cobros', 'x', None),\n"
hostil += "# delete from copiloto_cobros\n"
s = s.replace(ancla, hostil + ancla, 1)
io.open(dest, 'w', encoding='utf-8', newline='\n').write(s)
PY

if [ ! -s "$TMP/inyectado.sh" ]; then
  malo "no pude construir el mutante: el control queda INVÁLIDO, no verde"
else
  set +e
  salida="$(bash "$TMP/inyectado.sh" --dry-run 2>&1)"
  codigo=$?
  set -e
  if [ "$codigo" = "3" ]; then
    ok "el guard disparó (exit 3)"
  else
    malo "el guard NO disparó: exit=$codigo. El fuente hostil habría salido. Salida: ${salida:0:200}"
  fi
fi

echo "== 3. argumentos libres rechazados (exit 2) =="
set +e
bash "$ORIGINAL" --lo-que-sea >/dev/null 2>&1
codigo=$?
set -e
[ "$codigo" = "2" ] && ok "argumento desconocido ⇒ exit 2" || malo "argumento desconocido dio exit=$codigo"

echo "== 4. el destino NO se puede pasar por argumento (regresión de seguridad) =="
# La v1 aceptaba `--host`, y con el patrón de permiso `...contar-filas-prod.sh:*` eso convertía
# «contar filas en nuestra instancia» en «SSH a cualquier destino». Si alguien lo reintroduce, acá
# se cae. Dos formas de pedirlo, las dos tienen que ser rechazadas.
for intento in "--host" "--host=otro-host"; do
  set +e
  bash "$ORIGINAL" "$intento" otro-host >/dev/null 2>&1
  codigo=$?
  set -e
  [ "$codigo" = "2" ] && ok "'$intento' rechazado (exit 2)" \
    || malo "'$intento' dio exit=$codigo: el destino volvió a ser parametrizable"
done

echo "== 5. CONTROL POSITIVO del guard de host: una constante con forma de flag tiene que cortar =="
# `ssh -o… -- "$HOST"` ya neutraliza esto, pero el guard existe para cortar ANTES y con un mensaje
# propio si alguien edita mal la constante. Un guard que nunca se vio disparar no se sabe si existe.
python -I - "$ORIGINAL" "$TMP/host-malo.sh" <<'PY'
import io, sys
orig, dest = sys.argv[1], sys.argv[2]
s = io.open(orig, encoding='utf-8').read()
ancla = "readonly HOST='unreal-copilot'"
assert ancla in s, 'el ancla del host no existe: el test quedo rancio respecto del script'
s = s.replace(ancla, "readonly HOST='-oProxyCommand=touch /tmp/pwned'", 1)
io.open(dest, 'w', encoding='utf-8', newline='\n').write(s)
PY
set +e
salida="$(bash "$TMP/host-malo.sh" 2>&1)"
codigo=$?
set -e
if [ "$codigo" = "2" ] && echo "$salida" | grep -q "host inválido"; then
  ok "el guard de host disparó (exit 2) antes de llamar a ssh"
else
  malo "el guard de host NO disparó: exit=$codigo. Salida: ${salida:0:200}"
fi

echo "== 6. el fuente que se envía PARSEA como Python =="
# Un fuente con error de sintaxis no falla en el mecanismo: falla del otro lado, ya conectado.
bash "$ORIGINAL" --dry-run 2>&1 | sed -n '/fuente python/,$p' | tail -n +2 > "$TMP/fuente.py"
if python -I -c "import io,sys; compile(io.open(sys.argv[1],encoding='utf-8').read(),'f','exec')" "$TMP/fuente.py" 2>/dev/null; then
  ok "el fuente python emitido compila"
else
  malo "el fuente python emitido NO compila: fallaría en el remoto, ya conectado"
fi

echo "== 7. el reporte DICE si RLS limita los números (sin eso, un 0 pasa por evidencia) =="
# El rol de la conexión es `uc_factory` y NO tiene BYPASSRLS (medido 2026-10-16), así que sin tenant
# declarado estos conteos dan 0 por fail-closed. Un script de EVIDENCIA que devuelve 0 sin decirlo
# contesta «el defecto es latente, no urge» — la conclusión cómoda, que es justo la sospechosa.
# Si alguien poda estas dos piezas, el 0 vuelve a parecer un dato.
fuente="$(cat "$TMP/fuente.py")"
echo "$fuente" | grep -q "rolbypassrls" \
  && ok "el reporte consulta si el rol bypasea RLS" \
  || malo "ya no pregunta por rolbypassrls: un 0 por fail-closed vuelve a leerse como tabla vacía"
echo "$fuente" | grep -q "RLS activo" \
  && ok "marca las tablas donde el número está sujeto a la policy" \
  || malo "ya no marca [RLS activo]: el lector no puede saber qué números están limitados"

echo
echo "--- CONTROL: $vistos control(es) ejercitados ---"
if [ "$vistos" -lt 8 ]; then
  echo "ROJO: sólo $vistos controles corrieron; esperaba ≥8. Un control que no mira nunca falla."
  exit 1
fi
if [ "$fallos" = "0" ]; then
  echo "VERDE: $vistos/$vistos — los guards se vieron disparar, no se asumieron."
  echo "       (y verde acá NO prueba que el script llegue al host: eso lo acredita una corrida)"
  exit 0
fi
echo "ROJO: $fallos de $vistos control(es) fallaron."
exit 1
