#!/usr/bin/env bash
# recibo-cubre.sh — ¿algún recibo de `gate.sh` cubre este SHA? Se compara por ÁRBOL, no por SHA.
#
# Por qué existe: ADR-001 pide que un merge cite el recibo del SHA mergeado. Con squash-merge ese SHA
# no existe hasta mergear, y el recibo que había era el de la cabeza del PR. El 2026-09-22 eso costó
# un segundo gate por merge (107fdf61, 8a7f2434, a267be6c...) y, al correrlos en worktrees detached,
# la colisión de stage de #632. Lo que el gate prueba es un árbol: si la rama estaba al día con main
# al mergear, el árbol del squash es IDÉNTICO al de la cabeza y su recibo lo cubre. Si no estaba al
# día, los árboles difieren y este script lo dice — ese árbol no lo probó nadie.
#
# Uso: bash scripts/recibo-cubre.sh <sha> [dir-de-recibos ...]
#      Sin dirs, busca en la copia durable `<git-common-dir>/ci-recibos/` (gate.sh la escribe; sobrevive a
#      `git worktree remove`) y en `.ci-recibos/` de TODOS los worktrees. Un recibo idéntico (la copia
#      durable y su original) se evalúa una vez; dos recibos DISTINTOS del mismo SHA se evalúan los dos:
#      deduplicar por SHA dejaba que uno fallido tapara al que cubre.
# Cubre = mismo árbol + los 5 jobs en `ok` + ningún job marcado `sucio` (árbol con cambios sin
# commitear durante la corrida: los jobs leen el disco, no git). Un recibo anterior al registro de
# `sucio` cubre con ⚠️: no consta si el árbol estaba limpio.
# Exit: 0 = al menos un recibo cubre · 1 = ninguno · 2 = no conozco el SHA.
set -uo pipefail

objetivo="${1:-}"
[ -n "$objetivo" ] || { echo "uso: recibo-cubre.sh <sha> [dir-de-recibos ...]" >&2; exit 2; }
shift
command -v jq >/dev/null || { echo "recibo-cubre.sh: falta jq." >&2; exit 2; }
sha_obj="$(git rev-parse --verify -q "${objetivo}^{commit}")" || { echo "recibo-cubre.sh: no conozco '$objetivo' (¿falta un fetch?)." >&2; exit 2; }
arbol_obj="$(git rev-parse "${sha_obj}^{tree}")"
JOBS=(core web mobile lint backend)

dirs=("$@")
if [ "${#dirs[@]}" -eq 0 ]; then
  dirs=("$(git rev-parse --path-format=absolute --git-common-dir)/ci-recibos")
  while IFS= read -r wt; do dirs+=("$wt/.ci-recibos"); done \
    < <(git worktree list --porcelain | awk '/^worktree /{print substr($0,10)}')
fi

# Prefiltro de rendimiento: evaluar cada recibo cuesta ~3 forks (jq, hash-object) y en Windows eso
# eran 34 s con 225 recibos el 22/09 — y la copia durable sólo crece. gate.sh nombra cada recibo
# `<sha>.json`: UN `git cat-file --batch-check` da el árbol de todos y la evaluación completa corre sólo
# sobre los que coinciden. Un recibo que no se llame `<sha40>.json` es candidato siempre. El prefiltro
# sólo puede descartar DE MÁS (un falso ❌), nunca dejar pasar: todo candidato se evalúa entero abajo.
todos=()
for d in "${dirs[@]}"; do for r in "$d"/*.json; do [ -f "$r" ] && todos+=("$r"); done; done
declare -A candidato=()
if [ "${#todos[@]}" -gt 0 ]; then
  mapfile -t arboles < <(for r in "${todos[@]}"; do b="${r##*/}"; printf '%s^{tree}\n' "${b%.json}"; done \
                           | git cat-file --batch-check='%(objectname)' 2>/dev/null)
  for i in "${!todos[@]}"; do
    b="${todos[$i]##*/}"; b="${b%.json}"
    # Si cat-file no devolvió una línea por recibo, no se puede alinear: se evalúan todos.
    if [ "${#arboles[@]}" -ne "${#todos[@]}" ] || ! [[ "$b" =~ ^[0-9a-f]{40}$ ]] \
       || [ "${arboles[$i]}" = "$arbol_obj" ]; then candidato["${todos[$i]}"]=1; fi
  done
fi

cubren=0; mismo_arbol=0; declare -A visto=()
for r in "${todos[@]}"; do
    [ -n "${candidato[$r]:-}" ] || continue
    sha_r="$(jq -r '.sha // empty' "$r" 2>/dev/null)"; [ -n "$sha_r" ] || continue
    huella="$(git hash-object "$r")"
    [ -n "${visto[$huella]:-}" ] && continue; visto[$huella]=1
    arbol_r="$(jq -r '.arbol // empty' "$r")"
    [ -n "$arbol_r" ] || arbol_r="$(git rev-parse --verify -q "${sha_r}^{tree}" 2>/dev/null)" || continue
    [ "$arbol_r" = "$arbol_obj" ] || continue
    mismo_arbol=$((mismo_arbol + 1))
    motivos=(); sin_dato=0
    for j in "${JOBS[@]}"; do
      res="$(jq -r --arg j "$j" '.jobs[$j] // "ausente"' "$r")"
      [ "$res" = "ok" ] || motivos+=("$j=$res")
      suc="$(jq -r --arg j "$j" 'if .detalle[$j] | has("sucio") then .detalle[$j].sucio else "sin-dato" end' "$r" 2>/dev/null)"
      [ "$suc" = "true" ] && motivos+=("$j corrió con el árbol SUCIO")
      [ "$suc" = "sin-dato" ] && sin_dato=1
    done
    meta="sha ${sha_r:0:8} · sesión $(jq -r '.sesion // "?"' "$r") · $(jq -r '.fecha // "?"' "$r")"
    if [ "${#motivos[@]}" -eq 0 ]; then
      cubren=$((cubren + 1))
      aviso=""; [ "$sin_dato" -eq 1 ] && aviso=" ⚠️ recibo anterior al registro de limpieza: no consta si el árbol estaba limpio"
      echo "✅ CUBRE  $r  ($meta)$aviso"
    else
      echo "❌ mismo árbol, NO cubre: $r  ($meta) — $(IFS=', '; echo "${motivos[*]}")"
    fi
done

if [ "$cubren" -gt 0 ]; then exit 0; fi
echo "❌ ningún recibo cubre ${sha_obj:0:8} (árbol ${arbol_obj:0:8}; $mismo_arbol con el mismo árbol, ninguno completo y limpio)."
[ "$mismo_arbol" -eq 0 ] && echo "   Si el PR se mergeó sin estar al día con main, ese árbol no lo probó nadie: corré gate.sh sobre ${sha_obj:0:8} (UC_SESION=<sesión> en un worktree detached)."
exit 1
