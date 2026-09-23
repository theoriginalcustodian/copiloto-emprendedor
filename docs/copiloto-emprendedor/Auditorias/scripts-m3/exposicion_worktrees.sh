#!/usr/bin/env bash
# M-3 · H1 cuantificado — ¿cuántos árboles vivos NO tienen capa local de secretos?
#
# El caso C demostró el mecanismo: un árbol anterior a #601 corre un pre-push sin escáner, así que un
# secreto sale sin que nada local lo frene. Esto cuenta a cuántos árboles reales les pasa.
#
# Se mide por DOS vías independientes, y se compara:
#   (a) ancestría: ¿el HEAD del worktree desciende de #601?
#   (b) contenido: ¿su .githooks/pre-push menciona secretos-check?
# Si (a) y (b) discrepan en algún árbol, eso vale más que el conteo — significa que la ancestría no
# predice la capa (p. ej. un árbol con el archivo editado a mano), y el chequeo por rama sería falso.
#
# Cada lectura lleva control positivo: un grep que devuelve 0 puede ser "no está" o "no miré".
set -uo pipefail
REPO="C:/Proyectos/Claude/Claude code/copiloto-emprendedor"
SHA_601="$(MSYS_NO_PATHCONV=1 git -C "$REPO" log origin/main --format=%H -S'secretos-check' --reverse -- .githooks/pre-push | head -1)"
[ -n "$SHA_601" ] || { echo "ERROR: no ubico #601 (¿medí sobre HEAD?)"; exit 2; }
echo "#601 (nace el escáner) = $SHA_601"
echo

printf '%-46s %-10s %-9s %-9s %s\n' "WORKTREE" "HEAD" "desc#601" "hook" "VEREDICTO"
printf '%.0s-' {1..100}; echo

sin_capa=0; con_capa=0; discrepan=0; total=0
while read -r dir; do
  [ -d "$dir" ] || continue
  total=$((total+1))
  head="$(git -C "$dir" rev-parse --short HEAD 2>/dev/null || echo '?')"
  # (a) ancestria
  if git -C "$REPO" merge-base --is-ancestor "$SHA_601" "$(git -C "$dir" rev-parse HEAD 2>/dev/null || echo "$SHA_601")" 2>/dev/null; then
    desc="si"; else desc="NO"; fi
  # (b) contenido, con control positivo (shebang) para distinguir "no menciona" de "no leí"
  hookf="$dir/.githooks/pre-push"
  if [ -f "$hookf" ]; then
    n="$(grep -c 'secretos-check' "$hookf" 2>/dev/null || true)"; n="${n:-0}"
    cp="$(grep -c '^#!' "$hookf" 2>/dev/null || true)"; cp="${cp:-0}"
    if [ "$cp" = "0" ]; then hook="ILEGIBLE"; else [ "$n" -gt 0 ] && hook="scanner" || hook="SIN-scan"; fi
  else
    hook="SIN-HOOK"
  fi
  case "$hook" in
    scanner)  ver="protegido"; con_capa=$((con_capa+1)) ;;
    SIN-scan|SIN-HOOK) ver="⚠ SIN CAPA LOCAL"; sin_capa=$((sin_capa+1)) ;;
    *) ver="no medible" ;;
  esac
  # las dos vias deben coincidir; si no, el dato importante es la discrepancia
  if { [ "$desc" = "si" ] && [ "$hook" != "scanner" ]; } || { [ "$desc" = "NO" ] && [ "$hook" = "scanner" ]; }; then
    ver="$ver  ← DISCREPA(a≠b)"; discrepan=$((discrepan+1))
  fi
  printf '%-46s %-10s %-9s %-9s %s\n' "$(basename "$dir")" "$head" "$desc" "$hook" "$ver"
done < <(git -C "$REPO" worktree list --porcelain | awk '/^worktree /{print substr($0,10)}')

echo
echo "TOTAL: $total árboles · con capa local: $con_capa · SIN capa local: $sin_capa · discrepancias (a vs b): $discrepan"
echo
echo "Control positivo del barrido: ¿vio al menos un árbol de cada clase?"
echo "  si 'SIN capa local' = 0 y el checkout compartido está en la lista, el instrumento está ciego:"
echo "  ese checkout fue medido a mano y NO tiene escáner."
