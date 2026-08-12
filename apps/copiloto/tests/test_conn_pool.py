"""C4 (auditoría lote C): el pool detrás de `conn_factory` (`conn_pool.py`).

Dos preguntas, dos tests -- ninguna se contesta leyendo el código:

1. ¿El reuso del pool puede filtrar el claim de RLS de un tenant al préstamo de OTRO? Es el riesgo
   que un PgBouncer en modo *transaction* sí tendría (ver el docstring de `conn_pool.py`) -- acá se
   fuerza el peor caso (`maxconn=1`, la MISMA conexión física reciclada) y se mide el claim real
   contra Postgres, no se asume que `declarar_en_conexion` alcanza.
2. ¿El pool efectivamente acota las conexiones reales bajo carga, con el patrón real de los ~57
   sitios que nunca llaman `.close()` (dependen del GC)? Se cuenta `pg_backend_pid()` bajo
   concurrencia, con un control positivo que muestra que SIN pool el mismo escenario abre un backend
   por hilo -- así el primer test no es vacuo."""
from __future__ import annotations

import json
import os
import threading
import time
import uuid

import psycopg2
import pytest

from conn_pool import pool_de_conexiones
from contexto_tenant import conexion_con_tenant, tenant

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


def _claim_actual(conn) -> dict:
    with conn.cursor() as cur:
        cur.execute("SELECT current_setting('request.jwt.claims', true)")
        crudo = cur.fetchone()[0]
    return json.loads(crudo) if crudo else {}


@necesita_pg
def test_ADVERSARIAL_prestamos_intercalados_de_dos_tenants_no_cruzan_el_claim():
    """`maxconn=1` fuerza que el segundo préstamo reuse la MISMA conexión física del primero -- el
    peor caso posible para una fuga. El primer préstamo se abandona sin `close()` explícito (como
    hacen ~57 sitios reales) y se fuerza la colecta antes de pedir el segundo, así el test ejercita
    el camino GC -> `__del__` -> `putconn`, no sólo el de `close()` a mano."""
    import gc

    db_url = os.environ["DATABASE_URL"]
    factory_cruda = pool_de_conexiones(db_url, minconn=1, maxconn=1)

    a, b = str(uuid.uuid4()), str(uuid.uuid4())

    with tenant(a):
        conn_a = conexion_con_tenant(factory_cruda)()
        claim_a = _claim_actual(conn_a)
    del conn_a
    gc.collect()  # dispara _ConexionPooleada.__del__ -> pool.putconn(); sin esto, maxconn=1 no cede

    with tenant(b):
        conn_b = conexion_con_tenant(factory_cruda)()
        claim_b = _claim_actual(conn_b)
    conn_b.close()

    assert claim_a["cliente_id"] == a
    assert claim_b["cliente_id"] == b
    assert claim_a != claim_b, "el préstamo de B leyó el claim que había dejado A -- fuga cross-tenant"


@necesita_pg
def test_ADVERSARIAL_prestamos_concurrentes_sin_close_no_superan_maxconn_backends_reales():
    """El patrón real de los ~57 sitios: piden `self._conn_factory()` y jamás llaman `.close()`.
    Bajo carga concurrente (20 hilos, `maxconn=3`), sin el `__del__` del proxy devolviendo la
    conexión al pool cada préstamo abriría un backend nuevo en Postgres -- acá se mide el PID real de
    backend que cada préstamo tocó, no que el código "compile"."""
    db_url = os.environ["DATABASE_URL"]
    maxconn = 3
    factory_cruda = pool_de_conexiones(db_url, minconn=1, maxconn=maxconn)
    tenant_id = str(uuid.uuid4())
    conn_factory = conexion_con_tenant(factory_cruda)

    pids_vistos: set[int] = set()
    lock = threading.Lock()
    errores: list[Exception] = []

    def prestamo() -> None:
        try:
            with tenant(tenant_id):
                conn = conn_factory()
                with conn.cursor() as cur:
                    cur.execute("SELECT pg_backend_pid()")
                    pid = cur.fetchone()[0]
                time.sleep(0.02)  # solapa préstamos de verdad entre hilos, no una carrera de un tick
                with lock:
                    pids_vistos.add(pid)
                # sin conn.close(): el mismo patrón que los ~57 sitios reales, el GC hace el resto
        except Exception as exc:  # noqa: BLE001
            with lock:
                errores.append(exc)

    hilos = [threading.Thread(target=prestamo) for _ in range(20)]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join(timeout=15)

    assert not errores, f"préstamos fallaron bajo carga: {errores!r}"
    assert len(pids_vistos) <= maxconn, (
        f"se vieron {len(pids_vistos)} backends distintos de Postgres con maxconn={maxconn} -- "
        "el pool no está acotando conexiones reales bajo carga concurrente")


@necesita_pg
def test_control_positivo_sin_pool_cada_prestamo_concurrente_abre_su_propio_backend():
    """Control positivo del test anterior: el patrón VIEJO (`psycopg2.connect` directo por llamada,
    sin pool) bajo la MISMA carga abre un backend por hilo. Confirma que el test de arriba mide algo
    real -- si este control también diera `<= maxconn`, sería evidencia de que Postgres reusa
    backends por su cuenta y el test del pool sería vacuo."""
    db_url = os.environ["DATABASE_URL"]
    n_hilos = 8

    pids_vistos: set[int] = set()
    lock = threading.Lock()
    errores: list[Exception] = []

    def prestamo_crudo() -> None:
        try:
            conn = psycopg2.connect(db_url)
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("SELECT pg_backend_pid()")
                pid = cur.fetchone()[0]
            time.sleep(0.02)
            with lock:
                pids_vistos.add(pid)
            conn.close()
        except Exception as exc:  # noqa: BLE001
            with lock:
                errores.append(exc)

    hilos = [threading.Thread(target=prestamo_crudo) for _ in range(n_hilos)]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join(timeout=15)

    assert not errores, f"conexiones crudas fallaron: {errores!r}"
    assert len(pids_vistos) == n_hilos, (
        f"se esperaban {n_hilos} backends distintos (uno por conexión cruda) y se vieron "
        f"{len(pids_vistos)} -- el control positivo no es válido, revisar el escenario")
