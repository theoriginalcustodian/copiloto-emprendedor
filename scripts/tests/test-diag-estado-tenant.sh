#!/usr/bin/env bash
# Controles POSITIVOS de `scripts/diag/estado-tenant-prod.sh`.
#
# Por qué existe: ese script es sujeto de un permiso del harness, y todo lo que lo hace merecedor de
# ese permiso son guards que en el uso normal NUNCA se ven disparar. Un mecanismo roto hacia el «no»
# no da síntoma: el camino feliz sale verde con el guard presente o ausente. Acá se inyecta cada caso
# hostil a propósito y se exige que CORTE.
#
# Dos controles son específicos de este script y son los que más importan:
#   - §8 que el SQL no pueda nombrar `cert_enc`/`key_enc` — la credencial fiscal del emprendedor.
#   - §9 que el CONTROL de RLS siga en el reporte. Sin él, un `0` se lee como «no tiene ARCA» cuando
#     puede ser «RLS me lo ocultó», que es el falso negativo que motivó todo el diseño.
#
# ⚠️ LO QUE ESTE ARCHIVO **NO** PUEDE VERIFICAR, y costó 5 días
# -------------------------------------------------------------
# Ningún control de acá sale a la red: todos miden RECHAZOS (el guard corta) o el ARMADO (`--dry-run`
# imprime el fuente). Con ese corpus, el gemelo `contar-filas-prod.sh` tuvo 6 controles verdes desde
# el 2026-10-11 mientras era **incapaz de correr**: mandaba el SQL a un `psql` que no existe en el
# VPS (`exit 127`). El único control que lo habría visto es UNA corrida real contra el host — y ésa
# no se puede meter en CI, que no tiene la llave ni la red.
# Así que la regla queda escrita acá: **verde en este archivo no significa que el script funcione.**
# Significa que rechaza lo que debe y arma lo que dice. Que LLEGUE se acredita con una corrida, y la
# corrida se cita en el PR. §11 y §12 son lo más cerca que se puede estar sin salir a la red: que el
# mecanismo compruebe el binario antes de usarlo, y que el fuente parsee.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ORIGINAL="$RAIZ/scripts/diag/estado-tenant-prod.sh"
EMAIL_OK="e2e-device@copiloto.test"

# El mutante va en `scripts/` y no en /tmp: el script sourcea `../lib/db-prod.sh` relativo a su
# ubicación, así que una copia fuera del repo sale con exit 1 antes de llegar al guard — un falso
# rojo que acusaría al guard en vez de a la ruta. Desde `scripts/<tmp>/`, `../lib` resuelve bien.
TMP="$(mktemp -d "$RAIZ/scripts/.tmp-diag-XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

fallos=0
vistos=0
ok()   { echo "  ✅ $1"; vistos=$((vistos+1)); }
malo() { echo "  ❌ $1"; fallos=$((fallos+1)); vistos=$((vistos+1)); }

# Construye un mutante reemplazando una sola ocurrencia. Va por python y no por sed a propósito: un
# escape que pasa por una capa extra llega como byte invisible, y este repo ya lo pagó dos veces hoy
# (un `\b` que nunca matcheó, y un `'\''` que llegó como `'''` y colapsaba los literales del SQL).
mutar() {
  python -I - "$ORIGINAL" "$TMP/$1" "$2" "$3" <<'PY'
import io, sys
orig, dest, ancla, reemplazo = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
s = io.open(orig, encoding='utf-8').read()
assert ancla in s, 'el ancla no existe: el test quedo rancio respecto del script -> %r' % ancla
io.open(dest, 'w', encoding='utf-8', newline='\n').write(s.replace(ancla, reemplazo, 1))
PY
}

echo "== 1. el camino normal pasa (si esto falla, el resto no significa nada) =="
if bash "$ORIGINAL" --email "$EMAIL_OK" --dry-run >/dev/null 2>&1; then
  ok "--dry-run con un email válido sale 0"
else
  malo "--dry-run NO sale 0: el script está roto y el control no puede concluir nada"
fi

echo "== 2. el selector es OBLIGATORIO y EXCLUSIVO =="
for args in "" "--email a@b.com --cliente-id 48a9d75f-124b-4f9d-af8d-a73e2311bbbd"; do
  set +e; bash "$ORIGINAL" $args --dry-run >/dev/null 2>&1; codigo=$?; set -e
  [ "$codigo" = "2" ] && ok "'${args:-<sin selector>}' ⇒ exit 2" \
    || malo "'${args:-<sin selector>}' dio exit=$codigo"
done

echo "== 3. NEWLINE EMBEBIDO: el agujero que este test NO miraba =="
# Lo encontró una revisión de seguridad el 2026-10-16, sobre la v1 de este script — que ya pasaba
# los 19 controles de acá. El validador era `grep -qE '^…$'`, y grep evalúa **línea por línea**:
# sale 0 si ALGUNA línea matchea. Así, `$'a@b.com\n'"' or 1=1--"` pasaba con su primera línea y el
# payload entraba al SQL (reproducido: el dry-run emitía `' or 1=1--`, en los DOS selectores).
# Yo había probado nueve inyecciones y ninguna traía un newline: el control positivo cubrió la mitad
# que sospechaba y la otra quedó muda. Este caso es esa otra mitad.
for sel in "--email:a@b.com" "--cliente-id:48a9d75f-124b-4f9d-af8d-a73e2311bbbd"; do
  flag="${sel%%:*}"; base="${sel#*:}"
  payload="$base"$'\n'"' or 1=1--"
  set +e; out="$(bash "$ORIGINAL" "$flag" "$payload" --dry-run 2>&1)"; codigo=$?; set -e
  if [ "$codigo" = "2" ] && ! echo "$out" | grep -q "or 1=1"; then
    ok "$flag con newline embebido ⇒ exit 2 y el payload no llega al SQL"
  else
    malo "$flag con newline: exit=$codigo y el fuente emitido contiene el payload — INYECTABLE"
  fi
done
# Y el \r solo, que algunos validadores tratan distinto del \n.
set +e; out="$(bash "$ORIGINAL" --email "a@b.com"$'\r'"' or 1=1--" --dry-run 2>&1)"; codigo=$?; set -e
[ "$codigo" = "2" ] && ok "--email con retorno de carro ⇒ exit 2" \
  || malo "--email con retorno de carro: exit=$codigo"

echo "== 4. el selector NO se interpola en el SQL (es parámetro de libpq) =="
# La barrera que no depende de que el validador sea perfecto: el valor viaja como `sys.argv` y llega
# a `cur.execute(sql, params)` como parámetro. Si alguien vuelve a incrustarlo en la cadena, acá se
# cae — y ése es el punto: el control no mide el validador, mide que el valor nunca sea texto SQL.
fuente="$(bash "$ORIGINAL" --email "$EMAIL_OK" --dry-run 2>&1 | sed -n '/fuente python/,$p')"
if echo "$fuente" | grep -q "$EMAIL_OK"; then
  malo "el selector está INCRUSTADO en el fuente: volvió la clase entera de inyección"
else
  ok "el selector no aparece en ninguna línea del fuente"
fi
echo "$fuente" | grep -q "sys.argv\[1\]" && ok "el fuente toma el selector de sys.argv" \
  || malo "el fuente ya no lee sys.argv: el selector volvió a ser texto"

echo "== 5. ALLOWLIST del selector: lo hostil se RECHAZA, no se escapa =="
# Cada uno llega como UN solo argv (entre comillas). Sin las comillas el shell lo parte y el script
# rechaza por «argumento no reconocido» — un verde que NO prueba la allowlist, que es el control que
# acá importa.
for malote in "a@b.com' or 1=1--" "a@b.com; drop table x" 'a@b.com$(id)' "a@b.com'" "a@b.com or" "sin-arroba"; do
  set +e; bash "$ORIGINAL" --email "$malote" --dry-run >/dev/null 2>&1; codigo=$?; set -e
  [ "$codigo" = "2" ] && ok "email hostil rechazado: <$malote>" \
    || malo "email hostil ACEPTADO (exit=$codigo): <$malote>"
done
for malote in "no-es-uuid" "48a9d75f-124b-4f9d-af8d-a73e2311bbbd'" "../../etc/passwd"; do
  set +e; bash "$ORIGINAL" --cliente-id "$malote" --dry-run >/dev/null 2>&1; codigo=$?; set -e
  [ "$codigo" = "2" ] && ok "cliente-id hostil rechazado: <$malote>" \
    || malo "cliente-id hostil ACEPTADO (exit=$codigo): <$malote>"
done

echo "== 6. CONTROL POSITIVO del guard read-only: un verbo de escritura tiene que cortar (exit 3) =="
mutar "escritura.sh" "filas.append((tabla + ': filas', str(cur.fetchone()[0])))" \
  "cur.execute('delete from uc_factory.afip_credentials')"
if [ ! -s "$TMP/escritura.sh" ]; then
  malo "no pude construir el mutante: el control queda INVÁLIDO, no verde"
else
  set +e; bash "$TMP/escritura.sh" --email "$EMAIL_OK" --dry-run >/dev/null 2>&1; codigo=$?; set -e
  [ "$codigo" = "3" ] && ok "el guard read-only disparó (exit 3)" \
    || malo "el guard read-only NO disparó: exit=$codigo. El fuente hostil habría salido"
fi

echo "== 7. CONTROL POSITIVO del guard de host: una constante con forma de flag tiene que cortar =="
# `prod_py` ya pone `--` antes del host, pero el guard existe para cortar ANTES y con un mensaje
# propio. Un guard que nunca se vio disparar no se sabe si existe.
mutar "host-malo.sh" "readonly HOST='unreal-copilot'" "readonly HOST='-oProxyCommand=touch /tmp/pwned'"
set +e; salida="$(bash "$TMP/host-malo.sh" --email "$EMAIL_OK" 2>&1)"; codigo=$?; set -e
if [ "$codigo" = "2" ] && echo "$salida" | grep -q "host inválido"; then
  ok "el guard de host disparó (exit 2) antes de llamar a ssh"
else
  malo "el guard de host NO disparó: exit=$codigo. Salida: ${salida:0:160}"
fi

echo "== 8. el SQL NUNCA nombra la credencial fiscal (cert_enc / key_enc) =="
# Se mide sobre el fuente que el script REALMENTE emitiría, **descartando los comentarios**.
#
# La v1 de este control medía el fuente completo «porque es más estricto», y salió ROJO en falso: el
# fuente tiene un comentario que dice `# Nunca cert_enc ni key_enc, y el CUIT enmascarado`, y el
# grep lo contó como fuga. Es el espejo exacto de una lección que este repo ya tenía
# (`memoria/el-guard-se-satisface-con-su-propio-comentario.md`): allá el guard se APROBABA con su
# propio comentario, acá se CONDENA con él. En los dos casos la causa es la misma —el comentario que
# declara la protección es indistinguible del código que la viola— y el arreglo también: al medir
# código, descartar los comentarios. Un falso rojo acá es peor que incómodo: parece prudencia, y lo
# que invita es a sacar el comentario que declara la protección.
sql_codigo="$(bash "$ORIGINAL" --email "$EMAIL_OK" --dry-run 2>&1 | grep -vE '^[[:space:]]*#')"
sql="$(bash "$ORIGINAL" --email "$EMAIL_OK" --dry-run 2>&1)"
if echo "$sql_codigo" | grep -qE "cert_enc|key_enc"; then
  malo "el fuente emitido nombra cert_enc/key_enc: es la credencial del emprendedor"
else
  ok "el fuente emitido no nombra cert_enc ni key_enc"
fi
# Control de ceguera del chequeo de arriba: si el grep no viera nada nunca, este control sería
# decorativo. Se inyecta la columna a propósito y se exige que lo CACE.
mutar "fuga.sh" "right(cuit, 3)" "cert_enc"
sql_fuga="$(bash "$TMP/fuga.sh" --email "$EMAIL_OK" --dry-run 2>&1 | grep -vE '^[[:space:]]*#' || true)"
if echo "$sql_fuga" | grep -qE "cert_enc|key_enc"; then
  ok "el chequeo MIRA: con la columna inyectada, la detecta"
else
  malo "el chequeo está CIEGO: ni con cert_enc inyectado lo vio"
fi
# Y el CUIT va enmascarado, no completo.
echo "$sql" | grep -q "right(cuit, 3)" && ok "el CUIT se emite enmascarado (right(cuit,3))" \
  || malo "el CUIT ya no está enmascarado"

echo "== 9. el CONTROL de RLS sigue en el reporte (sin él, un 0 miente) =="
# Sin declarar el tenant, la policy `cliente_id = current_cliente_id()` no matchea y el count da 0
# — indistinguible de «no tiene ARCA». El reporte abre contando SIN declarar tenant justamente para
# que ese riesgo quede visible. Si alguien poda ese fragmento, el falso negativo vuelve en silencio.
if echo "$sql" | grep -q "CONTROL RLS"; then
  ok "el control de RLS se emite"
else
  malo "el control de RLS NO se emite: un 0 del reporte vuelve a ser ambiguo"
fi
if echo "$sql" | grep -q "current_cliente_id()"; then
  ok "el reporte filtra por current_cliente_id() (cinturón además de RLS)"
else
  malo "el reporte ya no filtra explícitamente por tenant: si RLS no aplica, cuenta de TODOS"
fi
# Y el control ADVERSARIAL, que es el que exige la regla dura del repo (ADR-013 / BOLA): el de
# arriba, sin claim, sólo prueba el fail-closed —la mitad fácil, que sale verde igual si la tabla
# está vacía—. El adversarial cuenta SIN filtro con el claim ya declarado y compara: si ve más de
# las propias, hay fuga cross-tenant. Si alguien lo poda, el aislamiento vuelve a ser una
# afirmación. Corrido el 2026-10-16 con dato real ajeno existiendo: el canónico tiene 1 credencial
# ARCA y con el claim del operador el total visible es 0.
if echo "$sql" | grep -q "FUGA CROSS-TENANT"; then
  ok "el control adversarial de aislamiento sigue en el reporte"
else
  malo "el control adversarial NO está: el aislamiento queda afirmado y no ejercitado"
fi

echo "== 10. la sesión remota abre en SÓLO-LECTURA del lado del motor =="
# `default_transaction_read_only=on` es la barrera que no depende de enumerar verbos: el guard de
# §6 es un grep y sólo caza lo que lista, mientras que esto lo rechaza Postgres aunque el grep no lo
# haya visto. Vive en el preámbulo de la lib, así que se mide sobre el fuente emitido.
echo "$sql" | grep -q "default_transaction_read_only=on" \
  && ok "el fuente abre la conexión read-only del lado del motor" \
  || malo "falta default_transaction_read_only: el read-only queda sólo en el grep de verbos"
# Y el valor llega por argv, quoteado, no concatenado al fuente. Se mide sobre el comando que
# `prod_py` armaría, con un ssh falso que lo captura.
cmd_remoto="$(
  cd "$RAIZ" && source scripts/lib/db-prod.sh
  ssh() { printf '%s' "${@: -1}"; }
  prod_py "unreal-copilot" "uc-copiloto-web.service" "print(1)" "sel-x" "uuid"
)"
echo "$cmd_remoto" | grep -q -- "'sel-x' 'uuid'" \
  && ok "el selector viaja como argv del intérprete, no como texto del fuente" \
  || malo "el argv no llegó al comando remoto: el selector volvería a interpolarse"

echo "== 11. el mecanismo COMPRUEBA el binario antes de usarlo (lo que faltó 5 días) =="
# El gemelo mandaba el SQL a `psql`, que no existe en el VPS: el shell remoto respondía
# `command not found` con exit 127 — un código que no es ninguno de los del contrato (2/3/4) y que
# ningún control de armado podía ver. Hoy el intérprete sale del `ExecStart` de la unidad y se
# verifica con `-x` ANTES de ejecutarlo, así que un intérprete ausente da exit 4 con mensaje propio
# en vez de un 127 anónimo. Ese es el control que convierte «no se puede correr» en algo legible.
echo "$cmd_remoto" | grep -q 'systemctl show -p ExecStart' \
  && ok "el intérprete se deriva del ExecStart de la unidad (no está hardcodeado)" \
  || malo "el intérprete volvió a ser un literal: si el venv se mueve, 127 otra vez"
echo "$cmd_remoto" | grep -q '\[ ! -x "\$PY" \]' \
  && ok "comprueba que el intérprete sea ejecutable antes de usarlo (exit 4, no 127)" \
  || malo "no comprueba el binario: un ausente vuelve a dar 127, fuera del contrato de exits"

echo "== 12. el fuente que se envía PARSEA como Python =="
# Un fuente con un error de sintaxis no da un fallo del mecanismo: da un SyntaxError del otro lado,
# después de abrir la conexión. Compilarlo acá lo convierte en un rojo local y barato.
printf '%s\n' "$sql" | sed -n '/fuente python/,$p' | tail -n +2 > "$TMP/fuente.py"
if python -I -c "import io,sys; compile(io.open(sys.argv[1],encoding='utf-8').read(),'f','exec')" "$TMP/fuente.py" 2>/dev/null; then
  ok "el fuente python emitido compila"
else
  malo "el fuente python emitido NO compila: fallaría en el remoto, ya conectado"
fi

echo
echo "--- CONTROL: $vistos control(es) ejercitados ---"
if [ "$vistos" -lt 29 ]; then
  echo "ROJO: sólo $vistos controles corrieron; esperaba ≥29. Un control que no mira nunca falla."
  exit 1
fi
if [ "$fallos" = "0" ]; then
  echo "VERDE: $vistos/$vistos — los guards se vieron disparar, no se asumieron."
  echo "       (y verde acá NO prueba que el script llegue al host: eso lo acredita una corrida)"
  exit 0
fi
echo "ROJO: $fallos de $vistos control(es) fallaron."
exit 1
