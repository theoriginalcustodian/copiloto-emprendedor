#!/usr/bin/env bash
# no-ocio-check.sh — Chequeo determinista ANTI-OCIO (complementa cola-check.sh).
#
# CAUSA RAÍZ que resuelve: el 2026-07-24 la fábrica quedó ~9 h ociosa DE NOCHE. La REPL de
# backend murió ~00:31; el frontend quedó bloqueado en una pregunta de seam (la "Q1") que era
# un grep de planificación; y planificación —dueña de la costura, con horas de trabajo alcanzable
# (contrato, memoria, PLAN, el propio grep)— reportó "sigo el vigía" cada 3 min durante 7 h en vez
# de resolver. Detectó la parálisis y respondió PASIVO.
#
# cola-check.sh NO lo cazó: el hito 8 estaba `arrancando` (frontend "activo"), así que no había
# "arrancable sin arrancar". El hueco es OTRO: un hito arrancando pero con las sesiones PARADAS
# sobre un blocker que planificación podía resolver sola. Este script cubre ese hueco.
#
# QUÉ HACE: mide el ocio de cada sesión y, si hay ocio, IMPRIME UNA TRIADA OBLIGATORIA que
# PROHÍBE la respuesta "hold" hasta descartar, en orden:
#   (A) blocker resoluble por planificación (grep/contrato/lectura/decisión táctica) → RESOLVERLO
#       en el MISMO ciclo. NO diferirlo a otra sesión.
#   (B) trabajo de backlog independiente (COLA-VIVA, Bandeja, memoria, PLAN) → ADELANTARLO.
#   (D) sesión con REPL muda >UMBRAL_MUERTA en el camino crítico → PUSH al operador + reasignar
#       a planificación lo resoluble sin ella (dead-man's-switch).
# Ocio legítimo SÓLO si (A) y (B) están vacíos Y el bloqueo es operator-only (marker abajo).
#
# BLOQUEO OPERATOR-ONLY (para que sea determinista y no viva sólo en el chat): cuando planificación
# escala un MAYOR al operador, deja un marker  abierto/bloqueo-operador_<slug>.md  con el ask de una
# línea. Este script lo detecta; si de noche lleva >UMBRAL_BLOQUEO sin respuesta → PUSH REQUERIDO.
#
# Corrido por PLANIFICACIÓN en cada ciclo de monitor, junto a cola-check.sh y el janitor.
#
# Uso:  scripts/no-ocio-check.sh            # imprime ocio + triada si aplica
#       scripts/no-ocio-check.sh --quiet    # sólo imprime si hay ocio accionable (para crones)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUZON="$REPO_ROOT/coordinacion"
ABIERTO="$BUZON/abierto"
HOY="$(date +%Y-%m-%d)"
CERRADO_HOY="$BUZON/cerrado/$HOY"
QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

# ── Parámetros (fijados por el operador 2026-07-24) ────────────────────────────
UMBRAL_OCIO=6         # min sin actividad de UNA sesión mientras hay trabajo suyo → candidata a parada
UMBRAL_MUERTA=30      # min de REPL muda en camino crítico → push al operador + reasignar
UMBRAL_BLOQUEO=15     # min de un bloqueo operator-only sin respuesta → push (de noche, inmediato)

[ -d "$ABIERTO" ] || { echo "No existe $ABIERTO"; exit 0; }
now="$(date +%s)"

# mtime más reciente (epoch) entre los archivos AUTOREADOS por una sesión (nombre contiene <sesion>-a-)
# en abierto/ + cerrado/hoy. Es el piso conservador: si una sesión sólo acusa en hilos ajenos sin
# autorear, este piso puede subestimar — por eso la triada pide revisar acuses a mano en el caso (b).
ult_actividad() {
  local sesion="$1" nombre newest=0 m
  while IFS= read -r -d '' f; do
    m="$(stat --format=%Y "$f" 2>/dev/null || echo 0)"
    [ "$m" -gt "$newest" ] && newest="$m"
  done < <(find "$ABIERTO" "$CERRADO_HOY" -maxdepth 1 -type f -name "*${sesion}-a-*" -print0 2>/dev/null)
  echo "$newest"
}
min_desde() { local e="$1"; [ "$e" -eq 0 ] && { echo 9999; return; }; echo $(( (now - e) / 60 )); }

be="$(ult_actividad backend)";  min_be="$(min_desde "$be")"
fe="$(ult_actividad frontend)"; min_fe="$(min_desde "$fe")"

# ── VIDA REAL: el transcript, no el buzón ─────────────────────────────────────
# 🔴 Raíz 2026-07-24 (segunda pasada): medir actividad por archivos del buzón da FALSO IDLE — una
# sesión puede estar trabajando a full y no postear nada durante una hora. Se reportó "backend muerto
# 8½ h" mientras backend estaba escribiendo código. La prueba de vida es que la sesión ACTÚE, y eso se
# ve en su transcript JSONL, que Claude Code escribe en cada turno.
# Ver [[silencio-del-buzon-no-prueba-repl-muerta]].
# 🔴 Raíz 2026-08-07 (cuarto fallo del mismo sensor). Este glob terminaba en el basename del repo y
# sin `| head -1` ni siquiera eso: veía UN solo slug, el del checkout compartido. Una sesión que
# trabaja desde un worktree escribe en OTRO slug (`…-copiloto-emprendedor--claude-worktrees-<x>`),
# que no termina con el basename → el sensor no la ve NUNCA, `vida_fe` queda vacío y el bloque
# dead-man cae al sensor del buzón y declara MUERTA a una sesión que está mergeando PRs.
# Medido: frontend reportada "DEAD-MAN muda 96min" mientras mergeaba el #316 y abría el #320 verde.
# Es `[[una-sesion-en-worktree-es-invisible-para-el-monitor-el-slug-sale-del-cwd]]` mordiendo a este
# script. El `*` de cierre incluye los slugs de worktree; se escanean TODOS, no el primero.
PROJS="$(ls -d "$HOME/.claude/projects/"*"$(basename "$REPO_ROOT")"* 2>/dev/null)"
etiqueta_transcript() {   # imprime BACKEND|FRONTEND|PLANIFICACION|? — identidad ASIGNADA, no inferida
  # 🔴 Señal primaria: el PROMPT DEL CRON que la sesión RECIBE ("Vigía de coordinación (sesión X)").
  # Cada ventana recibe únicamente el heartbeat de su propio rol, así que el rótulo no depende ni de
  # cómo se llame la ventana ni de qué archivos toque. Medido 2026-07-24 sobre los 6 transcripts
  # vivos: frontend 8/0/0 · backend 2/0/0 · planificación 14 (con 1 y 1 de las otras, porque escribe
  # SOBRE ellas) → el máximo separa limpio.
  #
  # Por qué no alcanzaban los intentos anteriores, y son 5 falsos positivos de la misma familia:
  #   · por AUTODECLARACIÓN ("soy backend"): las tres citan el buzón, el conteo empata y el rótulo
  #     sale por descarte — y un rótulo por descarte no falla, CONFIRMA (con backend muerto habría
  #     reportado backend vivo igual).
  #   · por CONDUCTA (paths tocados): se contamina sola. Una sesión que está LEYENDO el buzón acumula
  #     hits de `coordinacion/` y pasa por planificación; backend que lee `apps/mobile` para entender
  #     la costura suma del lado de frontend. La conducta describe la TAREA DEL MOMENTO, no la identidad.
  # El cron, en cambio, se lo asigna otro y no cambia con lo que la sesión esté haciendo.
  #
  # 🔴 Se escanea el archivo ENTERO, no una ventana del final. La versión anterior miraba
  # `tail -c 400000` y eso invertía el instrumento: la marca del cron queda atrás a medida que la
  # sesión produce, así que **cuanto más trabaja una sesión, antes se vuelve invisible** — justo la
  # que más falta hace ver. Medido 2026-08-12 sobre los transcripts vivos: backend (128 MB) daba
  # `0/0/0` por ventana y `217/5/5` entero; frontend (23 MB) daba `0/0/0` y `8/381/6`. Las DOS
  # sesiones vigiladas estaban sin rotular al mismo tiempo, a minutos de un dead-man falso.
  # El costo que ahorraba la ventana no existía: grep sobre esos 24 MB tarda 25 ms, y el barrido ya
  # descarta los transcripts de más de 4 h antes de llegar acá.
  local f="$1" b fr pl
  b=$( grep -c 'sesión BACKEND'        "$f" 2>/dev/null || true)
  fr=$(grep -c 'sesión FRONTEND'       "$f" 2>/dev/null || true)
  pl=$(grep -c 'sesión PLANIFICACIÓN'  "$f" 2>/dev/null || true)
  b="${b:-0}"; fr="${fr:-0}"; pl="${pl:-0}"
  if [ $((b + fr + pl)) -gt 0 ]; then
    if   [ "$pl" -ge "$b" ] && [ "$pl" -ge "$fr" ]; then echo PLANIFICACION
    elif [ "$b"  -ge "$fr" ];                       then echo BACKEND
    else                                                 echo FRONTEND
    fi
    return
  fi
  # Fallback por conducta: sólo para una ventana SIN cron todavía (recién abierta, o heartbeat caído).
  # Que caiga acá ya es información: una sesión sin cron no está siendo vigilada por nadie.
  # Acá SÍ se mira una ventana del final, y a propósito: la conducta describe la tarea del momento,
  # no la identidad — un barrido entero acumularía los paths de todo lo que la sesión tocó en horas.
  local tail_txt
  tail_txt=$(tail -c 400000 "$f" 2>/dev/null || true)
  b=$( printf '%s' "$tail_txt" | grep -oE 'apps[\\/]+copiloto|motor[\\/]+backend|deploy[\\/]+worker' | wc -l)
  fr=$(printf '%s' "$tail_txt" | grep -oE 'apps[\\/]+mobile|packages[\\/]+core'                      | wc -l)
  if   [ "$b" -gt "$fr" ] && [ "$b" -gt 0 ]; then echo BACKEND
  elif [ "$fr" -gt 0 ];                      then echo FRONTEND
  else echo '?'; fi
}
vida_be=""; vida_fe=""; ambiguos=""; mt_be=0; mt_fe=0
if [ -n "$PROJS" ]; then
  while IFS= read -r -d '' f; do
    m="$(stat --format=%Y "$f" 2>/dev/null || echo 0)"
    [ $(( (now - m) / 60 )) -gt 240 ] && continue      # ignorar transcripts viejos (>4 h)
    # Se queda con el transcript MÁS FRESCO de cada rótulo, no con el primero que aparece: una
    # sesión deja transcripts viejos al reiniciarse, y quedarse con el primero reporta muerta a
    # una sesión que está trabajando en otro archivo (medido 2026-07-24: "backend 66min" con
    # backend tecleando).
    case "$(etiqueta_transcript "$f")" in
      # VIDA se queda con el más fresco; PRODUCCIÓN acumula TODOS (una sesión que reinicia deja
      # su trabajo repartido entre varios transcripts — ver comentario de `prod_min`).
      BACKEND)  tfs_be="${tfs_be:-} $f"; [ "$m" -gt "${mt_be:-0}" ] && { mt_be="$m"; tf_be="$f"; } ;;
      FRONTEND) tfs_fe="${tfs_fe:-} $f"; [ "$m" -gt "${mt_fe:-0}" ] && { mt_fe="$m"; tf_fe="$f"; } ;;
      '?')      ambiguos="$ambiguos $(basename "$f" | cut -c1-8)" ;;
    esac
  done < <(find $PROJS -maxdepth 1 -name '*.jsonl' -print0 2>/dev/null)
fi
[ "$mt_be" -gt 0 ] && vida_be="$(min_desde "$mt_be")"
[ "$mt_fe" -gt 0 ] && vida_fe="$(min_desde "$mt_fe")"
# Un transcript vivo que no se pudo rotular NO se silencia: podría ser la sesión que creés muerta.
[ -n "$ambiguos" ] && echo "⚠️  transcript(s) vivo(s) SIN rotular:$ambiguos — mirá sus tool calls a mano antes de concluir nada."

# ── PRODUCCIÓN: minutos desde el último turno que MUTÓ algo (Write/Edit) ─────────────────────────
# 🔴 Tercer fallo del mismo sensor (2026-07-24). El mtime del transcript mide "hubo un turno", NO
# "hubo trabajo" — y una sesión con cron de vigía cada 3 min tiene turnos PARA SIEMPRE. Medido:
# frontend con `vida 0min` repitiendo "idéntico al tick anterior, cola vacía, esperando" en CADA
# tick. El sensor daba verde mientras la sesión giraba en vacío, y lo cazó el operador, no el
# instrumento. Un pulso constante no prueba trabajo: prueba que el marcapasos anda.
# El timestamp sale de la línea JSONL del último tool_use mutante, no del mtime del archivo.
prod_desde() {   # minutos desde el último acto PRODUCTIVO del transcript, o 9999 si no hay ninguno
  # 🔴 "Producir" NO es sólo escribir archivos. Medido 2026-07-24 (6º falso positivo del sensor):
  # backend tenía el hito implementado y estaba corriendo tests, commit y push — todo por Bash —,
  # así que llevaba 92 min sin un Write y el script gritó `GIRA EN VACÍO` sobre la sesión que estaba
  # CERRANDO el hito. La fase de cierre es justamente la que no toca archivos.
  # Por eso cuenta también el Bash que MUTA o VERIFICA (git commit/push/merge, pytest, deploy, sync),
  # y sigue SIN contar el Bash de lectura (ls, cat, grep, git status) — que es el que un turno ocioso
  # repite sin avanzar. Sin ese filtro la métrica se vuelve un pulso más, y ya tenemos uno: VIDA.
  local f="$1"
  [ -f "$f" ] || { echo 9999; return; }
  tail -c 3000000 "$f" 2>/dev/null | python -c "
import sys, json, datetime, re
MUT = {'Write','Edit','MultiEdit','NotebookEdit'}
CMD_PRODUCTIVO = re.compile(r'git\s+(commit|push|merge|cherry-pick|tag)|gh\s+pr\s+(create|merge)|pytest|npm\s+(run|test)|yarn\s+(test|build)|deploy|sync-(test-)?backend|adb\s+', re.I)
ult = None
for l in sys.stdin:
    if '\"tool_use\"' not in l: continue
    try: d = json.loads(l)
    except Exception: continue
    c = (d.get('message') or {}).get('content')
    if not isinstance(c, list): continue
    prod = False
    for b in c:
        if b.get('type') != 'tool_use': continue
        if b.get('name') in MUT:
            prod = True; break
        if b.get('name') == 'Bash' and CMD_PRODUCTIVO.search(str((b.get('input') or {}).get('command',''))):
            prod = True; break
    if prod:
        ult = d.get('timestamp') or ult
if not ult:
    print(9999); raise SystemExit
try:
    t = datetime.datetime.fromisoformat(str(ult).replace('Z','+00:00'))
    print(int((datetime.datetime.now(datetime.timezone.utc) - t).total_seconds() // 60))
except Exception:
    print(9999)
" 2>/dev/null || echo 9999
}
# 🔴 PRODUCCIÓN se calcula sobre TODOS los transcripts de cada rótulo, no sólo el más fresco.
# Razón medida (2026-07-24, 4º fallo del mismo sensor): cuando una sesión REINICIA, su transcript
# nuevo es el más fresco pero todavía no tiene ningún Write/Edit → `prod_desde` devolvía 9999 y
# disparaba un `🌀 GIRA EN VACÍO` FALSO sobre una sesión que estaba tecleando en el transcript
# anterior. El trabajo de una sesión vive repartido entre sus reinicios: hay que mirarlos todos y
# quedarse con el Write/Edit MÁS RECIENTE de cualquiera de ellos.
prod_min() {   # imprime el MENOR "minutos desde el último Write/Edit" entre los transcripts dados
  local mejor=9999 v
  for f in "$@"; do
    [ -n "$f" ] || continue
    v="$(prod_desde "$f")"
    [ "$v" -lt "$mejor" ] && mejor="$v"
  done
  echo "$mejor"
}
prod_be="$(prod_min ${tfs_be:-})"
prod_fe="$(prod_min ${tfs_fe:-})"
echo "PRODUCCIÓN (último Write/Edit): backend ${prod_be}min · frontend ${prod_fe}min"

# Alarma propia: viva pero improductiva = gira en vacío. Es el caso que el umbral de VIDA no ve.
for par in "backend:${vida_be:-9999}:${prod_be}" "frontend:${vida_fe:-9999}:${prod_fe}"; do
  s="${par%%:*}"; rest="${par#*:}"; v="${rest%%:*}"; p="${rest##*:}"
  if [ "${v:-9999}" -lt "$UMBRAL_OCIO" ] && [ "$p" -ge "$UMBRAL_MUERTA" ]; then
    echo "🌀 $s GIRA EN VACÍO — transcript fresco (${v}min) pero sin mutar nada hace ${p}min."
    echo "   Su cron le da pulso, no trabajo. NO es dead-man: es OCIO. Reasignale algo YA (recon"
    echo "   read-only del hito siguiente, §0 de reutilización, de-risk) o confirmá ocio legítimo."
  fi
done
[ -n "$vida_be" ] && echo "VIDA (transcript): backend ${vida_be}min" || echo "VIDA (transcript): backend — sin transcript reciente"
[ -n "$vida_fe" ] && echo "VIDA (transcript): frontend ${vida_fe}min" || echo "VIDA (transcript): frontend — sin transcript reciente"

# ¿Es de noche? (para el push inmediato del bloqueo operator-only). 00:00–08:00 local.
hora="$(date +%H)"; es_noche=0; { [ "$hora" -ge 0 ] && [ "$hora" -lt 8 ]; } && es_noche=1

# Markers de bloqueo operator-only pendientes
bloqueos="$(find "$ABIERTO" -maxdepth 1 -type f -name "bloqueo-operador_*.md" 2>/dev/null | sort || true)"

echo "OCIO: backend ${min_be}min · frontend ${min_fe}min  (umbral parada ${UMBRAL_OCIO}min · muerta ${UMBRAL_MUERTA}min)"

alarma=0

# ── (D) Dead-man's-switch ──────────────────────────────────────────────────────
for par in "backend:$min_be:$vida_be" "frontend:$min_fe:$vida_fe"; do
  s="$(echo "$par" | cut -d: -f1)"; m="$(echo "$par" | cut -d: -f2)"; v="$(echo "$par" | cut -d: -f3)"
  # 🔴 La prueba de vida es el TRANSCRIPT, no el buzón. Una sesión con transcript fresco está
  # TRABAJANDO aunque no postee — eso NO es dead-man, es "trabaja y no reporta" (señal mucho más leve).
  if [ -n "$v" ] && [ "$v" -lt "$UMBRAL_MUERTA" ]; then
    [ "$m" -ge 90 ] && echo "ℹ️  $s VIVO (transcript ${v}min) pero sin postear al buzón hace ${m}min — trabaja sin reportar. Recordale un \`avance_\` por hito; NO es dead-man."
    continue
  fi
  # 🔴 CEGUERA ≠ MUERTE. Si no encontré NINGÚN transcript suyo, lo que medí es la ausencia de mi
  # propia señal, no la ausencia de trabajo: un vacío es una PREGUNTA, no un hallazgo. Sin este
  # corte el bloque de abajo cae al sensor del buzón y afirma dead-man sobre una sesión que puede
  # estar mergeando PRs (medido 2×, 2026-08-07). El control positivo es barato y externo al
  # transcript — que la sesión ACTÚE en el remoto — así que se exige ANTES de declarar nada.
  if [ -z "$v" ]; then
    echo "🕶️  $s SIN SEÑAL: no veo ningún transcript suyo (buzón mudo ${m}min). Eso es CEGUERA, no muerte."
    echo "    → CORRÉ EL CONTROL antes de afirmar nada: \`gh pr list --state all -L 5\` y \`git log origin/main -3\`."
    echo "       Si abrió/mergeó algo hace poco, está VIVA y este sensor no la alcanza (¿corre en un worktree?)."
    # El rótulo sale del prompt del CRON que la sesión recibe — así que una sesión SIN cron instalado
    # es literalmente irrotulable, y sus turnos caen en `ambiguos`. Ese es el caso que fabricó los dos
    # falsos dead-man del 2026-08-07: había un transcript vivo a la vista, contado como "sin rotular",
    # mientras el bloque de abajo declaraba muerta a la única sesión que podía ser. Atarlos es lo que
    # convierte dos señales sueltas en una respuesta.
    [ -n "$ambiguos" ] && echo "    → ⚠️  Y hay transcript(s) vivo(s) SIN rotular ($ambiguos): PUEDE SER ÉSTA, trabajando sin cron. Miralos antes de declarar nada."
    continue
  fi
  if [ "$m" -ge "$UMBRAL_MUERTA" ]; then
    alarma=1
    echo "🔔 DEAD-MAN ($s muda ${m}min ≥ ${UMBRAL_MUERTA}): la REPL o su heartbeat pueden estar caídos."
    echo "    → 1) PushNotification al operador: \"$s REPL/cron muda ${m}min — pegale su cron o revivíla\"."
    echo "    → 2) REASIGNÁ a planificación TODO blocker de $s que sea resoluble sin su REPL"
    echo "         (grep, contrato, lectura, decisión táctica). No esperes a que reviva."
    echo "    → 3) Dejá 'dato_planificacion-a-${s}_reactiva-tu-cron.md' en abierto/ (best-effort:"
    echo "         lo lee al despertar por cualquier vía y se auto-reinstala el heartbeat, CRONES.md)."
  fi
done

# ── Bloqueo operator-only → push (de noche, inmediato) ──────────────────────────
if [ -n "$bloqueos" ]; then
  while IFS= read -r bf; do
    [ -z "$bf" ] && continue
    m="$(min_desde "$(stat --format=%Y "$bf" 2>/dev/null || echo 0)")"
    ask="$(grep -m1 -E '^ASK:' "$bf" 2>/dev/null | sed 's/^ASK:[[:space:]]*//' || true)"
    if { [ "$es_noche" = "1" ] && [ "$m" -ge 1 ]; } || [ "$m" -ge "$UMBRAL_BLOQUEO" ]; then
      alarma=1
      echo "🔔 BLOQUEO OPERADOR (${m}min, $([ "$es_noche" = 1 ] && echo NOCHE || echo día)): $(basename "$bf")"
      echo "    → PushNotification YA: \"${ask:-decisión pendiente, ver buzón}\""
    fi
  done <<< "$bloqueos"
fi

# ── Triada obligatoria si hay ocio (prohíbe el "hold" pasivo) ───────────────────
hay_ocio=0; { [ "$min_be" -ge "$UMBRAL_OCIO" ] || [ "$min_fe" -ge "$UMBRAL_OCIO" ]; } && hay_ocio=1
if [ "$hay_ocio" = "1" ]; then
  echo "─────────────────────────────────────────────────────────────────────────"
  echo "⛔ OCIO DETECTADO — PROHIBIDO responder \"sigo el vigía\" antes de descartar, en orden:"
  echo "  (A) ¿Hay un blocker RESOLUBLE POR PLANIFICACIÓN? — un [ASSUMED_PENDING_VERIFY], una Q de"
  echo "      seam, un contrato sin bajar, un grep, una lectura. Buscalo y RESOLVELO este ciclo:"
  grep -rlE 'ASSUMED_PENDING_VERIFY|PREGUNTA →|Q[0-9]|pendiente-de-backend|espera.*contrato' \
       "$ABIERTO" 2>/dev/null | sed 's/^/        · /' | head -8 || true
  echo "  (B) ¿Hay BACKLOG independiente? — COLA-VIVA (corré cola-check.sh), Bandeja, memoria sin"
  echo "      commitear, PLAN por actualizar, prep del próximo hito (de-risk, NO implementar)."
  echo "  (D) ¿Alguna sesión muda ≥${UMBRAL_MUERTA}min? — ver arriba."
  echo "  → Ocio LEGÍTIMO sólo si (A) y (B) vacíos Y el bloqueo es operator-only con push ya emitido."
  echo "     Regla dura: PLANIFICACIÓN NUNCA está ociosa con la cola no vacía."
  alarma=1
fi

if [ "$alarma" = "0" ]; then
  [ "$QUIET" = "1" ] && exit 0
  echo "OCIO: ✅ ambas sesiones activas dentro de umbral — sin acción."
fi
exit 0
