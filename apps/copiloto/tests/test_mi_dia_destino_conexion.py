"""H5b (contrato 2026-10-13, opción B): la tarjeta crítica `conexion_caida` trae `datos.destino`.

El backend emite SEMÁNTICA (`tipo` + `id`) y el `connect_path` COPIADO de la misma fuente que el catálogo
(`_entry`); el ruteo a una pantalla es de la app. Todo puro, sin DB.

Lo que este archivo existe para distinguir: «COPIA el connect_path del catálogo» de «lo RECONSTRUYE desde la
key». Con un servicio Composio solamente, los dos pasan igual (`/composio/connect?service=<key>`); sólo
MercadoPago (`/mp/connect`) los separa. Por eso el caso asimétrico es obligatorio, y por eso hay un control
que arma `destino` a la fuerza desde la key y exige que el test se ponga ROJO.
"""
from __future__ import annotations

import datetime

import pytest

import catalog
from catalog import TIPO_DESTINO_CONEXION, build_catalog, destino_conexion
from mi_dia_detector import _evaluar_conexion_caida
from mi_dia_tarjeta_store import _fila_a_dict

# Los dos servicios asimétricos: pago (`/mp/connect`) y Composio (`/composio/connect?service=<key>`).
MP = "mercadopago"
COMPOSIO = "gmail"


def _connect_path_del_catalogo(servicio: str) -> str:
    """El `connect_path` que la app recibe por `GET /catalog` para ese servicio (la fuente de verdad)."""
    cat = {s["key"]: s for s in build_catalog(valid_toolkits={COMPOSIO, "googledrive"}, mp_connected=False,
                                              composio_connected=[], mp_status="caido", composio_caidos=[COMPOSIO])}
    return cat[servicio]["connect_path"]


def _destino_de_la_tarjeta(servicio: str) -> dict:
    (tarjeta,) = _evaluar_conexion_caida([servicio])
    return tarjeta["datos"]["destino"]


def _atar_al_catalogo(servicio: str) -> None:
    """La aserción del DoD: el `destino.connect_path` de la tarjeta ES el del catálogo, no uno armado."""
    assert _destino_de_la_tarjeta(servicio)["connect_path"] == _connect_path_del_catalogo(servicio)


# ── el DoD: atado al catálogo en los DOS casos asimétricos ────────────────────────────────────────

def test_mercadopago_copia_el_connect_path_del_catalogo():
    _atar_al_catalogo(MP)
    assert _destino_de_la_tarjeta(MP)["connect_path"] == "/mp/connect"            # el literal, no sólo la igualdad


def test_composio_copia_el_connect_path_del_catalogo():
    _atar_al_catalogo(COMPOSIO)
    assert _destino_de_la_tarjeta(COMPOSIO)["connect_path"] == "/composio/connect?service=gmail"


def test_los_dos_casos_son_realmente_asimetricos():
    """Si alguien algún día unifica los paths, el par deja de distinguir copia de reconstrucción: que avise."""
    assert _connect_path_del_catalogo(MP) != f"/composio/connect?service={MP}"


def test_control_un_destino_reconstruido_desde_la_key_pone_el_test_rojo(monkeypatch):
    """El test tiene que poder FALLAR: con `connect_path` armado desde la key, MercadoPago rompe."""
    def reconstruye(service: str) -> dict:
        return {"tipo": TIPO_DESTINO_CONEXION, "id": service,
                "connect_path": f"/composio/connect?service={service}"}
    monkeypatch.setattr(catalog, "destino_conexion", reconstruye)
    _atar_al_catalogo(COMPOSIO)                       # el caso simétrico PASA: por eso un solo caso no alcanza
    with pytest.raises(AssertionError):
        _atar_al_catalogo(MP)                         # el asimétrico lo caza


# ── el shape (congelado en el contrato §3) ────────────────────────────────────────────────────────

@pytest.mark.parametrize("servicio", [MP, COMPOSIO])
def test_shape_exacto_y_coherente_con_la_tarjeta(servicio):
    (t,) = _evaluar_conexion_caida([servicio])
    d = t["datos"]["destino"]
    assert set(d) == {"tipo", "id", "connect_path"}
    assert d["tipo"] == TIPO_DESTINO_CONEXION == "conexion"
    assert d["id"] == t["entidad_id"] == servicio
    assert d["tipo"] == t["entidad_tipo"]             # el enum coincide con el entidad_tipo de la tarjeta
    assert t["datos"]["servicio"] == servicio         # lo que ya viajaba, intacto


def test_destino_no_pisa_desde():
    (t,) = _evaluar_conexion_caida([MP], {MP: "2026-10-13T10:00:00+00:00"})
    assert t["datos"]["desde"] == "2026-10-13T10:00:00+00:00" and "destino" in t["datos"]


# ── lectura: las filas que YA existen convergen (crear_si_no_existe es DO NOTHING) ────────────────

AHORA = datetime.datetime(2026, 10, 13, 12, 0, tzinfo=datetime.timezone.utc)


def _fila(regla, entidad_tipo, entidad_id, datos):
    return (7, regla, entidad_tipo, entidad_id, "texto", "para_hoy", datos, AHORA, None)


def test_fila_vieja_sin_destino_lo_recibe_al_leer():
    d = _fila_a_dict(_fila("conexion_caida", "conexion", MP, {"servicio": MP, "nombre": "MercadoPago"}))
    assert d["datos"]["destino"] == destino_conexion(MP)
    assert d["datos"]["destino"]["connect_path"] == "/mp/connect"
    assert d["datos"]["servicio"] == MP                # no pierde lo que ya tenía


def test_fila_con_destino_guardado_gana_lo_guardado():
    guardado = {"tipo": "conexion", "id": MP, "connect_path": "/guardado"}
    d = _fila_a_dict(_fila("conexion_caida", "conexion", MP, {"destino": guardado}))
    assert d["datos"]["destino"] == guardado


def test_fila_de_conexion_con_datos_null_igual_trae_destino():
    d = _fila_a_dict(_fila("conexion_caida", "conexion", COMPOSIO, None))
    assert d["datos"] == {"destino": destino_conexion(COMPOSIO)}


@pytest.mark.parametrize("fila", [
    _fila("cae_por_vencer", "comprobante", "55", {"nro": 1}),   # otra regla: no es de conexión
    _fila(None, None, None, {"x": 1}),                           # manual
    _fila(None, None, None, None),                               # manual sin datos
])
def test_las_demas_tarjetas_pasan_intactas(fila):
    d = _fila_a_dict(fila)
    assert d["datos"] == fila[6]
    assert not (isinstance(d["datos"], dict) and "destino" in d["datos"])
