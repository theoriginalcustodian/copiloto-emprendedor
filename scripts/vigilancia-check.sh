#!/usr/bin/env bash
# vigilancia-check.sh — Gancho 1: vigilancia determinista, decide si hay alarma.
#
# CAUSA RAÍZ que resuelve (docs/aprendizajes/pendientes/2026-07-24_vigilancia-determinista-fuera-del-modelo.md):
# cada latido del Cron 1 despertaba al modelo caro para listar carpetas y comparar mtimes A MANO —
# 465 turnos de cron contra 149 de una persona en 12h (76%), y planificación consumió 52.6% de los
# tokens del sprint sin escribir una línea de producto (scripts/metricas-sesiones.py). La MEDICIÓN
# es determinista; el JUICIO (qué hago con esto) sí necesita modelo.
#
# Este script HACE la medición y decide. El Cron 1 lo corre primero: si sale 0 (sin alarma), el
# turno se cierra en una línea sin gastar razonamiento. Si sale 1, el turno ocurre y usa el reporte
# de este script como punto de partida — no reconstruye la medición a mano.
#
# Compone piezas YA existentes, no las reinventa:
#   - scripts/cola-check.sh         (COLA: hito arrancable sin arrancar). Se usa TAL CUAL, sin
#     tocarlo — su contrato "--quiet: sólo imprime si hay algo que atender" ya es exactamente lo
#     que este script necesita (su exit code no distingue alarma, así que la señal es "¿imprimió
#     algo?", no el exit code).
#   - scripts/escaladores-buzon.sh  (Gancho 3: contrato_/pedido_/en-curso viejos). Exit 0/1 real.
#   - VIDA por transcript: mtime PURO de los .jsonl de sesión, SIN inferir contenido, identidad ni
#     productividad — esa heurística (no-ocio-check.sh) falló 6 veces seguidas y está PROHIBIDA
#     para juzgar si una sesión trabaja (.claude/commands/monitoreo.md). Acá sólo se mide "hace
#     cuántos minutos escribió algo", que es justamente lo que no le costó nada acertar.
#
# LÍMITE DOCUMENTADO: cola-check.sh deriva su propio PLAN.md desde SU PATH de script, no acepta
# override — así que el chequeo de COLA sólo corre contra el buzón REAL (coordinacion/ del repo).
# Contra un buzón de prueba (BUZON_DIR apuntando a un fixture sin PLAN.md) ese paso se salta solo
# (no hay PLAN.md ahí) — no hace falta tocar cola-check.sh para poder probar este script aislado.
#
# Uso:
#   scripts/vigilancia-check.sh                  # contra el buzón y transcripts reales
#   scripts/vigilancia-check.sh --quiet           # igual, pero sin la línea "sin novedades"
#   BUZON_DIR=/tmp/x TRANSCRIPTS_DIR=/tmp/y scripts/vigilancia-check.sh   # override para test
#
# Exit code: 0 = sin novedades (no despertar al modelo) · 1 = alarma (reporte a stdout).
set -uo pipefail   # SIN -e: un chequeo que falle no debe abortar los demás

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUZON="${BUZON_DIR:-$REPO_ROOT/coordinacion}"
TRANSCRIPTS="${TRANSCRIPTS_DIR:-$HOME/.claude/projects/c--Proyectos-Claude-Claude-code-copiloto-emprendedor}"
UMBRAL_MUERTA_MIN="${UMBRAL_MUERTA_MIN:-30}"
QUIET=0
DRY_RUN=0
for arg in "$@"; do
  [ "$arg" = "--quiet" ] && QUIET=1
  [ "$arg" = "--dry-run" ] && DRY_RUN=1
done

alarma=0
reporte=()
add() { reporte+=("$1"); alarma=1; }

# ── 1) COLA: hito arrancable sin arrancar (sólo aplica al buzón real, ver nota arriba) ─────────
if [ -f "$BUZON/PLAN.md" ]; then
  cola_out="$(bash "$REPO_ROOT/scripts/cola-check.sh" --quiet 2>&1 || true)"
  [ -n "$cola_out" ] && add "COLA:
$cola_out"
fi

# ── 2) ESCALADORES DE EDAD (Gancho 3): contrato_/pedido_/en-curso viejos ───────────────────────
# --dry-run se propaga: permite correr TODO este script contra el buzón real sin escribir
# urgente_ — sólo lectura, útil para smoke-test/evidencia sin riesgo de mutar el canal vivo.
if [ "$DRY_RUN" = "1" ]; then
  esc_out="$(bash "$REPO_ROOT/scripts/escaladores-buzon.sh" --dry-run "$BUZON" 2>&1)"
else
  esc_out="$(bash "$REPO_ROOT/scripts/escaladores-buzon.sh" "$BUZON" 2>&1)"
fi
esc_rc=$?
[ "$esc_rc" -ne 0 ] && add "ESCALADORES:
$esc_out"

# ── 2.bis) LINT de contratos: un contrato_ nuevo sin artefacto es prosa ambigua ──────────────
# Regla del formato desde 2026-07-26 (context engineering): todo contrato_/addendum_ baja con
# ≥1 referencia RICA (shape/test/ejemplo en bloque cercado, o path a artefacto). El lint tiene
# grandfather: los contratos previos no alarman. Detalle en el propio script.
lint_out="$(bash "$REPO_ROOT/scripts/lint-contratos-referencias.sh" --quiet 2>&1)"
lint_rc=$?
[ "$lint_rc" -ne 0 ] && add "CONTRATOS SIN ARTEFACTO:
$lint_out"

# ── 2.ter) MAIL FRESCO para planificación: nadie lo mira hasta el vigía (cada 20min) ────────────
# Causa raíz (2026-08-03, hallazgo del operador): ni este chequeo ni el de sesiones ociosas leían
# abierto/ — sólo COLA/ESCALADORES/VIDA, ninguno es "¿hay correo nuevo dirigido a mí?". Un
# avance_/cierre_ backend-a-planificacion podía esperar hasta 20min (la cadencia del vigía v3) sin
# que el gate de 3min lo viera, porque un mensaje nuevo no es ociosidad ni parálisis — es lo
# opuesto. Ventana de 5min (> intervalo del cron de 3min + margen de jitter): un archivo -a-
# planificacion_/-a-todos_ más nuevo que eso es necesariamente correo que ningún ciclo previo pudo
# haber visto. Se apaga solo pasados 5min (no hay estado "leído" que trackear) — alarma como mucho
# una vez por archivo, en el ciclo inmediato siguiente a su llegada.
#
# `! -iname '*_planificacion-a-*'` (2026-08-06, medido): sin esto el gate se alarmaba con los
# broadcasts que ESTA MISMA sesión acababa de escribir — un `dato_planificacion-a-todos_…` matchea
# `*-a-todos_*`. Cada mensaje propio quemaba el ciclo siguiente releyendo lo que uno mismo redactó
# treinta segundos antes. El vigía v3 ya descartaba lo propio por esta razón ("son tuyos:
# notificarlos es ruido disfrazado de novedad"); el gate de 3min nunca copió esa mitad de la regla.
# Ojo con el patrón: `*_planificacion-a-*`, no `planificacion-a-*`, porque el nombre arranca con la
# fecha (`2026-08-06_dato_planificacion-a-todos_…`) — anclar al principio no matchearía nunca, y ése
# es el modo de fallar en silencio de este filtro: no rompe nada, sólo deja de filtrar.
mail_out="$(find "$BUZON/abierto" -maxdepth 1 -type f \( -iname '*-a-planificacion_*' -o -iname '*-a-todos_*' \) ! -iname '*_planificacion-a-*' -newermt '-5 minutes' -printf '%f\n' 2>/dev/null)"
[ -n "$mail_out" ] && add "MAIL FRESCO (sin ver aún, <5min):
$mail_out"

# ── 3) VIDA por transcript: mtime puro, sin inferir contenido ──────────────────────────────────
# Rotula por el MARCADOR DEL PROMPT DEL CRON ("sesión BACKEND"/"FRONTEND"/"PLANIFICACIÓN"), la
# misma técnica de etiqueta_transcript() en no-ocio-check.sh — validada (8/0/0, medido 2026-07-24,
# COORDINACION.md §4.2.sexies). Se reusa SÓLO esa mitad (identidad por marcador + mtime); se
# descarta a propósito la mitad que falló 6 veces (inferir SI trabaja/gira-en-vacío por contenido)
# — esa pregunta la resuelve ultimas-acciones.sh + juicio humano, nunca este script.
#
# Por qué hace falta rotular y no mirar "cualquier .jsonl <4h": medido en esta sesión (2026-07-24)
# — sin filtrar por rol, el repo real tiene >10 transcripts de ventanas YA CERRADAS pero <4h de
# antigüedad, que dispararon 15 falsas "SESION MUDA" en una sola corrida. Sin este filtro el
# gancho se autosilencia en una semana por ruido — exactamente el fallo que el pendiente advierte.
if [ -d "$TRANSCRIPTS" ]; then
  now="$(date +%s)"
  mt_be=0; mt_fe=0; mt_pl=0; mt_me=0; mt_sin_rol=0
  while IFS= read -r -d '' f; do
    m="$(stat -c %Y "$f" 2>/dev/null || echo 0)"
    # ⚠️ El rol se cuenta SÓLO dentro de las líneas que son el PROMPT DEL CRON que esta ventana
    # RECIBE — no en cualquier mención del texto. Contar menciones sueltas ya falló dos veces:
    # una sesión que le escribe contratos a otra la nombra más que a sí misma. Medido 2026-07-24
    # en el transcript de PLANIFICACIÓN mientras trabajaba: 'sesión BACKEND' 4 · 'FRONTEND' 2 ·
    # 'PLANIFICACIÓN' 2 → se rotulaba a sí misma como BACKEND. La identidad la asigna quien manda
    # el cron, no el contenido del trabajo. (En JSONL cada mensaje es UNA línea, así que el prompt
    # del cron entero cae en una sola.)
    cron_txt="$(tail -c 400000 "$f" 2>/dev/null | grep -E 'Vig[ií]a de coordinaci[oó]n|Control de (sesiones|SESIONES)|Monitor de PAR[AÁ]LISIS' || true)"
    b=$( printf '%s' "$cron_txt" | grep -oc 'sesión BACKEND' || true)
    fr=$(printf '%s' "$cron_txt" | grep -oc 'sesión FRONTEND' || true)
    pl=$(printf '%s' "$cron_txt" | grep -oc 'sesión PLANIFICACIÓN' || true)
    me=$(printf '%s' "$cron_txt" | grep -oc 'sesión MANEJO DE ERRORES' || true)
    # Sin marcador NO es "no es una sesión vigilada": puede ser una ventana viva cuyo cron está
    # apagado. Se registra aparte — abajo bloquea la alarma. Medido 2026-07-24: con los crones
    # borrados, la ventana de planificación que estaba ESCRIBIENDO quedó sin marcador y el script
    # rotuló como PLANIFICACION a una ventana vieja que sí lo tenía, alarmando en falso sobre una
    # sesión activa. La identidad sale del cron; sin cron no hay identidad, y "no sé" no se
    # resuelve eligiendo otro archivo.
    if [ $((b + fr + pl + me)) -eq 0 ]; then
      [ "$m" -gt "$mt_sin_rol" ] && mt_sin_rol="$m"
      continue
    fi
    # Máximo entre los 4 — mismo criterio que antes (gana el conteo más alto; PLANIFICACIÓN
    # desempata primero por ser la que más se auto-nombra en contratos ajenos, ver nota arriba).
    if   [ "$pl" -ge "$b" ] && [ "$pl" -ge "$fr" ] && [ "$pl" -ge "$me" ]; then rol=PLANIFICACION
    elif [ "$b"  -ge "$fr" ] && [ "$b"  -ge "$me" ];                          then rol=BACKEND
    elif [ "$fr" -ge "$me" ];                                                 then rol=FRONTEND
    else                                                                          rol=MANEJO_DE_ERRORES
    fi
    case "$rol" in
      BACKEND)           [ "$m" -gt "$mt_be" ] && mt_be="$m" ;;
      FRONTEND)          [ "$m" -gt "$mt_fe" ] && mt_fe="$m" ;;
      PLANIFICACION)      [ "$m" -gt "$mt_pl" ] && mt_pl="$m" ;;
      MANEJO_DE_ERRORES) [ "$m" -gt "$mt_me" ] && mt_me="$m" ;;
    esac
  # -newermt '-4 hours': mismo filtro que no-ocio-check.sh para ignorar transcripts de sesiones
  # cerradas hace días (ventanas viejas no son "sesión muda hoy", son ruido de fondo).
  done < <(find "$TRANSCRIPTS" -maxdepth 1 -name '*.jsonl' -newermt '-4 hours' -print0 2>/dev/null)

  for par in "BACKEND:$mt_be" "FRONTEND:$mt_fe" "PLANIFICACION:$mt_pl" "MANEJO_DE_ERRORES:$mt_me"; do
    rol="${par%%:*}"; mt="${par##*:}"
    [ "$mt" -eq 0 ] && continue   # sin transcript rotulado <4h para ese rol -> sin señal, no alarma
    edad=$(( (now - mt) / 60 ))
    if [ "$edad" -ge "$UMBRAL_MUERTA_MIN" ]; then
      # Si hay una ventana ACTIVA sin rol identificable, podría ser justamente ésta: callar.
      # Falso negativo (no avisar de una muda real) es recuperable; falso positivo repetido
      # silencia el watchdog en una semana y lo deja de existir.
      edad_sin_rol=$(( (now - mt_sin_rol) / 60 ))
      if [ "$mt_sin_rol" -gt 0 ] && [ "$edad_sin_rol" -lt "$UMBRAL_MUERTA_MIN" ]; then
        add "AVISO: hay una ventana activa (hace ${edad_sin_rol}min) SIN rol identificable — ¿crones apagados? No se juzga a $rol con este dato."
      else
        add "SESION MUDA: $rol sin escribir hace ${edad}min (umbral ${UMBRAL_MUERTA_MIN}min)."
      fi
    fi
  done
fi

# ── Veredicto ────────────────────────────────────────────────────────────────────────────────
if [ "$alarma" = "1" ]; then
  printf '%s\n' "${reporte[@]}"
  exit 1
fi
[ "$QUIET" = "1" ] || echo "VIGILANCIA: sin novedades — $(date '+%Y-%m-%d %H:%M')."
exit 0
