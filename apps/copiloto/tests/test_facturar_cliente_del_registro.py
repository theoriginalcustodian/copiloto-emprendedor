"""D7 (2026-10-13) — «facturale a Juan»: el cliente del REGISTRO del tenant se precarga, con la compuerta.

Las tres condiciones del contrato, una por grupo de tests:
1. el dato precargado aparece en la card marcado `del_registro` (y en la frase que la acompaña), y es
   EXACTAMENTE lo que se le mandó al workflow — un CUIT no entra a la factura sin pasar por la card;
2. un match con documento ⇒ precarga · dos o más ⇒ NO adivina · cero ⇒ como hoy;
3. adversarial: dos clientes que matchean la misma mención ⇒ el receptor NO trae `nro_doc`; y el
   lookup va contra el tenant del request (el cliente de B no se precarga en la factura de A).

Contra `ClienteStore` REAL sobre Postgres con RLS `FORCE` (`conn_de_tenant`), no contra un dict: lo que se
prueba es que el SQL aísla y que `listar(q=)` devuelve lo que la regla de «uno solo» necesita.
"""
from __future__ import annotations

import os
import uuid

import pytest

import tool_catalog
from afip_rules import CondicionIVA, TipoDoc
from cliente_store import DOC_CUIT, DOC_DNI, ClienteStore
from test_facturar_por_voz import (HOY_ISO, ITEM, _CredFake, _FacturaBackendFake, _perfil,
                                   _PerfilStoreFake)

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


def _cuit_valido(prefijo10: str) -> str:
    """CUIT con su dígito verificador real (módulo 11, pesos 5-4-3-2-7-6-5-4-3-2)."""
    pesos = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)
    resto = sum(int(d) * p for d, p in zip(prefijo10, pesos)) % 11
    dv = 0 if resto == 0 else 9 if resto == 1 else 11 - resto
    return f"{prefijo10}{dv}"


CUIT_JUAN = _cuit_valido("2027123456")
CUIT_OTRO = _cuit_valido("3071234567")


class _Ctx:
    composio_user_id = "42"

    def __init__(self, cliente_id: str) -> None:
        self.cliente_id = cliente_id


@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM uc_factory.copiloto_clientes WHERE cliente_id = %s", (cid,))
        conn.close()


def _facturar(backend, cliente_id, args, *, store_factory, idem_key="w1-1-0"):
    perfil = _perfil()
    ex = tool_catalog.make_tool_executor(
        None, now_iso_provider=lambda: HOY_ISO,
        afip_cred_store_factory=lambda cid: _CredFake(),
        afip_perfil_store_factory=lambda cid: _PerfilStoreFake(perfil),
        abrir_borrador_dictado=backend.abrir, consultar_factura_dictado=backend.consultar,
        signal_factura_dictado=backend.signal, buscar_borrador_dictado=backend.buscar_abierto,
        cliente_store_factory=store_factory)
    res = ex("emitir_factura", args, _Ctx(cliente_id), confirmed=False, idem_key=idem_key)
    # sin card no hay nada que medir: se falla acá, con la razón, y no más abajo con un AttributeError
    assert res.artifact is not None, f"la tool preguntó en vez de proponer: {res.observation}"
    return res


def _store_de(conn_de_tenant):
    return lambda cid: ClienteStore(conn_de_tenant(cid), cid)


def _receptor_que_llego_al_workflow(backend, cliente_id, res):
    return backend.borradores[(cliente_id, res.artifact.data["factura_id"])].receptor


def _sin_documento(receptor) -> bool:
    """«No trae documento precargado» = consumidor final, SIN CUIT/DNI. El receptor sin documento NO
    tiene `nro_doc=None`: lleva el `'0'` de consumidor final, así que se mira el TIPO."""
    return receptor.tipo_doc is TipoDoc.CONSUMIDOR_FINAL and receptor.nro_doc not in (CUIT_JUAN, CUIT_OTRO)


# ── 1 · la compuerta: lo precargado se MUESTRA marcado, y es lo mismo que recibió el workflow ───────

@necesita_pg
def test_un_match_con_documento_se_precarga_y_la_card_lo_marca(conn_de_tenant, tenants):
    a, _ = tenants
    ClienteStore(conn_de_tenant(a), a).crear(nombre="Juan Pérez", doc_tipo=DOC_CUIT, doc_nro=CUIT_JUAN,
                                             condicion_iva=CondicionIVA.RESPONSABLE_INSCRIPTO.value)
    backend = _FacturaBackendFake(perfil=_perfil())

    res = _facturar(backend, a, {"cliente_nombre": "Juan", "items": [ITEM]},
                    store_factory=_store_de(conn_de_tenant))

    cliente = res.artifact.data["cliente"]
    assert cliente["razon_social"] == "Juan Pérez"
    assert cliente["cuit"] == CUIT_JUAN
    assert cliente["condicion_iva"] == "RESPONSABLE_INSCRIPTO"      # la del registro, no «Consumidor Final»
    assert cliente["del_registro"] is True
    # la card y el workflow ven LO MISMO: un CUIT no entra a la factura por un camino que la card no muestra
    receptor = _receptor_que_llego_al_workflow(backend, a, res)
    assert receptor.nro_doc == cliente["cuit"] and receptor.tipo_doc == TipoDoc.CUIT
    # y la frase que acompaña a la card lo DICE (es la marca visible aunque la app todavía no pinte el flag)
    assert "de tu registro de clientes" in res.observation["result"]
    assert CUIT_JUAN in res.observation["result"]


@necesita_pg
def test_un_dni_del_registro_se_precarga_como_dni(conn_de_tenant, tenants):
    a, _ = tenants
    ClienteStore(conn_de_tenant(a), a).crear(nombre="Ana López", doc_tipo=DOC_DNI, doc_nro="30123456")
    backend = _FacturaBackendFake(perfil=_perfil())

    res = _facturar(backend, a, {"cliente_nombre": "Ana López", "items": [ITEM]},
                    store_factory=_store_de(conn_de_tenant))

    assert _receptor_que_llego_al_workflow(backend, a, res).tipo_doc == TipoDoc.DNI
    assert res.artifact.data["cliente"]["del_registro"] is True


# ── 2 · uno ⇒ precarga · varios ⇒ no adivina · cero ⇒ como hoy ─────────────────────────────────────

@necesita_pg
def test_cero_matches_factura_como_hoy_sin_marca(conn_de_tenant, tenants):
    a, _ = tenants
    backend = _FacturaBackendFake(perfil=_perfil())

    res = _facturar(backend, a, {"cliente_nombre": "Nadie Registrado", "items": [ITEM]},
                    store_factory=_store_de(conn_de_tenant))

    assert res.artifact.data["cliente"]["cuit"] is None
    assert res.artifact.data["cliente"]["del_registro"] is False
    assert "de tu registro" not in res.observation["result"]


@necesita_pg
def test_un_cuit_del_registro_sin_condicion_de_iva_no_inventa_una(conn_de_tenant, tenants):
    """Sin condición cargada el receptor cae a Consumidor Final y la tool NO propone card: pregunta,
    nombrando el problema (igual que un CUIT dictado). No se inventa una condición para destrabarlo."""
    a, _ = tenants
    ClienteStore(conn_de_tenant(a), a).crear(nombre="Juan Pérez", doc_tipo=DOC_CUIT, doc_nro=CUIT_JUAN)
    backend = _FacturaBackendFake(perfil=_perfil())
    perfil = _perfil()
    ex = tool_catalog.make_tool_executor(
        None, now_iso_provider=lambda: HOY_ISO,
        afip_cred_store_factory=lambda cid: _CredFake(),
        afip_perfil_store_factory=lambda cid: _PerfilStoreFake(perfil),
        abrir_borrador_dictado=backend.abrir, consultar_factura_dictado=backend.consultar,
        signal_factura_dictado=backend.signal, buscar_borrador_dictado=backend.buscar_abierto,
        cliente_store_factory=_store_de(conn_de_tenant))

    res = ex("emitir_factura", {"cliente_nombre": "Juan", "items": [ITEM]}, _Ctx(a),
             confirmed=False, idem_key="w1-1-0")

    assert res.artifact is None
    assert "condición" in res.observation["result"].lower()


@necesita_pg
def test_un_match_sin_documento_no_precarga_nada(conn_de_tenant, tenants):
    a, _ = tenants
    ClienteStore(conn_de_tenant(a), a).crear(nombre="Juan Sin Papeles")
    backend = _FacturaBackendFake(perfil=_perfil())

    res = _facturar(backend, a, {"cliente_nombre": "Juan Sin Papeles", "items": [ITEM]},
                    store_factory=_store_de(conn_de_tenant))

    assert res.artifact.data["cliente"]["cuit"] is None
    assert res.artifact.data["cliente"]["del_registro"] is False


@necesita_pg
def test_si_la_persona_dicto_el_documento_manda_lo_dictado_no_el_registro(conn_de_tenant, tenants):
    a, _ = tenants
    ClienteStore(conn_de_tenant(a), a).crear(nombre="Juan Pérez", doc_tipo=DOC_CUIT, doc_nro=CUIT_JUAN,
                                             condicion_iva=CondicionIVA.RESPONSABLE_INSCRIPTO.value)
    backend = _FacturaBackendFake(perfil=_perfil())

    res = _facturar(backend, a, {"cliente_nombre": "Juan Pérez", "cliente_documento": "30111222",
                                 "cliente_tipo_doc": "DNI", "items": [ITEM]},
                    store_factory=_store_de(conn_de_tenant))

    receptor = _receptor_que_llego_al_workflow(backend, a, res)
    assert receptor.tipo_doc is TipoDoc.DNI and receptor.nro_doc == "30111222"
    assert res.artifact.data["cliente"]["del_registro"] is False


# ── 3 · ADVERSARIAL (regla dura del repo): el caso hostil, no sólo el happy path ───────────────────

@necesita_pg
def test_ADVERSARIAL_dos_clientes_que_matchean_la_misma_mencion_no_precargan_documento(conn_de_tenant, tenants):
    a, _ = tenants
    store = ClienteStore(conn_de_tenant(a), a)
    iva = CondicionIVA.RESPONSABLE_INSCRIPTO.value
    store.crear(nombre="Juan Pérez", doc_tipo=DOC_CUIT, doc_nro=CUIT_JUAN, condicion_iva=iva)
    store.crear(nombre="Juan Gómez", doc_tipo=DOC_CUIT, doc_nro=CUIT_OTRO, condicion_iva=iva)
    backend = _FacturaBackendFake(perfil=_perfil())

    res = _facturar(backend, a, {"cliente_nombre": "Juan", "items": [ITEM]},
                    store_factory=_store_de(conn_de_tenant))

    receptor = _receptor_que_llego_al_workflow(backend, a, res)
    assert _sin_documento(receptor), f"adivinó un cliente entre dos: {receptor}"
    assert res.artifact.data["cliente"]["cuit"] is None
    assert res.artifact.data["cliente"]["del_registro"] is False
    assert CUIT_JUAN not in str(res.observation) and CUIT_OTRO not in str(res.observation)

    # control: la MISMA cartera con una mención que identifica a UNO sí precarga — si el lookup
    # estuviera muerto, el «no precarga» de arriba se vería idéntico y no probaría nada.
    res2 = _facturar(backend, a, {"cliente_nombre": "Juan Pérez", "items": [ITEM]},
                     store_factory=_store_de(conn_de_tenant), idem_key="w1-2-0")
    assert res2.artifact.data["cliente"]["cuit"] == CUIT_JUAN


@necesita_pg
def test_ADVERSARIAL_el_cliente_de_B_no_se_precarga_en_la_factura_de_A(conn_de_tenant, tenants):
    a, b = tenants
    ClienteStore(conn_de_tenant(b), b).crear(nombre="Juan Pérez", doc_tipo=DOC_CUIT, doc_nro=CUIT_JUAN,
                                             condicion_iva=CondicionIVA.RESPONSABLE_INSCRIPTO.value)
    backend_a = _FacturaBackendFake(perfil=_perfil())

    res = _facturar(backend_a, a, {"cliente_nombre": "Juan Pérez", "items": [ITEM]},
                    store_factory=_store_de(conn_de_tenant))

    assert res.artifact.data["cliente"]["cuit"] is None, "fuga cross-tenant: el CUIT de B llegó a la factura de A"
    assert res.artifact.data["cliente"]["del_registro"] is False
    assert _sin_documento(_receptor_que_llego_al_workflow(backend_a, a, res))

    # control: B, dictando lo mismo, sí lo recibe (el lookup anda; lo que falló en A es el aislamiento)
    backend_b = _FacturaBackendFake(perfil=_perfil())
    res_b = _facturar(backend_b, b, {"cliente_nombre": "Juan Pérez", "items": [ITEM]},
                      store_factory=_store_de(conn_de_tenant))
    assert res_b.artifact.data["cliente"]["cuit"] == CUIT_JUAN


# ── la precarga es una comodidad: su caída no frena la factura ─────────────────────────────────────

def test_si_el_store_falla_se_factura_sin_precarga_y_sin_romper_el_turno():
    class _StoreRoto:
        def listar(self, **kw):
            raise RuntimeError("base caída")

    backend = _FacturaBackendFake(perfil=_perfil())
    res = _facturar(backend, "tenant-x", {"cliente_nombre": "Juan", "items": [ITEM]},
                    store_factory=lambda cid: _StoreRoto())

    assert res.status == "ok" and res.artifact is not None
    assert res.artifact.data["cliente"]["cuit"] is None
    assert res.artifact.data["cliente"]["del_registro"] is False


def test_sin_cliente_store_factory_el_comportamiento_es_el_de_siempre():
    backend = _FacturaBackendFake(perfil=_perfil())
    res = _facturar(backend, "tenant-x", {"cliente_nombre": "Juan", "items": [ITEM]}, store_factory=None)
    assert res.artifact.data["cliente"]["del_registro"] is False
