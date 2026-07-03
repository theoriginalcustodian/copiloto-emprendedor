"""CLI hand-link (capa CLIENTE): imprime el link de conexión de MercadoPago para un cliente_id, para que el
operador se lo pase al vendedor (mismo patrón que enable_services.py de Composio). Uso (VPS, env cargado):
  python mp_connect.py <cliente_id>"""
from __future__ import annotations

import sys
from pathlib import Path

ARCH = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
from clients.agent.providers.crypto import FernetCrypto
from clients.agent.providers.mercadopago_gateway import MercadoPagoGateway


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit("uso: python mp_connect.py <cliente_id>")
    cliente_id = sys.argv[1]
    state = FernetCrypto().encrypt(cliente_id)
    print(f"[CONECTAR MERCADOPAGO] cliente={cliente_id}\n{MercadoPagoGateway().connect_url(state)}")


if __name__ == "__main__":
    main()
