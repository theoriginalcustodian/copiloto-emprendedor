"""SEC-D8 · front-door: el borrado/exportación sólo alcanza al PROPIO tenant (OWASP API1:2023).

Actor hostil = A con su token válido, intentando destruir/leer lo de B por todos los canales posibles
(query, header, body, path). Aserto: lo único que llega a la capa de datos / a Temporal es el
`cliente_id` de A. Más: sin token no se ejecuta nada, sin la confirmación exacta no se arranca el
borrado, y la ruta de operador exige claim de admin.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi import HTTPException, Request
from fastapi.testclient import TestClient

from admin_web import create_admin_app
from contexto_tenant import declarar_tenant
from cuenta_web import CONFIRMACION, create_cuenta_app


class _Espia:
    def __init__(self) -> None:
        self.borrados: list[str] = []
        self.conns: list[str | None] = []

    async def iniciar_borrado(self, cliente_id: str, solicitante: str, email: str) -> None:
        self.borrados.append(cliente_id)

    def conn_factory(self):
        from contexto_tenant import tenant_actual
        self.conns.append(tenant_actual())
        raise RuntimeError("conn_factory-espia: llegó a la capa de datos")


@pytest.fixture
def mundo():
    sfx = uuid.uuid4().hex[:8]
    a, b = f"cid-A-{sfx}", f"cid-B-{sfx}"
    mapa = {f"TOKEN-A-{sfx}": a, f"TOKEN-B-{sfx}": b}
    espia = _Espia()

    async def require_tenant(request: Request) -> str:
        _, _, tok = request.headers.get("Authorization", "").partition(" ")
        if tok not in mapa:
            raise HTTPException(status_code=401, detail="token invalido")
        declarar_tenant(mapa[tok])
        return mapa[tok]

    async def require_admin(request: Request) -> dict:
        _, _, tok = request.headers.get("Authorization", "").partition(" ")
        if tok != f"ADMIN-{sfx}":
            raise HTTPException(status_code=403, detail="no admin")
        return {"sub": "op-1", "email": "op@x.invalid"}

    cuenta = create_cuenta_app(require_tenant=require_tenant, conn_factory=espia.conn_factory,
                               iniciar_borrado=espia.iniciar_borrado)
    admin = create_admin_app(require_admin=require_admin, iniciar_borrado=espia.iniciar_borrado,
                             conn_factory=espia.conn_factory)
    yield (TestClient(cuenta, raise_server_exceptions=False),
           TestClient(admin, raise_server_exceptions=False), espia, a, b,
           f"TOKEN-A-{sfx}", f"ADMIN-{sfx}")
    declarar_tenant(None)


def test_borrar_sin_token_no_ejecuta_nada(mundo):
    cuenta, _, espia, *_ = mundo
    r = cuenta.request("DELETE", "/cuenta", json={"confirmar": CONFIRMACION})
    assert r.status_code == 401 and espia.borrados == []


def test_borrar_exige_la_confirmacion_exacta(mundo):
    cuenta, _, espia, a, b, tok_a, _ = mundo
    for malo in ("", "borrar mi cuenta", "si", CONFIRMACION + " "):
        r = cuenta.request("DELETE", "/cuenta", json={"confirmar": malo},
                           headers={"Authorization": f"Bearer {tok_a}"})
        assert r.status_code == 422, malo
    assert espia.borrados == []


def test_ADVERSARIAL_A_inyecta_el_id_de_B_y_solo_se_borra_A(mundo):
    cuenta, _, espia, a, b, tok_a, _ = mundo
    r = cuenta.request(
        "DELETE", f"/cuenta?cliente_id={b}&tenant={b}",
        json={"confirmar": CONFIRMACION, "cliente_id": b, "tenant": b},
        headers={"Authorization": f"Bearer {tok_a}", "X-Cliente-Id": b})
    assert r.status_code == 202 and r.json() == {"estado": "en_curso"}
    assert espia.borrados == [a]            # control positivo: SÍ llegó, y con la identidad del token
    assert b not in espia.borrados


def test_ADVERSARIAL_exportar_usa_siempre_el_tenant_del_token(mundo):
    cuenta, _, espia, a, b, tok_a, _ = mundo
    cuenta.get(f"/cuenta/exportar?cliente_id={b}", headers={"Authorization": f"Bearer {tok_a}",
                                                              "X-Cliente-Id": b})
    assert espia.conns == [a] and b not in espia.conns   # llegó a la capa de datos, y como A


def test_admin_borrar_exige_claim_admin_y_confirmacion(mundo):
    _, admin, espia, a, b, tok_a, tok_admin = mundo
    # un tenant común (token de A) NO puede usar la ruta de operador
    r = admin.post(f"/admin/tenants/{b}/borrar", json={"confirmar": b},
                   headers={"Authorization": f"Bearer {tok_a}"})
    assert r.status_code == 403 and espia.borrados == []
    # operador sin repetir el id -> 422
    r = admin.post(f"/admin/tenants/{b}/borrar", json={"confirmar": "otro"},
                   headers={"Authorization": f"Bearer {tok_admin}"})
    assert r.status_code == 422 and espia.borrados == []
