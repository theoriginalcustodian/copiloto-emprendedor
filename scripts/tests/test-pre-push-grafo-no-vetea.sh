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

ok()   { echo "  ✅ $1"; }
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
  printf '#!/usr/bin/env bash\necho "[stub] el reconcile borraría 218 objetos (tope absoluto 200)" >&2\nexit 1\n' \
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
    git push -q origin HEAD:main 2>/dev/null
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
  local dir="$1" log="$2"
  (
    cd "$dir/wt" || exit 1
    PATH="$dir:$PATH" GRAPHITY_BRIDGE_PATH="$dir/bridge" \
      git push origin HEAD:refs/heads/rama-de-prueba > "$log" 2>&1
  )
  echo $?
}

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
sed -E 's|^bash "\$\(git rev-parse --show-toplevel\)/scripts/graph-sync\.sh" \|\| GRAPH_RC=\$\?$|bash "$(git rev-parse --show-toplevel)/scripts/graph-sync.sh"|' \
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

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ 4/4 — el sync del grafo avisa pero no veta, y el control negativo lo acredita"
  exit 0
fi
echo "❌ $fallos control(es) en rojo"
exit 1
