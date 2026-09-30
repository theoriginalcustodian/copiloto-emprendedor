#!/usr/bin/env bash
# plan-drift-check.sh — Una fila que dice `pendiente` mientras el trabajo YA vive en `origin/main`
# desvía trabajo hacia algo ya hecho. Este control mide cada fila contra el EFECTO en el remoto.
#
# Por qué existe (fila `PLANDRIFT`, 2026-09-28): seis filas con dueño FE2 declaraban `pendiente` con el
# contenido ya mergeado. No fue descuido: el dueño de la fila NO edita `PLAN.md` (dueña única:
# planificación), y planificación se entera por el buzón, que sólo muestra lo que alguien decide avisar.
# El agujero vive en el par, no en una sesión. Es el criterio 2 del Cierre A (acta del 2026-09-29).
#
# **NO mide contra un número de PR, a propósito:** `PLACEM` se cerró sin PR que lo reclame. El sujeto
# es el contenido de `origin/main`.
#
# Este script RECOLECTA candidatos; NO dicta veredicto. Una fila con su artefacto presente en `main`
# es un CANDIDATO a drift, no un cierre: el archivo puede existir por otra razón. El veredicto lo da
# la sesión. (memoria: los sub-agentes y los scripts traen datos; el veredicto no se delega)
#
# **La presencia del archivo sola NO es señal — MEDIDO en la v1 de este script:** las 3 filas que marcó
# eran ruido. `DOCANC` cita `LegalScreen.tsx`, que está en `main` porque la feature existe; lo pendiente
# es una corrección de documentación. Un artefacto viejo aparece PRESENTE para toda fila que lo
# mencione, así que «todo lo citado existe» marca medio tablero y se vuelve ignorable — un guard que
# grita en el caso normal se desarma solo.
# El discriminador es **la FECHA**: si `main` tocó el artefacto en o después de la fecha de evidencia de
# la fila, pasó algo después de escribirla → candidato. Si el último cambio es anterior, su presencia no
# informa nada → `PRESENCIA-VIEJA`, que NO es candidato.
#
# ── EL FORMATO DE LA CITA, y por que se documenta ACA ────────────────────────────────────────────
# Una fila puede citar un path por DOS roles distintos, y el detector los trataba igual:
#   * **entregable** — lo que la fila produce. Path a secas. Si `main` lo tocó, es señal.
#   * **fundamento** — la razón por la que la fila dice lo que dice (una lección, un ADR, un acta).
#     Va **entre `(ver: ...)`**, y el extractor lo DESCARTA: que se mueva el fundamento no informa
#     nada sobre si la fila está hecha.
#
# Medido el 2026-09-29 con `FACTIDFIX`, que citaba
# `(memoria/un-criterio-de-cierre-con-algo-fuera-de-alcance-no-se-cumple-nunca.md)` como fundamento:
# `main` lo tocó ese mismo día porque la lección se escribió ese día ⇒ falso positivo garantizado.
#
# **Auditoría refutó por medición las dos salidas que no requieren cambiar el formato:** (a) leer el
# rol de la COLUMNA — las tablas del plan no tienen el mismo número de campos entre sí (6/7, 6/7,
# 4/6) y en `FACTIDFIX` la cita vive dentro de la descripción larga, que mezcla razón y entregable en
# un campo; (b) leer el rol de la ANTIGÜEDAD — un fundamento del 29/09 y un entregable del 29/09
# coexisten, este repo produce lecciones al ritmo de las filas que las citan.
# ⇒ **La información no estaba en el texto, así que ningún parser podía recuperarla.** La raíz era
# el protocolo, no el extractor — y por eso el formato y el parser cambian en el MISMO commit.
#
# **Y se documenta en este docstring, no sólo en `COORDINACION.md`, a propósito:** `coordinacion/`
# está gitignoreada, así que una regla que viva sólo ahí no sobrevive a un clon ni a una limpieza del
# buzón. La lección equivalente del 28/09 se perdió exactamente así.
#
# ── DIRECCIÓN 2 (fila `PLANRECON`, 2026-09-30) — la CARA que nadie mira ─────────────────────────────
# La v1 sólo auditaba `pendiente`→¿ya-hecho? Pero un barrido manual del 30/09 (21 filas no-cerradas
# contra `origin/main`, 3 agentes en paralelo) encontró la inversa en el propio par de filas gemelas
# `IDXMARGEN`/`IDXFORMATO`: EL MISMO commit (`89156496`) actualizó una y dejó la otra citando números
# pre-fix — nada ata "esta fila describe este archivo" en NINGUNA dirección, así que una fila puede
# mentir declarándose `pendiente` (dir. 1) O declarándose `✅ cerrada` sin que la evidencia citada
# exista de verdad (dir. 2). Ninguna sesión audita la segunda porque una fila cerrada deja de pedir
# turno — el mismo mecanismo de `un-disparador-cumplido-no-avisa-a-nadie`, aplicado al cierre en vez
# de al bloqueo.
#
# **El sujeto de la dir. 2 son PR (`#NNN`) y PATHS — a propósito, NO shas.** El primer intento de este
# script sí usaba shas cortos citados entre backticks, y contra el `PLAN.md` real dio **24 "candidatos"
# de 129 filas `✅`** — pero al verificar a mano `LEGAL` (ratchet TS↔Python) y `FACTID` (spike AFIP), las
# DOS estaban genuinamente cerradas: `LEGAL` cierra con PR **#686** (`03e9c200`, confirmado con
# `git log -- scripts/ci/idemkey_paridad.py`) pero la fila cita `c3d3e161`/`cb3756a5` — commits REALES
# (`git cat-file -t` los confirma) que existen en el object store pero son de ANTES del squash, así que
# nunca aparecen en el log de `main` aunque el código sí está ahí. Es la MISMA trampa que
# `merge-base --is-ancestor` sobre la rama (auditoría se equivocó así este mismo día), un nivel más
# abajo: **cualquier sha corto citado puede ser el de la rama pre-squash, no el del commit de squash**,
# y no hay forma de distinguirlos por el string solo. Un guard que grita en el caso normal (2 de 2
# verificados a mano eran falsos positivos) se desarma solo — así que el chequeo por sha se DESCARTA
# por completo, no se ajusta.
#
# Lo que SÍ es estable: el mensaje del commit de squash que escribe GitHub SIEMPRE lleva `(#NNN)` —
# sobrevive al squash porque lo escribe la plataforma, no la rama.
#
# **El chequeo por PATH (reusar `extraer_artefactos`/`existe_en_main` de dir. 1) SE PROBÓ Y TAMBIÉN SE
# DESCARTÓ**, mismo día, mismo método (correr contra el `PLAN.md` real antes de declarar terminado):
# dio **39 "candidatos" de 130 filas `✅`**, y la mayoría citaba cosas que NUNCA van a estar en
# `origin/main` aunque la fila esté perfectamente cerrada — no porque falten, sino porque el SUJETO no
# es este repo: nombres de archivo del buzón (`cierre_…md`, `contrato_…md`; `coordinacion/` está
# GITIGNOREADA, así que "no existe en main" es su estado NORMAL, no una señal — `BOLA`, `ESCRACT`,
# `B1`, `CTXW1`, `CAL1`), bundles con hash de build (`index-CrAcdbep.js`, citados porque la auditoría
# verificó CONTRA PROD, no contra git — `LEGAL`, `DEPLOYLAG`, `ODOBI6`) y paths de OTRO repo
# (`graphify-graytity-bridge/…`, `.bridge/…` — `GRAFO`, `GRAFOTMO`). El extractor de dir. 1 es correcto
# para SU sujeto (`pendiente`→¿ya en main?); reusarlo para dir. 2 asumía que toda fila `✅` cita
# evidencia de ESTE repo, y es falso: una fila cerrada cita lo que la cerró, y buena parte de eso vive
# fuera del árbol de git a propósito (buzón, prod, otro repo). Se descarta, no se filtra caso por caso.
#
# **El PR mismo tiene el problema simétrico del sha: `#NNN` suelto es AMBIGUO.** `OLA0` cita
# `#517 #518 #519` — no son PRs, son numeración interna de actas/planificación. `AACORE` cita
# `#306654` — es un color hex (`#306654`) que por pura coincidencia son todos dígitos. Ninguno de los
# dos es detectable por regex sin contexto. Por eso el extractor exige la FORMA en que este repo
# realmente escribe un PR real: `(#NNN)` entre paréntesis o `PR #NNN` explícito — ambas formas
# aparecen en las filas ya verificadas (`AACORE`: "PR #694"; el propio asunto de squash de GitHub:
# "(#757)"). Un `#NNN` bien real pero escrito sin esa forma (`BIS` cita `#671` a secas) cae en
# NO-MEDIBLE, no en candidato: preferible no medir a acusar por una convención de escritura.
#
# Uso:
#   bash scripts/plan-drift-check.sh              # informe + exit 1 si hay candidatos
#   bash scripts/plan-drift-check.sh --quiet      # sólo el resumen
#   BUZON=/otra/ruta bash scripts/plan-drift-check.sh
#
# Exit: 0 = sin candidatos · 1 = hay candidatos a drift (dir. 1 o dir. 2) · **2 = el instrumento no
# pudo medir**. El 2 existe separado del 1 a propósito: si «no pude medir» comparte código con
# «encontré algo», el falso rojo empuja a ignorar el rojo verdadero (memoria
# `dos-causas-distintas-comparten-el-codigo-de-salida-y-el-mensaje-elige-una`).
set -uo pipefail

QUIET=0
[ "${1:-}" = "--quiet" ] && QUIET=1

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# `coordinacion/` está GITIGNOREADA y vive en UNA carpeta física, no por worktree. Por eso el default
# es la ruta absoluta del checkout compartido y no `$REPO/coordinacion`: en un worktree ese path no
# existe. **Y por eso la ausencia es exit 2, no un skip silencioso** — un chequeo gateado con
# `-f $BUZON/PLAN.md` se salteaba solo y salía verde (caso 1 de
# `el-instrumento-respondio-sobre-otro-sujeto`, 2026-08-13).
BUZON="${BUZON:-C:/Proyectos/Claude/Claude code/copiloto-emprendedor/coordinacion}"
PLAN="$BUZON/PLAN.md"

fatal() { echo "🛑 NO PUDE MEDIR: $*" >&2; exit 2; }

# El autotest del extractor va ACA, antes de tocar git: es trabajo de strings y no depende de
# nada externo. Cuando estaba después del `fetch`, romper el parser a propósito daba rc=2 — el
# código correcto — pero por «el fetch falló», o sea el control pasaba por la causa equivocada.
# El control más barato y más específico corre primero.
# ── El extractor de artefactos, y su autotest ──────────────────────────────────────────────────
# Los segmentos `(ver: ...)` se descartan: son citas de FUNDAMENTO (ver el docstring).
extraer_artefactos() {
  printf '%s' "$1" \
    | sed 's/([Vv]er:[^)]*)//g' \
    | grep -oE '[A-Za-z0-9_./-]+\.(tsx|ts|jsx|js|mjs|py|sh|sql|json|md|yml|yaml)' \
    | sort -u
}

# Extractor de la dir. 2: SÓLO números de PR, y sólo en la forma en que este repo realmente los cita:
# `(#NNN)` entre paréntesis o `PR #NNN` explícito (ver docstring: un `#NNN` suelto es ambiguo — acta,
# color hex, o PR real sin esa forma). Shas cortos y paths se probaron y se DESCARTARON (docstring,
# casos `LEGAL`/`FACTID` para sha y `BOLA`/`GRAFO`/`LEGAL` para path). Mismo criterio de exclusión de
# fundamento que `extraer_artefactos` — una fila puede citar el PR de la LECCIÓN que la explica, no del
# código que declara cerrado.
extraer_citas() {
  local sinfund
  sinfund="$(printf '%s' "$1" | sed 's/([Vv]er:[^)]*)//g')"
  printf '%s' "$sinfund" | grep -oE '\(#[0-9]{3,4}\)|PR #[0-9]{3,4}' | grep -oE '[0-9]{3,4}' | sort -u
}

# El autotest corre SIEMPRE, no detrás de un flag: es trabajo de strings, cuesta nada, y un control
# que hay que acordarse de invocar es un control que no corre. Necesita las DOS direcciones — con
# sólo la primera, un `sed` que borrara el renglón entero pasaría igual (memoria
# `un-mecanismo-roto-hacia-el-no-no-da-sintoma`).
autotest_extraccion() {
  local fila_fund="DEMO | la razón es X (ver: memoria/lec-demo.md) y el entregable es scripts/foo-demo.sh | pendiente"
  local fila_ent="DEMO | hay que escribir memoria/lec-demo.md | pendiente"
  local a b
  a="$(extraer_artefactos "$fila_fund")"
  case "$a" in *memoria/lec-demo.md*)
    fatal "AUTOTEST: un path dentro de '(ver: ...)' salió como artefacto. La exclusión de fundamentos NO funciona y todo fundamento va a marcar falso positivo." ;;
  esac
  case "$a" in *scripts/foo-demo.sh*) : ;; *)
    fatal "AUTOTEST: el entregable de la MISMA fila desapareció. La exclusión borra de más y el detector quedaría ciego — saldría verde por no mirar." ;;
  esac
  b="$(extraer_artefactos "$fila_ent")"
  case "$b" in *memoria/lec-demo.md*) : ;; *)
    fatal "AUTOTEST (control negativo): el mismo path SIN '(ver: ...)' tampoco salió. La exclusión no discrimina por rol: está filtrando por carpeta, no por cita." ;;
  esac

  # Autotest del extractor de citas (dir. 2): un PR dentro de "(ver: ...)" no cuenta como evidencia
  # de cierre; el mismo PR fuera de ese paréntesis, en forma `PR #NNN` o `(#NNN)`, sí. Un sha corto
  # entre backticks y un `#NNN` SUELTO (sin esa forma) NO deben salir NUNCA — son los dos caminos que
  # se probaron contra el `PLAN.md` real y se descartaron por ruido (ver docstring: LEGAL/FACTID para
  # sha, OLA0/AACORE para `#NNN` suelto).
  local fila_cita_fund="DEMO | ✅ cerrado (ver: hallazgo #9999 que lo motivó) por PR #1234, cita suelta #4321, sha \`abc1234\`, y también (#5678)"
  local c
  c="$(extraer_citas "$fila_cita_fund")"
  case "$c" in *9999*)
    fatal "AUTOTEST citas: un #NNN dentro de '(ver: ...)' salió como evidencia de cierre. Cuenta el fundamento como si fuera el entregable." ;;
  esac
  case "$c" in *1234*) : ;; *)
    fatal "AUTOTEST citas: el PR en forma 'PR #NNN' desapareció. El extractor de citas quedaría ciego para el formato más común del repo." ;;
  esac
  case "$c" in *5678*) : ;; *)
    fatal "AUTOTEST citas: el PR en forma '(#NNN)' desapareció. El extractor no reconoce el formato del asunto de squash-merge de GitHub." ;;
  esac
  case "$c" in *4321*)
    fatal "AUTOTEST citas: un '#NNN' SUELTO (sin 'PR' ni paréntesis) salió como evidencia. Es la ambigüedad de OLA0 (numeración de actas) / AACORE (color hex) que se descartó." ;;
  esac
  case "$c" in *abc1234*)
    fatal "AUTOTEST citas: el extractor de citas volvió a devolver un sha corto. Ese camino se descartó por no-fiable bajo squash-merge (LEGAL/FACTID) — no debe reaparecer." ;;
  esac
}
autotest_extraccion

[ -f "$PLAN" ] || fatal "no encuentro $PLAN. NO es 'sin drift': es que el instrumento no tiene sujeto. Pasá BUZON=<ruta absoluta>."

# ── El fetch va PRIMERO, y su ausencia es la forma en que este script mentiría ──────────────────────
# `git cat-file -e origin/main:<path>` NO consulta el remoto: lee la copia local de la ref. Sin fetch
# previo, un artefacto mergeado hace diez minutos «no existe», y el informe sale COHERENTE por estar
# ciego. El checkout compartido llegó a estar 141 commits atrás.
git -C "$REPO" fetch origin --quiet 2>/dev/null || fatal "el fetch falló; sin él mido mi propia copia vieja y el informe no vale"
BASE="$(git -C "$REPO" rev-parse origin/main 2>/dev/null)" || fatal "no resuelvo origin/main"

# ── Control POSITIVO + NEGATIVO de la función que decide «existe en main» ───────────────────────────
# Sin esto, un `cat-file` roto (ref mal armada, repo equivocado) devolvería «no existe» para todo y el
# informe entero saldría COHERENTE: verde por ceguera. memoria `instrumento-que-no-mira-nunca-falla`.
existe_en_main() { git -C "$REPO" cat-file -e "origin/main:$1" 2>/dev/null; }
# El `|| true` es a propósito: un path ausente devuelve vacío, y vacío NO puede significar «viejo» por
# defecto — ésa es exactamente la forma en que un no-medido se disfraza de medición.
tocado_en_main() { git -C "$REPO" log -1 --format=%cs "origin/main" -- "$1" 2>/dev/null || true; }

existe_en_main "README.md" || fatal "control POSITIVO falló: 'README.md' no aparece en origin/main. El instrumento está ciego, no el repo limpio."
if existe_en_main "no-existe-jamas-canario-$$.md"; then fatal "control NEGATIVO falló: un path inventado dio PRESENTE. La prueba de existencia no discrimina."; fi
[ -n "$(tocado_en_main README.md)" ] || fatal "control POSITIVO de fechas falló: 'README.md' no tiene fecha de último cambio en origin/main."

# ── Log de `main` para la dir. 2 — el sujeto es el MENSAJE de commit, no el grafo de ancestros ──────
# `git log --oneline` trae "<sha-corto> <asunto>", y el asunto de un squash-merge de GitHub incluye
# "(#NNN)". Buscar el PR ahí, con el paréntesis incluido, es el test correcto (ver docstring); buscar
# ancestría de la rama original, o un sha corto suelto, NO lo es.
LOG_MAIN="$(mktemp)"; trap 'rm -f "$INDICE" "$LOG_MAIN"' EXIT
git -C "$REPO" log --oneline origin/main > "$LOG_MAIN" || fatal "no pude leer el log de origin/main"
LOG_LINEAS=$(wc -l < "$LOG_MAIN")
[ "$LOG_LINEAS" -gt 50 ] || fatal "el log de origin/main trajo $LOG_LINEAS líneas: eso no es este repo con su historia real"

# `#NNN` como TOKEN completo (no precedido/seguido de otro dígito) en el asunto del commit: cubre
# tanto el squash-merge de GitHub (`... (#622)`) como el merge commit clásico (`Merge pull request
# #622 from ...`) — medido con `OLA3`/#622, que mergeó por la segunda forma y el chequeo estricto
# por paréntesis lo daba como ausente siendo un PR real. El lado del LOG no tiene la ambigüedad de
# `extraer_citas` (acta/color hex): un `#NNN` en la HISTORIA de git es casi siempre un PR o issue real.
cita_en_main_pr() { grep -qE -- "(^|[^0-9])#$1([^0-9]|\$)" "$LOG_MAIN"; }

# Control POSITIVO + NEGATIVO: el propio HEAD de `origin/main` casi siempre llegó por squash-merge,
# así que su asunto trae su propio "(#NNN)" — lo leemos de ahí en vez de fabricar uno inventado, para
# que el control positivo ejercite el MISMO commit real que "$BASE" resuelve, no un dato de attrezzo.
HEAD_SUBJECT="$(git -C "$REPO" log -1 --format=%s origin/main)"
HEAD_PR="$(printf '%s' "$HEAD_SUBJECT" | grep -oE '\(#[0-9]{2,6}\)' | tail -1 | tr -d '(#)')"
[ -n "$HEAD_PR" ] || fatal "el HEAD de origin/main ('$HEAD_SUBJECT') no trae '(#NNN)': no puedo armar el canario del lookup de dir. 2 sin un PR real conocido."
cita_en_main_pr "$HEAD_PR" || fatal "control POSITIVO de citas falló: el propio PR del HEAD de origin/main (#$HEAD_PR) no aparece en su log. El lookup de dir. 2 está roto."
if cita_en_main_pr "999999"; then fatal "control NEGATIVO de citas falló: un PR inventado (#999999) dio PRESENTE. El lookup no discrimina."; fi

# Índice de nombres de archivo de `main`, para las filas que citan sólo el basename.
INDICE="$(mktemp)"
git -C "$REPO" ls-tree -r --name-only origin/main > "$INDICE" || fatal "no pude listar el árbol de origin/main"
TOTAL_ARCHIVOS=$(wc -l < "$INDICE")
[ "$TOTAL_ARCHIVOS" -gt 100 ] || fatal "el árbol de origin/main trajo $TOTAL_ARCHIVOS archivos: eso no es este repo"

# ── Autotest END-TO-END (fila `PLANRECON`, pedido explícito): inyectar una fila-`pendiente`-ya-hecha
# y una fila-`✅`-con-PR-falso, y verificar que las DOS quedan atrapadas — con las MISMAS funciones
# que usa el loop real de abajo, no una reimplementación paralela que podría discrepar de él.
autotest_veredicto() {
  # Positivo dir.1: fila `pendiente` que cita un entregable real (`README.md`) con fecha de evidencia
  # deliberadamente vieja (2020-01-01) — main lo tocó después, así que TIENE que salir candidato.
  local fila fecha_fila arts a ruta t falta frescos
  fila="SELFTEST-DRIFT | cita entregable README.md, ya resuelta hace años 2020-01-01 | pendiente"
  arts="$(extraer_artefactos "$fila")"
  fecha_fila="$(echo "$fila" | grep -oE '20[0-9]{2}-[0-1][0-9]-[0-3][0-9]' | sort | tail -1)"
  falta=0; frescos=""
  for a in $arts; do
    ruta="$a"
    existe_en_main "$ruta" || ruta="$(grep -m1 -F -- "/$(basename "$a")" "$INDICE" || true)"
    if [ -z "$ruta" ]; then falta=1; continue; fi
    t="$(tocado_en_main "$ruta")"
    if [ -n "$t" ] && [[ "$t" > "$fecha_fila" || "$t" == "$fecha_fila" ]]; then frescos="$frescos$ruta "; fi
  done
  if [ "$falta" = "1" ] || [ -z "$frescos" ]; then
    fatal "AUTOTEST end-to-end dir.1: la fila sintética 'pendiente' citando README.md con fecha 2020-01-01 NO salió como candidato a drift. El mecanismo que va a correr contra el PLAN.md real no discrimina el caso positivo."
  fi

  # Positivo dir.2: fila `✅` que cita un PR que nunca existió (4 dígitos, fuera de rango real — el
  # HEAD actual está en los 3 dígitos altos/4 bajos; #9899 no es ningún PR de este repo).
  local citas_falsas faltantes_falsas c
  citas_falsas="$(extraer_citas "SELFTEST-INVERSA | ✅ cerrado con PR #9899")"
  case "$citas_falsas" in *9899*) : ;; *) fatal "AUTOTEST end-to-end dir.2: el extractor no reconoció 'PR #9899' en la fila sintética." ;; esac
  faltantes_falsas=""
  for c in $citas_falsas; do cita_en_main_pr "$c" || faltantes_falsas="$faltantes_falsas#$c "; done
  [ -n "$faltantes_falsas" ] || fatal "AUTOTEST end-to-end dir.2: una fila que cierra citando PR #9899 (inventado) salió COHERENTE. El mecanismo que va a correr contra el PLAN.md real no discrimina el caso positivo."

  # Negativo dir.2: la MISMA forma de fila, pero con el PR real del HEAD — no debe quedar atrapada.
  local citas_reales faltantes_reales
  citas_reales="$(extraer_citas "SELFTEST-COHERENTE | ✅ cerrado con PR #$HEAD_PR")"
  faltantes_reales=""
  for c in $citas_reales; do cita_en_main_pr "$c" || faltantes_reales="$faltantes_reales#$c "; done
  [ -z "$faltantes_reales" ] || fatal "AUTOTEST end-to-end dir.2 (control negativo): una fila citando el PR REAL del HEAD (#$HEAD_PR) salió como candidato. El mecanismo grita en el caso normal."
}
autotest_veredicto

# ── Las filas ──────────────────────────────────────────────────────────────────────────────────────
# El estado vive en el ÚLTIMO campo del renglón, y ahí se lee: ponerlo en otra posición es cómo se
# perdieron dos frentes (memoria `un-enum-al-final-del-renglon-lo-borra-el-que-appendea`).
FILAS_TOTAL=0; FILAS_PEND=0; EXAMINADAS=0
N_DRIFT=0; N_COHER=0; N_VIEJA=0; N_NOMED=0
DRIFT=""; VIEJA=""; NOMED=""

# Dir. 2: filas `✅` — candidatas a INVERSA si citan PR/sha que no aparece en el log de main.
FILAS_CERRADAS=0; EXAMINADAS_INV=0
N_INVERSA=0; N_COHER_INV=0; N_NOMED_INV=0
INVERSA=""; NOMED_INV=""

while IFS= read -r linea; do
  case "$linea" in [A-Z][A-Z0-9]*"|"*) : ;; *) continue ;; esac
  FILAS_TOTAL=$((FILAS_TOTAL+1))
  id="${linea%%|*}"; id="$(echo "$id" | tr -d ' ')"
  estado="${linea##*|}"; estado="$(echo "$estado" | tr -d ' ')"

  if [ "$estado" = "pendiente" ]; then
    FILAS_PEND=$((FILAS_PEND+1))

    # Artefactos citados: tokens con extensión de código o path con barra. Los backticks los delimitan.
    arts="$(extraer_artefactos "$linea")"
    if [ -z "$arts" ]; then
      N_NOMED=$((N_NOMED+1)); EXAMINADAS=$((EXAMINADAS+1))
      NOMED="$NOMED$id "
      continue
    fi

    EXAMINADAS=$((EXAMINADAS+1))
    # Fecha de evidencia de la fila: la MAYOR que aparezca en el renglón.
    fecha_fila="$(echo "$linea" | grep -oE '20[0-9]{2}-[0-1][0-9]-[0-3][0-9]' | sort | tail -1)"
    falta=0; frescos=""
    for a in $arts; do
      # Un artefacto cuya PROPIA RUTA contiene la fecha de la fila no puede testificar sobre ella: la
      # «fecha de evidencia» sale de su nombre, no de una medición, así que su último cambio coincide
      # con la fila por construcción y marcaría SIEMPRE. Medido el 29/09 con `DEC11FILL`, que cita
      # `Auditorias/2026-09-28-BL-Q4-...md`: falso positivo garantizado.
      if [ -n "$fecha_fila" ] && case "$a" in *"$fecha_fila"*) true ;; *) false ;; esac; then continue; fi
      ruta="$a"
      if ! existe_en_main "$ruta"; then
        ruta="$(grep -m1 -F -- "/$(basename "$a")" "$INDICE" || true)"
      fi
      if [ -z "$ruta" ]; then falta=1; continue; fi
      t="$(tocado_en_main "$ruta")"
      if [ -n "$fecha_fila" ] && [ -n "$t" ] && [[ "$t" > "$fecha_fila" || "$t" == "$fecha_fila" ]]; then
        frescos="$frescos$ruta($t) "
      fi
    done
    if [ "$falta" = "1" ]; then
      N_COHER=$((N_COHER+1))
    elif [ -n "$frescos" ]; then
      N_DRIFT=$((N_DRIFT+1))
      DRIFT="$DRIFT$id :: fila $fecha_fila · main tocó $frescos"$'\n'
    else
      N_VIEJA=$((N_VIEJA+1)); VIEJA="$VIEJA$id "
    fi

  elif case "$estado" in "✅"*) true ;; *) false ;; esac; then
    # ── Dir. 2: ¿el PR que esta fila cita como evidencia de cierre aparece en el log de main? ────────
    # SÓLO por PR en forma `(#NNN)`/`PR #NNN` (ver docstring). El chequeo por path se probó y se
    # descartó el mismo día: la mayoría de lo que una fila `✅` cita como evidencia vive FUERA del
    # árbol de git a propósito (buzón gitignoreado, bundles de prod, paths de otro repo) — "no existe
    # en main" es su estado normal, no una señal de drift.
    FILAS_CERRADAS=$((FILAS_CERRADAS+1))
    citas="$(extraer_citas "$linea")"
    if [ -z "$citas" ]; then
      N_NOMED_INV=$((N_NOMED_INV+1)); EXAMINADAS_INV=$((EXAMINADAS_INV+1))
      NOMED_INV="$NOMED_INV$id "
      continue
    fi
    EXAMINADAS_INV=$((EXAMINADAS_INV+1))
    faltantes=""
    for c in $citas; do
      cita_en_main_pr "$c" || faltantes="$faltantes#$c "
    done
    if [ -n "$faltantes" ]; then
      N_INVERSA=$((N_INVERSA+1))
      INVERSA="$INVERSA$id :: cierra citando $faltantes— no aparece(n) como (#NNN) en el log de origin/main"$'\n'
    else
      N_COHER_INV=$((N_COHER_INV+1))
    fi
  fi
done < "$PLAN"

[ "$FILAS_TOTAL" -gt 0 ] || fatal "0 filas reconocidas en $PLAN. El parser no entendió el formato; no concluyas 'sin drift'."

if [ "$QUIET" = "0" ]; then
  echo "── PLAN-DRIFT · sujeto: origin/main @ ${BASE:0:8} · $PLAN"
  if [ -n "$DRIFT" ]; then
    echo
    echo "🟠 CANDIDATOS a drift (dir. 1) — dicen \`pendiente\` y \`main\` tocó lo que citan DESPUÉS de escribirse la fila:"
    printf '%s' "$DRIFT" | sed 's/^/   /'
    echo "   ⚠️  Candidato ≠ cerrado. El veredicto es de la sesión: abrí el archivo y fijate si el cambio es el de la fila."
  fi
  [ -n "$VIEJA" ] && { echo; echo "⚪ PRESENCIA-VIEJA — citan artefactos que \`main\` NO tocó desde la fila: $VIEJA"; echo "   NO son candidatos: su presencia no informa nada sobre la fila."; }
  [ -n "$NOMED" ] && { echo; echo "⚪ NO-MEDIBLE por efecto (dir. 1) — no citan ningún artefacto: $NOMED"; echo "   NO son 'coherentes': son filas que este control no puede juzgar."; }

  if [ -n "$INVERSA" ]; then
    echo
    echo "🔴 CANDIDATOS a INVERSA (dir. 2) — dicen \`✅ cerrada\` citando un PR que no aparece como (#NNN) en el log de \`origin/main\`:"
    printf '%s' "$INVERSA" | sed 's/^/   /'
    echo "   ⚠️  Candidato ≠ falso. Puede ser rama sin pushear, o un PR real mergeado SIN squash (merge commit sin '(#NNN)' en el asunto) — verificá antes de declarar mentira."
  fi
  [ -n "$NOMED_INV" ] && { echo; echo "⚪ NO-MEDIBLE por evidencia (dir. 2) — cierran sin citar un PR en forma (#NNN)/PR #NNN: $NOMED_INV"; echo "   NO son 'coherentes': este control no tiene con qué buscarlas en el log de main."; }
fi

echo "── CONTROL dir.1: $EXAMINADAS de $FILAS_PEND filas \`pendiente\` examinadas (de $FILAS_TOTAL filas en total) · árbol de main: $TOTAL_ARCHIVOS archivos"
echo "── $N_DRIFT candidato(s) dir.1 · $N_COHER coherente(s) · $N_VIEJA presencia-vieja · $N_NOMED no-medible(s)"
echo "── CONTROL dir.2: $EXAMINADAS_INV de $FILAS_CERRADAS filas \`✅\` examinadas · log de main: $LOG_LINEAS commits"
echo "── $N_INVERSA candidato(s) dir.2 (inversa) · $N_COHER_INV coherente(s) · $N_NOMED_INV no-medible(s)"

[ "$N_DRIFT" -gt 0 ] && exit 1
[ "$N_INVERSA" -gt 0 ] && exit 1
exit 0
