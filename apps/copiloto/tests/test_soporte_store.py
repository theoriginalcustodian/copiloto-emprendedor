"""SOP3 (bloque B) — persistencia de tickets/mensajes, contra Postgres real.

Corre contra la base real (no un mock): lo que se verifica -- `FORCE ROW LEVEL SECURITY`, el `WITH
CHECK` de la policy, la reserva atómica del código bajo concurrencia real -- es comportamiento de la
base, no del código Python. Un doble no reproduce ninguno de los tres.
"""
from __future__ import annotations

import os
import threading
import uuid

import pytest

from soporte_store import (ABIERTO, CERRADO, COMO_USO_LA_APP, RESPONDIDO, SOPORTE_TECNICO, TicketStore)

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")


@pytest.fixture
def tenants(conn_de_tenant):
    """Dos tenants sintéticos y su barrido -- uno por tenant, con SU conexión (con RLS, la conexión
    de A no puede borrar las filas de B)."""
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_mensajes WHERE cliente_id = %s", (cid,))
            cur.execute("DELETE FROM uc_factory.copiloto_tickets WHERE cliente_id = %s", (cid,))
            cur.execute("DELETE FROM uc_factory.copiloto_ticket_secuencia WHERE cliente_id = %s",
                       (cid,))
        conn.commit()
        conn.close()


def _store(conn_de_tenant, cid):
    return TicketStore(conn_de_tenant(cid), cid)


# ======================================================================================
# B3 — código SOP-XXXX: único por tenant, atómico bajo concurrencia real
# ======================================================================================
@necesita_pg
def test_reservar_codigo_arranca_en_SOP_0001_y_avanza_secuencial(tenants, conn_de_tenant):
    a, _ = tenants
    store = _store(conn_de_tenant, a)
    assert store.reservar_codigo() == "SOP-0001"
    assert store.reservar_codigo() == "SOP-0002"
    assert store.reservar_codigo() == "SOP-0003"


@necesita_pg
def test_ADVERSARIAL_dos_tenants_pueden_compartir_el_MISMO_codigo_sin_colisionar(tenants,
                                                                                 conn_de_tenant):
    """El índice único es (cliente_id, codigo), no codigo solo -- dos tenants nuevos generan AMBOS
    "SOP-0001" el mismo día, y eso está bien: son namespaces distintos."""
    a, b = tenants
    assert _store(conn_de_tenant, a).reservar_codigo() == "SOP-0001"
    assert _store(conn_de_tenant, b).reservar_codigo() == "SOP-0001"


@necesita_pg
def test_reservar_codigo_bajo_concurrencia_real_NO_repite_numero(tenants, conn_de_tenant):
    """El control de B3: 20 hilos reservando código para el MISMO tenant, en paralelo, contra
    Postgres real. Si el UPSERT no fuera atómico, dos hilos leerían `ultimo` antes de que el otro lo
    incremente y devolverían el mismo número -- exactamente la ventana que el spike S3 de
    `copiloto_traumas` midió para un patrón `if ya existe`."""
    a, _ = tenants
    store = _store(conn_de_tenant, a)
    N = 20
    codigos: list[str] = []
    lock = threading.Lock()
    errores: list[Exception] = []

    def _reservar():
        try:
            codigo = store.reservar_codigo()
            with lock:
                codigos.append(codigo)
        except Exception as exc:  # noqa: BLE001 -- se reporta, no se traga
            with lock:
                errores.append(exc)

    hilos = [threading.Thread(target=_reservar) for _ in range(N)]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join()

    assert not errores, f"{len(errores)} hilos fallaron: {errores[:3]}"
    assert len(codigos) == N
    assert len(set(codigos)) == N, f"colisión: {sorted(codigos)}"


# ======================================================================================
# B2 — RLS FORCE + adversarial
# ======================================================================================
@necesita_pg
def test_crear_ticket_y_listarlo_para_el_mismo_tenant(tenants, conn_de_tenant):
    a, _ = tenants
    store = _store(conn_de_tenant, a)
    creado = store.crear_ticket(canal=SOPORTE_TECNICO, asunto="no puedo facturar",
                                primer_mensaje="AFIP me tira un error raro")
    assert creado["codigo"] == "SOP-0001"
    assert creado["estado"] == ABIERTO

    tickets = store.listar_tickets()
    assert len(tickets) == 1
    assert tickets[0]["codigo"] == "SOP-0001"
    assert tickets[0]["asunto"] == "no puedo facturar"

    mensajes = store.listar_mensajes(ticket_id=creado["id"])
    assert len(mensajes) == 1
    assert mensajes[0]["texto"] == "AFIP me tira un error raro"
    assert mensajes[0]["autor"] == "usuario"


@necesita_pg
def test_cambiar_estado_actualiza_y_devuelve_el_ANTERIOR(tenants, conn_de_tenant):
    """SOP6 §0: el verbo que faltaba. Devuelve el estado ANTERIOR -- es lo que la auditoría
    (`admin_web.py`) necesita para `detalle={"de": ..., "a": ...}`, mismo criterio que
    `admin_tenants.cambiar_estado`."""
    a, _ = tenants
    store = _store(conn_de_tenant, a)
    creado = store.crear_ticket(canal=SOPORTE_TECNICO, asunto="x", primer_mensaje="y")
    anterior = store.cambiar_estado(ticket_id=creado["id"], nuevo_estado=RESPONDIDO)
    assert anterior == ABIERTO
    assert store.listar_tickets()[0]["estado"] == RESPONDIDO


@necesita_pg
def test_cambiar_estado_ticket_inexistente_devuelve_None(tenants, conn_de_tenant):
    a, _ = tenants
    assert _store(conn_de_tenant, a).cambiar_estado(ticket_id=999999999, nuevo_estado=CERRADO) is None


def test_cambiar_estado_invalido_lanza_ValueError():
    """Falla temprano (antes de tocar la base), mismo criterio que `crear_ticket` con `canal`
    inválido -- no hace falta Postgres para probar esto."""
    with pytest.raises(ValueError):
        TicketStore(lambda: None, "x").cambiar_estado(ticket_id=1, nuevo_estado="archivado")


@necesita_pg
def test_H1_ADVERSARIAL_cambiar_estado_como_B_el_ticket_de_A_no_hace_nada(tenants, conn_de_tenant):
    """B "cambia" el estado de un ticket de A -- el `WHERE cliente_id = %s` de la propia conexión de
    B hace que la fila de A ni siquiera exista desde su punto de vista: `None`, y A no ve el cambio."""
    a, b = tenants
    creado = _store(conn_de_tenant, a).crear_ticket(canal=SOPORTE_TECNICO, asunto="x", primer_mensaje="y")

    resultado = _store(conn_de_tenant, b).cambiar_estado(ticket_id=creado["id"], nuevo_estado=CERRADO)
    assert resultado is None

    assert _store(conn_de_tenant, a).listar_tickets()[0]["estado"] == ABIERTO  # A: intacto


@necesita_pg
def test_H1_ADVERSARIAL_B_no_ve_el_ticket_de_A_pero_A_SI_lo_ve_MISMO_TEST(tenants, conn_de_tenant):
    """H1 del contrato de SOP3, con control positivo en la MISMA corrida -- sin el positivo, un
    error de conexión daría el mismo resultado ("no veo nada") y parecería aislamiento."""
    a, b = tenants
    creado = _store(conn_de_tenant, a).crear_ticket(canal=SOPORTE_TECNICO, asunto="ticket de A",
                                                     primer_mensaje="mensaje de A")

    # --- positivo: A ve su propio ticket y su mensaje.
    tickets_de_a = _store(conn_de_tenant, a).listar_tickets()
    assert len(tickets_de_a) == 1 and tickets_de_a[0]["codigo"] == creado["codigo"]
    mensajes_de_a = _store(conn_de_tenant, a).listar_mensajes(ticket_id=creado["id"])
    assert len(mensajes_de_a) == 1

    # --- negativo: B no ve NADA de A, ni el ticket ni sus mensajes.
    store_b = _store(conn_de_tenant, b)
    assert store_b.listar_tickets() == []
    assert store_b.listar_mensajes(ticket_id=creado["id"]) == []


@necesita_pg
def test_H1_ADVERSARIAL_responder_como_B_el_ticket_de_A_es_rechazado(tenants, conn_de_tenant):
    """"Responder" el ticket ajeno = escribir en `copiloto_mensajes` con el `ticket_id` de A. El
    `WITH CHECK` de la policy lo rechaza -- no es una validación de Python, es la base."""
    a, b = tenants
    creado = _store(conn_de_tenant, a).crear_ticket(canal=SOPORTE_TECNICO, asunto="ticket de A",
                                                     primer_mensaje="mensaje de A")

    with pytest.raises(Exception):  # noqa: PT011 -- psycopg2 crudo, no un tipo propio
        _store(conn_de_tenant, b).agregar_mensaje(ticket_id=creado["id"], autor="usuario",
                                                   texto="intento responder el ticket de A")


@necesita_pg
def test_ADVERSARIAL_escribir_un_mensaje_con_el_cliente_id_de_otro_tenant_es_rechazado(
        tenants, conn_de_tenant):
    """El `WITH CHECK` de la policy, no una validación de Python: se conecta CON el tenant A pero se
    intenta insertar una fila declarando el `cliente_id` de B a mano -- Postgres debe rechazarla."""
    a, b = tenants
    conn = conn_de_tenant(a)()
    try:
        with conn.cursor() as cur:
            with pytest.raises(Exception):  # noqa: PT011 -- psycopg2 crudo, no un tipo propio
                cur.execute(
                    """INSERT INTO uc_factory.copiloto_mensajes
                           (cliente_id, ticket_id, autor, texto)
                       VALUES (%s, 0, 'usuario', 'intento cross-tenant')""",
                    (b,))
        conn.rollback()
    finally:
        conn.close()


@necesita_pg
def test_ADVERSARIAL_sin_tenant_declarado_no_se_ve_nada(conn_de_tenant, tenants):
    """Control de ceguera del propio instrumento
    ([[un-instrumento-ciego-por-rls-dice-no-hay-en-vez-de-no-veo]]): con FORCE y sin tenant
    declarado en el `ContextVar` (no "" -- eso ni siquiera es un uuid válido), un `SELECT` SIN
    filtro sobre la tabla debe devolver CERO filas -- fail-closed, no fail-open. Mismo patrón que
    `test_contexto_tenant.py::test_ADVERSARIAL_...`, aplicado a `copiloto_tickets`."""
    import psycopg2

    from contexto_tenant import conexion_con_tenant, tenant

    a, _ = tenants
    _store(conn_de_tenant, a).crear_ticket(canal=SOPORTE_TECNICO, asunto="x", primer_mensaje="y")

    factory = conexion_con_tenant(lambda: psycopg2.connect(os.environ["DATABASE_URL"]))
    with tenant(None):
        conn = factory()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM uc_factory.copiloto_tickets")  # a propósito SIN WHERE
                assert cur.fetchone()[0] == 0
        finally:
            conn.close()


def test_canal_invalido_lanza_ANTES_de_reservar_codigo(conn_de_tenant):
    """Falla temprano: un canal inválido no debe consumir un número de la secuencia (dejaría un
    hueco que el usuario nunca vería explicado)."""
    store = TicketStore(conn_de_tenant("00000000-0000-0000-0000-000000000000"),
                        "00000000-0000-0000-0000-000000000000")
    with pytest.raises(ValueError):
        store.crear_ticket(canal="feedback", asunto="x", primer_mensaje="y")


# ======================================================================================
# B4 — `copiloto_feedback` intacta
# ======================================================================================
@necesita_pg
def test_copiloto_feedback_conserva_sus_4_columnas_de_negocio(conn_de_tenant):
    """Este sprint no migra ni toca `copiloto_feedback`. Si algún cambio futuro le agrega/quita una
    columna de negocio sin querer, este test lo caza."""
    conn = conn_de_tenant("00000000-0000-0000-0000-000000000000")()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT column_name FROM information_schema.columns
                   WHERE table_schema='uc_factory' AND table_name='copiloto_feedback'
                   ORDER BY column_name""")
            columnas = {fila[0] for fila in cur.fetchall()}
    finally:
        conn.close()
    # id/cliente_id los agrega el mecanismo estándar a TODA tabla; las 4 de negocio son las del DoD.
    assert {"tipo", "texto", "contexto", "created_at"} <= columnas
    assert "id" in columnas and "cliente_id" in columnas
