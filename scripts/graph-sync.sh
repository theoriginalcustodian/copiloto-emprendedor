#!/usr/bin/env bash
# scripts/graph-sync.sh — sync VERIFICADO del grafo de código, SIEMPRE desde origin/main.
# Camino ÚNICO de invocación: .githooks/pre-push llama a ESTE script (no duplica `uv run bridge`
# inline), así el hook, el uso manual y cualquier agente en background heredan la misma verificación.
#
# Por qué un worktree dedicado y no este checkout (decisión del operador, 2026-07-31):
# graphify parsea el WORKING TREE EN DISCO y sella `valid_at` con la fecha de HEAD. El checkout de
# trabajo lo comparten 3 sesiones y vive en una rama — llegó a estar 111 commits detrás de main, así
# que el grafo quedaba con contenido de hoy y fecha de hace 4 días, y podía contener código que no
# estaba en ninguna rama. Clavando un árbol en origin/main, contenido y fecha salen del MISMO ref.
#
# El grafo es el modelo que la app tiene de sí misma y lo consume el ciclo de autosanación: si
# describe otra cosa que la desplegada, el sanador razona sobre código que no falló. Para el backend
# —lo que el sanador parchea— main EQUIVALE a prod, porque el gate de drift de `deploy.sh` aborta si
# `apps/copiloto` o `motor` difieren de origin/main.
#
# Por qué además "verificado" (evidencia 2026-07-24, tasks/b12f3vc5e.output): un sync reportó
# `exit 0` con `GraphityError: timeout` adentro. Causa raíz: en algún caller, un pipe
# (`cmd | tail`) devolvía el status de `tail`, no el del sync real — un instrumento así no
# falla, CONFIRMA (da permiso para seguir aunque el grafo haya quedado desactualizado).
# Esta envoltura cierra las 3 capas del gancho:
#   1. captura el status del comando REAL vía PIPESTATUS (no el de un pipe intermedio);
#   2. grepea su propia salida buscando patrones de error conocidos aunque el status sea 0
#      (defensa en profundidad: cubre también un futuro caller que trague el exit code, o
#      un cambio del CLI que empiece a atrapar GraphityError y devuelva 0 por error);
#   3. cierra con un control positivo automático (graphity_positive_control.py): busca en
#      Graphity un símbolo del commit recién sincronizado y falla ruidoso si no aparece —
#      la única de las tres capas que prueba que el dato llegó al servidor, no solo que el
#      proceso local no explotó.
#
# Uso:
#   bash scripts/graph-sync.sh                  # actualiza el worktree a origin/main y sincroniza (completo)
#   bash scripts/graph-sync.sh --since <ref>     # incremental desde <ref> (lo usa el pre-push hook)
#   UC_GRAPH_FORCE=1 bash scripts/graph-sync.sh  # además saltea el tope del reconcile (ver abajo)
#
# Antes de usar UC_GRAPH_FORCE=1, correr el dry-run y MIRAR la lista:
#   cd "$BRIDGE" && uv run python <repo>/scripts/graphity_dry_run_reconcile.py \
#       --config config/repos.toml --repo copiloto-emprendedor
# `--force` sin haber mirado es un borrado a ciegas: el guard del reconcile existe justamente para
# frenar eso, y ya cazó una anomalía real (221 objetos, 2026-07-31).
#
# Nota: sin -e a propósito — necesitamos leer PIPESTATUS y decidir nosotros, no abortar en
# la línea del pipe antes de poder inspeccionar qué pasó.
set -uo pipefail

# Git EXPORTA GIT_DIR/GIT_WORK_TREE/GIT_INDEX_FILE a los hooks, y esas variables GANAN sobre `-C`:
# `-C "$WT"` cambia el cwd, no qué repositorio abre git cuando el entorno ya se lo dice. Sin este
# unset, cada `git -C "$WT" …` de este script corre sobre el repo de QUIEN PUSHEA (el que disparó el
# hook), no sobre el worktree del grafo — la guarda de la rama abortaba con la rama de quien pushea
# (falso positivo del 100%, siempre que el script se use de verdad, vía hook), y si no hubiera
# abortado, `reset --hard`/`clean -fd` habrían borrado cambios sin commitear ajenos. Medido 2026-08-06.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE

BRIDGE="${GRAPHITY_BRIDGE_PATH:-C:/Proyectos/Claude/Claude code/graphify-graphity-bridge}"
REPO_NAME="${GRAPHITY_REPO_NAME:-copiloto-emprendedor}"
CKPT=".bridge/checkpoint-${REPO_NAME}.db"
# El default dejó de ser `C:/gfw-src/copiloto-main` el 2026-08-19: alguien levantó ahí el Metro del
# dev-client (`expo start --dev-client`, PID vivo escuchando :8081) y este script le hacía
# `reset --hard` + `clean -fd` + `checkout --detach` DEBAJO en cada push. Metro veía desaparecer los
# archivos a mitad del fast-refresh y el teléfono quedaba en «Failed to compile: None of these files
# exist: src\modules\chat\BotonVoz…». Rompía en CADA push de CUALQUIER sesión, en silencio del lado
# de git. El worktree del grafo tiene que ser exclusivo de este script — se muda el destructivo, no
# el pasivo. Si no existe, se crea solo más abajo (`worktree add --detach`).
WT="${UC_GRAPH_WORKTREE:-C:/gfw-src/copiloto-grafo}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POSITIVE_CONTROL="$SCRIPT_DIR/graphity_positive_control.py"

SINCE=""
if [ "${1:-}" = "--since" ]; then
  SINCE="${2:-}"
  if [ -z "$SINCE" ]; then
    echo "[graph-sync] ❌ --since requiere un ref git." >&2
    exit 2
  fi
fi

if [ ! -d "$BRIDGE" ]; then
  echo "[graph-sync] ❌ no encuentro el bridge en '$BRIDGE' — seteá GRAPHITY_BRIDGE_PATH." >&2
  exit 1
fi
if ! command -v uv >/dev/null 2>&1; then
  echo "[graph-sync] ❌ 'uv' no está en el PATH." >&2
  exit 1
fi

# BITÁCORA (2026-09-22): este script no dejaba NINGÚN rastro en disco. Cuando el marcador no avanza
# hay al menos cuatro causas con remedios distintos —contención con otro sync, drift de config, fallo
# de verificación, control positivo rojo— y desde afuera las cuatro se ven igual: el marcador viejo.
# El día que el bridge quedó apuntando a un árbol inexistente, discriminar «está trabajando» de
# «falló» sólo se pudo porque el proceso seguía vivo y se lo agarró en el acto; media hora más tarde
# habría sido indistinguible. Dos causas y un solo síntoma es el patrón que este repo ya paga caro.
BITACORA="${UC_GRAPH_LOG:-$BRIDGE/.bridge/graph-sync.log}"
MOTIVO="salida-inesperada"
registrar_sync() {
  local rc="${1:-$?}"
  mkdir -p "$(dirname "$BITACORA")" 2>/dev/null || return "$rc"
  printf '%s pid=%s rc=%s motivo=%s wt=%s marcador=%s origin_main=%s
'     "$(date '+%Y-%m-%dT%H:%M:%S')" "$$" "$rc" "$MOTIVO" "$WT"     "$(cut -c1-12 "$BRIDGE/.bridge/last-synced-${REPO_NAME}.sha" 2>/dev/null || echo '-')"     "$(git -C "$REPO" rev-parse --short=12 origin/main 2>/dev/null || echo '-')"     >> "$BITACORA" 2>/dev/null || true
  return "$rc"
}
trap registrar_sync EXIT

# Guarda dura 4 (2026-09-22): ESTE script escribe `$WT` y el bridge LEE el `path` de su repos.toml.
# Son dos configs independientes del MISMO árbol, y nada verificaba que coincidieran. El 2026-08-19 el
# default de `WT` pasó de `copiloto-main` a `copiloto-grafo` y la del bridge no se movió: durante más
# de un mes el bridge leyó un árbol que nadie actualizaba. No dio síntoma porque el hook sólo
# sincroniza cuando `origin/main` ≠ marcador — el atajo tapaba el drift. Al mergear #663/#664
# (20:56) el sync empezó a correr siempre y, como ese árbol ya no existía, abortó TODO push del repo
# para las 5 sesiones a la vez.
#
# Lo que hace falta NO es que el árbol exista: es que sea EL MISMO. Recrear el que falta destraba el
# push y deja al bridge ingiriendo un árbol congelado en silencio, con el marcador avanzando igual —
# un error ruidoso convertido en un grafo desactualizado sin síntoma. Por eso acá se COMPARA, no se
# crea: un instrumento que lee lo que nadie escribe no falla nunca, y eso es peor que fallar.
BRIDGE_PATH="$(awk -v target="$REPO_NAME" '
  /^\[\[repo\]\]/      { name=""; }
  /^name[[:space:]]*=/ { v=$0; sub(/^[^=]*=[[:space:]]*"/,"",v); sub(/".*$/,"",v); name=v }
  /^path[[:space:]]*=/ { v=$0; sub(/^[^=]*=[[:space:]]*"/,"",v); sub(/".*$/,"",v);
                         if (name==target) { print v; exit } }
' "$BRIDGE/config/repos.toml" 2>/dev/null || true)"
# Normalizar antes de comparar. Del MISMO path conviven tres escrituras, y compararlas crudas
# convierte este guard en un falso positivo — que es justamente lo que enseña a saltearlo:
#   · mayúsculas: `C:` vs `c:`
#   · separador:  `\` vs `/`
#   · y la forma MSYS de Git-Bash (`/c/gfw-src/...`, `/tmp/...`), que es como sale
#     UC_GRAPH_WORKTREE escrito desde una terminal, contra la forma Windows (`C:/gfw-src/...`)
#     que usa repos.toml.
# Medido el 2026-09-22 con el control negativo de este mismo guard: sin reconciliar la forma MSYS,
# exportar la variable desde una terminal dispara un DRIFT falso apuntando al mismo árbol.
#
# La conversión la hace `cygpath`, no un sed a mano: MSYS no sólo antepone la letra de unidad, tiene
# una TABLA DE MOUNTS — `/tmp` no es `t:/mp`, es `C:/Users/<user>/AppData/Local/Temp`. Un sed
# `s#^/\([a-z]\)/#\1:/#` cubre `/c/...` y falla justo en esos casos, callado y pareciendo correcto.
# Fuera de Git-Bash (CI en Linux) cygpath no existe y los paths ya son nativos: ahí el fallback basta.
norm_path() {
  local v="${1:-}"
  if command -v cygpath >/dev/null 2>&1; then
    v="$(cygpath -m "$v" 2>/dev/null || printf '%s' "$v")"
  fi
  printf '%s' "$v" | tr 'A-Z\\' 'a-z/' | sed -e 's#^/\([a-z]\)/#\1:/#' -e 's#/*$##'
}
if [ -z "$BRIDGE_PATH" ]; then
  MOTIVO="repo-ausente-en-repos-toml"
  echo "[graph-sync] ❌ no encuentro el repo '$REPO_NAME' en '$BRIDGE/config/repos.toml'." >&2
  echo "[graph-sync]    Sin esa entrada el bridge no sabe qué ingerir. Abortando antes de sincronizar." >&2
  exit 1
fi
if [ "$(norm_path "$BRIDGE_PATH")" != "$(norm_path "$WT")" ]; then
  MOTIVO="drift-de-config"
  echo "[graph-sync] ❌ DRIFT de configuración: este script y el bridge apuntan a árboles DISTINTOS." >&2
  echo "[graph-sync]    graph-sync ESCRIBE : $WT" >&2
  echo "[graph-sync]    el bridge LEE      : $BRIDGE_PATH   (config/repos.toml, repo '$REPO_NAME')" >&2
  echo "[graph-sync]    El grafo ingeriría un árbol que este script nunca actualiza." >&2
  echo "[graph-sync]    Fix: alinear repos.toml con éste, o exportar UC_GRAPH_WORKTREE=$BRIDGE_PATH" >&2
  exit 1
fi

# Guarda dura 1: el worktree del grafo NO puede ser el checkout de trabajo. Si lo fuera, este script
# haría `checkout --detach` sobre el árbol donde otra sesión está trabajando y le volaría el WIP.
if [ "$(cd "$WT" 2>/dev/null && pwd || echo _)" = "$(cd "$REPO" && pwd)" ]; then
  echo "[graph-sync] ❌ UC_GRAPH_WORKTREE apunta al checkout de trabajo ('$REPO')." >&2
  echo "[graph-sync]    Este script hace 'checkout --detach' sobre él: pisaría el trabajo de otra sesión." >&2
  exit 1
fi

# Guarda dura 2 (2026-08-06): más abajo saneamos el árbol con `reset --hard`, que DESTRUYE cambios
# sin commitear. La guarda 1 sólo conoce ESTE checkout — no ve los otros worktrees de trabajo del
# repo (_wt-*, _documed-wt, .claude/worktrees/*), y apuntar `UC_GRAPH_WORKTREE` a uno de ellos por
# error volaría trabajo real. La diferencia observable es simple: un worktree de TRABAJO siempre
# tiene una rama checkouteada; el del grafo siempre está detached. Esa es la que decide si podemos
# destruir. Sin esta guarda, el fix de abajo convierte un error de configuración en pérdida de datos.
if [ -d "$WT" ]; then
  if ! git -C "$WT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "[graph-sync] ❌ '$WT' existe pero no es un working tree de git." >&2
    echo "[graph-sync]    No lo toco: no puedo distinguirlo de un directorio con datos." >&2
    exit 1
  fi
  rama_wt="$(git -C "$WT" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
  if [ -n "$rama_wt" ]; then
    echo "[graph-sync] ❌ '$WT' tiene la rama '$rama_wt' checkouteada." >&2
    echo "[graph-sync]    El worktree del grafo va SIEMPRE detached; con rama es un árbol de trabajo" >&2
    echo "[graph-sync]    y este script lo sanearía con 'reset --hard'. Abortando antes de destruir." >&2
    exit 1
  fi

  # Guarda dura 3 (2026-08-19): las guardas 1 y 2 sólo ven consumidores de GIT. Un bundler no lo es:
  # Metro sirve el árbol en solo-lectura, no tiene rama checkouteada (detached es justo lo que la
  # guarda 2 EXIGE) y no aparece en `git worktree list` como algo distinto. Las dos guardas pasaban
  # verdes mientras el `reset --hard` de abajo le volaba los archivos al dev-client debajo, y el
  # síntoma salía a 2 metros de acá: el teléfono en «Failed to compile».
  # `node_modules` es la señal: `clean -fd` (sin `-x`) no lo toca porque está gitignored, y un
  # worktree creado por este script con `worktree add --detach` no lo tiene nunca. Si está, alguien
  # instaló un proyecto acá y lo está usando. Fail-closed: mejor abortar el push, ruidoso y con
  # motivo, que romper un device en silencio.
  if [ -d "$WT/node_modules" ] || [ -d "$WT/apps/mobile/node_modules" ]; then
    echo "[graph-sync] ❌ '$WT' tiene node_modules: alguien lo está usando como proyecto vivo" >&2
    echo "[graph-sync]    (típicamente 'expo start' / Metro sirviendo el dev-client desde acá)." >&2
    echo "[graph-sync]    Este script hace 'reset --hard' + 'clean -fd' sobre el árbol: le borraría" >&2
    echo "[graph-sync]    los archivos al bundler en caliente. El worktree del grafo va exclusivo." >&2
    echo "[graph-sync]    Salidas: mover ese proyecto a un worktree propio, o apuntar este script a" >&2
    echo "[graph-sync]    otro árbol con UC_GRAPH_WORKTREE=<path-exclusivo>." >&2
    exit 1
  fi
fi

# Lock: serializa corridas concurrentes sobre $WT y $BRIDGE/checkpoint, que son GLOBALES —
# el mismo path físico para las 3 sesiones (Guarda 1 arriba ya distingue $WT de "mi" checkout, pero
# no evita que dos sesiones corran esta sección AL MISMO TIEMPO sobre ese único $WT compartido).
# Sin lock, un sync puede reingerir un árbol que otro sync está reescribiendo a mitad de camino.
#
# Sin flock (no disponible en este Git-Bash de Windows: `command -v flock` da vacío) el mecanismo es
# `mkdir`, atómico en NTFS igual que en POSIX — de dos procesos que lo corran a la vez sólo uno
# consigue crear el directorio. Antigüedad máxima + PID adentro para no quedar trabados si el dueño
# del lock muere sin pasar por el trap (Ctrl-C, cierre de ventana): un lockfile plano sin esto deja
# el sync bloqueado para siempre.
LOCKDIR="${UC_GRAPH_LOCK:-${WT}.sync.lock}"
LOCK_MAX_AGE="${UC_GRAPH_LOCK_MAX_AGE:-600}"
# Techo absoluto para el caso de PID reciclado (ver adquirir_lock): 4 h, muy por encima de
# cualquier sync legítimo medido.
LOCK_HARD_MAX="${UC_GRAPH_LOCK_HARD_MAX:-14400}"
LOCK_OWNED=0
OUT=""

cleanup_exit() {
  local rc=$?
  [ -n "$OUT" ] && rm -f "$OUT"
  [ "$LOCK_OWNED" = "1" ] && rm -rf "$LOCKDIR"
  registrar_sync "$rc"   # este trap REEMPLAZA al de la bitácora: sin esta línea, todo lo que pasa
                         # del lock para adelante -que es donde ocurren los fallos- no se registra.
}
trap cleanup_exit EXIT

adquirir_lock() {
  if mkdir "$LOCKDIR" 2>/dev/null; then
    echo "$$" > "$LOCKDIR/pid" 2>/dev/null || true
    LOCK_OWNED=1
    return 0
  fi
  local mtime edad pid_lock
  mtime="$(stat -c %Y "$LOCKDIR" 2>/dev/null || echo 0)"
  edad=$(( $(date +%s) - mtime ))
  pid_lock="$(cat "$LOCKDIR/pid" 2>/dev/null || echo '')"

  # El PID se guardaba desde siempre y NUNCA se leía: la única prueba de vida era la edad. Medido el
  # 2026-09-22: el primer sync completo tras un mes de drift ingiere durante >17 min, o sea pasa
  # holgado los 600s — con la regla vieja, la siguiente sesión le roba el lock a un sync VIVO y las
  # dos reescriben el mismo árbol y el mismo checkpoint, que es exactamente lo que el lock evita.
  # `$$` y `kill -0` viven en el MISMO espacio de nombres (MSYS), así que la prueba es válida acá;
  # `Get-Process` NO sirve: mide PIDs de Windows y da "muerto" para cualquier proceso de Git-Bash.
  if [ -n "$pid_lock" ] && kill -0 "$pid_lock" 2>/dev/null; then
    if [ "$edad" -le "$LOCK_HARD_MAX" ]; then
      return 1   # dueño VIVO: el lock vale por viejo que sea
    fi
    # Techo absoluto: un PID de MSYS puede reciclarse y hacer pasar por vivo a un dueño muerto. Sin
    # este tope, ese caso trabaría el sync para siempre — el fallo que la edad sí sabía resolver.
    echo "[graph-sync] lock con pid=$pid_lock vivo pero de hace ${edad}s (> ${LOCK_HARD_MAX}s): lo trato" >&2
    echo "[graph-sync]    como PID reciclado y lo tomo." >&2
  fi
  # Dueño muerto (o sin pid anotado): no hay por qué esperar a que venza la edad.
  if [ -z "$pid_lock" ] || ! kill -0 "$pid_lock" 2>/dev/null || [ "$edad" -gt "$LOCK_HARD_MAX" ]; then
    echo "[graph-sync] lock huérfano (pid=${pid_lock:-?} no responde, ${edad}s) — lo tomo." >&2
    rm -rf "$LOCKDIR"
    if mkdir "$LOCKDIR" 2>/dev/null; then
      echo "$$" > "$LOCKDIR/pid" 2>/dev/null || true
      LOCK_OWNED=1
      return 0
    fi
  fi
  return 1
}

if ! adquirir_lock; then
  # Salir 0, no 1: un lock ocupado NO es un fallo, es OTRO sync en curso que va a dejar el árbol
  # en origin/main igual. Si abortáramos con error acá volveríamos a bloquear pushes ajenos —
  # exactamente el problema que este repo viene arrastrando todo el día con el pre-push.
  MOTIVO="contencion-otro-sync"
  echo "[graph-sync] otro sync está corriendo ($LOCKDIR ocupado, pid=$(cat "$LOCKDIR/pid" 2>/dev/null || echo '?')) — salgo sin tocar el árbol."
  exit 0
fi

MOTIVO="sync-en-curso"
echo "[graph-sync] actualizando el árbol del grafo a origin/main…"
git -C "$REPO" fetch origin main --quiet
if [ ! -d "$WT" ]; then
  echo "[graph-sync] (el worktree no existía — creándolo en '$WT')"
  git -C "$REPO" worktree add --detach "$WT" origin/main
else
  # El árbol del grafo es DESECHABLE por diseño: su contenido se reconstruye entero desde origin/main
  # en cada corrida, y nadie trabaja acá (guardas 1 y 2 arriba). Por eso se sanea ANTES del checkout.
  #
  # QUÉ ARREGLA ESTO (2026-08-06, medido — no es lo que parecía a simple vista):
  # El árbol del grafo quedó con dos archivos TRACKEADOS borrados y así siguió corrida tras corrida,
  # porque ninguna de las dos operaciones que había podía restaurarlos:
  #   · `checkout --detach origin/main` NO los restaura cuando el archivo es idéntico entre el HEAD
  #     del árbol y origin/main: git no ve conflicto, mueve el HEAD y CONSERVA el borrado local.
  #     Reproducido con el estado exacto del incidente (HEAD 86f3f823 + los 2 borrados): rc=0, HEAD
  #     avanzó a origin/main, y `git status` seguía mostrando los mismos ` D`.
  #   · `clean -fd` tampoco: sólo borra archivos UNTRACKED, nunca restaura trackeados. Verificado
  #     con `clean -nd` sobre el árbol real: lista vacía.
  # Consecuencia: graphify parsea el WORKING TREE, así que ingiere un árbol al que le FALTAN archivos
  # y reporta éxito igual. El grafo queda describiendo un repo que no existe, sin dar síntoma — el
  # modo de fallo exacto que este script fue escrito para evitar, entrando por otra puerta.
  #
  # `reset --hard` (restaura trackeados) + `clean -fd` (borra untracked) + checkout, en ese orden.
  # `checkout --force` solo no bastaría: dejaría los untracked, que sí entrarían al grafo como
  # código vivo.
  #
  # OJO — lo que esto NO explica: los pushes que fallaron ese día por el pre-push. Se atribuyeron a
  # que este checkout abortaba, y la reproducción demuestra que NO aborta. La causa de esos fallos
  # sigue SIN determinar: hace falta el mensaje de error real, no una hipótesis. [ASSUMED_PENDING_VERIFY]
  git -C "$WT" reset --hard --quiet
  git -C "$WT" clean -qfd
  git -C "$WT" checkout --detach origin/main --quiet
fi

SHA="$(git -C "$WT" rev-parse HEAD)"
ESPERADO="$(git -C "$REPO" rev-parse origin/main)"
# Control positivo del ÁRBOL: sin esto, un fetch fallido o un worktree trabado sincronizaría un árbol
# viejo y el sync reportaría OK igual — que es exactamente el modo de fallo que originó este script.
[ "$SHA" = "$ESPERADO" ] || { echo "[graph-sync] ❌ el árbol quedó en $SHA y origin/main es $ESPERADO." >&2; exit 1; }
echo "[graph-sync] árbol en origin/main @ ${SHA:0:12} ✓"

if [ -n "$SINCE" ]; then
  echo "[graph-sync] sync incremental de ${REPO_NAME} desde ${SINCE:0:12}…"
else
  echo "[graph-sync] sync completo de ${REPO_NAME}…"
fi

# Patrones de error que un exit 0 puede estar ocultando. GraphityError = el visto en el
# incidente; Traceback = cualquier excepción Python no atrapada; "abortado:"/"reconcile
# abortado:" = lo que imprime cli/main.py._run_reconcile y orchestrator/sync.py ante
# ReconcileError (umbral de borrado superado).
_ERROR_GREP='GraphityError|Traceback \(most recent call last\)|^abortado:|reconcile abortado:'

OUT="$(mktemp)"

(
  cd "$BRIDGE"
  FORCE_FLAG=()
  [ -n "${UC_GRAPH_FORCE:-}" ] && FORCE_FLAG=(--force)
  if [ -n "$SINCE" ]; then
    uv run bridge --config config/repos.toml --repo "$REPO_NAME" sync \
      --checkpoint "$CKPT" --since "$SINCE" "${FORCE_FLAG[@]}"
  else
    uv run bridge --config config/repos.toml --repo "$REPO_NAME" sync \
      --checkpoint "$CKPT" "${FORCE_FLAG[@]}"
  fi
) 2>&1 | tee "$OUT"
sync_status="${PIPESTATUS[0]}"

if [ "$sync_status" -ne 0 ]; then
  echo "[graph-sync] ❌ el sync salió con status ${sync_status}." >&2
  exit "$sync_status"
fi
if grep -Eq "$_ERROR_GREP" "$OUT"; then
  echo "[graph-sync] ❌ exit 0 pero la salida tiene un patrón de error conocido (ver arriba) — tratado como fallo." >&2
  exit 1
fi

(
  cd "$BRIDGE"
  if [ -n "$SINCE" ]; then
    uv run python "$POSITIVE_CONTROL" --config config/repos.toml --repo "$REPO_NAME" --since "$SINCE"
  else
    uv run python "$POSITIVE_CONTROL" --config config/repos.toml --repo "$REPO_NAME"
  fi
)
pc_status=$?

if [ "$pc_status" -eq 1 ]; then
  echo "[graph-sync] ❌ control positivo FALLÓ — el grafo remoto no tiene el símbolo esperado." >&2
  exit 1
elif [ "$pc_status" -eq 2 ]; then
  echo "[graph-sync] ⚠️  control positivo no aplicable en este rango (ver arriba) — sync OK igual."
elif [ "$pc_status" -ne 0 ]; then
  echo "[graph-sync] ❌ control positivo terminó con status inesperado (${pc_status})." >&2
  exit 1
fi

# Marcador del ÚLTIMO SHA SINCRONIZADO CON ÉXITO. Se escribe recién acá, al final, después de las
# 3 capas de verificación: si cualquiera falla, el marcador queda viejo y el próximo push reintenta.
# Usar el HEAD del worktree como marcador sería un instrumento que confirma — quedaría en main aunque
# el sync/control positivo hubieran reventado. Lo consume .githooks/pre-push para decidir si hace
# falta sincronizar en absoluto.
mkdir -p "$BRIDGE/.bridge"
printf '%s\n' "$SHA" > "$BRIDGE/.bridge/last-synced-copiloto-emprendedor.sha"
MOTIVO="ok"
echo "[graph-sync] ✅ grafo sincronizado y verificado desde origin/main @ ${SHA:0:12} (checkpoint: $BRIDGE/$CKPT)"
