#!/usr/bin/env bash
# sync-motor.sh — RETIRADO. El motor del Copiloto está en FORK DURO desde el 2026-07-07.
#
# Hasta esa fecha, `motor/` se mantenía alineado con el arquetipo `conversational_agent` de la fábrica
# `unreal-copilot` (patrón vendorizar-con-sync). El primer cambio divergente fue `fix(motor-react)`: el
# copiloto arregló el bug del buffer de corto plazo del motor react (el turno react no inyectaba
# `self._history` al prompt → amnesia entre turnos), un fix que NO existe en la fábrica. Desde entonces el
# copiloto EVOLUCIONA el motor por su cuenta; sincronizar desde la fábrica ahora PISARÍA esa divergencia.
#
# El sync queda retirado (fail-closed). Ver HANDOFF.md §6 y CLAUDE.md §2. Si alguna vez se quiere realinear
# algo puntual con la fábrica, hacelo A MANO con un diff dirigido y revisado, NUNCA con un rsync --delete ciego.
set -euo pipefail

echo "sync-motor.sh RETIRADO — el motor del Copiloto está en FORK DURO (2026-07-07)." >&2
echo "El motor evoluciona en ESTE repo; no se sincroniza desde la fábrica. Ver HANDOFF.md §6 / CLAUDE.md §2." >&2
exit 1
