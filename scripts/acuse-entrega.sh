#!/usr/bin/env bash
# Acusa la ENTREGA DIRECTA de un contrato a un rol, para la senal (e) de vigilancia-check.sh.
#
# Por que existe: las cuatro senales de vida del gate miden PRODUCCION (transcript, buzon, rama,
# commit). Una sesion viva, idle y sin trabajo empujado no produce nada, asi que el gate la da por
# ausente y afirma "nadie de ese rol estuvo vivo para leer este contrato". El 2026-11-04 eso acuso
# tres ciclos seguidos a BACKEND y AUDITORIA estando las dos vivas y contestando. El hecho era
# cierto; la causa sugerida era falsa.
#
# Se corre SOLO despues de un SendMessage exitoso al rol. No afloja el criterio relacional: un
# contrato emitido despues de este acuse vuelve a quedar huerfano. Si el acuse falta, el gate acusa
# de mas — fail-closed a propósito, porque el costo de volver a empujar trabajo es menor que el de
# dar por leido un contrato que nadie leyo.
#
# Uso: scripts/acuse-entrega.sh <rol> ["nota"]
set -euo pipefail
ROL="${1:-}"
[ -n "$ROL" ] || { echo "uso: $0 <rol> [nota]" >&2; exit 2; }
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib/buzon-roles.sh
. "$REPO_ROOT/scripts/lib/buzon-roles.sh"
# El rol se valida contra la MISMA fuente que usa el gate: un rol inventado crearia un acuse que
# nunca descarga ninguna alarma y no daria sintoma — el modo de falla mudo de siempre.
# ROLES_BUZON es el array que la lib ya define (lib/buzon-roles.sh:31) y que el gate honra. NO se
# escribe una lista nueva aca: dos listas para la MISMA pregunta hacen que el acuse se escriba con
# un nombre que el gate nunca busca, y eso no da ningun sintoma — el acuse existe, la alarma sigue.
# (Primer intento de este script invento `roles_conocidos`, que NO existe: habria salido ROJO
# siempre. Fail-closed salvo el error, pero el script quedaba inutil.)
_ok=0
for _r in "${ROLES_BUZON[@]}"; do [ "$_r" = "$ROL" ] && _ok=1; done
if [ "$_ok" -ne 1 ]; then
  echo "ROJO: '$ROL' no es un rol conocido. Conocidos: ${ROLES_BUZON[*]}" >&2
  exit 1
fi
BUZON="${BUZON:-$REPO_ROOT/coordinacion}"
[ -d "$BUZON" ] || { echo "ROJO: no existe el buzon $BUZON" >&2; exit 1; }
mkdir -p "$BUZON/entregas"
F="$BUZON/entregas/$ROL"
printf '%s  entrega directa acusada por planificacion  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${2:-}" >> "$F"
echo "ACUSADO: $ROL -> $F"
