#!/usr/bin/env bash
# test-escalador-retira-urgente-obsoleto.sh — el escalador retira los `urgente_` que él mismo
# generó y cuya causa ya no existe.
#
# Caso real del 2026-09-29 21:42. Un `urgente_vigilancia-a-manejo-de-errores_contratos-sin-tomar.md`
# perseguía el contrato FACTID **que ya estaba en `cerrado/2026-09-29/`**, por una exigencia de
# reporte que el fix de `ROLES:` había eliminado ese mismo día. Con **0 alarmas reales**, el gate de
# las CUATRO sesiones seguía en rojo por ese archivo.
#
# Por qué era inmortal, medido en el código: **no hay un solo `rm` en todo `escaladores-buzon.sh`**,
# y `archivar-buzon.sh` declara `urgente_` OBLIGACIÓN que «NUNCA se auto-archiva». Así que nadie lo
# retiraba nunca. Y es el mismo agujero que el `a-todos` un nivel más arriba: **el artefacto no tiene
# dueño** — su emisor es `vigilancia`, que no es una sesión, y el único que podría moverlo es el
# destinatario, que al hacerlo afirmaría haberlo atendido.
#
#   1. RETIRA        — urgente_ de vigilancia sin causa viva      → se archiva a cerrado/<fecha>/
#   2. NO APAGA      — el rol escala HOY y el archivo es de hoy   → NO se toca
#   3. FECHA VIEJA   — el rol escala hoy pero el urgente es de ayer→ se retira (su info va en el de hoy)
#   4. AJENO         — urgente_ escrito por una SESIÓN            → intacto, no es suyo
#   5. SIDECAR       — se va con el archivo                       → si la causa vuelve, edad nueva
#   6. NO ES ALARMA  — sólo un obsoleto y nada más                → exit 0, no rojo permanente
#
# El caso 2 es el que impide que esto se vuelva un interruptor de apagado, y el 6 es el defecto que
# el bloque viene a cerrar: una limpieza que pusiera `alarma=1` sería otra alarma permanente.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ESCALADOR="${ESCALADOR_BAJO_PRUEBA:-$REPO_ROOT/scripts/escaladores-buzon.sh}"
[ -f "$ESCALADOR" ] || { echo "❌ no existe $ESCALADOR"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fallos=0
ok()   { printf '  ✅ %s\n' "$1"; }
fail() { printf '  ❌ %s\n' "$1"; fallos=$((fallos + 1)); }

HOY="$(date +%Y-%m-%d)"
AYER="$(date -d '1 day ago' +%Y-%m-%d 2>/dev/null || echo '2026-01-01')"

BUZON="$TMP/buzon"
limpiar() {
  rm -rf "$BUZON"
  mkdir -p "$BUZON/abierto" "$BUZON/en-curso" "$BUZON/cerrado" "$BUZON/.escalador-estado"
}

# El contrato viejo que hace escalar a un rol. Fecha de AYER para que `edad_alta_min` lo dé por
# encima de cualquier umbral sin depender del reloj, igual que en los tests hermanos.
contrato_viejo_para() {
  echo "# contrato" > "$BUZON/abierto/${AYER}_contrato_planificacion-a-${1}_algo.md"
}

urgente_de() {   # urgente_de <rol> <fecha>
  printf '# URGENTE -> %s\n\nfoto vieja.\n' "$1" \
    > "$BUZON/abierto/${2}_urgente_vigilancia-a-${1}_contratos-sin-tomar.md"
}

correr() {       # correr [--dry-run]
  out="$(UMBRAL_CONTRATO_MIN=0 BUZON_DIR="$BUZON" bash "$ESCALADOR" ${1:-} 2>&1)"
  rc=$?
}

echo "── Caso 1: RETIRA — un urgente_ de vigilancia sin ninguna causa viva"
limpiar; urgente_de "manejo-de-errores" "$HOY"; correr
if [ -f "$BUZON/abierto/${HOY}_urgente_vigilancia-a-manejo-de-errores_contratos-sin-tomar.md" ]; then
  fail "sigue en abierto/: el gate de las 4 sesiones queda rojo por una causa que ya no existe"
elif [ -f "$BUZON/cerrado/$HOY/${HOY}_urgente_vigilancia-a-manejo-de-errores_contratos-sin-tomar.md" ]; then
  ok "archivado a cerrado/$HOY/ (se archiva, no se borra: que se escaló es dato)"
else
  fail "desapareció sin quedar en cerrado/: el registro del escalamiento se perdió"
fi

echo "── Caso 2: NO APAGA — el rol escala HOY, su urgente_ de hoy NO se toca"
limpiar; contrato_viejo_para "backend"; urgente_de "backend" "$HOY"; correr
if [ -f "$BUZON/abierto/${HOY}_urgente_vigilancia-a-backend_contratos-sin-tomar.md" ]; then
  ok "el urgente_ vigente sigue en abierto/ (la limpieza no es un interruptor de apagado)"
else
  fail "RETIRÓ UN URGENTE VIGENTE — esto apaga el escalador en silencio, el peor modo"
  echo "$out" | sed 's/^/      /' | head -5
fi

echo "── Caso 3: FECHA VIEJA — el rol escala hoy, pero el urgente_ es de ayer"
limpiar; contrato_viejo_para "backend"; urgente_de "backend" "$AYER"; correr
if [ -f "$BUZON/abierto/${AYER}_urgente_vigilancia-a-backend_contratos-sin-tomar.md" ]; then
  fail "quedaron dos urgente_ del mismo rol: la alarma se duplica en cada corrida"
elif [ -f "$BUZON/abierto/${HOY}_urgente_vigilancia-a-backend_contratos-sin-tomar.md" ]; then
  ok "retiró el de ayer y dejó el de hoy, que es el que tiene la lista actual"
else
  fail "se llevó los dos: el rol está en deuda y ya no hay quien lo diga"
fi

echo "── Caso 4: AJENO — un urgente_ escrito por una SESIÓN no es suyo"
limpiar
printf '# urgente de una sesion\n' > "$BUZON/abierto/${AYER}_urgente_backend-a-planificacion_algo-real.md"
correr
if [ -f "$BUZON/abierto/${AYER}_urgente_backend-a-planificacion_algo-real.md" ]; then
  ok "intacto: el escalador sólo retira lo que él mismo genera"
else
  fail "se llevó un urgente_ de otra sesión — eso es borrar trabajo ajeno del buzón"
fi

echo "── Caso 5: SIDECAR — la medición se va con el archivo"
limpiar; urgente_de "auditoria" "$HOY"
SC="$BUZON/.escalador-estado/${HOY}_urgente_vigilancia-a-auditoria_contratos-sin-tomar.md.first-seen"
echo "1000000000" > "$SC"
correr
if [ -f "$SC" ]; then
  fail "el sidecar sobrevivió: si la causa vuelve, el aviso nuevo nace ya por encima del umbral"
else
  ok "el sidecar se fue con el archivo (son la misma unidad de medición)"
fi

echo "── Caso 6: NO ES ALARMA — sólo un obsoleto y nada más ⇒ exit 0"
limpiar; urgente_de "frontend1" "$HOY"; correr
if [ "$rc" = "0" ]; then
  ok "exit 0: la limpieza no es un hallazgo, y no deja el gate rojo por sí misma"
else
  fail "exit $rc — una limpieza que alarma es otra alarma permanente, el defecto que vino a cerrar"
  echo "$out" | sed 's/^/      /' | head -5
fi

echo "── Caso 7: DRY-RUN — reporta sin mover nada"
limpiar; urgente_de "frontend2" "$HOY"; correr --dry-run
F="$BUZON/abierto/${HOY}_urgente_vigilancia-a-frontend2_contratos-sin-tomar.md"
if [ ! -f "$F" ]; then
  fail "--dry-run movió el archivo: un dry-run que muta es indistinguible de la corrida real"
elif echo "$out" | grep -q "RETIRARIA"; then
  ok "lo reporta y no lo toca"
else
  fail "no reportó nada en dry-run: la limpieza sería invisible hasta que ya pasó"
  echo "$out" | sed 's/^/      /' | head -5
fi

echo
if [ "$fallos" -eq 0 ]; then
  echo "✅ TODO VERDE — el escalador ya sabe apagar lo que enciende, y no puede apagarse solo"
  exit 0
fi
echo "❌ $fallos fallo(s)"
exit 1
