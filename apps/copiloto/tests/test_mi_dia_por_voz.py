"""HITO 7 — el Kanban "Mi día" por voz (contrato §2.4): `crear_tarjeta_mi_dia`,
`mover_tarjeta_mi_dia`, `borrar_tarjeta_mi_dia`.

Mismo criterio que `test_plata_por_voz.py`: `TarjetaStore` fake (la SQL ya está probada en
`test_mi_dia_tarjeta_store.py`), acá se ejercita la DECISIÓN de cada tool.
"""
from __future__ import annotations

import tool_catalog
from mi_dia_tarjeta_store import HACIENDO, HECHA, PARA_HOY, EstadoInvalido


class _Ctx:
    composio_user_id = "42"
    mp_gateway = None
    mp_cred_store = None
    mp_seller_user_id = None
    mp_webhook_base = None
    cliente_id = "tenant-a"


class _TarjetaFake:
    def __init__(self, cliente_id="tenant-a", *, tarjetas=None):
        self.cliente_id = cliente_id
        self._tarjetas = {t["id"]: dict(t) for t in (tarjetas or [])}
        self._seq = max(self._tarjetas, default=0)
        self.borradas = []

    def listar_tablero(self):
        tablero = {PARA_HOY: [], HACIENDO: [], HECHA: []}
        for t in self._tarjetas.values():
            tablero.setdefault(t["estado"], []).append(dict(t))
        return tablero

    def crear_manual(self, texto, datos=None):
        self._seq += 1
        fila = {"id": self._seq, "regla": None, "texto": texto, "estado": PARA_HOY, "datos": datos}
        self._tarjetas[fila["id"]] = fila
        return dict(fila)

    def mover(self, tarjeta_id, nuevo_estado):
        if nuevo_estado not in (PARA_HOY, HACIENDO, HECHA):
            raise EstadoInvalido(nuevo_estado)
        if tarjeta_id not in self._tarjetas:
            return None
        self._tarjetas[tarjeta_id]["estado"] = nuevo_estado
        return dict(self._tarjetas[tarjeta_id])

    def borrar(self, tarjeta_id):
        if tarjeta_id not in self._tarjetas:
            return False
        self.borradas.append(tarjeta_id)
        del self._tarjetas[tarjeta_id]
        return True


def _t(tid, texto, estado=PARA_HOY):
    return {"id": tid, "texto": texto, "estado": estado}


def _ex(tarjeta=None):
    return tool_catalog.make_tool_executor(
        None, now_iso_provider=lambda: "2026-07-23T10:00:00",
        tarjeta_store_factory=(lambda cid: tarjeta) if tarjeta is not None else None)


def _correr(nombre, args, *, tarjeta=None, idem_key="tc-1"):
    return _ex(tarjeta)(nombre, args, _Ctx(), confirmed=False, idem_key=idem_key)


# ── el catálogo ──────────────────────────────────────────────────────────────────────────────────

def test_las_tres_estan_en_el_catalogo():
    nombres = [s["function"]["name"] for s in tool_catalog.build_tool_catalog()]
    for tool in ("crear_tarjeta_mi_dia", "mover_tarjeta_mi_dia", "borrar_tarjeta_mi_dia"):
        assert tool in nombres


def test_NINGUNA_pide_confirmacion_si_no():
    """El riesgo real es "¿a cuál tarjeta?" — lo cubre `_elegir_uno`, no el confirm-gate sí/no."""
    for tool in ("crear_tarjeta_mi_dia", "mover_tarjeta_mi_dia", "borrar_tarjeta_mi_dia"):
        assert tool not in tool_catalog.WRITE_TOOLS


def test_mover_solo_ofrece_los_tres_estados_reales():
    """El enum sale de `mi_dia_tarjeta_store.ESTADOS`, no de literales — mismo criterio que
    `marcar_presupuesto` (contrato §0: un rename allá sin acá es un aviso silencioso)."""
    schema = next(s for s in tool_catalog.build_tool_catalog()
                 if s["function"]["name"] == "mover_tarjeta_mi_dia")
    enum = schema["function"]["parameters"]["properties"]["estado"]["enum"]
    assert enum == [PARA_HOY, HACIENDO, HECHA]


# ── crear_tarjeta_mi_dia ─────────────────────────────────────────────────────────────────────────

def test_crear_tarjeta_persiste_y_confirma():
    store = _TarjetaFake()
    res = _correr("crear_tarjeta_mi_dia", {"texto": "llamar a Juan"}, tarjeta=store)
    assert res.status == "ok" and res.is_write is True
    assert store._tarjetas[1]["texto"] == "llamar a Juan"
    assert store._tarjetas[1]["estado"] == PARA_HOY


def test_crear_tarjeta_sin_texto_no_persiste():
    store = _TarjetaFake()
    res = _correr("crear_tarjeta_mi_dia", {"texto": "   "}, tarjeta=store)
    assert res.is_write is False
    assert store._tarjetas == {}


# ── mover_tarjeta_mi_dia ─────────────────────────────────────────────────────────────────────────

def test_mover_tarjeta_unica_que_coincide():
    store = _TarjetaFake(tarjetas=[_t(1, "llamar a Juan"), _t(2, "pasar por el banco")])
    res = _correr("mover_tarjeta_mi_dia", {"tarjeta": "Juan", "estado": HACIENDO}, tarjeta=store)
    assert res.status == "ok" and res.is_write is True
    assert store._tarjetas[1]["estado"] == HACIENDO
    assert store._tarjetas[2]["estado"] == PARA_HOY  # la otra no se tocó


def test_mover_no_elige_sola_si_hay_varias():
    store = _TarjetaFake(tarjetas=[_t(1, "llamar a Juan"), _t(2, "llamar a Juana")])
    res = _correr("mover_tarjeta_mi_dia", {"tarjeta": "llamar", "estado": HACIENDO}, tarjeta=store)
    assert res.is_write is False
    assert store._tarjetas[1]["estado"] == PARA_HOY  # nada se movió
    assert store._tarjetas[2]["estado"] == PARA_HOY


def test_mover_estado_invalido_no_toca_nada():
    store = _TarjetaFake(tarjetas=[_t(1, "llamar a Juan")])
    res = _correr("mover_tarjeta_mi_dia", {"tarjeta": "Juan", "estado": "archivada"}, tarjeta=store)
    assert res.is_write is False
    assert store._tarjetas[1]["estado"] == PARA_HOY


def test_mover_ignora_tarjetas_ya_hechas():
    """Contrato §2.1: una tarjeta `hecha` no se reabre por voz — sólo `para_hoy`/`haciendo` son
    candidatas (`_tarjetas_activas`)."""
    store = _TarjetaFake(tarjetas=[_t(1, "llamar a Juan", estado=HECHA)])
    res = _correr("mover_tarjeta_mi_dia", {"tarjeta": "Juan", "estado": HACIENDO}, tarjeta=store)
    assert res.is_write is False
    assert "No encontré" in res.observation["result"] or "no hay" in res.observation["result"].lower() \
        or "ninguna tarjeta" in res.observation["result"].lower()
    assert store._tarjetas[1]["estado"] == HECHA


# ── borrar_tarjeta_mi_dia ────────────────────────────────────────────────────────────────────────

def test_borrar_tarjeta_unica_que_coincide():
    store = _TarjetaFake(tarjetas=[_t(1, "llamar a Juan")])
    res = _correr("borrar_tarjeta_mi_dia", {"tarjeta": "Juan"}, tarjeta=store)
    assert res.status == "ok" and res.is_write is True
    assert store.borradas == [1]
    assert 1 not in store._tarjetas


def test_borrar_no_elige_sola_si_hay_varias():
    store = _TarjetaFake(tarjetas=[_t(1, "llamar a Juan"), _t(2, "llamar a Juana")])
    res = _correr("borrar_tarjeta_mi_dia", {"tarjeta": "llamar"}, tarjeta=store)
    assert res.is_write is False
    assert store.borradas == []
    assert len(store._tarjetas) == 2


def test_borrar_sin_referencia_no_elige_entre_todas():
    """Sin `tarjeta` en el dictado, TODAS las activas son candidatas — con más de una, sigue sin
    elegir sola (irreversible, contrato §2.4)."""
    store = _TarjetaFake(tarjetas=[_t(1, "llamar a Juan"), _t(2, "pasar por el banco")])
    res = _correr("borrar_tarjeta_mi_dia", {"tarjeta": ""}, tarjeta=store)
    assert res.is_write is False
    assert store.borradas == []


# ── sin factory ──────────────────────────────────────────────────────────────────────────────────

def test_sin_tarjeta_store_factory_da_error_no_500():
    ex = tool_catalog.make_tool_executor(None, now_iso_provider=lambda: "2026-07-23T10:00:00")
    res = ex("crear_tarjeta_mi_dia", {"texto": "x"}, _Ctx(), confirmed=False, idem_key="tc-1")
    assert res.status == "error"
