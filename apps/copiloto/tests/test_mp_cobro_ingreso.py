"""COBROMP — un pago de Mercado Pago APROBADO se vuelve Ingreso (`origen='mercadopago'`), contra Postgres real.

Lo que este contrato promete —un solo ingreso aunque MP reintente el webhook, sólo `approved`, y que el
webhook de un tenant no escriba en otro— vive en el motor (índice `copiloto_cobros_idem_uk`, RLS). Un fake
del store de cobros confirmaría las tres cosas sin que ninguna sea cierta. Por eso el efecto se mide
contando filas en `copiloto_cobros`, no mirando lo que responde el webhook (siempre 200).

Lo que se simula es sólo la frontera con Mercado Pago (gateway HTTP y credenciales): no es lo que se prueba.
"""
from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

from clients.agent.providers.crypto import FernetCrypto  # noqa: E402
from cobro_store import CobroInvalido, CobroStore, ORIGEN_MANUAL, ORIGEN_MP  # noqa: E402
from mp_payment_store import MpPaymentStore  # noqa: E402
from mp_web import create_mp_app  # noqa: E402

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


class _GatewayMp:
    """Frontera con Mercado Pago: devuelve el pago que el test le fija. La firma se acepta siempre."""

    def __init__(self, pagos: dict):
        self._pagos = pagos

    def get_payment(self, access_token, pid):
        return self._pagos[str(pid)]

    def verify_webhook(self, x_sig, x_rid, data_id):
        return True


class _CredencialesOk:
    """Frontera con las credenciales del seller: el tenant ya conectó MP."""

    def get(self, seller):
        return {"access_token": "AT"}


def _pago(pid: str, status: str = "approved", monto: float = 150.0) -> dict:
    return {"id": pid, "status": status, "transaction_amount": monto, "external_reference": "ext-1",
            "payer": {"email": "comprador@test.com"}, "date_approved": "2026-10-06T10:00:00.000-03:00"}


@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            for t in ("copiloto_eventos", "copiloto_cobros", "mp_payments"):
                cur.execute(f"DELETE FROM uc_factory.{t} WHERE cliente_id=%s", (cid,))
        conn.close()


@pytest.fixture
def webhook_de(conn_de_tenant, monkeypatch):
    """Arma la app MP con los stores REALES (contra la base) y devuelve un cliente para un gateway dado."""
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())

    def construir(pagos: dict) -> TestClient:
        return TestClient(create_mp_app(
            gateway=_GatewayMp(pagos), crypto=FernetCrypto(),
            cred_store_factory=lambda cid: _CredencialesOk(),
            payment_store_factory=lambda cid: MpPaymentStore(conn_de_tenant(cid), cid),
            cobro_store_factory=lambda cid: CobroStore(conn_de_tenant(cid), cid)))
    return construir


def _notificar(client: TestClient, cid: str, pid: str):
    return client.post(f"/mp/webhook?cid={cid}&seller=146&data.id={pid}&type=payment",
                       headers={"x-signature": "ts=1,v1=abc", "x-request-id": "rid"})


def _ingresos(conn_de_tenant, cid: str) -> list[tuple]:
    conn = conn_de_tenant(cid)()
    with conn.cursor() as cur:
        cur.execute("SELECT origen, monto, idem_key FROM uc_factory.copiloto_cobros "
                    "WHERE cliente_id=%s ORDER BY id", (cid,))
        filas = cur.fetchall()
    conn.close()
    return filas


@necesita_pg
def test_pago_aprobado_se_vuelve_UN_ingreso_aunque_mp_reintente(conn_de_tenant, tenants, webhook_de):
    """DoD: webhook `approved` ⇒ 1 fila con origen mercadopago. El mismo webhook DOS veces ⇒ sigue en 1.
    El reintento es el caso normal de MP, no el borde: es el que el índice tiene que frenar."""
    a, _ = tenants
    client = webhook_de({"P1": _pago("P1")})

    assert _notificar(client, a, "P1").status_code == 200
    assert _notificar(client, a, "P1").status_code == 200

    filas = _ingresos(conn_de_tenant, a)
    assert len(filas) == 1
    origen, monto, idem = filas[0]
    assert origen == ORIGEN_MP == "mercadopago"
    assert str(monto) == "150.00"
    assert idem == "mp:P1"


@necesita_pg
@pytest.mark.parametrize("status", ["pending", "rejected", "in_process"])
def test_pago_no_aprobado_no_genera_ingreso(conn_de_tenant, tenants, webhook_de, status):
    """Plata que el emprendedor ve y no tiene: un pago sin aprobar NO es un ingreso."""
    a, _ = tenants
    client = webhook_de({"P9": _pago("P9", status=status)})

    assert _notificar(client, a, "P9").status_code == 200

    assert _ingresos(conn_de_tenant, a) == []


@necesita_pg
def test_pago_aprobado_con_monto_invalido_responde_200_sin_ingreso(conn_de_tenant, tenants, webhook_de):
    """Un 500 aquí haría que MP reintente el webhook sin fin. El invariante del endpoint es 200 siempre."""
    a, _ = tenants
    client = webhook_de({"P5": _pago("P5", monto=0)})

    assert _notificar(client, a, "P5").status_code == 200

    assert _ingresos(conn_de_tenant, a) == []


@necesita_pg
def test_adversarial_webhook_de_A_no_escribe_ingreso_en_B(conn_de_tenant, tenants, webhook_de):
    """Actor A notifica un pago; B no puede ver ni un ingreso de ese pago. Sin este test, el happy-path
    «el ingreso aparece» pasa igual si el aislamiento por tenant no existe."""
    a, b = tenants
    client = webhook_de({"P1": _pago("P1")})

    _notificar(client, a, "P1")

    assert len(_ingresos(conn_de_tenant, a)) == 1
    assert _ingresos(conn_de_tenant, b) == []


@necesita_pg
def test_mismo_payment_id_en_dos_tenants_son_dos_ingresos_independientes(conn_de_tenant, tenants, webhook_de):
    """El índice es por (cliente_id, idem_key): un payment id que cae en A y en B no se bloquea entre sí."""
    a, b = tenants
    client = webhook_de({"P1": _pago("P1")})

    _notificar(client, a, "P1")
    _notificar(client, b, "P1")

    assert len(_ingresos(conn_de_tenant, a)) == 1
    assert len(_ingresos(conn_de_tenant, b)) == 1


@necesita_pg
def test_registro_manual_sigue_siendo_manual_y_origen_invalido_se_rechaza(conn_de_tenant, tenants):
    """Regresión de la parametrización: el default de `registrar_suelto` sigue siendo `manual` (ningún
    llamador cambia), y un origen fuera de la lista no entra a la base."""
    a, _ = tenants
    store = CobroStore(conn_de_tenant(a), a)

    store.registrar_suelto(monto="85000", medio="efectivo", cliente_nombre="Panadería", concepto="trabajo")
    with pytest.raises(CobroInvalido):
        store.registrar_suelto(monto="10", origen="factura_falsa")

    filas = _ingresos(conn_de_tenant, a)
    assert [f[0] for f in filas] == [ORIGEN_MANUAL]
