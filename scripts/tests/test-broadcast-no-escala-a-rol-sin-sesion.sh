#!/usr/bin/env bash
# Un broadcast `a-todos` NO interpela a un rol que no tiene sesión en el sprint.
#
# POR QUÉ EXISTE (2026-11-03). `roles_de_broadcast todos` expandía al universo COMPLETO de
# `ROLES_BUZON`, que son los nombres de destinatario VÁLIDOS — no las sesiones VIVAS. Medido ese
# día sobre el buzón real: 5 contratos `-a-todos_` escalaban contra `auditoria` y
# `manejo-de-errores`, y `vigilancia-check.sh` emitía **dos `urgente_` por ciclo** contra roles que
# nunca dieron señal de vida en el sprint. El propio gate lo decía —«no es 'va lento', es que no
# hay ventana»— y seguía escalando: una alarma cuya única salida es que aparezca una sesión que el
# sprint no tiene es inapagable, y un guard que grita en el caso normal se desarma solo.
#
# Los dos sentidos se prueban, no uno: el caso 2 es el CONTROL POSITIVO del mecanismo de exclusión
# —un mecanismo roto hacia el «no» no da ningún síntoma— y el caso 3 fija que el LECTOR no cambió:
# los 3300 .md del buzón citan esos nombres y un mensaje histórico tiene que seguir parseándose.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=/dev/null
. "$ROOT/scripts/lib/buzon-roles.sh"

fallos=0
check() { # check <nombre> <esperado> <obtenido>
  if [ "$2" = "$3" ]; then printf '  ok   %s\n' "$1"
  else printf '  FALLO %s\n       esperado: %s\n       obtenido: %s\n' "$1" "$2" "$3"; fallos=$((fallos + 1)); fi
}

# 1. El caso que motivó el fix: los roles sin sesión no reciben el broadcast.
got="$(roles_de_broadcast todos planificacion | tr '\n' ' ')"
check "a-todos no alcanza a los roles sin sesion" "backend frontend1 frontend2 " "$got"

# 2. CONTROL POSITIVO del mecanismo de exclusión: con la lista vacía vuelven los seis.
got="$(UC_ROLES_SIN_SESION="" bash -c '. "$1/scripts/lib/buzon-roles.sh"; roles_de_broadcast todos planificacion' _ "$ROOT" | tr '\n' ' ')"
check "con UC_ROLES_SIN_SESION vacio vuelve el universo completo" \
  "backend frontend1 frontend2 manejo-de-errores auditoria " "$got"

# 3. El LECTOR no cambia: un mensaje histórico dirigido a un rol sin sesión sigue siendo suyo.
if me_interpela auditoria "2026-11-03_urgente_vigilancia-a-auditoria_contratos-sin-tomar.md"; then
  printf '  ok   me_interpela sigue cazando un mensaje historico a un rol sin sesion\n'
else
  printf '  FALLO me_interpela dejo de cazar un mensaje historico (el fix toco al LECTOR)\n'
  fallos=$((fallos + 1))
fi

# 4. El broadcast `frontend` no se vio afectado.
got="$(roles_de_broadcast frontend planificacion | tr '\n' ' ')"
check "broadcast frontend intacto" "frontend1 frontend2 " "$got"

[ "$fallos" -eq 0 ] && { echo "VERDE 4/4"; exit 0; }
echo "ROJO: $fallos caso(s)"
exit 1
