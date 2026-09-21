"""K-08 («Lo pediste vos»): `GET /feedback` propio y `POST /admin/feedback/{id}/escuchado`.

Store y ruta admin contra Postgres REAL con RLS FORCE (dos roles: dueño del tenant + `copiloto_consola`),
mismo patrón que `test_admin_soporte_tickets.py`. La forma de `GET /feedback` se prueba con un fake sin DB.
"""
from __future__ import annotations

import datetime as dt
import time
import uuid

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

import web as web_module
from admin_web import create_admin_app
from auth import make_require_admin
from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.crypto import FernetCrypto
from feedback_store import FeedbackStore
from test_admin_soporte_tickets import (SECRET, _client, _headers_admin, _tok_normal, necesita_pg,
                                        necesita_rol_consola)


@pytest.fixture(autouse=True)
def _fernet(monkeypatch):
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())


@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_feedback WHERE cliente_id = %s", (cid,))
        conn.commit()
        conn.close()


# ── store contra PG real ─────────────────────────────────────────────────────────────────────────

@necesita_pg
def test_listar_propio_trae_solo_lo_del_tenant_mas_nuevo_primero(tenants, conn_de_tenant):
    a, b = tenants
    sa, sb = FeedbackStore(conn_de_tenant(a), a), FeedbackStore(conn_de_tenant(b), b)
    primero = sa.crear(tipo="texto", texto="uno", contexto="chat")
    segundo = sa.crear(tipo="voz", texto="dos", contexto=None)
    sb.crear(tipo="texto", texto="del otro", contexto=None)
    items = sa.listar_propio()
    assert [i["id"] for i in items] == [segundo, primero]
    assert [i["texto"] for i in items] == ["dos", "uno"]
    assert {i["tipo"] for i in items} == {"texto", "voz"}
    assert all(i["escuchado"] is False and i["escuchado_en"] is None for i in items)


@necesita_pg
def test_marcar_escuchado_es_idempotente_y_conserva_la_primera_fecha(tenants, conn_de_tenant):
    a, _ = tenants
    s = FeedbackStore(conn_de_tenant(a), a)
    fid = s.crear(tipo="texto", texto="x", contexto=None)
    p1 = s.marcar_escuchado(fid)
    time.sleep(0.05)
    p2 = s.marcar_escuchado(fid)
    assert p1["escuchado"] is True and p1["escuchado_en"] is not None
    assert p2["escuchado_en"] == p1["escuchado_en"]
    assert s.listar_propio()[0]["escuchado"] is True


@necesita_pg
def test_ADVERSARIAL_el_store_de_A_no_marca_el_feedback_de_B(tenants, conn_de_tenant):
    a, b = tenants
    fid_b = FeedbackStore(conn_de_tenant(b), b).crear(tipo="texto", texto="de B", contexto=None)
    assert FeedbackStore(conn_de_tenant(a), a).marcar_escuchado(fid_b) is None
    assert FeedbackStore(conn_de_tenant(b), b).listar_propio()[0]["escuchado"] is False


# ── POST /admin/feedback/{id}/escuchado ──────────────────────────────────────────────────────────

@necesita_pg
@necesita_rol_consola
def test_admin_marca_escuchado_con_el_tenant_duenio_y_no_toca_a_otro(tenants, conn_de_tenant):
    a, b = tenants
    fid = FeedbackStore(conn_de_tenant(a), a).crear(tipo="texto", texto="quiero X", contexto=None)
    FeedbackStore(conn_de_tenant(b), b).crear(tipo="texto", texto="otro", contexto=None)
    r = _client().post(f"/admin/feedback/{fid}/escuchado", headers=_headers_admin())
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == fid and body["escuchado"] is True and body["escuchado_en"]
    assert FeedbackStore(conn_de_tenant(a), a).listar_propio()[0]["escuchado"] is True
    assert FeedbackStore(conn_de_tenant(b), b).listar_propio()[0]["escuchado"] is False   # B intacto
    # auditoría: la escribe el tenant dueño (append-only, no se limpia)
    conn = conn_de_tenant(a)()
    with conn.cursor() as cur:
        cur.execute("SELECT accion, detalle->>'feedback_id' FROM uc_factory.copiloto_auditoria "
                    "WHERE cliente_id = %s AND accion = 'feedback.escuchado'", (a,))
        assert cur.fetchall() == [("feedback.escuchado", str(fid))]
    conn.close()


@necesita_pg
@necesita_rol_consola
def test_admin_feedback_inexistente_404():
    assert _client().post("/admin/feedback/999999999/escuchado", headers=_headers_admin()).status_code == 404


def test_ADVERSARIAL_sin_token_es_401_y_usuario_normal_es_403():
    """Nunca 200 sin el claim admin."""
    client = TestClient(create_admin_app(require_admin=make_require_admin(secret=SECRET)))
    assert client.post("/admin/feedback/1/escuchado").status_code == 401
    r = client.post("/admin/feedback/1/escuchado", headers={"Authorization": f"Bearer {_tok_normal()}"})
    assert r.status_code == 403


# ── GET /feedback: forma (sin DB) ────────────────────────────────────────────────────────────────

class _FakeCur:
    description = [(c,) for c in ("id", "tipo", "texto", "contexto", "created_at", "escuchado", "escuchado_en")]

    def __init__(self, filas):
        self._filas = filas

    def execute(self, sql, params):
        assert sql.strip().upper().startswith("SELECT") and "cliente_id = %s" in sql

    def fetchall(self):
        return self._filas

    def __enter__(self): return self
    def __exit__(self, *a): return False


class _FakeConn:
    def __init__(self, filas): self._filas = filas
    def cursor(self): return _FakeCur(self._filas)
    def __enter__(self): return self
    def __exit__(self, *a): return False


def _app_get(filas, *, cliente_id="cid-A"):
    def _req():
        if cliente_id is None:
            raise HTTPException(status_code=401, detail="no")
        return cliente_id
    return TestClient(web_module.create_web_app(
        temporal_client=object(), adapter=WebChannelAdapter(reply_sink=lambda *a: None),
        conn_factory=lambda: _FakeConn(filas), require_tenant=_req, mp_app=FastAPI(), gotrue=None,
        mp_gateway=object(), composio_gateway=object()))


def test_get_feedback_devuelve_items_con_escuchado_en_ambos_estados():
    t = dt.datetime(2026, 9, 20, 14, 0, tzinfo=dt.timezone.utc)
    filas = [(2, "voz", "audio", None, t, True, t), (1, "texto", "hola", "chat", t, False, None)]
    r = _app_get(filas).get("/feedback")
    assert r.status_code == 200
    items = r.json()["items"]
    assert [i["id"] for i in items] == [2, 1]
    assert items[0]["escuchado"] is True and items[0]["escuchado_en"]
    assert items[1]["escuchado"] is False and items[1]["escuchado_en"] is None
    assert set(items[0]) == {"id", "tipo", "texto", "contexto", "created_at", "escuchado", "escuchado_en"}


def test_get_feedback_vacio_es_200_lista_vacia_y_sin_token_401():
    assert _app_get([]).get("/feedback").json() == {"items": []}
    assert _app_get([], cliente_id=None).get("/feedback").status_code == 401
