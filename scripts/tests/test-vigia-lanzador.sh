#!/usr/bin/env bash
# test-vigia-lanzador.sh — ejercita `scripts/vigia.sh`.
#
# La propiedad que se prueba no es «corre algo»: es **corre la copia del PIN y NUNCA la del
# working tree del que lo invocan**. Es hermético: `UC_VIGIA_PIN` evita red y git, así que el test
# no depende del estado de `origin/main`.
#
# El caso 6 es el que impide que el fix se podrezca: deriva la lista de instrumentos del `case` de
# `vigia.sh` en vez de copiarla, y verifica que ningún comando de monitoreo invoque un instrumento
# con path relativo. Forma tomada de `test-lint-controles-deploy-cableados.sh` (auditoría,
# 2026-10-08): una lista copiada envejece en silencio; una lista derivada no puede.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VIGIA="$ROOT/scripts/vigia.sh"
fallos=0; corridos=0
ok()   { corridos=$((corridos+1)); printf '  ✅ %s\n' "$1"; }
bad()  { corridos=$((corridos+1)); fallos=$((fallos+1)); printf '  ❌ %s\n' "$1"; }

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
PIN="$TMP/pin"; LOCAL="$TMP/local"
mkdir -p "$PIN/scripts" "$LOCAL/scripts"
# el pin imprime una marca; la copia LOCAL imprime otra. Si alguna vez sale la local, el defecto
# volvió.
cat > "$PIN/scripts/cola-check.sh"   <<'EOS'
#!/usr/bin/env bash
echo "MARCA-DEL-PIN args=[$*]"
exit 0
EOS
cat > "$LOCAL/scripts/cola-check.sh" <<'EOS'
#!/usr/bin/env bash
echo "MARCA-LOCAL-NO-DEBE-SALIR"
exit 0
EOS
cat > "$PIN/scripts/deuda-check.sh" <<'EOS'
#!/usr/bin/env bash
exit 7
EOS
cp "$VIGIA" "$LOCAL/scripts/vigia.sh"

echo "— 1) POSITIVO: ejecuta la copia del PIN, no la del working tree"
out="$(UC_VIGIA_NO_REFRESH=1 UC_VIGIA_PIN="$PIN" bash "$LOCAL/scripts/vigia.sh" cola-check.sh 2>/dev/null)"
if printf '%s' "$out" | grep -q 'MARCA-DEL-PIN'; then ok "corrió la del pin"; else bad "no corrió la del pin: [$out]"; fi
# CONTROL que hace significativo al caso 5: con el pin sano, stderr tiene que estar VACÍO.
# Sin esto, un banner emitido SIEMPRE haría pasar el caso 5 aunque su condición no se diera.
UC_VIGIA_NO_REFRESH=1 UC_VIGIA_PIN="$PIN" bash "$LOCAL/scripts/vigia.sh" cola-check.sh >/dev/null 2>"$TMP/err0"
if [ ! -s "$TMP/err0" ]; then ok "CONTROL: pin sano ⇒ stderr vacío (el banner discrimina)"
else bad "CONTROL: emite banner con el pin sano ⇒ el caso 5 no prueba nada: [$(cat "$TMP/err0")]"; fi
if printf '%s' "$out" | grep -q 'MARCA-LOCAL'; then bad "CORRIÓ LA LOCAL — el defecto volvió"; else ok "no corrió la local"; fi

echo "— 2) los argumentos pasan tal cual"
out="$(UC_VIGIA_NO_REFRESH=1 UC_VIGIA_PIN="$PIN" bash "$LOCAL/scripts/vigia.sh" cola-check.sh --quiet --raro=1 2>/dev/null)"
if printf '%s' "$out" | grep -qF 'args=[--quiet --raro=1]'; then ok "argumentos intactos"; else bad "argumentos perdidos: [$out]"; fi

echo "— 3) el rc del instrumento se propaga (es lo que leen los crones)"
UC_VIGIA_NO_REFRESH=1 UC_VIGIA_PIN="$PIN" bash "$LOCAL/scripts/vigia.sh" deuda-check.sh >/dev/null 2>&1; rc=$?
if [ "$rc" = "7" ]; then ok "rc=7 propagado"; else bad "rc esperado 7, vino $rc"; fi

echo "— 4) WHITELIST: rechaza lo que no está en la lista y no ejecuta NADA"
printf '#!/usr/bin/env bash\necho EJECUTE-LO-PROHIBIDO\n' > "$TMP/evil.sh"
for mal in "../evil.sh" "../../evil.sh" "evil.sh" ""; do
  out="$(UC_VIGIA_NO_REFRESH=1 UC_VIGIA_PIN="$PIN" bash "$LOCAL/scripts/vigia.sh" "$mal" 2>&1)"; rc=$?
  if [ "$rc" = "2" ] && ! printf '%s' "$out" | grep -q 'EJECUTE-LO-PROHIBIDO'; then
    ok "rechazado: '${mal:-<vacío>}' (rc=2, nada ejecutado)"
  else bad "NO rechazó '${mal:-<vacío>}' (rc=$rc)"; fi
done
# CANARIO del caso 4: con la whitelist funcionando, un nombre permitido SÍ pasa. Sin esto, un
# `exit 2` incondicional haría pasar los cuatro de arriba.
out="$(UC_VIGIA_NO_REFRESH=1 UC_VIGIA_PIN="$PIN" bash "$LOCAL/scripts/vigia.sh" cola-check.sh 2>/dev/null)"
if printf '%s' "$out" | grep -q 'MARCA-DEL-PIN'; then ok "CANARIO: el permitido sigue pasando"; else bad "CANARIO: rechaza TODO, la whitelist no discrimina"; fi

echo "— 5) DEGRADADO: sin el script en el pin cae al working tree, pero GRITA"
out="$(UC_VIGIA_NO_REFRESH=1 UC_VIGIA_PIN="$TMP/pin-vacio" bash "$LOCAL/scripts/vigia.sh" cola-check.sh 2>"$TMP/err")"
err="$(cat "$TMP/err")"
if printf '%s' "$out" | grep -q 'MARCA-LOCAL'; then ok "corrió la local (único camino disponible)"; else bad "no corrió nada: [$out]"; fi
if printf '%s' "$err" | grep -q 'DEGRADADO'; then ok "avisó DEGRADADO en stderr"; else bad "cayó al working tree EN SILENCIO — ése es el defecto"; fi
if printf '%s' "$err" | grep -qF 'NO es un pase'; then ok "dice que no es un pase"; else bad "no declara que no es un pase"; fi

echo "— 6) COMPLETITUD: ningún comando de monitoreo invoca un instrumento con path RELATIVO"
# la lista se DERIVA del case de vigia.sh; copiarla la haría envejecer en silencio.
# El patrón caza `.sh|.py`: hasta el 2026-10-15 sólo cazaba `.sh`, así que
# `medir-mapeo-implementacion.py` habría entrado a la whitelist SIN que este control de completitud
# lo mirara nunca -- un instrumento que ningún gate caza por estar del lado equivocado del patrón
# (`nada-cazaba-al-mal-clasificado-solo-al-no-clasificado`).
mapfile -t permitidos < <(sed -n '/case "\$INSTRUMENTO" in/,/^  \*)/p' "$VIGIA" \
  | grep -oE '[a-z0-9-]+\.(sh|py)' | sort -u)
if [ "${#permitidos[@]}" -ge 5 ]; then ok "derivé ${#permitidos[@]} instrumentos del case de vigia.sh"
else bad "CEGUERA: derivé ${#permitidos[@]} instrumentos — el parseo del case se rompió"; fi
cmds=0; malos=0; convigia=0; usan=0
for f in "$ROOT"/.claude/commands/monitoreo*.md; do
  [ -e "$f" ] || continue
  cmds=$((cmds+1))
  _usa=0
  for i in "${permitidos[@]}"; do grep -qF "$i" "$f" && _usa=1; done
  [ "$_usa" = "1" ] && usan=$((usan+1))
  if [ "$_usa" = "1" ] && grep -q 'vigia\.sh' "$f"; then convigia=$((convigia+1)); fi
  for i in "${permitidos[@]}"; do
    if grep -qE "(bash|python3?) +(\")?scripts/(evidencia/)?$i" "$f"; then
      printf '      ↳ %s invoca %s con path relativo\n' "$(basename "$f")" "$i"
      malos=$((malos+1))
    fi
  done
done
if [ "$cmds" -ge 3 ]; then ok "CONTROL DE CEGUERA: revisé $cmds comandos de monitoreo"
else bad "CEGUERA: revisé $cmds comandos — el glob no encontró nada"; fi
if [ "$malos" = "0" ]; then ok "0 invocaciones relativas"; else bad "$malos invocaciones relativas: corren la versión del cwd"; fi
# Un comando que NO corre instrumentos no necesita nombrar vigia.sh: exigirselo forzaria una
# mención decorativa. La aserción es sobre los que SÍ los corren.
if [ "$usan" = "0" ]; then bad "CEGUERA: 0 comandos nombran un instrumento"
elif [ "$convigia" -ge "$usan" ]; then ok "los $usan comandos que corren instrumentos pasan por vigia.sh"
else bad "$(( usan - convigia )) de $usan comandos corren instrumentos SIN vigia.sh"; fi

echo "— 6.bis) vigia.sh se vigila a sí mismo: está entre las piezas del guard de versión"
if grep -q 'scripts/vigia.sh' "$ROOT/scripts/vigilancia-check.sh"; then ok "declarado en PIEZAS_INSTRUMENTO"
else bad "vigia.sh NO está en PIEZAS_INSTRUMENTO — el lanzador puede envejecer sin que nadie avise"; fi

echo "— 7) PIN ROTO: una carpeta que ya no es worktree NO se usa a ciegas"
# Por qué importa: si el podador le hace un `worktree remove` parcial (en Windows falla sobre un
# junction de node_modules y DESREGISTRA igual), queda la carpeta sin registro. Ahí `git -C` no
# falla: camina hacia arriba y contesta por el checkout principal — el instrumento respondería
# sobre OTRO sujeto. Este caso usa un repo real, no un fixture, porque la propiedad es de git.
R="$TMP/repo"; mkdir -p "$R/scripts"
( cd "$R" && git init -q . && git config user.email t@t && git config user.name t \
  && printf '#!/usr/bin/env bash\necho DEL-PIN-REAL\n' > scripts/cola-check.sh \
  && git add scripts/cola-check.sh && git commit -qm base ) >/dev/null 2>&1
if [ -d "$R/.git" ]; then
  cp "$VIGIA" "$R/scripts/vigia.sh"
  git -C "$R" worktree add --detach "$TMP/pinreal" HEAD >/dev/null 2>&1
  # CONTROL POSITIVO primero: con el pin real y SANO no hay banner. Sin este control, el caso de
  # abajo pasaría igual aunque el banner se emitiera siempre.
  UC_VIGIA_PIN="$TMP/pinreal" UC_VIGIA_REF=HEAD bash "$R/scripts/vigia.sh" cola-check.sh >/dev/null 2>"$TMP/e7a"
  if [ ! -s "$TMP/e7a" ]; then ok "CONTROL: pin real y sano ⇒ sin banner"
  else bad "CONTROL: el pin sano ya emite banner ⇒ el caso de abajo no prueba nada: [$(cat "$TMP/e7a")]"; fi
  # ahora lo rompo como lo rompe una poda parcial: le saco el archivo .git
  #
  # 🔴 ESTA ASERCION CAMBIO EL 2026-10-13, y el motivo importa: antes exigia el BANNER
  # (`grep DEGRADADO`), que es exactamente lo que el DEFECTO producia. `vigia.sh` traia un
  # `\n` LITERAL en la rama de recuperacion (PR #953), asi que le pasaba un argumento de
  # mas a `git worktree add` y la recuperacion fallaba SIEMPRE -> banner siempre -> este caso
  # verde. Un test que afirma el sintoma del bug no puede cazar el bug.
  # La propiedad correcta es la RECUPERACION: pin roto => se recrea y el instrumento sale
  # DEL PIN. (Medido: `worktree add` plano y `--force` fallan sobre un dir existente; lo unico
  # que recupera es sacar la carcasa del camino.)
  rm -f "$TMP/pinreal/.git"
  UC_VIGIA_PIN="$TMP/pinreal" UC_VIGIA_REF=HEAD bash "$R/scripts/vigia.sh" cola-check.sh >"$TMP/o7b" 2>"$TMP/e7b"
  if [ -e "$TMP/pinreal/.git" ] && grep -q 'DEL-PIN-REAL' "$TMP/o7b"; then
    ok "pin roto ⇒ RECUPERADO y corriendo del pin"
  else
    bad "pin roto y NO recuperado (.git=$([ -e "$TMP/pinreal/.git" ] && echo si || echo no), salida=[$(head -c 60 "$TMP/o7b")]) — quedaria degradado para siempre"
  fi

  # 7c) la OTRA mitad: cuando la recuperacion es IMPOSIBLE, el banner sigue siendo obligatorio.
  # Carcasa CON `.git` (ilegible) y toplevel que no coincide: la guarda se niega a borrarla, asi
  # que no hay forma de recrear el worktree y lo unico correcto es avisar. Sin este caso, el fix
  # de arriba podria haber matado el banner por completo y nadie se enteraria.
  mkdir -p "$TMP/pinfalso" && printf 'gitdir: /ruta/que/no/existe
' > "$TMP/pinfalso/.git"
  UC_VIGIA_PIN="$TMP/pinfalso" UC_VIGIA_REF=HEAD bash "$R/scripts/vigia.sh" cola-check.sh >/dev/null 2>"$TMP/e7c"
  if grep -q 'DEGRADADO' "$TMP/e7c"; then ok "pin irrecuperable ⇒ DEGRADADO (el banner no se perdio)"
  else bad "pin irrecuperable y NO aviso: el fix de la recuperacion se llevo el banner"; fi
else
  bad "no pude armar el repo temporal del caso 7 (git init falló)"
fi

echo "— 8) el podador NO poda los pines (si no: poda ⇒ huérfano ⇒ monitoreo degradado)"
POD="$ROOT/scripts/podar-worktrees.sh"
if [ -f "$POD" ]; then
  if grep -qF '_vigia-pins' "$POD"; then ok "guarda presente en podar-worktrees.sh"
  else bad "el podador no excluye _vigia-pins: un pin limpio y detached pasa sus 3 guardas"; fi
  if [ "$(wc -l < "$POD")" -gt 50 ]; then ok "CONTROL DE CEGUERA: el podador tiene $(wc -l < "$POD") líneas"
  else bad "CEGUERA: el podador parece vacío"; fi
else
  bad "no encontré podar-worktrees.sh"
fi

echo "— 9) COPIA VIEJA del lanzador: su whitelist NO decide (re-exec desde el pin)"
# Por que existe: el docstring de vigia.sh afirmaba que "una copia vieja de ESTE archivo hace lo
# mismo que la nueva". Era FALSO y lo levanto FRONTEND2 el 2026-10-13: la whitelist es POLITICA y
# vivia en el lanzador, asi que las copias de /c/gfw-src/_*-vigia rechazaban `mi-buzon.sh` con
# rc 2 aunque el instrumento existiera en el pin. Medido ese dia: 5 de 6 pines atrasados y solo
# 1 con el instrumento. El fix no es agrandar la whitelist (eso fue el parche de la manana): es
# que el lanzador delegue en el del pin ANTES de decidir nada.
P9="$TMP/pin9"; L9="$TMP/local9"
mkdir -p "$P9/scripts" "$L9/scripts"
cp "$VIGIA" "$P9/scripts/vigia.sh"
{ echo "#!/usr/bin/env bash"; echo "echo MARCA-DEL-PIN9"; } > "$P9/scripts/mi-buzon.sh"
# la copia VIEJA: misma base, pero sin `mi-buzon.sh` en su whitelist
# 🔴 ESTE SED SE ROMPIO UNA VEZ, y el control de al lado no lo vio. Hardcodeaba
# `^  mi-buzon.sh) ;;`; cuando `ci-verde.sh` entro a la whitelist la linea paso a ser
# `  mi-buzon.sh|ci-verde.sh) ;;`, el sed dejo de matchear y fabrico CERO cambios -- mientras su
# control (`grep -q "mi-buzon.sh) ;;"`) daba NO ENCONTRADO y concluia «fabricada». Un control
# cuya condicion de exito es «el literal desaparecio» acredita por igual «lo saque yo» y «alguien
# renombro la linea». Ahora el patron tolera la alternancia Y el control exige las DOS cosas:
# que la copia DIFIERA del original y que el instrumento ya no este en su case.
sed -E "s/^([[:space:]]*)mi-buzon[.]sh([|][^)]*)?[)] ;;/\1no-existe-xx.sh) ;;/" "$VIGIA" > "$L9/scripts/vigia.sh"
if cmp -s "$L9/scripts/vigia.sh" "$VIGIA" || grep -qE '^[[:space:]]*mi-buzon[.]sh([|][^)]*)?[)] ;;' "$L9/scripts/vigia.sh"; then
  bad "CONTROL: no pude fabricar la copia vieja (el sed no saco mi-buzon.sh del case)"
else
  ok "CONTROL: copia vieja fabricada (su whitelist NO tiene mi-buzon.sh)"
  # CONTROL NEGATIVO primero: sin pin, la copia vieja TIENE que rechazar con rc 2. Sin esto, el
  # caso de abajo pasaria igual si el rechazo nunca existiera.
  UC_VIGIA_PIN="$TMP/nada-aqui" UC_VIGIA_NO_REFRESH=1 UC_VIGIA_REF=HEAD bash "$L9/scripts/vigia.sh" mi-buzon.sh >/dev/null 2>&1; rc9a=$?
  if [ "$rc9a" = "2" ]; then ok "CONTROL NEGATIVO: sin pin, la copia vieja rechaza (rc 2)"
  else bad "CONTROL NEGATIVO roto: sin pin dio rc $rc9a (esperaba 2)"; fi
  # y con el pin al dia, la whitelist vieja NO decide: corre el instrumento del pin.
  out9="$(UC_VIGIA_PIN="$P9" UC_VIGIA_NO_REFRESH=1 UC_VIGIA_REF=HEAD bash "$L9/scripts/vigia.sh" mi-buzon.sh 2>/dev/null)"; rc9b=$?
  if [ "$rc9b" = "0" ] && [ "$out9" = "MARCA-DEL-PIN9" ]; then
    ok "copia vieja + pin al dia => corre el instrumento del PIN (su whitelist no decidio)"
  else
    bad "la whitelist VIEJA decidio: rc=$rc9b salida=[$out9] -- el lanzador sigue envejeciendo"
  fi
fi


echo "- 10) ci-verde.sh pasa la whitelist, y gate.sh sigue RECHAZADO aunque exista en el pin"
# POR QUE EXISTE. El 2026-10-13 el broadcast decia «todo instrumento va por el lanzador», y el
# lanzador RECHAZABA `ci-verde.sh` -- justo el que autoriza merges, y el mas atrasado del checkout
# compartido (71 lineas contra 422 en main). La receta era incumplible para el instrumento mas
# consecuente. Pero la leccion NO es «agrandar la whitelist»: entra lo que NO mira el arbol,
# porque el lanzador no hace `cd` y el CWD se hereda del llamador.
#
# El segundo control es el que importa, porque separa las DOS causas de un rc 2: `gate.sh` se
# fabrica EN EL PIN y tiene que seguir rechazado. Sin esa linea, un rc 2 por «no lo encontre» es
# indistinguible de uno por «no esta permitido», y el dia que alguien lo agregue por simetria este
# caso seguiria verde mientras el gate mide main en vez de tu rama.
P10="$TMP/pin10"; mkdir -p "$P10/scripts"
cp "$VIGIA" "$P10/scripts/vigia.sh"
{ echo "#!/usr/bin/env bash"; echo "echo MARCA-CIVERDE args=[\$*]"; } > "$P10/scripts/ci-verde.sh"
{ echo "#!/usr/bin/env bash"; echo "echo MARCA-GATE-NO-DEBE-SALIR"; } > "$P10/scripts/gate.sh"
out10="$(UC_VIGIA_PIN="$P10" UC_VIGIA_NO_REFRESH=1 UC_VIGIA_REF=HEAD bash "$VIGIA" ci-verde.sh 1054 2>/dev/null)"; rc10=$?
if [ "$rc10" = "0" ] && [ "$out10" = "MARCA-CIVERDE args=[1054]" ]; then
  ok "ci-verde.sh pasa la whitelist y recibe sus argumentos"
else
  bad "ci-verde.sh no paso: rc=$rc10 salida=[$out10]"
fi
out10b="$(UC_VIGIA_PIN="$P10" UC_VIGIA_NO_REFRESH=1 UC_VIGIA_REF=HEAD bash "$VIGIA" gate.sh 2>&1)"; rc10b=$?
if [ "$rc10b" = "2" ] && ! printf "%s" "$out10b" | grep -q "MARCA-GATE-NO-DEBE-SALIR"; then
  ok "CONTROL: gate.sh existe en el pin y sigue rechazado (rc 2) -- deriva su ROOT del script y mediria main"
else
  bad "gate.sh se ejecuto o no dio rc 2: rc=$rc10b salida=[$out10b] -- un gate que mide el arbol equivocado sale VERDE"
fi
if grep -q "NO lo agregues por simetria" "$VIGIA"; then
  ok "el motivo de la exclusion de gate.sh vive en el propio case, no solo en un commit"
else
  bad "se perdio el comentario que explica por que gate.sh no entra -- el proximo lo agrega"
fi

echo "— 11) un instrumento .py de un SUBDIRECTORIO sale del PIN y se corre con python"
# Por que existe: `medir-mapeo-implementacion.py` vive en `scripts/evidencia/` (no en `scripts/`) y
# el lanzador resolvia UN solo nivel, asi que lo rechazaba con rc 2 -- y por eso nadie lo corria por
# aca, aunque su propio docstring declaraba estar habilitado. El 2026-10-15 esa habilitacion escrita
# y nunca ejecutada se pago: corrido desde el checkout compartido midio 44/54 con 0 pendientes (la
# clasificacion previa a #1218) cuando main daba 46/54 con 8.
# Ademas el `exec` era `bash` fijo: un `.py` lanzado con bash muere con un error de SINTAXIS, que no
# se parece a «elegi mal el interprete» y manda a arreglar el instrumento, que no esta roto.
# El fixture usa sintaxis que SOLO corre en python (`import`), asi que este caso prueba las DOS
# cosas juntas: que se encontro en el subdirectorio Y que el interprete se eligio por extension.
mkdir -p "$PIN/scripts/evidencia" "$LOCAL/scripts/evidencia"
cat > "$PIN/scripts/evidencia/medir-mapeo-implementacion.py" <<'EOP'
import sys
print("MARCA-PY-DEL-PIN args=%s" % (sys.argv[1:],))
EOP
cat > "$LOCAL/scripts/evidencia/medir-mapeo-implementacion.py" <<'EOP'
print("MARCA-PY-LOCAL-NO-DEBE-SALIR")
EOP
out11="$(UC_VIGIA_NO_REFRESH=1 UC_VIGIA_PIN="$PIN" bash "$LOCAL/scripts/vigia.sh" \
  medir-mapeo-implementacion.py --base x 2>/dev/null)"; rc11=$?
if [ "$rc11" = "0" ] && printf '%s' "$out11" | grep -q 'MARCA-PY-DEL-PIN'; then
  ok "el .py de scripts/evidencia/ corrio desde el pin, con python"
else
  bad "no corrio el .py del pin: rc=$rc11 salida=[$out11]"
fi
if printf '%s' "$out11" | grep -qF "args=['--base', 'x']"; then
  ok "los argumentos llegan tal cual al .py"
else
  bad "los argumentos no llegaron al .py: [$out11]"
fi
if printf '%s' "$out11" | grep -q 'MARCA-PY-LOCAL'; then
  bad "salio la copia LOCAL del .py: el subdirectorio se resolvio contra el working tree"
else
  ok "CONTROL: no salio la copia local del .py"
fi
# CONTROL DE CEGUERA del caso: sin el .py en el pin tiene que DEGRADAR y gritar, no fallar mudo.
# Sin esto, un rechazo incondicional (o un exit 0 mudo) haria pasar los tres de arriba.
rm -f "$PIN/scripts/evidencia/medir-mapeo-implementacion.py"
UC_VIGIA_NO_REFRESH=1 UC_VIGIA_PIN="$PIN" bash "$LOCAL/scripts/vigia.sh" \
  medir-mapeo-implementacion.py >"$TMP/o11b" 2>"$TMP/e11b"
if grep -q 'DEGRADADO' "$TMP/e11b" && grep -q 'MARCA-PY-LOCAL' "$TMP/o11b"; then
  ok "CONTROL DE CEGUERA: sin el .py en el pin cae al working tree y GRITA"
else
  bad "sin el .py en el pin no degrado con aviso: err=[$(cat "$TMP/e11b")] out=[$(cat "$TMP/o11b")]"
fi


printf '\n  %s corridos · %s fallados\n' "$corridos" "$fallos"
[ "$fallos" = "0" ] || exit 1
