#!/usr/bin/env bash
# Detecta ramas con trabajo que NUNCA llegó a main — el fallo que costó el sign-in nativo de
# Google (2026-08-06): implementado, probado en device, cerrado como "listo", y viviendo sólo en
# `docs/production-readiness-brief` porque nadie abrió PR.
#
# POR QUÉ ESTE INSTRUMENTO Y NO OTRO
# ----------------------------------
# Los dos controles obvios NO sirven, y saber por qué es el punto:
#
#   1. `git rev-list --count main..rama` cuenta COMMITS. Un merge por SQUASH crea un commit nuevo
#      en main, así que los commits originales nunca figuran como mergeados aunque su contenido SÍ
#      esté. Medido acá: 106 ramas "no mergeadas" de las cuales casi todas estaban perfectamente
#      en main. Un instrumento que marca todo no distingue nada.
#
#   2. `git diff main...rama` compara ÁRBOLES. Falla por el otro lado: después del squash, main
#      sigue evolucionando esos mismos archivos, así que el diff vuelve a dar no-vacío. Medido:
#      105 de 136 ramas marcadas como "ausentes". Mismo problema, disfrazado de rigor.
#
# El único que discrimina es preguntarle a GitHub qué PR se mergeó desde cada rama. Con eso, de
# 136 ramas quedaron 7 — y de esas, 5 eran huérfanas reales.
#
# CONTROL POSITIVO HORNEADO
# -------------------------
# Un detector que no encuentra nada es indistinguible de un detector roto. Por eso el script
# verifica primero que reconoce como MERGEADA una rama que sabemos mergeada. Si ese control falla,
# aborta en vez de reportar "todo limpio" — el falso verde es peor que no correrlo.
set -uo pipefail

cd "$(git rev-parse --show-toplevel)" || exit 1

if ! command -v gh >/dev/null 2>&1; then
  echo "ramas-huerfanas: falta el CLI 'gh' — no puedo distinguir squash-merge de huérfana. Abortando."
  exit 2
fi

git fetch --prune -q origin 2>/dev/null || true

MERGED=$(mktemp); CERRADOS=$(mktemp); ABIERTOS=$(mktemp)
trap 'rm -f "$MERGED" "$CERRADOS" "$ABIERTOS"' EXIT

gh pr list --state merged --limit 400 --json headRefName --jq '.[].headRefName' 2>/dev/null | sort -u > "$MERGED"
gh pr list --state closed --limit 400 --json headRefName,state --jq '.[] | select(.state=="CLOSED") | .headRefName' 2>/dev/null | sort -u > "$CERRADOS"
# Un PR ABIERTO no es una huérfana: es trabajo en vuelo, con destino declarado.
gh pr list --state open --limit 400 --json headRefName --jq '.[].headRefName' 2>/dev/null | sort -u > "$ABIERTOS"

# --- control positivo: sin esto, un $MERGED vacío haría que TODAS las ramas parezcan huérfanas ---
if [ ! -s "$MERGED" ]; then
  echo "ramas-huerfanas: la lista de PRs mergeados vino VACÍA (¿sin auth de gh? ¿sin red?)."
  echo "  Eso haría que toda rama parezca huérfana. Abortando en vez de reportar un falso positivo."
  exit 2
fi

HUERFANAS=0
while read -r ref; do
  rama=${ref#origin/}
  n=$(git rev-list --count "origin/main..$ref" 2>/dev/null) || continue
  [ "${n:-0}" = "0" ] && continue
  grep -qxF "$rama" "$MERGED" && continue          # su PR se mergeó (aunque haya sido por squash)
  grep -qxF "$rama" "$CERRADOS" && continue        # PR cerrado a propósito: descarte deliberado
  grep -qxF "$rama" "$ABIERTOS" && continue        # PR abierto: trabajo en vuelo, no huérfano
  case "$rama" in spike/*) continue ;; esac        # los spikes son desechables por diseño
  fecha=$(git log -1 --format='%ci' "$ref" 2>/dev/null | cut -c1-10)
  if [ "$HUERFANAS" = "0" ]; then
    echo "🔴 RAMAS CON TRABAJO QUE NUNCA LLEGÓ A MAIN (commits propios · sin PR mergeado ni cerrado)"
    echo ""
    printf "   %-6s %-52s %s\n" "commits" "rama" "último"
  fi
  printf "   %-6s %-52s %s\n" "$n" "$rama" "$fecha"
  HUERFANAS=$((HUERFANAS+1))
done < <(git for-each-ref --format='%(refname:short)' refs/remotes/origin | grep -v 'origin/main$\|origin/HEAD')

if [ "$HUERFANAS" = "0" ]; then
  echo "✅ ramas-huerfanas: ninguna rama con trabajo sin mergear (verificado contra $(wc -l < "$MERGED") PRs mergeados)"
  exit 0
fi

echo ""
echo "   Cada línea es trabajo hecho que NO está en main. Si alguna se dio por 'cerrada', la memoria"
echo "   no miente sobre el trabajo: miente sobre dónde vive. Abrí PR o borrá la rama, pero no la"
echo "   dejes en el limbo — un APK o un deploy cortado de main NO la va a incluir."
exit 1
