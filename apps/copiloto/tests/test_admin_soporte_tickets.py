"""SOP6 (S6-1..S6-8) -- el operador responde el ticket desde la consola. HTTP end-to-end sobre
`create_admin_app` real, mismo patrón que `test_admin_errores_reintentar.py`: la restricción del
contrato (`copiloto_consola` lee cross-tenant, la respuesta se escribe con la conexión del TENANT
DUEÑO, resuelto leyendo el ticket) es comportamiento real de dos roles de Postgres, no un mock."""
from __future__ import annotations

import os
import time
import uuid

import jwt
import psycopg2
import pytest
from fastapi.testclient import TestClient

from admin_soporte import listar_mensajes_admin
from admin_web import create_admin_app
from auditoria_store import AuditoriaStore
from auth import make_require_admin
from contexto_tenant import conexion_con_tenant
from soporte_store import ABIERTO, CERRADO, RESPONDIDO, SOPORTE_TECNICO, TicketStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres real (DATABASE_URL)")
necesita_rol_consola = pytest.mark.skipif(
    not os.environ.get("COPILOTO_CONSOLA_DSN"),
    reason="requiere el rol de lectura de la Consola: levantá con `test-db.sh --export` y pasá "
           "COPILOTO_CONSOLA_DSN a sync-test-backend.sh")

SECRET = "test-secret-not-real"


def _owner_conn_factory():
    """Mismo wrapping que `serve.py::_conn_factory_from_env` -- ver el porqué en
    `test_admin_errores_reintentar.py::_owner_conn_factory`."""
    def f():
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        conn.autocommit = True
        return conn
    return conexion_con_tenant(f)


def _consola_conn_factory():
    def f():
        return psycopg2.connect(os.environ["COPILOTO_CONSOLA_DSN"])
    return f


def _tok_admin() -> str:
    return jwt.encode({"sub": str(uuid.uuid4()), "aud": "authenticated", "exp": int(time.time()) + 3600,
                       "app_metadata": {"copiloto_admin": True}}, SECRET, algorithm="HS256")


def _tok_normal() -> str:
    return jwt.encode({"sub": "u-1", "aud": "authenticated", "exp": int(time.time()) + 3600},
                      SECRET, algorithm="HS256")


@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_mensajes WHERE cliente_id = %s", (cid,))
            cur.execute("DELETE FROM uc_factory.copiloto_tickets WHERE cliente_id = %s", (cid,))
            cur.execute("DELETE FROM uc_factory.copiloto_ticket_secuencia WHERE cliente_id = %s", (cid,))
            # `copiloto_auditoria` es append-only por trigger (CONS1, `auditoria_append_only.sql`) --
            # NI EL DUEÑO puede borrarla. No se limpia a propósito: es el comportamiento correcto del
            # sistema bajo prueba, mismo criterio que `test_admin_errores_reintentar.py::nuevo_tenant`.
        conn.commit()
        conn.close()


def _client() -> TestClient:
    return TestClient(create_admin_app(
        require_admin=make_require_admin(secret=SECRET),
        consola_conn_factory=_consola_conn_factory(), conn_factory=_owner_conn_factory()))


def _headers_admin() -> dict:
    return {"Authorization": f"Bearer {_tok_admin()}"}


# ======================================================================================
# S6-6 -- adversarial: 403 sin el claim, en la MISMA corrida que el control positivo (ver abajo)
# ======================================================================================
@pytest.mark.parametrize("metodo,ruta", [
    ("get", "/admin/soporte/tickets"),
    ("get", "/admin/soporte/tickets/1"),
    ("post", "/admin/soporte/tickets/1/responder"),
])
def test_S6_6_ADVERSARIAL_usuario_normal_403(metodo, ruta):
    app = create_admin_app(require_admin=make_require_admin(secret=SECRET))
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {_tok_normal()}"}
    resp = (client.get(ruta, headers=headers) if metodo == "get"
           else client.post(ruta, json={"texto": "x"}, headers=headers))
    assert resp.status_code == 403


def test_sin_header_401():
    app = create_admin_app(require_admin=make_require_admin(secret=SECRET))
    assert TestClient(app).get("/admin/soporte/tickets").status_code == 401


# ======================================================================================
# S6-1 + S6-2 -- listar y buscar por código
# ======================================================================================
@necesita_pg
@necesita_rol_consola
def test_S6_6_CONTROL_POSITIVO_listar_tickets_con_admin_200(tenants, conn_de_tenant):
    """Control positivo del mismo test adversarial de arriba -- sin esto, el 403 podría venir de
    que la ruta no existe (memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md)."""
    a, _ = tenants
    TicketStore(conn_de_tenant(a), a).crear_ticket(canal=SOPORTE_TECNICO, asunto="x", primer_mensaje="y")
    resp = _client().get("/admin/soporte/tickets", headers=_headers_admin())
    assert resp.status_code == 200
    assert resp.json()["total"] >= 1


@necesita_pg
@necesita_rol_consola
def test_listar_tickets_filtra_por_estado(tenants, conn_de_tenant):
    a, _ = tenants
    store = TicketStore(conn_de_tenant(a), a)
    abierto = store.crear_ticket(canal=SOPORTE_TECNICO, asunto="abierto", primer_mensaje="y")
    cerrado = store.crear_ticket(canal=SOPORTE_TECNICO, asunto="cerrado", primer_mensaje="y")
    store.cambiar_estado(ticket_id=cerrado["id"], nuevo_estado=CERRADO)

    resp = _client().get("/admin/soporte/tickets", params={"estado": CERRADO}, headers=_headers_admin())
    codigos = {t["codigo"] for t in resp.json()["tickets"]}
    assert cerrado["codigo"] in codigos
    assert abierto["codigo"] not in codigos


@necesita_pg
@necesita_rol_consola
def test_listar_tickets_busca_por_codigo_S6_2(tenants, conn_de_tenant):
    a, _ = tenants
    creado = TicketStore(conn_de_tenant(a), a).crear_ticket(
        canal=SOPORTE_TECNICO, asunto="x", primer_mensaje="y")
    resp = _client().get("/admin/soporte/tickets", params={"codigo": creado["codigo"]},
                         headers=_headers_admin())
    assert [t["codigo"] for t in resp.json()["tickets"]] == [creado["codigo"]]


# ======================================================================================
# S6-1 -- detalle
# ======================================================================================
@necesita_pg
@necesita_rol_consola
def test_detalle_devuelve_ticket_y_mensajes(tenants, conn_de_tenant):
    a, _ = tenants
    creado = TicketStore(conn_de_tenant(a), a).crear_ticket(
        canal=SOPORTE_TECNICO, asunto="algo roto", primer_mensaje="describo el problema")
    resp = _client().get(f"/admin/soporte/tickets/{creado['id']}", headers=_headers_admin())
    assert resp.status_code == 200
    body = resp.json()
    assert body["ticket"]["codigo"] == creado["codigo"]
    assert body["ticket"]["cliente_id"] == a
    assert len(body["mensajes"]) == 1
    assert body["mensajes"][0]["texto"] == "describo el problema"


@necesita_pg
@necesita_rol_consola
def test_detalle_ticket_inexistente_404():
    resp = _client().get("/admin/soporte/tickets/999999999", headers=_headers_admin())
    assert resp.status_code == 404


# ======================================================================================
# S6-3..S6-5 -- responder: escribe con la conexión del TENANT DUEÑO, cambia estado, audita (B5)
# ======================================================================================
@necesita_pg
@necesita_rol_consola
def test_responder_escribe_mensaje_cambia_a_RESPONDIDO_y_audita_B5(tenants, conn_de_tenant):
    a, _ = tenants
    creado = TicketStore(conn_de_tenant(a), a).crear_ticket(
        canal=SOPORTE_TECNICO, asunto="x", primer_mensaje="y")

    resp = _client().post(f"/admin/soporte/tickets/{creado['id']}/responder",
                          json={"texto": "ya lo estamos revisando"}, headers=_headers_admin())
    assert resp.status_code == 200
    assert resp.json()["estado"] == RESPONDIDO

    # el mensaje quedó con autor='operador', escrito con la conexión del tenant DUEÑO (S6-3)
    mensajes = TicketStore(conn_de_tenant(a), a).listar_mensajes(ticket_id=creado["id"])
    assert mensajes[-1] == {**mensajes[-1], "autor": "operador", "texto": "ya lo estamos revisando"}
    assert TicketStore(conn_de_tenant(a), a).listar_tickets()[0]["estado"] == RESPONDIDO

    # B5: la fila de auditoría existe, con accion legible y el admin real del claim (no una 2ª fuente)
    eventos = AuditoriaStore(_consola_conn_factory()).listar(cliente_id=a)
    assert any(e["accion"] == "soporte.responder" and e["detalle"]["codigo"] == creado["codigo"]
              for e in eventos)


@necesita_pg
@necesita_rol_consola
def test_responder_con_cerrar_true_pone_CERRADO_y_audita_soporte_cerrar(tenants, conn_de_tenant):
    a, _ = tenants
    creado = TicketStore(conn_de_tenant(a), a).crear_ticket(
        canal=SOPORTE_TECNICO, asunto="x", primer_mensaje="y")

    resp = _client().post(f"/admin/soporte/tickets/{creado['id']}/responder",
                          json={"texto": "resuelto, cierro", "cerrar": True}, headers=_headers_admin())
    assert resp.status_code == 200
    assert resp.json()["estado"] == CERRADO

    eventos = AuditoriaStore(_consola_conn_factory()).listar(cliente_id=a)
    assert any(e["accion"] == "soporte.cerrar" for e in eventos)


@necesita_pg
@necesita_rol_consola
def test_responder_texto_vacio_422(tenants, conn_de_tenant):
    a, _ = tenants
    creado = TicketStore(conn_de_tenant(a), a).crear_ticket(
        canal=SOPORTE_TECNICO, asunto="x", primer_mensaje="y")
    resp = _client().post(f"/admin/soporte/tickets/{creado['id']}/responder",
                          json={"texto": "   "}, headers=_headers_admin())
    assert resp.status_code == 422
    # y NO cambió de estado ni escribió nada -- falló antes de tocar la base
    assert TicketStore(conn_de_tenant(a), a).listar_tickets()[0]["estado"] == ABIERTO


@necesita_pg
@necesita_rol_consola
def test_responder_ticket_inexistente_404():
    resp = _client().post("/admin/soporte/tickets/999999999/responder",
                          json={"texto": "x"}, headers=_headers_admin())
    assert resp.status_code == 404


# ======================================================================================
# S6-7 -- SEGUNDO ADVERSARIAL, el que este repo ya pagó caro: la respuesta de A no aparece para B
# ======================================================================================
@necesita_pg
@necesita_rol_consola
def test_S6_7_ADVERSARIAL_la_respuesta_al_ticket_de_A_NO_aparece_en_el_feed_de_B(tenants, conn_de_tenant):
    """Un control declarado sin test hostil es indistinguible de uno ausente (contrato SOP6, y antes
    ADR-013). Responder el ticket de A tiene que quedar SÓLO en A -- ni el ticket, ni el mensaje, ni
    la fila de auditoría se filtran a B por compartir el mismo endpoint de consola."""
    a, b = tenants
    creado = TicketStore(conn_de_tenant(a), a).crear_ticket(
        canal=SOPORTE_TECNICO, asunto="ticket de A", primer_mensaje="mensaje de A")

    _client().post(f"/admin/soporte/tickets/{creado['id']}/responder",
                   json={"texto": "respuesta al ticket de A"}, headers=_headers_admin())

    # positivo: A sí ve la respuesta.
    assert any(m["texto"] == "respuesta al ticket de A"
              for m in TicketStore(conn_de_tenant(a), a).listar_mensajes(ticket_id=creado["id"]))

    # negativo: B no ve ESE ticket, ni sus mensajes, ni la auditoría quedó bajo su cliente_id.
    assert TicketStore(conn_de_tenant(b), b).listar_tickets() == []
    assert TicketStore(conn_de_tenant(b), b).listar_mensajes(ticket_id=creado["id"]) == []
    eventos_b = AuditoriaStore(_consola_conn_factory()).listar(cliente_id=b)
    assert eventos_b == []


@necesita_pg
@necesita_rol_consola
def test_listar_mensajes_admin_cross_tenant_trae_los_del_ticket_correcto(tenants, conn_de_tenant):
    """Sanity del helper cross-tenant que usa la ruta de detalle -- probado directo, no sólo via HTTP."""
    a, _ = tenants
    creado = TicketStore(conn_de_tenant(a), a).crear_ticket(
        canal=SOPORTE_TECNICO, asunto="x", primer_mensaje="primer mensaje")
    mensajes = listar_mensajes_admin(_consola_conn_factory(), creado["id"])
    assert [m["texto"] for m in mensajes] == ["primer mensaje"]
