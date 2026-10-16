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

# Repo cuyos worktrees se barren. `RAMAS_GIT_DIR` es la MISMA variable que vigilancia-check.sh ya
# declara como override para test (su :60): sin ella, una corrida con fixture barria los 146
# worktrees REALES del disco -- el gate medía al equipo y no al commit, y tardaba en proporcion a
# cuantos worktrees tuviera la maquina (10 s de los 11,5 s de cada invocacion, medido 2026-10-16).
# Sin definir se cae al cwd, que es el comportamiento de siempre en uso real.
GIT_DIR_BARRIDO="${RAMAS_GIT_DIR:-.}"

campo() { grep -E "^$2=" "$1" 2>/dev/null | head -1 | cut -d= -f2-; }

# La rama de cada worktree YA VIENE en el `--porcelain` (`branch refs/heads/<x>` o `detached`), asi
# que el `git -C "$wt" branch --show-current` por worktree preguntaba de nuevo algo que ya estaba en
# la mano: 146 forks de git, 68 ms cada uno = 10 s por corrida (medido 2026-10-16, y este script es
# el 87% del costo de cada invocacion de vigilancia-check por el camino de fixture). Ahora es UN
# fork de git para todo el barrido. `${wt##*/}` == `basename` para rutas sin barra final, que es lo
# que emite el porcelain.
filas=(); con=0; sin=0
emitir() {  # emitir <ruta> <rama>
  local wt="$1" rama="${2:-(detached)}" base id desde fuente
  [ -z "$wt" ] && return 0
  base="${wt##*/}"
  if [ -f "$wt/.goal" ]; then
    id="$(campo "$wt/.goal" id)"; desde="$(campo "$wt/.goal" desde)"
    fuente="$(campo "$wt/.goal" fuente)"
    filas+=("$base	$rama	${id:-?}	${desde:-?}	${fuente:-?}"); con=$((con+1))
  else
    filas+=("$base	$rama	—	—	—"); sin=$((sin+1))
  fi
}
_wt=""; _rama=""
while IFS= read -r linea; do
  case "$linea" in
    "worktree "*) emitir "$_wt" "$_rama"; _wt="${linea#worktree }"; _rama="" ;;
    "branch refs/heads/"*) _rama="${linea#branch refs/heads/}" ;;
  esac
done < <(git -C "$GIT_DIR_BARRIDO" worktree list --porcelain 2>/dev/null)
emitir "$_wt" "$_rama"

if [ "$TSV" = "1" ]; then printf '%s\n' "${filas[@]}"; exit 0; fi
echo "GOALS por worktree — con orden declarada: $con · sin orden: $sin"
printf '%s\n' "${filas[@]}" | awk -F'\t' '$3!="—"{printf "  🎯 %-26s %-34s %-10s %s\n",$1,$2,$3,$5}'
[ "$con" -eq 0 ] && echo "  (ninguna sesión declaró orden todavía — se fija con /goal <ID>)"
exit 0
