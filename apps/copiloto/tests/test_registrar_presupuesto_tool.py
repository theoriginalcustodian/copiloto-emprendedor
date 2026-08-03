"""La tool `registrar_presupuesto` del motor — hito P (contrato
`2026-07-24_contrato_planificacion-a-backend_hito-P-emitir-el-kind-presupuesto-propuesto.md`).

Lo que estos tests defienden, en orden de qué tan caro sale que se rompa:

1. **El `kind` es la costura entera.** El validador del frontend (`presupuestoPropuesto.ts:70`) corta
   en la primera línea si no coincide carácter por carácter: la card cae a `Burbuja` sin ningún error
   en ningún lado. `doc_tipo` tiene que viajar como `int` JSON, no como string — mismo bug que el id de
   tarjeta de PR #107 (`Number.isInteger` en el validador).
2. **No persiste.** Igual que `registrar_gasto`/`registrar_cliente`: la tool propone, el `POST
   /presupuestos` lo dispara el emprendedor al tocar Guardar.
3. **Un ítem sin descripción NO se descarta** (decisión explícita del operador, §1 del contrato) — viaja
   vacío y editable en vez de desaparecer.
4. **El separador argentino** en los montos de cada ítem, mismo bug histórico que `registrar_gasto`.
5. **Control negativo:** sin concepto/cliente/ítems, la tool repregunta y NO emite card — emitirla igual
   sería peor, porque el validador la descartaría en silencio (mismo punto 1).
"""
from __future__ import annotations

import pytest

from tool_catalog import REGISTRAR_PRESUPUESTO_SCHEMA, WRITE_TOOLS, _run_registrar_presupuesto


def _ctx():
    class C:
        cliente_id = "cid-A"
        composio_user_id = "cid-A"
    return C()


def _correr(**args):
    return _run_registrar_presupuesto(args, _ctx(), "idem-1")


DOS_ITEMS = {
    "concepto": "dos sillas", "cliente_nombre": "Juan",
    "items": [{"descripcion": "silla de madera", "cantidad": "2", "precio_unitario": "8000"},
              {"descripcion": "flete", "cantidad": "1", "precio_unitario": "1500,50"}],
}


# --- 🔴 la regla dura: proponer no es guardar ---

def test_la_tool_NO_es_un_write_y_no_pasa_por_el_gate():
    assert "registrar_presupuesto" not in WRITE_TOOLS
    assert _correr(**DOS_ITEMS).is_write is False


def test_le_dice_al_LLM_que_TODAVIA_no_esta_guardado():
    obs = _correr(**DOS_ITEMS).observation["result"]
    assert "TODAVÍA NO" in obs or "todavía no" in obs.lower()


# --- 🔴 el `kind` y la forma EXACTA de `data` (§1 del contrato) ---

def test_devuelve_la_card_con_2_items_y_doc_tipo_como_int():
    r = _correr(concepto="dos sillas", cliente_nombre="Juan", cliente_documento="30712345678",
                cliente_tipo_doc="CUIT", contacto="juan@mail.com",
                items=[{"descripcion": "silla de madera", "cantidad": "2", "precio_unitario": "8000"},
                       {"descripcion": "flete", "cantidad": "1", "precio_unitario": "1500,50"}])
    assert r.artifact.kind == "presupuesto_propuesto"
    d = r.artifact.data
    assert d["concepto"] == "dos sillas"
    assert d["receptor"] == {"nombre": "Juan", "doc_tipo": 80, "doc_nro": "30712345678",
                             "contacto": "juan@mail.com"}
    assert isinstance(d["receptor"]["doc_tipo"], int), "el validador usa Number.isInteger — un string rompe la card"
    assert len(d["items"]) == 2
    assert d["items"][0] == {"descripcion": "silla de madera", "cantidad": "2.00", "precio_unitario": "8000.00"}
    assert d["items"][1] == {"descripcion": "flete", "cantidad": "1.00", "precio_unitario": "1500.50"}


def test_sin_documento_el_receptor_viaja_sin_doc_tipo():
    d = _correr(**DOS_ITEMS).artifact.data
    assert d["receptor"]["doc_tipo"] is None and d["receptor"]["doc_nro"] is None


# --- 🔴 el separador argentino en cada ítem ---

@pytest.mark.parametrize("dictado, esperado", [
    ("15000", "15000.00"),
    ("15.000", "15000.00"),        # punto = miles en Argentina
    ("15000,50", "15000.50"),      # coma = decimal
    (8000, "8000.00"),             # el LLM a veces manda número, no string
])
def test_el_precio_de_cada_item_se_interpreta_como_lo_dice_un_argentino(dictado, esperado):
    r = _correr(concepto="x", cliente_nombre="Juan",
               items=[{"descripcion": "algo", "precio_unitario": dictado}])
    assert r.artifact.data["items"][0]["precio_unitario"] == esperado


def test_sin_precio_dictado_viaja_en_blanco_no_inventado():
    """§2 del contrato: 'No inventar precios'. `""` es lo que la app muestra en blanco;
    inventar `"0.00"` sería un precio falso que el emprendedor no notaría."""
    r = _correr(concepto="x", cliente_nombre="Juan", items=[{"descripcion": "algo"}])
    assert r.artifact.data["items"][0]["precio_unitario"] == ""


def test_sin_cantidad_dictada_se_asume_1():
    r = _correr(concepto="x", cliente_nombre="Juan", items=[{"descripcion": "algo"}])
    assert r.artifact.data["items"][0]["cantidad"] == "1.00"


# --- 🔴 un ítem sin descripción NO se descarta ---

def test_un_item_sin_descripcion_viaja_igual_no_se_filtra():
    r = _correr(concepto="x", cliente_nombre="Juan",
               items=[{"precio_unitario": "500"}, {"descripcion": "flete", "precio_unitario": "100"}])
    assert len(r.artifact.data["items"]) == 2, "el ítem sin descripción se filtró — el contrato prohíbe descartarlo"
    assert r.artifact.data["items"][0]["descripcion"] == ""


# --- 🔴 control negativo: sin datos obligatorios, NO hay card ---

@pytest.mark.parametrize("args", [
    {"cliente_nombre": "Juan", "items": [{"descripcion": "silla"}]},          # sin concepto
    {"concepto": "sillas", "items": [{"descripcion": "silla"}]},              # sin cliente
    {"concepto": "sillas", "cliente_nombre": "Juan", "items": []},            # sin ítems
    {"concepto": "sillas", "cliente_nombre": "Juan"},                        # sin la clave items
    {"concepto": "  ", "cliente_nombre": "Juan", "items": [{"descripcion": "silla"}]},   # concepto vacío tras trim
])
def test_sin_datos_obligatorios_se_REPREGUNTA_y_no_hay_card(args):
    r = _correr(**args)
    assert r.status == "ok" and r.artifact is None
    assert r.observation["result"]


# --- documento contradictorio (mismo patrón que registrar_cliente) ---

def test_CUIT_dicho_que_no_es_CUIT_no_se_fuerza_y_avisa():
    r = _correr(concepto="x", cliente_nombre="Juan", cliente_documento="3071234", cliente_tipo_doc="CUIT",
               items=[{"descripcion": "algo"}])
    assert r.artifact.data["receptor"]["doc_tipo"] is None, "7 dígitos no es CUIT — no se fuerza el tipo dicho"
    assert "OJO" in r.observation["result"]


# --- el schema no exige de más en la puerta de entrada ---

def test_el_schema_solo_exige_concepto_cliente_e_items():
    assert set(REGISTRAR_PRESUPUESTO_SCHEMA["function"]["parameters"]["required"]) == {
        "concepto", "cliente_nombre", "items"}
