"""HITO 9 — `emitir_factura`, la tool que traduce un dictado a los MISMOS signals que usa la pantalla.

No re-implementa las reglas fiscales: el gate de "completa" es `validar_factura_completa` (afip_rules),
la MISMA función que usa `FacturaWorkflow.estado()`. El fake de acá simula abrir/señalizar/consultar el
workflow reusando esas MISMAS dataclasses puras, para que `faltantes`/`items`/`total` sean fieles a lo
que produciría el workflow real — lo que se ejercita es la DECISIÓN de la tool, no la aritmética fiscal
(ya cubierta en `test_afip_rules.py`).
"""
from datetime import date
from decimal import Decimal

import pytest

import tool_catalog
from afip_rules import (BorradorFactura, CondicionEmisor, CondicionIVA, Concepto, DatosVenta, Item,
                        PerfilFiscal, Receptor, TipoDoc, validar_factura_completa)

HOY_ISO = "2026-07-21T10:00:00"
CUIT_EMISOR = "20409378472"  # dígito verificador real (mismo CUIT de testing que test_afip_rules.py)


class _Ctx:
    composio_user_id = "42"
    cliente_id = "tenant-a"


def _perfil(**kw) -> PerfilFiscal:
    base = dict(cuit=CUIT_EMISOR, razon_social="Emprendimiento de Prueba",
               domicilio_comercial="Calle Falsa 123, CABA", condicion_iva=CondicionEmisor.MONOTRIBUTO,
               ingresos_brutos="20-40937847-2", inicio_actividades=date(2020, 1, 1), punto_venta=1)
    base.update(kw)
    return PerfilFiscal(**base)  # type: ignore[arg-type]


class _CredFake:
    def __init__(self, cuit=CUIT_EMISOR):
        self._cuit = cuit

    def primer_cuit(self):
        return self._cuit


class _PerfilStoreFake:
    def __init__(self, perfil):
        self._perfil = perfil

    def get(self, cuit):
        return self._perfil


class _FacturaBackendFake:
    """Simula `abrir_borrador`/`consultar_factura`/`signal_factura`/`buscar_borrador_dictado` sobre un
    dict en memoria, keyeado por `(cliente_id, factura_id)`. Recorre `validar_factura_completa` REAL
    contra el `BorradorFactura` acumulado — así `faltantes` sale de la MISMA fuente que el workflow."""

    def __init__(self, *, perfil=None):
        self._perfil = perfil
        self.borradores: dict[tuple, BorradorFactura] = {}
        self.emitidas: set[str] = set()
        self.llamadas_abrir: list[tuple] = []
        self.llamadas_signal: list[tuple] = []

    async def abrir(self, cliente_id, cuit, factura_id):
        self.llamadas_abrir.append((cliente_id, factura_id))
        self.borradores.setdefault((cliente_id, factura_id), BorradorFactura())
        return True

    async def signal(self, cliente_id, factura_id, nombre, payload):
        self.llamadas_signal.append((factura_id, nombre))
        b = self.borradores.setdefault((cliente_id, factura_id), BorradorFactura())
        if nombre == "cargar_datos_venta":
            b.datos_venta = DatosVenta(fecha=date.fromisoformat(payload["fecha"]),
                                       concepto=Concepto(payload["concepto"]),
                                       condicion_venta=payload["condicion_venta"])
        elif nombre == "agregar_item":
            b.items.append(Item(descripcion=payload["descripcion"],
                                cantidad=Decimal(payload["cantidad"]),
                                precio_unitario=Decimal(payload["precio_unitario"])))
        elif nombre == "cargar_cliente":
            b.receptor = Receptor(condicion_iva=CondicionIVA(payload["condicion_iva"]),
                                  tipo_doc=TipoDoc(payload["tipo_doc"]), nro_doc=payload["nro_doc"],
                                  nombre=payload["nombre"])

    async def consultar(self, cliente_id, factura_id):
        clave = (cliente_id, factura_id)
        if clave not in self.borradores:
            return None
        b = self.borradores[clave]
        errores = validar_factura_completa(self._perfil, b, hoy=date(2026, 7, 21))
        total = str(sum((i.precio_unitario * i.cantidad for i in b.items), Decimal("0")))
        resultado = {"cae": "7000000"} if factura_id in self.emitidas else None
        return {"faltantes": [{"codigo": e.codigo, "campo": e.campo, "mensaje": e.mensaje}
                              for e in errores],
                "items": [{"descripcion": i.descripcion, "cantidad": str(i.cantidad),
                          "precio_unitario": str(i.precio_unitario)} for i in b.items],
                "total": total, "resultado": resultado}

    async def buscar_abierto(self, cliente_id):
        abiertos = [fid for (cid, fid) in self.borradores if cid == cliente_id and fid not in self.emitidas]
        return abiertos[-1] if abiertos else None


def _ex(backend, *, perfil=None, cuit=CUIT_EMISOR):
    return tool_catalog.make_tool_executor(
        None, now_iso_provider=lambda: HOY_ISO,
        afip_cred_store_factory=lambda cid: _CredFake(cuit),
        afip_perfil_store_factory=lambda cid: _PerfilStoreFake(perfil),
        abrir_borrador_dictado=backend.abrir, consultar_factura_dictado=backend.consultar,
        signal_factura_dictado=backend.signal, buscar_borrador_dictado=backend.buscar_abierto)


def _correr(backend, args, *, perfil=None, idem_key="w1-1-0"):
    return _ex(backend, perfil=perfil)("emitir_factura", args, _Ctx(), confirmed=False, idem_key=idem_key)


ITEM = {"descripcion": "el service", "cantidad": "1", "precio_unitario": "50000"}


# ── está en el catálogo ──────────────────────────────────────────────────────────────────────────

def test_emitir_factura_esta_en_el_catalogo():
    nombres = [s["function"]["name"] for s in tool_catalog.build_tool_catalog()]
    assert "emitir_factura" in nombres


# ── sin perfil fiscal: mensaje de negocio, no card (DoD §5.5) ──────────────────────────────────────

def test_sin_perfil_fiscal_da_mensaje_de_negocio_sin_card():
    backend = _FacturaBackendFake(perfil=None)
    res = _correr(backend, {"cliente_nombre": "Juan", "items": [ITEM]}, perfil=None)
    assert res.status == "ok"
    assert res.artifact is None
    assert "ajustes" in res.observation["result"].lower()
    assert not backend.llamadas_abrir   # no tocó Temporal: nunca llegó a intentar abrir nada


# ── 1ª vez incompleta: pregunta, SIN card — pero el borrador se abre silencioso (DoD §5.1) ─────────

def test_primera_vez_incompleta_pregunta_sin_card_pero_abre_el_borrador():
    perfil = _perfil()
    backend = _FacturaBackendFake(perfil=perfil)
    res = _correr(backend, {"cliente_nombre": "Juan"}, perfil=perfil)   # sin items: incompleto
    assert res.status == "ok"
    assert res.artifact is None                       # DoD §5.1: sin card
    assert backend.llamadas_abrir                      # pero SÍ abrió (para que el turno 2 lo encuentre)


# ── 2ª vez (hay borrador abierto) sigue incompleta → CARD, sin repreguntar (DoD §5.2) ──────────────

def test_segunda_vez_incompleta_da_card_no_repregunta():
    perfil = _perfil()
    backend = _FacturaBackendFake(perfil=perfil)
    _correr(backend, {"cliente_nombre": "Juan"}, perfil=perfil, idem_key="w1-1-0")   # turno 1
    res = _correr(backend, {"cliente_nombre": "Juan"}, perfil=perfil, idem_key="w1-2-0")  # turno 2, sigue sin items
    assert res.status == "ok"
    assert res.artifact is not None
    assert res.artifact.kind == "factura_propuesta"
    assert res.artifact.data["faltantes"]              # sigue incompleta
    assert "revisala" in res.observation["result"] or "completala" in res.observation["result"]


# ── dictado completo desde el arranque → card con faltantes=[] (Emitir) ────────────────────────────

def test_dictado_completo_da_card_lista_para_emitir():
    perfil = _perfil()
    backend = _FacturaBackendFake(perfil=perfil)
    res = _correr(backend, {"cliente_nombre": "Juan", "items": [ITEM]}, perfil=perfil)
    assert res.status == "ok"
    assert res.artifact is not None
    assert res.artifact.data["faltantes"] == []
    assert res.artifact.data["items"] and res.artifact.data["items"][0]["descripcion"] == "el service"
    assert "TODAVÍA NO está emitida" in res.observation["result"]


# ── el doble dictado NO duplica items en la continuación (control explícito del contrato §0) ───────

def test_doble_dictado_no_duplica_items():
    perfil = _perfil()
    backend = _FacturaBackendFake(perfil=perfil)
    _correr(backend, {"cliente_nombre": "Juan", "items": [ITEM]}, perfil=perfil, idem_key="w1-1-0")
    res = _correr(backend, {"cliente_nombre": "Juan", "items": [ITEM]}, perfil=perfil, idem_key="w1-2-0")
    assert len(res.artifact.data["items"]) == 1        # NO 2 — agregar_item acumula, no reemplaza
    assert len(backend.llamadas_abrir) == 1             # UN solo borrador, no dos


# ── segunda red: ya emitida (CAE) → error, no reabre (id_reuse_policy default es ALLOW_DUPLICATE) ──

def test_factura_ya_emitida_no_se_reabre():
    perfil = _perfil()
    backend = _FacturaBackendFake(perfil=perfil)
    factura_id = tool_catalog.factura_id_del_dictado("w1-1-0")
    backend.borradores[("tenant-a", factura_id)] = BorradorFactura()
    backend.emitidas.add(factura_id)
    res = _correr(backend, {"cliente_nombre": "Juan", "items": [ITEM]}, perfil=perfil, idem_key="w1-1-0")
    assert res.status == "error"
    assert len(backend.llamadas_signal) == 0            # no le mandó signals a una factura ya emitida


# ── sin wiring (client=None en el composition root) degrada, no explota ────────────────────────────

def test_sin_wiring_degrada_con_error_de_negocio():
    ex = tool_catalog.make_tool_executor(None, now_iso_provider=lambda: HOY_ISO)
    res = ex("emitir_factura", {"cliente_nombre": "Juan", "items": [ITEM]}, _Ctx(),
             confirmed=False, idem_key="w1-1-0")
    assert res.status == "error"


# ── factura_id_del_dictado — determinístico, deriva del idem_key completo ──────────────────────────

def test_factura_id_del_dictado_es_determinístico():
    assert (tool_catalog.factura_id_del_dictado("wf-1-2-0")
           == tool_catalog.factura_id_del_dictado("wf-1-2-0"))
    assert (tool_catalog.factura_id_del_dictado("wf-1-2-0")
           != tool_catalog.factura_id_del_dictado("wf-1-3-0"))
