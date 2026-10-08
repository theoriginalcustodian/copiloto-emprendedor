#!/usr/bin/env bash
# version-instrumento.sh — ¿el instrumento que estoy EJECUTANDO es el de `origin/main`?
#
# FUENTE ÚNICA de esta pregunta. La usan los instrumentos que ejecutan código del working tree
# (`vigilancia-check.sh`, `inventario-ola.sh`, …). No se re-implementa en cada uno: el mismo defecto
# viviendo dos veces hace que el fix llegue a uno solo.
#   → memoria: dos-implementaciones-del-mismo-cliente-el-fix-llega-a-una
#
# EL CASO QUE LA CREÓ (medido 2026-10-08, test diferencial, mismo `PLAN.md`, dos copias del script):
#
#   | | checkout compartido (4a9f4f7c) | origin/main |
#   |---|---|---|
#   | enums "no reconocidos" | 14            | 0                                        |
#   | frentes activos        | no los reporta| 🔥 4 en paralelo                         |
#   | `arrancando`           | SMTPLINKPROD  | SNIPPETMIENTE                            |
#   | bloqueados ⏳           | ninguno       | MAINSINGUARD CIERREB BLO4OUT LEGALNOOPERA|
#   | **exit code**          | **0**         | **0**                                    |
#
# Las dos salen rc=0: `vigilancia-check.sh --quiet` decía «sin novedades» mientras ocultaba 4 items
# bloqueados y nombraba OTRO frente activo. BACKEND levantó las 14 filas como «la lista de enums
# válidos quedó vieja»; era falso —`cola-check.sh` en main ya reconoce `⏸*` (:140) y `⏳*` (:154)—:
# el diff del clasificador entre el checkout y main era +119/-12. El dato no estaba roto y el
# validador tampoco. Estaba viejo el archivo que se ejecutaba.
#   → memoria: el-checkout-compartido-sirve-comandos-viejos · un-instrumento-que-no-mira-nunca-falla
#
# DOS CLASES DE MEDICIÓN, y hoy se trataban como una (distinción de AUDITORÍA, 2026-10-08):
#   · lee `<ref>:<path>` (`git show origin/main:x`, `git grep <ref>`) → INMUNE al checkout.
#   · ejecuta un script del working tree                              → HEREDA su versión.
# Esta función es para la segunda. La primera no la necesita.
#
# POR QUÉ POR CONTENIDO Y NO POR HEAD: el checkout compartido tiene el HEAD viejo *siempre* y ~100
# archivos editados a mano al día. Un guard por HEAD gritaría en cada latido y se desarmaría solo
# (memoria: el-guard-que-grita-en-el-caso-normal-se-desarma-solo). Por contenido habla sólo cuando
# la pieza que se va a ejecutar difiere de la de main, que es cuando el veredicto no es confiable.
#
# CONTRATO
#   instrumento_divergente <repo_root> <pieza-relativa>...
#     stdout : una línea por pieza divergente / ausente / no verificable, vacío si todo coincide
#     rc  0  : todas las piezas coinciden con el ref  → el veredicto de arriba es confiable
#     rc  1  : al menos una difiere                   → el veredicto puede ser de otra versión
#     rc  2  : NO SE PUDO VERIFICAR (sin git, sin el ref) → NO es un pase. Un vacío del propio
#              instrumento no es un hallazgo: hay que decirlo.  → memoria: vacio-no-es-hallazgo
#   Ref parametrizable con INSTRUMENTO_REF (default `origin/main`) — para test y para flotas que
#   no usan `main`. Cero hardcoding.

instrumento_divergente() {
  local repo="$1"; shift
  local ref="${INSTRUMENTO_REF:-origin/main}"
  local pieza divergentes=() rc=0

  if ! git -C "$repo" rev-parse --git-dir >/dev/null 2>&1; then
    echo "no puedo verificar mi propia versión: '$repo' no es un repo git"
    return 2
  fi
  if ! git -C "$repo" rev-parse --verify --quiet "$ref" >/dev/null 2>&1; then
    echo "no puedo verificar mi propia versión: el ref '$ref' no existe acá (¿nunca se hizo fetch?)"
    return 2
  fi

  for pieza in "$@"; do
    if [ ! -f "$repo/$pieza" ]; then
      divergentes+=("$pieza (NO EXISTE en el working tree)"); rc=1; continue
    fi
    # ¿La pieza existe en el ref? `git diff` sólo mira archivos TRACKEADOS: para una pieza nueva
    # sin commitear dice **«sin diferencia»** — absolución falsa, y de la clase peor, porque falla
    # hacia el "no hay nada". Lo encontró la corrida real del guard sobre sí mismo: su propia lib
    # recién creada no salía listada. La pregunta correcta es por el OBJETO en el ref, no por el
    # archivo en el disco.  → memoria: medir-contra-un-ref-que-no-existe-da-vacio-y-vacio-se-parsea-como-cero
    if ! git -C "$repo" cat-file -e "$ref:$pieza" 2>/dev/null; then
      divergentes+=("$pieza (NO EXISTE en $ref — pieza nueva sin mergear)"); rc=1; continue
    fi
    # `git diff <ref> -- <path>` compara el ref contra el WORKING TREE, que es exactamente el
    # archivo que se va a ejecutar. No es un descuido: es la pregunta.
    #   → memoria: el-instrumento-respondio-sobre-otro-sujeto
    if ! git -C "$repo" diff --quiet "$ref" -- "$pieza" 2>/dev/null; then
      local n
      n="$(git -C "$repo" diff --numstat "$ref" -- "$pieza" 2>/dev/null | awk '{print "+"$1"/-"$2}')"
      divergentes+=("$pieza (${n:-difiere})"); rc=1
    fi
  done

  [ "$rc" = "0" ] && return 0

  # La EDAD del ref va en el reporte, no en el veredicto: si el `origin/main` local es de hace días,
  # «coincide» puede significar «los dos viejos». Que el lector lo vea en vez de que el gate adivine.
  local edad_ct ahora horas=""
  edad_ct="$(git -C "$repo" log -1 --format=%ct "$ref" 2>/dev/null || echo 0)"
  ahora="$(date +%s)"
  [ "$edad_ct" != "0" ] && horas="$(( (ahora - edad_ct) / 3600 ))"
  printf '%s\n' "${divergentes[@]}"
  echo "ref de comparación: $ref = $(git -C "$repo" rev-parse --short=8 "$ref" 2>/dev/null)${horas:+, de hace ${horas}h}"
  return 1
}
