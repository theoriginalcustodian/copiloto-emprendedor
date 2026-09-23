#!/usr/bin/env bash
# test-cola-check-ciego.sh — «no veo mi sujeto» tiene que sonar distinto de «está todo en orden».
#
# Por qué existe (2026-09-22). `cola-check.sh` salía rc=0 con «No existe $PLAN», y el vigilante lo
# componía detrás de `if [ -f "$BUZON/PLAN.md" ]`. Como `coordinacion/` es UNA carpeta física no
# versionada que vive sólo en el checkout principal, desde cualquier worktree —26 vivos, el caso
# NORMAL de este repo— la dimensión COLA no se medía y tampoco se decía: el ciclo cerraba «sin
# novedades» y el control positivo daba verde POR AUSENCIA. Es el mismo defecto que cola-check
# existe para cazar (una fábrica parada en silencio), un nivel más arriba.
#
# El mismo archivo ya había aprendido la lección: el bloque DEUDA se gatea con `BUZON_DIR sin
# setear` y su comentario nombra a COLA como el contraejemplo que todavía la tenía. El fix estaba
# escrito en otro call-site y no se propagó — por eso este test cubre las DOS capas.
#
#   1. POSITIVO   cola-check sin PLAN                 → rc≠0 y lo DICE (no «cola en orden»)
#   2. CONTROL    cola-check con PLAN sano            → rc=0 y --quiet calla (hace al 1 atribuible)
#   3. POSITIVO   el vigía con un buzón SIN PLAN      → ALARMA (antes: salteo mudo)
#   4. CONTROL    el vigía con un buzón CON PLAN sano → sin alarma de COLA
#   5. RAÍZ       el vigía desde un WORKTREE, sin override → resuelve el buzón físico y lo mide
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COLA_SH="$ROOT/scripts/cola-check.sh"
VIG="$ROOT/scripts/vigilancia-check.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
fallos=0
ok()  { printf '  ✅ %s\n' "$1"; }
mal() { printf '  ❌ %s\n' "$1"; fallos=$((fallos+1)); }
echo "test-cola-check-ciego"

buzon() {  # buzon <dir> <estado-del-hito|SIN-PLAN>
  mkdir -p "$1"/{abierto,en-curso,cerrado}
  [ "$2" = "SIN-PLAN" ] && return 0
  cat > "$1/PLAN.md" <<EOF
# plan de prueba
<!-- COLA-VIVA:INICIO -->
\`\`\`
H9 | hito de prueba | disparador de prueba | $2
\`\`\`
<!-- COLA-VIVA:FIN -->
EOF
}
vigia() {  # vigia <buzón> -> salida en $T/out
  mkdir -p "$T/transcripts"
  BUZON_DIR="$1" TRANSCRIPTS_DIR="$T/transcripts" bash "$VIG" --quiet --dry-run > "$T/out" 2>&1
  echo $?
}

# 1 — el sujeto no está: el instrumento tiene que decirlo, no devolver calma
out="$(COLA_PLAN="$T/no-existe/PLAN.md" bash "$COLA_SH" --quiet 2>&1)"; rc=$?
[ "$rc" -ne 0 ] && grep -qF "no puedo ver mi sujeto" <<< "$out" \
  && ok "1 sin PLAN -> rc=$rc y lo dice (no lo tapa con un rc=0)" \
  || mal "1 rc=$rc · «no medí nada» salió indistinguible de «cola en orden»: $out"

# 2 — CONTROL: sin él, el caso 1 pasaría igual si el script estuviera rojo siempre
buzon "$T/sano" arrancando
out="$(COLA_PLAN="$T/sano/PLAN.md" bash "$COLA_SH" --quiet 2>&1)"; rc=$?
[ "$rc" -eq 0 ] && [ -z "$out" ] \
  && ok "2 control: con PLAN sano calla y sale 0 (el rc≠0 del 1 es atribuible)" \
  || mal "2 rc=$rc · rojo con un PLAN sano, el caso 1 no prueba nada: $out"

# 3 — COMPOSICIÓN: el vigía ya no se saltea el paso cuando no ve el PLAN
buzon "$T/sin-plan" SIN-PLAN
rc="$(vigia "$T/sin-plan")"
[ "$rc" -ne 0 ] && grep -qF "no puedo ver mi sujeto" "$T/out" \
  && ok "3 buzón sin PLAN -> el vigía ALARMA (antes se salteaba mudo)" \
  || mal "3 rc=$rc · el ciclo reportó calma sobre una dimensión que no midió: $(tail -2 "$T/out")"

# 4 — CONTROL del 3: con el PLAN sano no hay alarma de COLA (si no, el 3 sólo mide que grita siempre)
rc="$(vigia "$T/sano")"
! grep -qF "no puedo ver mi sujeto" "$T/out" && ! grep -qF "COLA:" "$T/out" \
  && ok "4 control: con PLAN sano el vigía no alarma por COLA (rc=$rc)" \
  || mal "4 falso positivo de COLA con un PLAN sano: $(grep -m2 'COLA' "$T/out")"

# 5 — LA RAÍZ: desde un worktree, SIN override, el buzón físico tiene que resolverse igual. Es el
# caso que nadie probaba porque el salteo mudo lo hacía verde por ausencia. Sólo aplica si esta
# máquina tiene el buzón físico (en el CI no existe: ahí no hay raíz que verificar, no un fallo).
PRINCIPAL="$(dirname "$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo /nada/.git)")"
if [ -f "$PRINCIPAL/coordinacion/PLAN.md" ] && [ ! -d "$ROOT/coordinacion" ]; then
  mkdir -p "$T/transcripts"
  TRANSCRIPTS_DIR="$T/transcripts" bash "$VIG" --quiet --dry-run > "$T/out5" 2>&1
  ! grep -qF "no puedo ver mi sujeto" "$T/out5" \
    && ok "5 desde un worktree sin override -> encuentra el buzón físico y lo mide" \
    || mal "5 el worktree sigue ciego al buzón real: $(grep -m2 'COLA' "$T/out5")"
elif [ -d "$ROOT/coordinacion" ]; then
  printf '  ·  5 n/a: corriendo desde el checkout principal (el buzón está al lado)\n'
else
  printf '  ·  5 n/a: esta máquina no tiene el buzón físico (CI) — no hay raíz que verificar\n'
fi

# ── El TERCER gemelo: scripts/archivar-buzon.sh ────────────────────────────────────────────────
# Mismo par de líneas que cola-check: derivaba el buzón de su propio root y salía `exit 0` sobre
# "No existe". Desde cualquier worktree el vigía lo invocaba (paso 4) y creía haber ordenado un
# buzón que nunca miró: 11 archivos vencidos apilados, medidos el 2026-09-22.
JAN="$ROOT/scripts/archivar-buzon.sh"

# 6 — POSITIVO: sin sujeto tiene que fallar Y decirlo, no reportar calma
out="$(BUZON_DIR=/tmp/no-existe-jamas-$$ bash "$JAN" 2>&1)"; rc=$?
[ "$rc" -ne 0 ] && echo "$out" | grep -qF "no puedo ver mi sujeto"   && ok "6 janitor sin sujeto: rc=$rc y lo dice"   || mal "6 rc=$rc · el janitor reportó orden sobre una carpeta que no miró: $out"

# 7 — CONTROL del 6: con un buzón sano NO grita (si no, el 6 sólo mide que falla siempre)
mkdir -p "$T/buzon/abierto"
: > "$T/buzon/abierto/2026-01-01_dato_x-a-y_viejo.md"
out="$(BUZON_DIR="$T/buzon" bash "$JAN" --dry-run 2>&1)"; rc=$?
[ "$rc" = 0 ] && ! echo "$out" | grep -qF "no puedo ver mi sujeto"   && ok "7 control: con un buzón sano el janitor corre limpio (rc=0)"   || mal "7 falso positivo del janitor sobre un buzón sano: rc=$rc · $out"

# 8 — LA RAÍZ, para el janitor: desde un worktree, SIN override, tiene que resolver el buzón físico.
# `--dry-run` para no mover nada real. El bloque resolvedor está COPIADO de vigilancia-check.sh, y
# código copiado diverge: por eso se verifica acá en vez de confiar en que sigue igual.
if [ -f "$PRINCIPAL/coordinacion/abierto" ] || [ -d "$PRINCIPAL/coordinacion/abierto" ]; then
  if [ ! -d "$ROOT/coordinacion" ]; then
    out="$(bash "$JAN" --dry-run 2>&1)"; rc=$?
    [ "$rc" = 0 ] && ! echo "$out" | grep -qF "no puedo ver mi sujeto"       && ok "8 janitor desde un worktree sin override -> resuelve el buzón físico"       || mal "8 el janitor sigue ciego desde un worktree: rc=$rc · $out"
  else
    printf '  ·  8 n/a: corriendo desde el checkout principal (el buzón está al lado)
'
  fi
else
  printf '  ·  8 n/a: esta máquina no tiene el buzón físico (CI)
'
fi

[ "$fallos" = 0 ] && { echo "OK"; exit 0; } || { echo "$fallos check(s) fallaron"; exit 1; }
