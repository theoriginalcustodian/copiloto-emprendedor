""""Mi día" — el endpoint (routing, forma, barrera de tenant). Con `TestClient` y fakes: la lógica
real del pipeline (detector + reconciliación) vive en `test_mi_dia_orquestador.py`; acá sólo se
defiende que la HTTP hable bien — mismo criterio que `test_inteligencia_web.py`.
"""
from __future__ import annotations

from fastapi import Header, HTTPException
from fastapi.testclient import TestClient

from mi_dia_tarjeta_store import ESTADOS, HACIENDO, PARA_HOY
from mi_dia_web import create_mi_dia_app


def _tenant_fijo(cid: str = "cid-A"):
    def dep() -> str:
        return cid
    return dep


def _tenant_401():
    def dep(authorization: str | None = Header(default=None)) -> str:
        raise HTTPException(status_code=401, detail="sin token")
    return dep


class _TarjetaStoreFake:
    """En memoria — para probar routing/forma sin DB. El dict vive por INSTANCIA de fábrica (una
    por test, ver `_fabrica_de_tarjetas()`), no por clase: dos tests no pueden pisarse el estado."""

    def __init__(self, tarjetas: dict, seq: list, cliente_id: str) -> None:
        self._tarjetas, self._seq, self._cid = tarjetas, seq, cliente_id

    def crear_manual(self, texto: str, datos=None) -> dict:
        self._seq[0] += 1
        t = {"id": self._seq[0], "regla": None, "entidad_tipo": None, "entidad_id": None,
            "texto": texto, "estado": PARA_HOY, "datos": datos,
            "creada_en": "2026-07-24T00:00:00", "movida_en": "2026-07-24T00:00:00"}
        self._tarjetas[t["id"]] = t
        return t

    def mover(self, tarjeta_id: int, nuevo_estado: str) -> dict | None:
        t = self._tarjetas.get(tarjeta_id)
        if t is None:
            return None
        t["estado"] = nuevo_estado
        return t

    def borrar(self, tarjeta_id: int) -> bool:
        return self._tarjetas.pop(tarjeta_id, None) is not None


def _fabrica_de_tarjetas() -> callable:
    """Una fábrica fresca por test: mismo dict/seq para TODOS los `cliente_id` que pida el test
    (alcanza para estos tests, que sólo usan `cid-A`)."""
    tarjetas, seq = {}, [0]
    return lambda cliente_id: _TarjetaStoreFake(tarjetas, seq, cliente_id)


def _app(**kw):
    return TestClient(create_mi_dia_app(require_tenant=kw.pop("require_tenant", _tenant_fijo()), **kw))


# --- el punto de encuentro: la forma final aunque no haya factories (front-door sin DB) ---

def test_sin_factories_tablero_es_200_con_la_forma_final_vacia():
    """Forma acordada con frontend en el buzón: `{solapas: [{id, titulo, tarjetas}, ...]}`, orden
    fijo §2.3 (Para hoy · Haciendo · Hechas) — NO el dict plano interno de `TarjetaStore`."""
    r = _app().get("/mi-dia/tablero")
    assert r.status_code == 200
    body = r.json()
    assert [s["id"] for s in body["solapas"]] == list(ESTADOS)
    assert all(s["tarjetas"] == [] for s in body["solapas"])
    assert [s["titulo"] for s in body["solapas"]] == ["Para hoy", "Haciendo", "Hechas"]


def test_sin_factories_crear_da_503_no_500():
    """`_store()` devuelve 503 explícito — no un 500 genérico si algún día alguien olvida cablear
    el factory en `serve.py`."""
    r = _app().post("/mi-dia/tarjetas", json={"texto": "llamar a un cliente"})
    assert r.status_code == 503


# --- routing y forma con el fake ---

def test_get_tablero_llama_avanzar_tablero_fn_con_el_cliente_id():
    llamadas = []

    def avanzar(cid):
        llamadas.append(cid)
        return {"para_hoy": [{"id": 1}], "haciendo": [], "hecha": []}

    r = _app(tarjeta_store_factory=_fabrica_de_tarjetas(), avanzar_tablero_fn=avanzar).get("/mi-dia/tablero")
    assert r.status_code == 200
    solapas = {s["id"]: s["tarjetas"] for s in r.json()["solapas"]}
    assert solapas["para_hoy"] == [{"id": 1}]
    assert llamadas == ["cid-A"]


def test_crear_tarjeta_manual_devuelve_201_y_la_tarjeta_en_para_hoy():
    r = _app(tarjeta_store_factory=_fabrica_de_tarjetas()).post("/mi-dia/tarjetas",
                                                            json={"texto": "llamar a un cliente"})
    assert r.status_code == 201
    tarjeta = r.json()["tarjeta"]
    assert tarjeta["texto"] == "llamar a un cliente"
    assert tarjeta["estado"] == PARA_HOY
    assert tarjeta["regla"] is None


def test_crear_tarjeta_con_texto_vacio_da_400():
    r = _app(tarjeta_store_factory=_fabrica_de_tarjetas()).post("/mi-dia/tarjetas", json={"texto": "   "})
    assert r.status_code == 400


def test_mover_tarjeta_inexistente_da_404():
    r = _app(tarjeta_store_factory=_fabrica_de_tarjetas()).patch("/mi-dia/tarjetas/999/estado",
                                                             json={"estado": HACIENDO})
    assert r.status_code == 404


def test_mover_a_estado_invalido_da_400_no_422():
    """Mismo criterio que `presupuestos_web.EstadoBody`: 400 con el motivo, no el 422 genérico."""
    r = _app(tarjeta_store_factory=_fabrica_de_tarjetas()).patch("/mi-dia/tarjetas/1/estado",
                                                             json={"estado": "archivada_a_mano"})
    assert r.status_code == 400
    assert "estado" in r.json()["detail"]


def test_crear_mover_y_borrar_de_punta_a_punta():
    client = _app(tarjeta_store_factory=_fabrica_de_tarjetas())
    creada = client.post("/mi-dia/tarjetas", json={"texto": "revisar stock"}).json()["tarjeta"]
    movida = client.patch(f"/mi-dia/tarjetas/{creada['id']}/estado",
                          json={"estado": HACIENDO}).json()["tarjeta"]
    assert movida["estado"] == HACIENDO
    r = client.delete(f"/mi-dia/tarjetas/{creada['id']}")
    assert r.status_code == 200
    assert client.delete(f"/mi-dia/tarjetas/{creada['id']}").status_code == 404


# --- la barrera de tenant, igual que el resto de los *_web.py ---

def test_sin_token_da_401_antes_de_tocar_ningun_store():
    r = _app(require_tenant=_tenant_401()).get("/mi-dia/tablero")
    assert r.status_code == 401
