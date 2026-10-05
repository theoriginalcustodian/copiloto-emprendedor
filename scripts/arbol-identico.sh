#!/usr/bin/env bash
# Detecta commits cuyo ÁRBOL es byte-idéntico al de su primer padre: el commit existe, `git log` lo
# lista igual que a cualquier otro, el PR dice «merged» y el CI sale verde — pero NO cambió ni un
# archivo. Nada en el flujo normal lo nombra.
#
# Caso raíz (2026-09-30, auditoría): el PR #760 mergeó así. Lo que lo destapó NO fue un gate, fue que
# `git diff-tree --numstat` devolvió VACÍO — y vacío se lee como «no pude leerlo», no como «no cambió
# nada». El control real es comparar <sha>^{tree} con <sha>^1^{tree}.
#
# Alcance declarado (el instrumento dice qué NO mira): sólo commits de un único padre (--no-merges).
# Un merge cuyo árbol iguala al primer padre significa que el segundo no aportó nada — caso legítimo y
# frecuente («ours»); mezclarlo acá daría falsos positivos, y un guard que grita en el caso normal se
# desarma solo.
#
# Un árbol idéntico admite DOS causas opuestas, y este script NO las separa — no puede:
#   · PERDIÓ contenido (grave: el trabajo se fue en un rebase/resolución y el commit quedó de fachada)
#   · era REDUNDANTE (benigno: el contenido ya había entrado por otra vía — el caso del #760)
# Por eso AVISA y no rompe por defecto; --estricto lo vuelve fail-closed.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# A propósito NO hay `cd "$ROOT"`: el script opera sobre el repo del CWD, para que el canario pueda
# ejercitarlo contra un repo desechable. Un `cd` fijo acá dejaba el control positivo midiendo ESTE
# repo, y salía negativo sin que nada lo dijera.

ESTRICTO=0; CANARIO=0; SHAS=0; RANGO="origin/main..HEAD"
for a in "$@"; do
  case "$a" in
    --estricto) ESTRICTO=1 ;;
    --canario)  CANARIO=1 ;;
    # Modo maquina: sha COMPLETOS, uno por linea. Existe porque el reporte humano usa %h (7
    # chars) y el canario comparaba contra el sha de 40: no lo encontraba nunca e informaba
    # que el script fallaba. Un control que no puede ver lo que busca siempre acusa ausencia.
    --shas)     SHAS=1 ;;
    -*) echo "uso: $0 [<rango-git>] [--estricto] [--canario]" >&2; exit 2 ;;
    *)  RANGO="$a" ;;
  esac
done

# stdout: los sha de árbol idéntico al primer padre. stderr: cuántos examinó (el instrumento SIEMPRE
# dice cuántos elementos miró; si no, un 0 hallazgos no se distingue de un 0 mirados).
buscar_vacios() {
  local rango="$1" total=0 sin_padre=0 sha t tp
  local -a vacios=()
  while read -r sha; do
    [ -n "$sha" ] || continue
    total=$((total + 1))
    if [ "$(git rev-list --parents -n1 "$sha" | wc -w)" -lt 2 ]; then
      sin_padre=$((sin_padre + 1)); continue     # commit raíz: no hay padre contra el que comparar
    fi
    t="$(git rev-parse "${sha}^{tree}")"
    tp="$(git rev-parse "${sha}^1^{tree}")"
    [ "$t" = "$tp" ] && vacios+=("$sha")
  done < <(git rev-list --no-merges "$rango" 2>/dev/null || true)
  echo "EXAMINADOS=$total SIN_PADRE=$sin_padre" >&2
  # Un `echo` por elemento, a propósito: `printf '%s\n' "${arr[@]}"` con el array VACÍO imprime una
  # línea vacía igual, y mapfile la cuenta como hallazgo. Este script llegó a reportar «1 commit de
  # árbol idéntico» sobre una rama limpia por exactamente eso.
  local v
  for v in ${vacios[@]+"${vacios[@]}"}; do echo "$v"; done
}

if [ "$CANARIO" = 1 ]; then
  # Control positivo Y negativo en un repo desechable: tiene que cazar el vacío y NO marcar el bueno.
  tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
  (
    cd "$tmp"
    git init -q . && git config user.email c@c.c && git config user.name canario
    echo uno > a.txt; git add a.txt; git commit -qm base
    base="$(git rev-parse HEAD)"
    echo dos >> a.txt; git add a.txt; git commit -qm "cambia de verdad"
    bueno="$(git rev-parse HEAD)"
    git commit -q --allow-empty -m "no cambia nada"
    vacio="$(git rev-parse HEAD)"
    salida="$("$ROOT/scripts/arbol-identico.sh" --shas "${base}..HEAD" 2>/dev/null || true)"
    ok=1
    grep -q "$vacio" <<<"$salida" || { echo "❌ CANARIO: no cazó el commit vacío"; ok=0; }
    grep -q "$bueno" <<<"$salida" && { echo "❌ CANARIO: marcó un commit que SÍ cambia (falso positivo)"; ok=0; }
    [ "$ok" = 1 ] && echo "✅ canario: caza el vacío y NO marca el bueno — discrimina en los dos sentidos"
    exit $(( 1 - ok ))
  )
  exit $?
fi

mapfile -t VACIOS < <(buscar_vacios "$RANGO")
if [ "$SHAS" = 1 ]; then
  for s in ${VACIOS[@]+"${VACIOS[@]}"}; do echo "$s"; done
  exit 0
fi
if [ "${#VACIOS[@]}" -eq 0 ]; then
  echo "✅ árbol-idéntico: ningún commit de '$RANGO' tiene el árbol igual al de su padre"
  exit 0
fi
echo "⚠️  árbol-idéntico: ${#VACIOS[@]} commit(s) de '$RANGO' NO cambian ningún archivo:"
for s in "${VACIOS[@]}"; do echo "   $(git log -1 --format='%h %ad %s' --date=short "$s")"; done
cat <<'MSG'
   Esto NO dice todavía si es grave. Dirimí ANTES de reportar:
     · ¿PERDIÓ contenido?  -> git show --stat <sha>^1..<sha>  ; y buscá el trabajo en otra rama
     · ¿era REDUNDANTE?    -> git log --oneline -- <archivo-esperado>
                              git merge-base --is-ancestor <sha-que-lo-trajo> HEAD   (0 = ya estaba)
MSG
[ "$ESTRICTO" = 1 ] && exit 1
exit 0
