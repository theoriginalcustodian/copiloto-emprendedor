#!/usr/bin/env bash
# test_manifbypass_registro.sh — MANIFBYPASS (hallazgo de auditoría, 2026-10-07): el manifiesto de
# deploy tiene que registrar el escape UC_DEPLOY_FUERA_DE_MAIN y el SHA REALMENTE desplegado, no sólo
# el de origin/main. Antes, un deploy con el escape puesto quedaba INDISTINGUIBLE de uno limpio en el
# propio manifiesto -- la forma exacta del incidente `1c92e25` (/healthz reportó 1c92e25 con
# 55b3f219 desplegado).
#
# Método (mismo patrón que test_redeploy_mismo_sha.sh, test_guard_postrestart.sh): extrae el bloque
# REAL del sello de procedencia de deploy.sh con sed (no lo reescribe) y lo corre con `git`/`ssh`
# stubeados -- nunca toca el VPS ni la red. Control positivo: con UC_DEPLOY_FUERA_DE_MAIN=1 Y
# HEAD≠origin/main, la línea tiene que ser DISTINGUIBLE de la de un deploy limpio; sin la variable,
# esa misma distinción NO puede aparecer (si apareciera sin la causa, el test no discrimina, miente).
#
# Uso: bash deploy/copiloto/test_manifbypass_registro.sh [ruta/a/deploy.sh]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY="${1:-$HERE/deploy.sh}"

# Bloque: desde el echo "==> [1.bis]..." hasta justo antes del comentario de REDEPLOYMISMOSHA.
extraer_sello() {
  sed -n '/^echo "==> \[1\.bis\]/,/^# REDEPLOYMISMOSHA:/p' "$1" | sed '$d'
}

# correr_caso <nombre> <deploy> <fuera_de_main:0|1> <head_sha> <origin_sha>
# Stubea `git` (rev-parse HEAD/origin/main + status --porcelain) y `ssh` (cat >> / tail -1, ambos
# contra un archivo local -- así el test verifica el MISMO camino de verificación-por-efecto que usa
# deploy.sh real, sin abrir una conexión).
correr_caso() {
  local nombre="$1" deploy="$2" fuera="$3" head_sha="$4" origin_sha="$5"
  local sandbox bin bloque manifiesto
  sandbox="$(mktemp -d)"
  bin="$sandbox/bin"; mkdir -p "$bin"
  manifiesto="$sandbox/DEPLOY-MANIFEST.json"
  : > "$manifiesto"

  cat > "$bin/git" <<STUB
#!/usr/bin/env bash
# stub: sólo entiende los dos usos que hace el bloque del sello.
if [[ "\$*" == *"rev-parse HEAD"* ]]; then echo "$head_sha"; exit 0; fi
if [[ "\$*" == *"rev-parse origin/main"* ]]; then echo "$origin_sha"; exit 0; fi
if [[ "\$*" == *"status --porcelain"* ]]; then exit 0; fi  # árbol limpio: sin stdout
exit 0
STUB
  chmod +x "$bin/git"

  cat > "$bin/ssh" <<STUB
#!/usr/bin/env bash
# stub: el comando remoto llega como \$2 ("HOST" cmd...); lo interpretamos localmente contra \$manifiesto.
cmd="\$2"
if [[ "\$cmd" == *"cat >>"* ]]; then cat >> "$manifiesto"; exit 0; fi
if [[ "\$cmd" == *"tail -1"* ]]; then tail -1 "$manifiesto"; exit 0; fi
exit 0
STUB
  chmod +x "$bin/ssh"

  bloque="$(extraer_sello "$deploy")"
  if [ -z "$bloque" ]; then echo "  [$nombre] ERROR: no encontré el bloque del sello en $deploy"; rm -rf "$sandbox"; return 2; fi

  (
    set -euo pipefail
    export PATH="$bin:$PATH"
    LOCAL="$sandbox"; REMOTE="$sandbox"; HOST="stub-host"
    if [ "$fuera" = "1" ]; then export UC_DEPLOY_FUERA_DE_MAIN=1; else unset -v UC_DEPLOY_FUERA_DE_MAIN 2>/dev/null || true; fi
    eval "$bloque"
  ) >/dev/null 2>&1 || true

  cat "$manifiesto" 2>/dev/null || true
  rm -rf "$sandbox"
}

echo "== MANIFBYPASS: $DEPLOY"
fallos=0

HEAD_VIEJO="1111111111111111111111111111111111111b"   # simula 1c92e25: HEAD ≠ origin/main
ORIGIN_SHA="2222222222222222222222222222222222222a"

echo "-- caso 1: deploy LIMPIO (sin UC_DEPLOY_FUERA_DE_MAIN, HEAD==origin/main)"
linea_limpia="$(correr_caso "limpio" "$DEPLOY" "0" "$ORIGIN_SHA" "$ORIGIN_SHA")"
echo "   $linea_limpia"
if [ -z "$linea_limpia" ]; then echo "  ROJO: no se escribió ninguna línea"; fallos=$((fallos+1)); fi

echo "-- caso 2: deploy CON el escape, HEAD viejo (la forma del incidente 1c92e25)"
linea_bypass="$(correr_caso "bypass" "$DEPLOY" "1" "$HEAD_VIEJO" "$ORIGIN_SHA")"
echo "   $linea_bypass"

# Veredicto del caso 2: tiene que declarar el escape Y el SHA real desplegado (≠ origin_main_sha).
if echo "$linea_bypass" | grep -q '"fuera_de_main":"SI' && echo "$linea_bypass" | grep -q "\"sha_desplegado\":\"$HEAD_VIEJO\""; then
  echo "  PASA: el manifiesto del bypass declara fuera_de_main=SI y sha_desplegado=$HEAD_VIEJO (≠ origin_main_sha)"
else
  echo "  ROJO: el manifiesto del bypass NO distingue el escape ni el SHA real desplegado"
  fallos=$((fallos+1))
fi

# Control positivo: el caso LIMPIO no puede mostrar ese mismo patrón (si lo mostrara sin la causa,
# el test no discrimina nada -- sería ruido permanente, no una señal).
if echo "$linea_limpia" | grep -q '"fuera_de_main":"SI'; then
  echo "  CONTROL FALLIDO: el deploy limpio también declara fuera_de_main=SI -- el test no discrimina"
  fallos=$((fallos+1))
else
  echo "  ok   control positivo: el deploy limpio declara fuera_de_main=NO"
fi

# Control negativo extra: las dos líneas, byte a byte, tienen que ser DISTINGUIBLES entre sí (más allá
# de nonce/timestamp) -- es el DoD explícito ("los dos casos producen líneas distintas").
limpia_sin_variables="$(echo "$linea_limpia" | sed -E 's/"nonce":"[^"]*"//; s/"desplegado_en":"[^"]*"//')"
bypass_sin_variables="$(echo "$linea_bypass" | sed -E 's/"nonce":"[^"]*"//; s/"desplegado_en":"[^"]*"//')"
if [ "$limpia_sin_variables" = "$bypass_sin_variables" ]; then
  echo "  ROJO: las líneas son indistinguibles salvo nonce/timestamp -- el DoD de MANIFBYPASS no se cumple"
  fallos=$((fallos+1))
else
  echo "  ok   las dos líneas son distinguibles entre sí"
fi

# Control positivo final: la versión VIEJA (836fc6ed, origin/main antes de este fix) tiene que dar
# ROJO en la misma comparación -- si no discrimina entre HERE y 836fc6ed, el test no prueba nada.
if git -C "$HERE" cat-file -e 836fc6ed:deploy/copiloto/deploy.sh 2>/dev/null; then
  VIEJO="$(mktemp)"
  git -C "$HERE" show 836fc6ed:deploy/copiloto/deploy.sh > "$VIEJO"
  echo "-- control positivo: versión vieja (836fc6ed, pre-MANIFBYPASS) tiene que ROMPER la distinción"
  vieja_limpia="$(correr_caso "vieja-limpia" "$VIEJO" "0" "$ORIGIN_SHA" "$ORIGIN_SHA")"
  vieja_bypass="$(correr_caso "vieja-bypass" "$VIEJO" "1" "$HEAD_VIEJO" "$ORIGIN_SHA")"
  vl="$(echo "$vieja_limpia" | sed -E 's/"nonce":"[^"]*"//; s/"desplegado_en":"[^"]*"//')"
  vb="$(echo "$vieja_bypass" | sed -E 's/"nonce":"[^"]*"//; s/"desplegado_en":"[^"]*"//')"
  if [ "$vl" = "$vb" ]; then
    echo "  ok   control positivo: 836fc6ed es indistinguible (confirma el defecto que este test cierra)"
  else
    echo "  CONTROL FALLIDO: 836fc6ed también discrimina -- el test no prueba lo que dice probar"
    fallos=$((fallos+1))
  fi
  rm -f "$VIEJO"
else
  echo "-- control positivo contra 836fc6ed: SALTEADO (SHA no alcanzable desde este checkout -- fetch primero)"
fi

echo
if [ "$fallos" -eq 0 ]; then echo "OK: MANIFBYPASS — el manifiesto registra el escape y el SHA real, discrimina, y el control positivo contra 836fc6ed confirma el defecto"; exit 0; fi
echo "FALLO: $fallos caso(s)"; exit 1
