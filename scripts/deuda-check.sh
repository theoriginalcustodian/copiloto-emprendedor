#!/usr/bin/env bash
# deuda-check.sh — Un disparador cumplido en el registro de deuda tiene que gritar solo.
#
# CAUSA RAÍZ que resuelve (2026-08-12, informe G8 §5 lección 4): el registro de deuda
# (docs/copiloto-emprendedor/Auditorias/2026-08-12-DEUDA-diferidos-con-dueno-y-fecha.md) es bueno
# guardando QUÉ falta, DE QUIÉN es y CUÁNDO arranca — y no tenía NINGÚN mecanismo que avisara
# cuando el "cuándo" ocurría. Ese día:
#   - D7 (5º except mudo de D-A) se difirió a «junto con D-A del lote B» y después a «lote C».
#     Los dos lotes cerraron el mismo día (15:40 y 18:12). El ítem no se movió.
#   - D5 se difirió a «tras el lote C». Mismo cierre de las 18:12. Tampoco se movió.
# Backend cerró su ciclo declarando cola vacía DE BUENA FE: abierto/ y en-curso/ estaban vacíos.
# La cola vive en DOS lugares y sólo uno se miraba solo. Costó ~2 h de dos sesiones y dejó G2/G3/G8
# abiertos por un except de dos líneas que nadie sabía que estaba pendiente.
#
# NO INVENTA UN IDIOMA NUEVO: es el mismo mecanismo de cola-check.sh sobre el bloque COLA-VIVA de
# PLAN.md, que ya resolvió exactamente este problema para los hitos (4 h de fábrica parada el
# 2026-07-23, «disparador cumplido y nadie lo arrancó»). Bloque delimitado + una línea por ítem +
# campo estado explícito. Si aquél funcionó tres semanas, éste no necesita ser distinto.
#
# POR QUÉ NO PARSEA LA TABLA EN PROSA: la tabla tiene el disparador en lenguaje natural
# («tras el lote C», «1er sprint post-beta», «al modificar FORCE RLS»). Un parser que intente
# interpretarlo es un instrumento que confirma en vez de verificar — la familia de fallas que ya
# costó un frente entero en este repo. Sólo se evalúa la forma `@<id>`, que es inequívoca; el resto
# se muestra como texto y NUNCA se da por cumplido.
#
# MODO DE FALLA ELEGIDO: sobre-reportar, jamás sub-reportar. Un id mal escrito en un disparador
# `@x` se reporta como roto (ruidoso pero visible); nunca se silencia una fila.
#
# Uso:
#   scripts/deuda-check.sh                 # estado completo del registro, legible
#   scripts/deuda-check.sh --quiet         # SÓLO imprime si hay disparadores cumplidos (para crones)
#   scripts/deuda-check.sh --rol backend   # filtra por dueño (subcadena, case-insensitive)
#   DEUDA_FILE=/tmp/x scripts/deuda-check.sh   # override para test
#
# Exit code: 0 = sin disparadores cumplidos · 1 = hay al menos uno cumplido y sin cerrar.
set -uo pipefail   # SIN -e: este script se compone dentro de vigilancia-check.sh

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEUDA="${DEUDA_FILE:-$REPO_ROOT/docs/copiloto-emprendedor/Auditorias/2026-08-12-DEUDA-diferidos-con-dueno-y-fecha.md}"
QUIET=0
ROL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --quiet) QUIET=1 ;;
    --rol)   ROL="$(printf '%s' "${2:-}" | tr '[:upper:]' '[:lower:]')"; shift ;;
  esac
  shift
done

if [ ! -f "$DEUDA" ]; then
  # Fail-LOUD, no fail-open: si el registro no está donde se espera, el silencio sería
  # indistinguible de "no hay deuda" — que es justo el fallo que este script existe para impedir.
  echo "⚠️  DEUDA: no existe $DEUDA — el registro no se pudo leer, esto NO es 'sin deuda'."
  exit 1
fi

bloque="$(awk '/DEUDA-VIVA:INICIO/{on=1;next} /DEUDA-VIVA:FIN/{on=0} on' "$DEUDA" \
          | grep -vE '^\s*```' | grep -E '\|' || true)"

if [ -z "$bloque" ]; then
  echo "⚠️  DEUDA: no encuentro el bloque DEUDA-VIVA en $(basename "$DEUDA") (¿marcadores movidos?)."
  echo "    Verificá a mano — un bloque ausente no es un registro vacío."
  exit 1
fi

# ── Paso 1: cargar el bloque entero antes de juzgar nada ─────────────────────────────────────
# Hace falta la tabla completa en memoria porque un disparador `@x` mira el estado de OTRA fila:
# no se puede decidir fila por fila en una sola pasada.
ids=(); duenos=(); disps=(); estados=()
while IFS='|' read -r id dueno disp estado; do
  id="$(printf '%s' "$id" | tr -d ' ')"; [ -z "$id" ] && continue
  ids+=("$id")
  duenos+=("$(printf  '%s' "$dueno"  | sed -E 's/^ +| +$//g')")
  disps+=("$(printf   '%s' "$disp"   | sed -E 's/^ +| +$//g')")
  estados+=("$(printf '%s' "$estado" | tr -d ' ' | tr '[:upper:]' '[:lower:]')")
done <<< "$bloque"

estado_de() {   # estado de un id, o "" si no existe
  local buscado="$1" i
  for i in "${!ids[@]}"; do
    [ "${ids[$i]}" = "$buscado" ] && { printf '%s' "${estados[$i]}"; return; }
  done
  printf ''
}

# ── Paso 2: veredicto por fila ───────────────────────────────────────────────────────────────
cumplidos=(); rotos=(); abiertos=0; cerrados=0
for i in "${!ids[@]}"; do
  id="${ids[$i]}"; dueno="${duenos[$i]}"; disp="${disps[$i]}"; estado="${estados[$i]}"

  if [ "$estado" = "cerrado" ]; then cerrados=$((cerrados + 1)); continue; fi
  abiertos=$((abiertos + 1))

  # SÓLO `abierto` puede alarmar. Una fila ya tomada (`en-curso`) o parada por una decisión ajena
  # (`bloqueado`) tiene dueño mirándola: gritarle cada 3 min sería la alarma-que-suena-siempre que
  # ya se corrigió en el watchdog (#394/#400) — y una alarma que suena siempre enseña a saltearla,
  # que es peor que no tenerla. Lo que este script caza es el hueco exacto: disparador cumplido y
  # NADIE la tomó.
  [ "$estado" != "abierto" ] && continue

  # Filtro por rol DESPUÉS de contar: los totales son del registro entero, no del filtro.
  if [ -n "$ROL" ] && ! printf '%s' "$dueno" | tr '[:upper:]' '[:lower:]' | grep -q "$ROL"; then
    continue
  fi

  case "$disp" in
    @*)
      dep="${disp#@}"
      dep_estado="$(estado_de "$dep")"
      if [ -z "$dep_estado" ]; then
        # Referencia colgada: se GRITA. Un `@lote-D` que no existe se cumpliría "nunca" en
        # silencio, y esa es exactamente la falla original con otro disfraz.
        rotos+=("$id ($dueno) → disparador @$dep NO EXISTE en el bloque")
      elif [ "$dep_estado" = "cerrado" ]; then
        cumplidos+=("$id · dueño $dueno · disparador @$dep ya está CERRADO")
      fi
      ;;
  esac
done

# ── Paso 3: salida ───────────────────────────────────────────────────────────────────────────
hay_alarma=0
[ "${#cumplidos[@]}" -gt 0 ] && hay_alarma=1
[ "${#rotos[@]}"     -gt 0 ] && hay_alarma=1

if [ "$hay_alarma" = "1" ]; then
  if [ "${#cumplidos[@]}" -gt 0 ]; then
    echo "⚠️  DEUDA: ${#cumplidos[@]} fila(s) con el DISPARADOR CUMPLIDO y sin cerrar${ROL:+ (rol: $ROL)}"
    for c in "${cumplidos[@]}"; do echo "    · $c"; done
    echo "    → NO es una decisión de scope: el disparador es el permiso. Tomala o movela con"
    echo "      dueño y disparador nuevos. Dejarla quieta es como quedó D7 el 2026-08-12."
  fi
  if [ "${#rotos[@]}" -gt 0 ]; then
    echo "❌ DEUDA: ${#rotos[@]} disparador(es) apuntan a un id inexistente — se cumplirían NUNCA:"
    for r in "${rotos[@]}"; do echo "    · $r"; done
  fi
  exit 1
fi

[ "$QUIET" = "1" ] && exit 0
echo "DEUDA: ✅ $abiertos abierta(s) · $cerrados cerrada(s) · 0 con disparador cumplido${ROL:+ (rol: $ROL)}"
exit 0
