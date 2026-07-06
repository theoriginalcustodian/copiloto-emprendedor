"""Seed idempotente del tenant sintético de B (dev). Provisiona las tablas copiloto_* y deja registrado el
cliente_id + el composio_user_id en el env del operador. La conexión Calendar del operador en Composio se
asume ya autorizada (se verifica con connection_status). NO crea datos reales de terceros (datos sintéticos)."""
import os
import sys
from pathlib import Path

from _paths import ensure_paths
ensure_paths()

import json
import psycopg2

from provision_tables import provision
from clients.agent.providers.composio_gateway import ComposioGateway
from calendar_policy import CALENDAR_POLICY


def main() -> None:
    db_url = os.environ["DATABASE_URL"]
    manifest = json.load(open(Path(__file__).resolve().parent / "uc_tables.json", encoding="utf-8"))
    conn = psycopg2.connect(db_url); conn.autocommit = True
    # copiloto_metering se provisiona como placeholder forward (follow-up de metering/costo); aún SIN writers
    # en este corte — no confundir filas con uso real.
    provision(manifest, conn)                                  # idempotente, namespacing copiloto_* (guard J27)
    print("OK tablas copiloto_* provisionadas", flush=True)

    user = os.environ.get("COPILOTO_COMPOSIO_USER_ID")
    if user:
        gw = ComposioGateway(CALENDAR_POLICY)
        st = gw.connection_status(user, "googlecalendar")
        print(f"Calendar connection status para {user}: {st}", flush=True)
        if not st:
            print("⚠️  No hay conexión Calendar activa. Corré el authorize() del operador antes del E2E.", flush=True)


if __name__ == "__main__":
    main()
