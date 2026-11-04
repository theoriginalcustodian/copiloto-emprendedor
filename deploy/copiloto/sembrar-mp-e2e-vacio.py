"""Siembra (o retira) una conexión MercadoPago SINTÉTICA y «sana» en el tenant de prueba `e2e-vacio@copiloto.test`.

Por qué existe: «cobrale N» sólo llega al preview HITL (`tool_catalog.py`, `mp_charge`) si el tenant tiene una
credencial MP vigente; sin ella corta con `requiere_conexion_card`. Medir en device el preview (SM-N20/SM-N21)
exigía reconectar MP en la cuenta canónica, que es del operador. Este script produce ese estado en el tenant de
PRUEBA, sin tocar nunca la canónica.

La credencial es SINTÉTICA: tokens inventados (prefijo `TEST-SINTETICO-`), cifrados con la misma llave de
servicio que los reales, `expires_at` lejano y `reauth_desde` NULL. No es una credencial de MercadoPago: sirve
para que `salud()` diga «conectado» y se llegue al preview. NO sirve para confirmar un cobro (MP la rechazaría):
la confirmación real queda fuera de este instrumento a propósito.

DRY-RUN POR DEFECTO: informa el estado y no cambia nada. Para aplicar: `--ejecutar`. Idempotente.

    python -I - < deploy/copiloto/sembrar-mp-e2e-vacio.py                       # dry-run: sembrar
    python -I - < deploy/copiloto/sembrar-mp-e2e-vacio.py --ejecutar            # siembra
    python -I - < deploy/copiloto/sembrar-mp-e2e-vacio.py --retirar --ejecutar  # teardown (vuelve a «nunca conectado»)

(se corre en el VPS; los argumentos se leen de `MP_SEED_ARGS` cuando el script llega por stdin.)

Guardas, todas fail-closed:
- El tenant se resuelve por el email canónico y se aborta si no resuelve exactamente UNA fila.
- Toda query de la credencial lleva `cliente_id` explícito (el store usa el rol owner, que bypassa RLS).
- El `--retirar` borra SÓLO la fila del seller sintético: si el tenant tuviera una conexión real, no se toca.
- Nunca imprime tokens.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys

EMAIL_VACIO = "e2e-vacio@copiloto.test"
UNIT = "uc-copiloto-web.service"
SCHEMA = "uc_factory"
SELLER_SINTETICO = "e2e-sintetico-mp-0001"
EXPIRA_EN_S = 10 * 365 * 24 * 3600  # lejos: que ningún chequeo de vencimiento la marque «caída» durante la prueba


def _args() -> set[str]:
    return set(sys.argv[1:]) | set(os.environ.get("MP_SEED_ARGS", "").split())


def _heredar_env_del_proceso(unit: str) -> str:
    """Hereda el env del servicio (DATABASE_URL, llave Fernet) y arma el sys.path como el servicio."""
    pid = subprocess.check_output(["systemctl", "show", unit, "-p", "MainPID", "--value"]).decode().strip()
    if not pid or pid == "0":
        sys.exit(f"{unit} no está corriendo")
    with open(f"/proc/{pid}/environ", "rb") as fh:
        for entrada in fh.read().split(b"\x00"):
            if b"=" in entrada:
                clave, valor = entrada.decode("utf-8", "replace").split("=", 1)
                os.environ.setdefault(clave, valor)
    for p in reversed([p for p in os.environ.get("PYTHONPATH", "").split(":") if p]):
        sys.path.insert(0, p)
    sys.path.insert(0, os.readlink(f"/proc/{pid}/cwd"))  # apps/copiloto
    return pid


def _control_vacio(conn, cid: str) -> None:
    """Un retiro que sólo mira la credencial deja el instrumento con aspecto de limpio: mira TAMBIÉN las filas de
    negocio (gastos, ingresos, presupuestos…) y dice explícito si el tenant NO quedó vacío."""
    with conn.cursor() as cur:
        cur.execute("SELECT table_name FROM information_schema.columns WHERE table_schema = %s "
                    "AND column_name = 'cliente_id' AND table_name IN "
                    "('copiloto_gastos','copiloto_ingresos','copiloto_presupuestos','copiloto_presupuesto_items')",
                    (SCHEMA,))
        sucias = {}
        for (t,) in cur.fetchall():
            cur.execute(f"SELECT count(*) FROM {SCHEMA}.{t} WHERE cliente_id = %s::uuid", (cid,))
            n = cur.fetchone()[0]
            if n:
                sucias[t] = n
    if sucias:
        print(f"⚠ e2e-vacio NO quedó vacío: {sucias} — correr deploy/copiloto/resetear-vacio-e2e.py --ejecutar")
    else:
        print("control: gastos, ingresos y presupuestos en 0 (la credencial MP se informa arriba)")


def main() -> int:
    args = _args()
    ejecutar = "--ejecutar" in args
    retirar = "--retirar" in args
    _heredar_env_del_proceso(UNIT)
    import time

    import psycopg2
    from clients.agent.providers.crypto import FernetCrypto
    from mp_credential_store import MpCredentialStore

    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(f"SELECT cliente_id::text FROM {SCHEMA}.tenants WHERE email = %s", (EMAIL_VACIO,))
        filas = cur.fetchall()
        if len(filas) != 1:
            print(f"ABORT: {EMAIL_VACIO} resuelve {len(filas)} fila(s), esperaba 1")
            return 2
        cid = filas[0][0]
        # FORCE RLS: el rol de DATABASE_URL tampoco bypassa la policy sin el claim del tenant (medido 2026-11-03:
        # el INSERT sin claim da InsufficientPrivilege). Se declara el de ESTE tenant, nunca otro.
        cur.execute("SELECT set_config('request.jwt.claims', %s, false)", (json.dumps({"cliente_id": cid}),))
        cur.execute(f"SELECT seller_user_id FROM {SCHEMA}.mp_credentials WHERE cliente_id = %s::uuid", (cid,))
        sellers = [s for (s,) in cur.fetchall()]

    store = MpCredentialStore(lambda: conn, cid, FernetCrypto())
    ajenos = [s for s in sellers if s != SELLER_SINTETICO]
    print(f"{EMAIL_VACIO} cliente_id={cid} · sellers={len(sellers)} (sintético: "
          f"{'sí' if SELLER_SINTETICO in sellers else 'no'}, ajenos: {len(ajenos)}) · salud={store.salud()}")

    if retirar:
        if SELLER_SINTETICO not in sellers:
            print("nada que retirar (idempotente)")
            return 0
        if not ejecutar:
            print("dry-run: se borraría la fila del seller sintético (usar --ejecutar)")
            _control_vacio(conn, cid)
            return 0
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {SCHEMA}.mp_credentials WHERE cliente_id = %s::uuid AND seller_user_id = %s",
                        (cid, SELLER_SINTETICO))
        print(f"OK retirada · salud={store.salud()}")
        _control_vacio(conn, cid)
        return 0

    if ajenos:
        print(f"ABORT: el tenant ya tiene {len(ajenos)} conexión(es) que NO son la sintética; no se pisa")
        return 3
    if not ejecutar:
        print("dry-run: se sembraría la credencial sintética sana (usar --ejecutar)")
        return 0
    store.save(SELLER_SINTETICO, access_token="TEST-SINTETICO-access", refresh_token="TEST-SINTETICO-refresh",
               expires_at=int(time.time()) + EXPIRA_EN_S, public_key="TEST-SINTETICO-public")
    print(f"OK sembrada · salud={store.salud()} · seller={SELLER_SINTETICO}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
