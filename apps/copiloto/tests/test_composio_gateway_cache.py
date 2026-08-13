"""D1 (auditoría C7): `list_connections` golpeaba el SDK sync de Composio en CADA llamada -- base de
`/me`, `/catalog` y `connection_status` (AFIP), así que un solo tenant activo multiplicaba requests al
SDK por cada apertura de esas rutas. Fix: TTL cache per-tenant, invalidado explícitamente en disconnect
(la red de seguridad real para el flip asíncrono post-OAuth sigue siendo el TTL corto, no la
invalidación -- ver `COMPOSIO_CACHE_TTL_SECONDS`).

Reloj inyectado (no `time.sleep`): un test que depende de dormir 45s de verdad es un test que nadie
corre a fuego -- controlamos el tiempo desde afuera.
"""
from __future__ import annotations

from clients.agent.providers.composio_gateway import ComposioGateway, ToolkitPolicy


class _RelojFalso:
    def __init__(self, ahora: float = 0.0):
        self._ahora = ahora

    def __call__(self) -> float:
        return self._ahora

    def avanzar(self, segundos: float) -> None:
        self._ahora += segundos


class _Cuenta:
    def __init__(self, id_, toolkit, status, user_id):
        self.id = id_
        self.toolkit = toolkit
        self.status = status
        self.user_id = user_id


class _SdkFalso:
    def __init__(self, cuentas):
        self._cuentas = cuentas
        self.llamadas_list = 0
        self.connected_accounts = self

    def list(self, user_ids=None, cursor=None, **_):
        self.llamadas_list += 1
        items = [c for c in self._cuentas if c.user_id in (user_ids or [])]
        return {"items": items, "next_cursor": None}

    def delete(self, connection_id):
        self._cuentas = [c for c in self._cuentas if c.id != connection_id]


def _gateway(sdk, *, reloj=None, ttl=45.0):
    return ComposioGateway({"gmail": ToolkitPolicy(version=None, read=("X",), write=())},
                           client_factory=lambda: sdk, cache_ttl_seconds=ttl,
                           clock=reloj or _RelojFalso())


def test_la_segunda_lectura_dentro_del_ttl_no_vuelve_a_golpear_el_sdk():
    sdk = _SdkFalso([_Cuenta("c1", "gmail", "ACTIVE", "juan")])
    gw = _gateway(sdk)
    assert gw.list_connections("juan") == gw.list_connections("juan")
    assert sdk.llamadas_list == 1


def test_tenants_distintos_no_comparten_cache():
    sdk = _SdkFalso([_Cuenta("c1", "gmail", "ACTIVE", "juan"), _Cuenta("c2", "gmail", "ACTIVE", "ana")])
    gw = _gateway(sdk)
    gw.list_connections("juan")
    gw.list_connections("ana")
    assert sdk.llamadas_list == 2


def test_vencido_el_ttl_vuelve_a_golpear_el_sdk():
    reloj = _RelojFalso()
    sdk = _SdkFalso([_Cuenta("c1", "gmail", "ACTIVE", "juan")])
    gw = _gateway(sdk, reloj=reloj, ttl=45.0)
    gw.list_connections("juan")
    reloj.avanzar(46.0)
    gw.list_connections("juan")
    assert sdk.llamadas_list == 2


def test_justo_antes_de_vencer_todavia_sirve_cache():
    reloj = _RelojFalso()
    sdk = _SdkFalso([_Cuenta("c1", "gmail", "ACTIVE", "juan")])
    gw = _gateway(sdk, reloj=reloj, ttl=45.0)
    gw.list_connections("juan")
    reloj.avanzar(44.0)
    gw.list_connections("juan")
    assert sdk.llamadas_list == 1


def test_invalidate_fuerza_a_releer_del_sdk_antes_de_que_venza_el_ttl():
    """El caso de disconnect: sin esto, `/me` seguiría diciendo 'conectado' hasta que el TTL venza solo."""
    reloj = _RelojFalso()
    sdk = _SdkFalso([_Cuenta("c1", "gmail", "ACTIVE", "juan")])
    gw = _gateway(sdk, reloj=reloj, ttl=45.0)
    assert gw.list_connections("juan") == [{"id": "c1", "toolkit": "gmail", "status": "ACTIVE"}]
    sdk.delete("c1")
    gw.invalidate("juan")
    assert gw.list_connections("juan") == []
    assert sdk.llamadas_list == 2


def test_invalidate_de_un_tenant_no_toca_el_cache_de_otro():
    sdk = _SdkFalso([_Cuenta("c1", "gmail", "ACTIVE", "juan"), _Cuenta("c2", "gmail", "ACTIVE", "ana")])
    gw = _gateway(sdk)
    gw.list_connections("juan")
    gw.list_connections("ana")
    gw.invalidate("juan")
    gw.list_connections("juan")
    gw.list_connections("ana")
    assert sdk.llamadas_list == 3  # juan releído, ana sirvió de cache


def test_connection_status_hereda_el_cache_de_list_connections():
    """`connection_status` llama `list_connections` por dentro -- si éste cachea, aquél también,
    sin que haya que cablear nada aparte (así cubre gratis el 4to call-site, `afip_web.py`)."""
    sdk = _SdkFalso([_Cuenta("c1", "gmail", "ACTIVE", "juan")])
    gw = _gateway(sdk)
    assert gw.connection_status("juan", "gmail") == "ACTIVE"
    assert gw.connection_status("juan", "gmail") == "ACTIVE"
    assert sdk.llamadas_list == 1
