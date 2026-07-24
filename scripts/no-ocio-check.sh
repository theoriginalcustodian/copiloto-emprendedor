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
PROJ="$(ls -d "$HOME/.claude/projects/"*"$(basename "$REPO_ROOT")" 2>/dev/null | head -1)"
etiqueta_transcript() {   # imprime BACKEND|FRONTEND|PLANIFICACION|? según el marcador dominante
  local f="$1" b fr pl
  b=$(tail -c 1000000 "$f" 2>/dev/null | grep -c 'sesión BACKEND' || true)
  fr=$(tail -c 1000000 "$f" 2>/dev/null | grep -c 'sesión FRONTEND' || true)
  pl=$(tail -c 1000000 "$f" 2>/dev/null | grep -c 'sesión PLANIFICACIÓN' || true)
  if   [ "$b"  -ge "$fr" ] && [ "$b"  -ge "$pl" ] && [ "$b"  -gt 0 ]; then echo BACKEND
  elif [ "$fr" -ge "$pl" ] && [ "$fr" -gt 0 ];                        then echo FRONTEND
  elif [ "$pl" -gt 0 ];                                                then echo PLANIFICACION
  else echo '?'; fi
}
vida_be=""; vida_fe=""
if [ -n "$PROJ" ]; then
  while IFS= read -r -d '' f; do
    m="$(stat --format=%Y "$f" 2>/dev/null || echo 0)"
    [ $(( (now - m) / 60 )) -gt 240 ] && continue      # ignorar transcripts viejos (>4 h)
    case "$(etiqueta_transcript "$f")" in
      BACKEND)  [ -z "$vida_be" ] && vida_be="$(min_desde "$m")" ;;
      FRONTEND) [ -z "$vida_fe" ] && vida_fe="$(min_desde "$m")" ;;
    esac
  done < <(find "$PROJ" -maxdepth 1 -name '*.jsonl' -print0 2>/dev/null)
fi
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
