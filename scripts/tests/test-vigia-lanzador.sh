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
# la lista se DERIVA del case de vigia.sh; copiarla la haría envejecer en silencio
mapfile -t permitidos < <(sed -n '/case "\$INSTRUMENTO" in/,/^  \*)/p' "$VIGIA" \
  | grep -oE '[a-z0-9-]+\.sh' | sort -u)
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
    if grep -qE "bash +(\")?scripts/$i" "$f"; then
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
  rm -f "$TMP/pinreal/.git"
  UC_VIGIA_PIN="$TMP/pinreal" UC_VIGIA_REF=HEAD bash "$R/scripts/vigia.sh" cola-check.sh >/dev/null 2>"$TMP/e7b"
  if grep -q 'DEGRADADO' "$TMP/e7b"; then ok "pin roto ⇒ DEGRADADO (no lo usa a ciegas)"
  else bad "pin roto y NO avisó: usaría un árbol que contesta por OTRO sujeto"; fi
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

printf '\n  %s corridos · %s fallados\n' "$corridos" "$fallos"
[ "$fallos" = "0" ] || exit 1
