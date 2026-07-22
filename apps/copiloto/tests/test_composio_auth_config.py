"""¿Cuál auth config elige el gateway, y por qué camino manda al usuario?

Es la pieza que decide si "Conectar" lleva al consentimiento de Google o al dashboard de Composio, y
la que va a convivir con DOS configs por toolkit durante la migración a credenciales propias.

No se puede ejercitar contra Composio real: hoy la cuenta no tiene ninguna config propia (7 de 8 son
`is_composio_managed=true`) y crear una exige credenciales de Google que todavía no existen. Por eso
el SDK está fingido — pero fingido en lo que importa: `initiate` **falla** para las configs
gestionadas, igual que el servidor real, que lo tiene retirado.
"""
from __future__ import annotations

import pytest
from clients.agent.providers.composio_gateway import (ComposioExecutionError, ComposioGateway,
                                                      ToolkitPolicy)


class _Cuenta:
    """Objeto-como-el-del-SDK: atributos, no dict. El SDK devuelve las dos formas según el endpoint."""

    def __init__(self, id_, managed):
        self.id = id_
        self.is_composio_managed = managed


class _SdkFalso:
    def __init__(self, configs, *, initiate_explota=True):
        self._configs = configs
        self.initiate_explota = initiate_explota
        self.llamadas: list[tuple[str, str]] = []      # (metodo, auth_config_id)
        self.connected_accounts = self
        self.auth_configs = self

    def list(self, toolkit_slug=None, **_):
        return {"items": self._configs.get(toolkit_slug, [])}

    def initiate(self, user_id, auth_config_id, **_):
        self.llamadas.append(("initiate", auth_config_id))
        if self.initiate_explota:
            # El 400 real: ComposioLegacyConnectedAccountsEndpointRetiredError
            raise RuntimeError("Creating connections on this endpoint for Composio-managed OAuth "
                               "auth configs is no longer supported")
        return {"redirect_url": "https://accounts.google.com/o/oauth2/v2/auth?client_id=nuestro"}

    def link(self, user_id, auth_config_id, **_):
        self.llamadas.append(("link", auth_config_id))
        return {"redirect_url": "https://connect.composio.dev/link/lk_XXXX"}


def _gateway(sdk):
    """Se construye por la puerta que el módulo ya ofrece —`client_factory`— y no forzando el objeto:
    así el test ejercita el gateway REAL, con su lazy del cliente incluido, sin API key ni red."""
    return ComposioGateway({"gmail": ToolkitPolicy(version=None, read=("X",), write=())},
                           client_factory=lambda: sdk)


# --- elección de la config ----------------------------------------------------

def test_con_UNA_sola_config_gestionada_la_usa():
    """El estado de hoy: no hay nada que elegir y no debe cambiar nada."""
    sdk = _SdkFalso({"gmail": [_Cuenta("ac_composio", True)]})
    assert _gateway(sdk)._auth_config("gmail") == ("ac_composio", True)


def test_con_LAS_DOS_conviviendo_elige_la_PROPIA():
    """🔴 El bug que este cambio arregla. Antes devolvía la primera de la lista: durante la migración
    habría elegido una de las dos sin criterio, y el síntoma sería 'a veces conecta bien y a veces te
    manda al dashboard' — un bug intermitente que se busca en la pantalla equivocada."""
    sdk = _SdkFalso({"gmail": [_Cuenta("ac_composio", True), _Cuenta("ac_nuestra", False)]})
    assert _gateway(sdk)._auth_config("gmail") == ("ac_nuestra", False)


def test_el_ORDEN_de_la_lista_no_cambia_la_elegida():
    """El control del anterior: si la propia viniera primero, 'devolver la primera' pasaría el test
    sin que la preferencia exista. Con el orden invertido, sólo pasa si de verdad prefiere."""
    sdk = _SdkFalso({"gmail": [_Cuenta("ac_nuestra", False), _Cuenta("ac_composio", True)]})
    assert _gateway(sdk)._auth_config("gmail") == ("ac_nuestra", False)


def test_ante_empate_elige_SIEMPRE_la_misma():
    """Dos propias (un duplicado por error de carga). Cuál gane da igual; que gane siempre la misma,
    no: un desempate arbitrario convierte un bug reproducible en uno intermitente."""
    a = _gateway(_SdkFalso({"g": [_Cuenta("ac_b", False), _Cuenta("ac_a", False)]}))._auth_config("g")
    b = _gateway(_SdkFalso({"g": [_Cuenta("ac_a", False), _Cuenta("ac_b", False)]}))._auth_config("g")
    assert a == b


def test_sin_ninguna_config_es_un_ERROR_explicito():
    """Fail-closed: sin config no se puede conectar, y hay que decirlo. Devolver None dejaría el
    fallo a una llamada más adelante, con un mensaje que no nombra al toolkit."""
    with pytest.raises(ComposioExecutionError, match="gmail"):
        _gateway(_SdkFalso({"gmail": []}))._auth_config("gmail")


def test_una_config_en_forma_de_DICT_tambien_se_lee():
    """El SDK devuelve dicts en algunos endpoints. `getattr(dict, 'id', None)` da None sin avisar, y
    el toolkit se vería como 'sin config' teniendo una."""
    sdk = _SdkFalso({"gmail": [{"id": "ac_dict", "is_composio_managed": False}]})
    assert _gateway(sdk)._auth_config("gmail") == ("ac_dict", False)


# --- por qué camino manda al usuario ------------------------------------------

def test_con_config_de_COMPOSIO_no_intenta_initiate():
    """Está retirado para esas configs: intentarlo sería una llamada perdida y un warning de ruido en
    cada conexión."""
    sdk = _SdkFalso({"gmail": [_Cuenta("ac_composio", True)]})
    url = _gateway(sdk).authorize("cid-A", "gmail")
    assert [m for m, _ in sdk.llamadas] == ["link"]
    assert "composio.dev" in url


def test_con_config_PROPIA_usa_initiate_y_manda_a_GOOGLE():
    sdk = _SdkFalso({"gmail": [_Cuenta("ac_nuestra", False)]}, initiate_explota=False)
    url = _gateway(sdk).authorize("cid-A", "gmail")
    assert [m for m, _ in sdk.llamadas] == ["initiate"]
    assert url.startswith("https://accounts.google.com/")


def test_si_initiate_falla_con_config_propia_DEGRADA_al_link(caplog):
    """Que el usuario pueda conectar gana sobre la marca. Pero la degradación **se loguea**: sin eso
    volveríamos al dashboard de Composio sin que nadie se entere de por qué, y el trámite de Google
    parecería no haber servido para nada."""
    sdk = _SdkFalso({"gmail": [_Cuenta("ac_nuestra", False)]}, initiate_explota=True)
    with caplog.at_level("WARNING"):
        url = _gateway(sdk).authorize("cid-A", "gmail")
    assert [m for m, _ in sdk.llamadas] == ["initiate", "link"]
    assert "composio.dev" in url
    assert "initiate falló" in caplog.text and "gmail" in caplog.text


def test_el_auth_config_id_que_viaja_es_el_ELEGIDO_no_otro():
    """Con las dos conviviendo, el id que llega a Composio tiene que ser el de la propia. Si se
    eligiera bien y se mandara el otro, el usuario terminaría igual en el dashboard."""
    sdk = _SdkFalso({"gmail": [_Cuenta("ac_composio", True), _Cuenta("ac_nuestra", False)]},
                    initiate_explota=False)
    _gateway(sdk).authorize("cid-A", "gmail")
    assert sdk.llamadas == [("initiate", "ac_nuestra")]
