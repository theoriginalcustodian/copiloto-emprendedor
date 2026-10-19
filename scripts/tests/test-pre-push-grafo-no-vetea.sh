#!/usr/bin/env bash
# Control de que el sync del grafo NO tiene veto sobre el push.
#
# Por qué existe (medido 2026-10-14): `.githooks/pre-push` corre con `set -euo pipefail` e invocaba
# `scripts/graph-sync.sh` SIN `||`, así que cualquier rc≠0 del sync se llevaba el push puesto — y el
# manejo cuidadoso de más abajo (el chequeo del marcador, que YA degrada a warning sin abortar)
# nunca se alcanzaba. Pasó 3 veces (221 objetos el 31-07, 1406 el 30-09, 218 el 14-10), siempre por
# una re-poda LEGÍTIMA que supera el tope absoluto de 200 del reconcile (`differ.py:27`), y el 14-10
# dejó a tres sesiones sin poder pushear. Un sistema AUXILIAR —la memoria del código— no puede
# vetar el trabajo de quien no lo tocó.
#
# Mide el EFECTO, no la forma: no grepea el hook buscando `|| true`, monta un repo de verdad con un
# `graph-sync.sh` que falla y PUSHEA. Un grep se satisface con un comentario; un push no.
#
# 2026-10-19 — el sync pasó a SEGUNDO PLANO. Se agregan los dos controles de ese contrato:
#   3 (POSITIVO)  push con un sync lento (8 s)                        =>  el push NO lo espera
#   4 (NEGATIVO)  la variante que hereda las fds del hook, derivada   =>  el push SÍ lo espera
#   + el fallo de la corrida en background lo AVISA el push siguiente (no queda mudo).
# Los casos 1 y 2 pasan a medir el modo foreground (UC_GRAPH_SYNC_FOREGROUND=1), que se conserva.
#
# Las DOS mitades, porque un mecanismo roto hacia el "no" no da síntoma (si el push pasara siempre
# —por ejemplo porque el hook sale antes de llegar al sync— el caso positivo sería verde igual y no
# probaría nada):
#   1 (POSITIVO)  el pre-push del repo        + sync que falla  =>  el push PASA
#   2 (NEGATIVO)  la variante vieja, derivada  + sync que falla  =>  el push ABORTA
# La variante vieja se deriva del propio archivo con sed, no se escribe a mano: así el control no
# puede quedar midiendo un "antes" que ya no se parece al que hubo.
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$RAIZ/.githooks/pre-push"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fallos=0
oks=0   # el total lo CUENTA el test: un «N/N» escrito a mano ya dijo 15 sobre 14 (2026-10-19)

ok()   { echo "  ✅ $1"; oks=$((oks + 1)); }
malo() { echo "  ❌ $1"; fallos=$((fallos + 1)); }

[ -f "$HOOK" ] || { echo "❌ no encuentro $HOOK"; exit 1; }

# Monta un repo con remote propio, el hook bajo prueba y TODO lo que el hook invoca stubeado.
# Los stubs salen 0 salvo graph-sync.sh, que es la variable del experimento.
montar() {
  local dir="$1" hook_src="$2"
  local bare="$dir/remote.git" wt="$dir/wt"
  git init -q --bare "$bare"
  git init -q "$wt"
  mkdir -p "$wt/scripts/ci" "$wt/.githooks" "$dir/bridge/.bridge"

  # El hook exige que el bridge exista y que `uv` esté en el PATH; ninguno de los dos se usa en
  # este camino, pero si faltan sale ANTES del sync y el test mediría otra cosa.
  printf '#!/usr/bin/env bash\nexit 0\n' > "$dir/uv"
  chmod +x "$dir/uv"

  printf '#!/usr/bin/env bash\nexit 0\n' > "$wt/scripts/secretos-check.sh"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$wt/scripts/ci/atribucion.sh"
  # LA VARIABLE: el sync falla, como cuando el reconcile supera el tope absoluto.
  printf '#!/usr/bin/env bash\nsleep "${STUB_SLEEP:-0}"\necho "[stub] el reconcile borraría 218 objetos (tope absoluto 200)" >&2\nexit 1\n' \
    > "$wt/scripts/graph-sync.sh"
  chmod +x "$wt/scripts/secretos-check.sh" "$wt/scripts/ci/atribucion.sh" "$wt/scripts/graph-sync.sh"

  cp "$hook_src" "$wt/.githooks/pre-push"
  chmod +x "$wt/.githooks/pre-push"

  (
    cd "$wt" || exit 1
    git config core.hooksPath .githooks
    git config user.email t@t.t
    git config user.name t
    git remote add origin "$bare"
    echo uno > a.txt
    git add a.txt
    git commit -q -m "base"
    # `main` en el remote y el marcador del bridge en otro sha: así el atajo "ya sincronizado"
    # no aplica y el hook SÍ llega a llamar al sync. Sin esto el hook saldría 0 por el atajo y
    # los dos casos darían verde — el control negativo es justo lo que detecta ese escenario.
    git push -q --no-verify origin HEAD:main 2>/dev/null
    echo 0000000000000000000000000000000000000000 \
      > "$dir/bridge/.bridge/last-synced-copiloto-emprendedor.sha"
    echo dos > b.txt
    git add b.txt
    git commit -q -m "el commit que se pushea"
  )
}

# Pushea y devuelve el rc. El PATH lleva el `uv` falso adelante; GRAPHITY_BRIDGE_PATH apunta al
# bridge falso. La salida completa va a un archivo: pipearla por `tail` borraría la evidencia.
pushear() {
  local dir="$1" log="$2" rama="${3:-rama-de-prueba}"
  (
    cd "$dir/wt" || exit 1
    PATH="$dir:$PATH" GRAPHITY_BRIDGE_PATH="$dir/bridge" \
      git push origin "HEAD:refs/heads/$rama" 2>&1 | cat > "$log"
  )
  echo $?
}
# Por qué el `| cat` y no `> "$log"` (medido 2026-10-19): git sólo espera al PROCESO del hook, no a
# sus fds. Con la salida a un archivo, un hijo en background que las herede no retiene a nadie y el
# caso 4 salía verde-por-ciego (1 s heredando las fds). Lo que sí retiene es un PIPE: el lector
# espera el EOF hasta que el último escritor suelte el fd. Y pipear `git push` es lo normal en los
# agentes de este repo (`git push 2>&1 | tail`), así que es el caso que hay que medir.
# `pipefail` (arriba) hace que el rc sea el de git, no el de `cat`.
_seg() { local t="${EPOCHREALTIME//[.,]/}"; echo $(( t / 1000000 )); }
# Espera a que la corrida en background deje su rc (o se rinde a los 60 s y lo dice).
esperar_bg() {
  local rcf="$1/bridge/.bridge/graph-sync-bg-copiloto-emprendedor.rc" i=0
  while [ "$i" -lt 120 ]; do
    if [ -f "$rcf" ] && ! grep -q '^en-curso' "$rcf"; then return 0; fi
    sleep 0.5; i=$((i + 1))
  done
  return 1
}

export UC_GRAPH_SYNC_FOREGROUND=1
echo "== 1 (POSITIVO) el pre-push del repo + graph-sync.sh que falla => el push PASA =="
d1="$TMP/caso1"
mkdir -p "$d1"
montar "$d1" "$HOOK"
rc1="$(pushear "$d1" "$d1/push.log")"
if [ "$rc1" -eq 0 ]; then
  ok "el push entró con el sync en rc=1 (el grafo es auxiliar, no tiene veto)"
else
  malo "el push abortó (rc=$rc1) por un fallo del sync — el grafo sigue vetando:"
  sed 's/^/     | /' "$d1/push.log"
fi
# El aviso no puede ser MUDO: un fallo degradado a warning que nadie ve es peor que el abort,
# porque nadie lo persigue y el grafo se queda viejo en silencio.
if grep -q "graph-sync.sh salió rc=" "$d1/push.log"; then
  ok "avisó el rc del sync"
else
  malo "el push pasó pero NO avisó del rc: warning mudo, nadie va a destrabar el grafo"
fi
if grep -q "destrabar-grafo-force" "$d1/push.log"; then
  ok "nombró el comando de destrabe"
else
  malo "no dijo CÓMO destrabarlo: el aviso sin acción no mueve a nadie"
fi

echo "== 2 (NEGATIVO) la variante vieja + el mismo sync que falla => el push ABORTA =="
# Se deriva del hook real: se le quita la captura del rc, que es exactamente lo que había antes.
viejo="$TMP/pre-push-viejo"
sed -E 's|^([[:space:]]*)bash "\$GRAPH_SYNC" \|\| GRAPH_RC=\$\?$|\1bash "$GRAPH_SYNC"|' \
  "$HOOK" > "$viejo"
if diff -q "$HOOK" "$viejo" >/dev/null; then
  malo "el sed no cambió nada: no pude derivar la variante vieja, así que este control NO corrió"
  malo "  (revisá si la línea del sync en $HOOK cambió de forma)"
else
  d2="$TMP/caso2"
  mkdir -p "$d2"
  montar "$d2" "$viejo"
  rc2="$(pushear "$d2" "$d2/push.log")"
  if [ "$rc2" -ne 0 ]; then
    ok "la variante vieja SÍ aborta (rc=$rc2) — el caso 1 está midiendo el fix, no un atajo del hook"
  else
    malo "la variante vieja también dejó pasar el push: el caso 1 no prueba nada."
    malo "  El hook está saliendo antes de llamar al sync; este test no mide lo que dice medir."
    sed 's/^/     | /' "$d2/push.log"
  fi
fi

unset UC_GRAPH_SYNC_FOREGROUND
export STUB_SLEEP=8

echo "== 3 (POSITIVO) background + sync lento (8 s) que falla => el push NO lo espera =="
d3="$TMP/caso3"
mkdir -p "$d3"
montar "$d3" "$HOOK"
t0="$(_seg)"
rc3="$(pushear "$d3" "$d3/push.log")"
dur3=$(( $(_seg) - t0 ))
if [ "$rc3" -eq 0 ] && [ "$dur3" -lt "$STUB_SLEEP" ]; then
  ok "el push entró en ${dur3}s sin esperar al sync de ${STUB_SLEEP}s"
else
  malo "rc=$rc3 en ${dur3}s — el push esperó al sync (o falló):"
  sed 's/^/     | /' "$d3/push.log"
fi
grep -q "No such file" "$d3/push.log" && malo "el primer push (sin .rc previo) imprimió «No such file»"   || ok "sin .rc previo el push no hace ruido"
grep -q "lanzado en segundo plano" "$d3/push.log" && ok "dijo que lo lanzó en background"   || malo "no anunció el lanzamiento: el push quedaría mudo sobre el sync"
if esperar_bg "$d3"; then
  ok "la corrida en background terminó y dejó su rc ($(cut -d' ' -f1 "$d3/bridge/.bridge/graph-sync-bg-copiloto-emprendedor.rc"))"
else
  malo "la corrida en background no dejó rc en 60 s: el resultado no llega a nadie"
fi
# El fallo de ESA corrida lo tiene que avisar el push SIGUIENTE: si no, un fallo en background es
# un warning mudo, que es peor que el abort.
( cd "$d3/wt" && echo tres > c.txt && git add c.txt && git commit -q -m "segundo push" )
STUB_SLEEP=0 pushear "$d3" "$d3/push2.log" rama-2 >/dev/null
if grep -q "graph-sync.sh salió rc=1" "$d3/push2.log" && grep -q "destrabar-grafo-force" "$d3/push2.log"; then
  ok "el push siguiente avisó el rc=1 de la corrida anterior, con el destrabe"
else
  malo "el push siguiente NO avisó el fallo de la corrida en background:"
  sed 's/^/     | /' "$d3/push2.log"
fi
esperar_bg "$d3" || true

echo "== 4 (NEGATIVO) la variante que hereda las fds del hook => el push SÍ espera =="
# Se deriva del hook real quitándole la redirección de las fds del nohup: así se mide que el caso 3
# depende de esa redirección, y no de que el hook salga antes de lanzar nada.
heredado="$TMP/pre-push-hereda-fds"
sed -E 's|^(.*) > "\$LOG_BG" 2>&1 < /dev/null &$|\1 \&|' "$HOOK" > "$heredado"
if diff -q "$HOOK" "$heredado" >/dev/null; then
  malo "el sed no cambió nada: no pude derivar la variante que hereda fds, este control NO corrió"
else
  d4="$TMP/caso4"
  mkdir -p "$d4"
  montar "$d4" "$heredado"
  t0="$(_seg)"
  pushear "$d4" "$d4/push.log" >/dev/null
  dur4=$(( $(_seg) - t0 ))
  if [ "$dur4" -ge "$STUB_SLEEP" ]; then
    ok "heredando las fds el push esperó ${dur4}s — el caso 3 mide la redirección, no un atajo"
  else
    malo "heredando las fds el push tardó ${dur4}s (< ${STUB_SLEEP}s): el caso 3 no prueba nada"
  fi
  esperar_bg "$d4" || true
fi

echo "== 5 (POSITIVO) push con un sync VIVO => no relanza, y el rc final es el de la corrida real =="
# Medido 2026-10-19 en el primer push real: el push de borrado de una rama lanzó una 2ª corrida que
# escribió rc=0 (contención) sobre el en-curso de la real y le truncó el .log.
correr_caso5() {
  local d="$1" hook="$2"
  mkdir -p "$d"
  montar "$d" "$hook"
  pushear "$d" "$d/push1.log" >/dev/null
  ( cd "$d/wt" && echo cinco > e.txt && git add e.txt && git commit -q -m "push con sync vivo" )
  pushear "$d" "$d/push2.log" rama-5 >/dev/null
}
d5="$TMP/caso5"
correr_caso5 "$d5" "$HOOK"
rcf5="$d5/bridge/.bridge/graph-sync-bg-copiloto-emprendedor.rc"
grep -q "no relanzo" "$d5/push2.log" && ok "el 2º push vio el sync vivo y no relanzó" \
  || { malo "el 2º push relanzó con un sync vivo:"; sed 's/^/     | /' "$d5/push2.log"; }
esperar_bg "$d5" || true
[ "$(cut -d' ' -f1 "$rcf5" 2>/dev/null)" = "1" ] && ok "el .rc final es el de la corrida real (1), no un 0 de contención" \
  || malo "el .rc final es '$(cat "$rcf5" 2>/dev/null)', no el rc=1 de la corrida real"
[ "$(grep -c '\[stub\]' "$d5/bridge/.bridge/graph-sync-bg-copiloto-emprendedor.log" 2>/dev/null)" = "1" ] \
  && ok "el .log de la corrida real quedó entero (una sola salida del stub)" \
  || malo "el .log no tiene exactamente una salida del stub: otra corrida lo pisó"

echo "== 6 (NEGATIVO) la variante SIN la guarda de corrida viva => SÍ relanza =="
singuarda="$TMP/pre-push-sin-guarda"
sed -E 's|&& kill -0 "\$_pid_prev" 2>/dev/null; then$|\&\& false; then|' "$HOOK" > "$singuarda"
if diff -q "$HOOK" "$singuarda" >/dev/null; then
  malo "el sed no cambió nada: no pude derivar la variante sin guarda, este control NO corrió"
else
  d6="$TMP/caso6"
  correr_caso5 "$d6" "$singuarda"
  grep -q "lanzado en segundo plano" "$d6/push2.log" \
    && ok "sin la guarda el 2º push relanza — el caso 5 mide la guarda, no un atajo" \
    || malo "sin la guarda el 2º push tampoco relanzó: el caso 5 no prueba nada"
  esperar_bg "$d6" || true
  sleep 9   # la 1ª corrida de este caso puede seguir viva: que no escriba en un $TMP ya borrado
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ ${oks}/${oks} — el sync no veta, no bloquea el push, avisa su fallo, no se relanza sobre sí mismo, y los controles negativos lo acreditan"
  exit 0
fi
echo "❌ $fallos de $((oks + fallos)) control(es) en rojo"
exit 1
