"""SM-N19 · DoD 3 — un presupuesto NO se persiste sin confirmación previa. Y con su control positivo.

La ficha exige las DOS mitades porque sin ellas no se distingue «el gate funciona» de «ya no se guarda
nunca»:

1. 🔴 **Rojo si algo persiste sin confirmar:** proponer (la tool `registrar_presupuesto` del agente) deja
   **cero** filas y no toca `PresupuestoStore.crear/crear_idem`; y el ÚNICO código de producción que
   llama a esos métodos es el `POST /presupuestos` — el que dispara el emprendedor al tocar Guardar. Si
   mañana otro camino (otra tool, un schedule, un workflow) empieza a crear presupuestos, el barrido
   estructural de abajo se pone rojo.
2. 🟢 **Control positivo:** la MISMA card, confirmada vía `POST /presupuestos`, SÍ persiste.

Premisa histórica de la ficha (refutada): el presupuesto N° 4 lo guardó frontend1 por ADB, no un camino
sin card. Este test no depende de esa historia: fija el contrato para que no pueda volver a ocurrir.
"""
from __future__ import annotations

import ast
from pathlib import Path

import presupuesto_store
from tool_catalog import _run_registrar_presupuesto

from test_presupuestos_web import _app

_RAIZ = Path(__file__).resolve().parents[3]
_METODOS_QUE_CREAN = {"crear", "crear_idem"}
# El ÚNICO archivo de producción autorizado a crear presupuestos: el POST que dispara el emprendedor.
_UNICO_CREADOR = "apps/copiloto/presupuestos_web.py"


class _Ctx:
    cliente_id = "cid-A"
    composio_user_id = "cid-A"


_DICTADO = {
    "concepto": "dos sillas", "cliente_nombre": "Juan",
    "items": [{"descripcion": "silla de madera", "cantidad": "2", "precio_unitario": "8000"},
              {"descripcion": "flete", "cantidad": "1", "precio_unitario": "1500,50"}],
}


def _llamadas_que_crean(codigo: str) -> list[int]:
    """Líneas de `<store>.crear(...)` / `<store>.crear_idem(...)`. Excluye `self.<m>()`: eso es un store
    llamando a su PROPIO método (cliente_store, gasto_store), no un camino de entrada a presupuestos."""
    return [n.lineno for n in ast.walk(ast.parse(codigo))
            if isinstance(n, ast.Call) and isinstance(n.func, ast.Attribute)
            and n.func.attr in _METODOS_QUE_CREAN
            and not (isinstance(n.func.value, ast.Name) and n.func.value.id == "self")]


def _importa_presupuesto_store(codigo: str) -> bool:
    """Import REAL (no la mención en un comentario: `gasto_store` y `cliente_store` lo nombran en prosa)."""
    for n in ast.walk(ast.parse(codigo)):
        if isinstance(n, ast.ImportFrom) and n.module == "presupuesto_store":
            return True
        if isinstance(n, ast.Import) and any(a.name == "presupuesto_store" for a in n.names):
            return True
    return False


def _archivos_de_produccion_que_crean_presupuestos() -> set[str]:
    """Archivos que IMPORTAN `presupuesto_store` y llaman a `.crear*()` sobre otro objeto. Excluye tests y
    el store mismo (`PresupuestoStore.crear` delega en `crear_idem`: es la definición, no una entrada)."""
    hallados: set[str] = set()
    for base in (_RAIZ / "apps" / "copiloto", _RAIZ / "motor"):
        for py in base.rglob("*.py"):
            rel = py.relative_to(_RAIZ).as_posix()
            if "/tests/" in rel or rel.endswith("/presupuesto_store.py") or "test_" in py.name:
                continue
            texto = py.read_text(encoding="utf-8")
            if _importa_presupuesto_store(texto) and _llamadas_que_crean(texto):
                hallados.add(rel)
    return hallados


# --- 🔴 proponer no persiste ---------------------------------------------------------------------

def test_proponer_un_presupuesto_NO_persiste_nada(monkeypatch):
    llamadas: list[str] = []
    for metodo in _METODOS_QUE_CREAN:
        monkeypatch.setattr(presupuesto_store.PresupuestoStore, metodo,
                            lambda *a, _m=metodo, **k: llamadas.append(_m), raising=True)

    cli, _, presupuestos, _ = _app()
    r = _run_registrar_presupuesto(dict(_DICTADO), _Ctx(), "idem-n19")

    assert r.artifact is not None and r.artifact.kind == "presupuesto_propuesto", "la card tiene que salir"
    assert r.is_write is False
    assert llamadas == [], f"proponer llamó al store: {llamadas}"
    assert presupuestos == {}, "proponer dejó una fila: el gate no existe"
    assert cli.get("/presupuestos").json()["presupuestos"] == []


# --- 🟢 control positivo: confirmada, SÍ persiste -----------------------------------------------

def test_CONTROL_la_misma_card_confirmada_por_POST_SI_persiste():
    cli, _, presupuestos, _ = _app()
    card = _run_registrar_presupuesto(dict(_DICTADO), _Ctx(), "idem-n19").artifact.data

    # Lo que la app manda al tocar Guardar: la card, tal cual (el emprendedor pudo corregirla antes).
    body = {"concepto": card["concepto"], "receptor": {"nombre": card["receptor"]["nombre"]},
            "items": card["items"]}
    r = cli.post("/presupuestos", json=body)

    assert r.status_code == 201, r.text
    assert len(presupuestos["cid-A"]) == 1, "confirmar no persistió: el test de arriba pasaría aunque nunca se guardara"
    assert r.json()["presupuesto"]["concepto"] == "dos sillas"


# --- 🔴 nadie más puede crear presupuestos --------------------------------------------------------

def test_el_unico_camino_de_produccion_que_crea_presupuestos_es_el_POST_confirmado():
    assert _archivos_de_produccion_que_crean_presupuestos() == {_UNICO_CREADOR}


def test_CONTROL_el_barrido_ve_un_camino_nuevo_si_aparece():
    """Control positivo del instrumento: un `.crear_idem(...)` en código ajeno SÍ se detecta; un
    `.listar()` no. Sin esto, un barrido que no mira nada daría verde igual (barrido ciego)."""
    assert _llamadas_que_crean("store = f(cid)\nstore.crear_idem(concepto='x')\n") == [2]
    assert _llamadas_que_crean("PresupuestoStore(c, cid).crear(concepto='x')\n") == [1]
    assert _llamadas_que_crean("store.listar(limit=None)\n") == []
    assert _llamadas_que_crean("self.crear_idem(monto=1)\n") == [], "self.<m> es el store propio, no una entrada"
    assert _importa_presupuesto_store("from presupuesto_store import PresupuestoStore\n")
    assert not _importa_presupuesto_store("# ver PresupuestoStore en presupuesto_store.py\nx = 1\n")
    assert _UNICO_CREADOR in _archivos_de_produccion_que_crean_presupuestos(), \
        "el barrido no ve ni el camino legítimo: está ciego"
