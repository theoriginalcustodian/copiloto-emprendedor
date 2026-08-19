#!/usr/bin/env bash
# Levanta el prototipo para abrirlo DESDE EL CELULAR.
#
# Un gesto vertical no se evalúa con el mouse: hay que arrastrarlo con el pulgar.
# Se sirve desde `odobi-ui/` (no desde `prototipo/`) porque el HTML referencia
# `../assets/fonts/` — si se sirviera desde acá, el wordmark saldría sin la fuente.
set -euo pipefail
PUERTO="${1:-8080}"
cd "$(dirname "$0")/.."

ip_actual() { ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true; }
IP="$(ip_actual)"

echo
echo "  Prototipo Odobi"
echo "  ───────────────────────────────────────────────"
if [ -n "$IP" ]; then
  echo "  📱 En el celular (misma red WiFi):"
  echo "       http://$IP:$PUERTO/prototipo/"
else
  echo "  ⚠️  Sin IP de WiFi: ¿estás por cable, o sin red?"
fi
echo "  💻 En esta compu:"
echo "       http://localhost:$PUERTO/prototipo/"
echo "  ───────────────────────────────────────────────"

# El firewall de macOS pregunta UNA vez si permite conexiones entrantes a Python.
# Si esa vez se rechazó, no vuelve a preguntar y el celular no llega nunca —
# el síntoma es "no me carga" con el servidor funcionando perfecto.
if /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null | grep -q "enabled"; then
  echo "  ℹ️  El firewall está activo. Si el celular no entra, revisá"
  echo "     Ajustes → Red → Firewall → Opciones: Python tiene que estar permitido."
fi
echo "  ℹ️  Si cambiás de red WiFi, la IP cambia: cortá con Ctrl+C y volvé a arrancar."
echo

# Si la IP cambia mientras corre (cambio de red), se avisa: la URL de arriba deja de servir.
( while sleep 20; do
    NUEVA="$(ip_actual)"
    if [ -n "$NUEVA" ] && [ "$NUEVA" != "$IP" ]; then
      echo ""
      echo "  ⚠️  CAMBIÓ LA IP: ahora es  http://$NUEVA:$PUERTO/prototipo/"
      echo ""
      IP="$NUEVA"
    fi
  done ) &
VIGIA=$!
trap 'kill $VIGIA 2>/dev/null' EXIT

python3 -m http.server "$PUERTO" --bind 0.0.0.0
