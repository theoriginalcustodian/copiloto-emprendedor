"""ACTIVIDAD RECIENTE — hito 1 (el punto de encuentro: el endpoint vivo, devolviendo vacío).

Se prueba por HTTP con `TestClient`: la mitad de lo que hay que defender acá es **routing y validación
de parámetros**, y un test que llame al handler directo no ve ninguna de las dos.
"""
from __future__ import annotations

import datetime

import pytest
from fastapi import Header, HTTPException
from fastapi.testclient import TestClient

from actividad_web import LIMITE_MAX, TIPOS, create_actividad_app


def _tenant_fijo(cid: str = "cid-A"):
    def dep() -> str:
        return cid
    return dep


def _tenant_401():
    def dep(authorization: str | None = Header(default=None)) -> str:
        raise HTTPException(status_code=401, detail="sin token")
    return dep


def _app(**kw):
    return TestClient(create_actividad_app(require_tenant=kw.pop("require_tenant", _tenant_fijo()),
                                           **kw))


# --- el punto de encuentro ---

def test_sin_actividad_es_200_con_lista_vacia_no_404():
    """§4.1: un emprendedor nuevo abre la app y lo PRIMERO que ve es esta lista. Un 404 haría que la
    app trate «todavía no hiciste nada» como «algo se rompió» — y el fallback sería el mockup."""
    r = _app().get("/actividad")
    assert r.status_code == 200
    assert r.json() == {"items": [], "cursor": None}


def test_la_forma_es_items_y_cursor_siempre():
    """`cursor: null` viaja aunque no haya más páginas: un campo que aparece y desaparece obliga al
    cliente a defenderse de dos formas del mismo dato."""
    assert set(_app().get("/actividad").json()) == {"items", "cursor"}


# --- validación de `limit` ---

@pytest.mark.parametrize("limit", [0, -1, LIMITE_MAX + 1, 500])
def test_limit_fuera_de_rango_es_400_y_NO_se_recorta_en_silencio(limit):
    """Recortar 500 a 100 sin avisar hace que el cliente concluya que hay 100 ítems en total. El
    contrato fija el máximo; decirlo cuesta menos que el bug de interpretación."""
    r = _app().get(f"/actividad?limit={limit}")
    assert r.status_code == 400 and str(LIMITE_MAX) in r.json()["detail"]


def test_limit_no_numerico_sigue_dando_422():
    """El control del anterior: que exista validación propia no puede tragarse el parseo de FastAPI."""
    assert _app().get("/actividad?limit=abc").status_code == 422


@pytest.mark.parametrize("limit", [1, 20, LIMITE_MAX])
def test_CONTROL_los_limits_validos_pasan(limit):
    assert _app().get(f"/actividad?limit={limit}").status_code == 200


# --- 🔴 el cursor keyset ---

def test_un_cursor_valido_se_acepta():
    cur = "2026-07-22T14:30:00+00:00|factura:42"
    assert _app().get(f"/actividad?cursor={cur}").status_code == 200


@pytest.mark.parametrize("cursor, por_que", [
    ("2026-07-22T14:30:00+00:00", "sin el separador |"),
    ("2026-07-22T14:30:00+00:00|", "sin id"),
    ("no-es-fecha|factura:42", "la fecha no es ISO"),
    ("2026-07-22T14:30:00+00:00|42", "el id no trae tipo"),
    ("2026-07-22T14:30:00+00:00|inventado:42", "tipo fuera de la lista"),
    ("|factura:42", "sin fecha"),
])
def test_un_cursor_mal_formado_es_400_y_no_se_ignora(cursor, por_que):
    """🔴 Ignorar un cursor inválido reinicia la paginación en silencio: el usuario ve los mismos
    ítems otra vez y **no hay ningún error** que lo explique. Es el fallo que el keyset existe para
    evitar, entrando por la puerta de la validación."""
    r = _app().get(f"/actividad?cursor={cursor}")
    assert r.status_code == 400, f"{por_que}: {r.text}"
    assert "cursor" in r.json()["detail"]


def test_los_tipos_declarados_son_los_del_contrato():
    """La app pinta ícono y color por tipo; la lista tiene que ser cerrada y la misma de los dos lados."""
    assert TIPOS == ("factura", "nota_credito", "presupuesto", "gasto", "ingreso", "cliente")


# --- `q` aceptado y sin efecto (§11) ---

def test_q_es_400_mientras_la_busqueda_no_exista():
    """🔴 Un parámetro aceptado y sin efecto devuelve 200 con resultados SIN filtrar, y quien lo manda
    cree que filtró. Es fabricar un falso verde por dos monedas. Un parámetro que no existe se
    descubre en el primer intento; uno que se ignora, comparando resultados — o nunca."""
    r = _app().get("/actividad?q=panaderia")
    assert r.status_code == 400 and "q" in r.json()["detail"]


def test_CONTROL_sin_q_sigue_devolviendo_200():
    """El control del anterior: rechazar `q` no puede romper el camino normal."""
    assert _app().get("/actividad").status_code == 200
    assert _app().get("/actividad?q=").status_code == 200, "`q` vacío es 'no vino', no una búsqueda"


# --- auth ---

def test_sin_token_es_401():
    assert _app(require_tenant=_tenant_401()).get("/actividad").status_code == 401


# --- el store del hito 2 se enchufa sin cambiar la forma ---

def test_con_store_devuelve_lo_que_el_store_diga():
    """El hito 2 sólo cambia de dónde salen los items. Si la forma cambiara, la app tendría que
    recablear — este test fija que no."""
    class _Fake:
        def __init__(self, cid): self.cid = cid
        def listar(self, *, limit, desde):
            return {"items": [{"id": "gasto:1", "tipo": "gasto", "fecha": "2026-07-22T00:00:00+00:00",
                               "titulo": "Nafta", "detalle": "", "monto": "8500.00", "signo": "sale"}],
                    "cursor": None}
    cli = _app(actividad_store_factory=_Fake)
    cuerpo = cli.get("/actividad").json()
    assert set(cuerpo) == {"items", "cursor"}
    assert cuerpo["items"][0]["signo"] == "sale"


# --- 🔴 el `+` del cursor en la query string ---

def test_el_cursor_sobrevive_al_MAS_convertido_en_espacio():
    """En una query string, `+` significa ESPACIO. Un cliente que pegue el cursor tal como se lo dimos
    manda `...14:30:00 00:00` y la fecha deja de parsear. El servidor emitió ese token, así que la
    carga de que sobreviva al viaje es del servidor."""
    mangled = "2026-07-22T14:30:00 00:00|factura:42"   # lo que llega tras decodificar el `+`
    assert _app().get("/actividad", params={"cursor": mangled}).status_code == 200


def test_el_cursor_que_EMITIMOS_no_contiene_ningun_mas():
    """El arreglo de raíz: se emite en UTC con `Z`. Lo que no tiene `+` no se puede romper así."""
    from actividad_web import formatear_cursor
    cur = formatear_cursor(datetime.datetime(2026, 7, 22, 14, 30, tzinfo=datetime.timezone.utc),
                           "factura:42")
    assert "+" not in cur and cur.endswith("|factura:42") and "Z" in cur
    assert _app().get("/actividad", params={"cursor": cur}).status_code == 200


def test_CONTROL_una_fecha_de_verdad_invalida_SIGUE_dando_400():
    """El control de los dos anteriores: tolerar el espacio no puede volver permisivo al parser."""
    assert _app().get("/actividad", params={"cursor": "ayer a la tarde|factura:42"}).status_code == 400
