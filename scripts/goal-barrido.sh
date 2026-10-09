#!/usr/bin/env bash
# goal-barrido.sh — ¿qué ORDEN DE TRABAJO tiene cada sesión? Read-only, idempotente.
#
# Por qué existe: `.goal` lo escribe `scripts/goal.sh` y vive en el worktree de cada sesión
# (gitignored; si se versionara, un worktree pisaría el goal del otro). Con tres sesiones
# paralelas eso deja un hueco: nadie ve centralmente quién está en qué. La alternativa era
# "que cada avance_ cite su goal", y en este repo lo que depende de disciplina se
# desincroniza — el orden lo garantiza un janitor
# (memoria/buzon-se-ordena-por-janitor-no-por-disciplina.md).
#
# NO declara alarma a propósito. Hoy ninguna sesión usa `/goal` todavía: un guard que grita
# en el caso normal se desarma solo (memoria/el-guard-que-grita-en-el-caso-normal-*). Primero
# se mide adopción real; recién con ese número se decide si "sesión viva sin goal" es alarma.
#
# Uso:  goal-barrido.sh          # tabla legible
#       goal-barrido.sh --tsv    # para componer en otro script
set -uo pipefail
TSV=0; [ "${1:-}" = "--tsv" ] && TSV=1

campo() { grep -E "^$2=" "$1" 2>/dev/null | head -1 | cut -d= -f2-; }

filas=(); con=0; sin=0
while IFS= read -r wt; do
  [ -z "$wt" ] && continue
  rama="$(git -C "$wt" branch --show-current 2>/dev/null)"; rama="${rama:-(detached)}"
  base="$(basename "$wt")"
  if [ -f "$wt/.goal" ]; then
    id="$(campo "$wt/.goal" id)"; desde="$(campo "$wt/.goal" desde)"
    fuente="$(campo "$wt/.goal" fuente)"
    filas+=("$base	$rama	${id:-?}	${desde:-?}	${fuente:-?}"); con=$((con+1))
  else
    filas+=("$base	$rama	—	—	—"); sin=$((sin+1))
  fi
done < <(git worktree list --porcelain 2>/dev/null | awk '/^worktree /{print substr($0,10)}')

if [ "$TSV" = "1" ]; then printf '%s\n' "${filas[@]}"; exit 0; fi
echo "GOALS por worktree — con orden declarada: $con · sin orden: $sin"
printf '%s\n' "${filas[@]}" | awk -F'\t' '$3!="—"{printf "  🎯 %-26s %-34s %-10s %s\n",$1,$2,$3,$5}'
[ "$con" -eq 0 ] && echo "  (ninguna sesión declaró orden todavía — se fija con /goal <ID>)"
exit 0
