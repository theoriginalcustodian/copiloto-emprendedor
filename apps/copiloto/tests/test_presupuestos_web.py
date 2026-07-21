"""Tests del router de PRESUPUESTOS y PERFIL DEL NEGOCIO.

Deps FAKE (mismo criterio que test_connect_endpoints.py): sin DB, sin Temporal, sin Composio. Los
stores falsos guardan en memoria POR TENANT — eso es lo que permite escribir el caso adversarial de
verdad y no una imitación: si el router dejara pasar un id ajeno, el fake se lo devolvería.
"""
from __future__ import annotations

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from presupuestos_web import create_presupuestos_app


# --- fakes ---------------------------------------------------------------------

def _require_tenant_fixed(cliente_id: str):
    def _dep() -> str:
        return cliente_id
    return _dep


def _require_tenant_401():
    def _dep() -> str:
        raise HTTPException(status_code=401, detail="sin token")
    return _dep


class _FakePerfilStore:
    def __init__(self, datos: dict, cid: str) -> None:
        self._datos, self._cid = datos, cid

    def get(self):
        return self._datos.get(self._cid)

    def upsert(self, cambios: dict) -> dict:
        actual = self._datos.setdefault(self._cid, {
            "que_vende": "", "a_quien": "ambos", "nombre_comercial": "", "horario_atencion": "",
            "formalidad": "cercano", "largo_respuesta": "breve", "nombre_copiloto": ""})
        actual.update(cambios)
        return actual


class _FakePresupuestoStore:
    """`datos` = {cliente_id: {id: presupuesto}}. El aislamiento es real: cada tenant sólo ve su dict."""

    def __init__(self, datos: dict, cid: str) -> None:
        self._datos, self._cid = datos, cid
        self.marcadas: list[tuple] = []

    def _mios(self) -> dict:
        return self._datos.setdefault(self._cid, {})

    def crear(self, *, concepto, receptor, items, moneda="ARS", reemplaza_a=None) -> dict:
        mios = self._mios()
        pid = max(mios) + 1 if mios else 1
        total = sum(float(i["cantidad"]) * float(i["precio_unitario"]) for i in items)
        p = {"id": pid, "numero": len(mios) + 1, "fecha": "2026-07-21T00:00:00Z",
             "concepto": concepto, "receptor": receptor, "total": f"{total:.2f}", "moneda": moneda,
             "doc_id": None, "doc_link": None, "sheet_fila": None, "reemplaza_a": reemplaza_a,
             "reemplazado_por": None, "factura_id": None, "facturado": False,
             "cantidad_items": len(items),
             "items": [{"orden": n, "descripcion": i["descripcion"],
                        "cantidad": f"{float(i['cantidad']):.2f}",
                        "precio_unitario": f"{float(i['precio_unitario']):.2f}",
                        "codigo": i.get("codigo", "")} for n, i in enumerate(items)]}
        mios[pid] = p
        return p

    def detalle(self, presupuesto_id: int):
        return self._mios().get(presupuesto_id)

    def listar(self, *, limit=50, incluir_reemplazados=False):
        vivos = list(self._mios().values())
        if not incluir_reemplazados:
            vivos = [p for p in vivos if p.get("reemplazado_por") is None]
        return vivos[:limit]

    def adjuntar_doc(self, presupuesto_id, doc_id, doc_link, sheet_fila=None) -> None:
        p = self._mios().get(presupuesto_id)
        if p:
            p.update({"doc_id": doc_id, "doc_link": doc_link, "sheet_fila": sheet_fila})

    def marcar_factura(self, presupuesto_id, factura_id) -> bool:
        self.marcadas.append((presupuesto_id, factura_id))
        p = self._mios().get(presupuesto_id)
        if p:
            p["factura_id"] = factura_id
        return p is not None


class _FakeCredStore:
    def __init__(self, cuit: str | None) -> None:
        self._cuit = cuit

    def primer_cuit(self):
        return self._cuit


class _EspiaFactura:
    """Registra las señales con las que se arma el borrador — es lo que permite afirmar QUÉ se
    transfirió del presupuesto a la factura, no sólo que el endpoint devolvió 200."""

    def __init__(self) -> None:
        self.iniciadas: list[tuple] = []
        self.senales: list[tuple] = []

    def iniciar(self, cliente_id, cuit) -> str:
        self.iniciadas.append((cliente_id, cuit))
        return f"factura-nueva-{len(self.iniciadas)}"

    def signal(self, cliente_id, factura_id, nombre, payload) -> None:
        self.senales.append((cliente_id, factura_id, nombre, payload))


def _app(*, cliente_id="cid-A", perfiles=None, presupuestos=None, cuit="20111111112",
         espia=None, generar_doc=None, require_tenant=None):
    perfiles = perfiles if perfiles is not None else {}
    presupuestos = presupuestos if presupuestos is not None else {}
    espia = espia or _EspiaFactura()
    app = create_presupuestos_app(
        require_tenant=require_tenant or _require_tenant_fixed(cliente_id),
        perfil_negocio_store_factory=lambda cid: _FakePerfilStore(perfiles, cid),
        presupuesto_store_factory=lambda cid: _FakePresupuestoStore(presupuestos, cid),
        afip_cred_store_factory=lambda cid: _FakeCredStore(cuit),
        iniciar_factura=espia.iniciar, signal_factura=espia.signal, generar_doc=generar_doc)
    return TestClient(app), espia, presupuestos, perfiles


_ITEMS = [{"descripcion": "Mano de obra", "cantidad": "1", "precio_unitario": "30000"},
          {"descripcion": "Materiales", "cantidad": "1", "precio_unitario": "15000"}]
_BODY = {"concepto": "Instalación", "receptor": {"nombre": "Juan Pérez"}, "items": _ITEMS}


# --- perfil del negocio -------------------------------------------------------

def test_perfil_sin_configurar_devuelve_200_con_null_no_404():
    """El estado del PRIMER DÍA. Un 404 acá haría que el cliente trate "todavía no lo llenó" como un
    error, y encima colisiona con el 404 semántico del resto del router."""
    cli, *_ = _app()
    r = cli.get("/perfil-negocio")
    assert r.status_code == 200
    assert r.json() == {"perfil": None}


def test_perfil_sin_token_es_401():
    cli, *_ = _app(require_tenant=_require_tenant_401())
    assert cli.get("/perfil-negocio").status_code == 401
    assert cli.post("/perfil-negocio", json={"formalidad": "formal"}).status_code == 401


def test_perfil_body_vacio_es_400_y_NO_escribe():
    """Es el CONTROL de despliegue que usa el frontend (`POST {}` → 400 = vivo, 405 = no desplegado).
    Tiene que rechazar ANTES de tocar la base: si escribiera, chequear si el endpoint existe crearía
    un perfil vacío en cada chequeo."""
    cli, _, _, perfiles = _app()
    r = cli.post("/perfil-negocio", json={})
    assert r.status_code == 400
    assert perfiles == {}, "el control de despliegue no puede escribir nada"


@pytest.mark.parametrize("campo,valor", [
    ("a_quien", "cualquier_cosa"), ("formalidad", "gritado"), ("largo_respuesta", "medio")])
def test_perfil_enum_invalido_es_400_con_el_motivo(campo, valor):
    cli, *_ = _app()
    r = cli.post("/perfil-negocio", json={campo: valor})
    assert r.status_code == 400
    assert campo in r.json()["detail"]          # accionable, no "value is not a valid enum member"


def test_perfil_actualizacion_es_PARCIAL_no_pisa_lo_otro():
    """Las dos secciones de Ajustes (negocio y personalidad) se guardan por separado. Con reemplazo
    total, guardar una borraría la otra."""
    cli, _, _, perfiles = _app()
    cli.post("/perfil-negocio", json={"nombre_comercial": "Electricidad Pérez",
                                      "que_vende": "Instalaciones"})
    r = cli.post("/perfil-negocio", json={"formalidad": "formal"})
    perfil = r.json()["perfil"]
    assert perfil["formalidad"] == "formal"
    assert perfil["nombre_comercial"] == "Electricidad Pérez"     # NO se borró
    assert perfil["que_vende"] == "Instalaciones"


def test_perfil_cadena_vacia_SI_vacia_el_campo():
    """Ausente = no tocar; `""` = vaciar. Son cosas distintas y el cliente necesita las dos."""
    cli, *_ = _app()
    cli.post("/perfil-negocio", json={"nombre_comercial": "Algo"})
    r = cli.post("/perfil-negocio", json={"nombre_comercial": ""})
    assert r.json()["perfil"]["nombre_comercial"] == ""


def test_perfil_texto_demasiado_largo_es_400():
    cli, *_ = _app()
    assert cli.post("/perfil-negocio", json={"que_vende": "x" * 501}).status_code == 400


# --- presupuestos: creación ---------------------------------------------------

def test_crear_presupuesto_calcula_el_total_e_ignora_el_que_mande_el_cliente():
    """Una sola fuente para la aritmética: si el cliente pudiera fijar el total, dos capas empezarían
    a discrepar por redondeo y la factura saldría por un monto distinto al presupuesto."""
    cli, *_ = _app()
    r = cli.post("/presupuestos", json={**_BODY, "total": "999999.00"})
    assert r.status_code == 201
    assert r.json()["presupuesto"]["total"] == "45000.00"


def test_crear_presupuesto_body_vacio_es_422_y_NO_crea():
    """El control de despliegue del frontend. 422 (pydantic: faltan campos requeridos) = vivo."""
    cli, _, presupuestos, _ = _app()
    assert cli.post("/presupuestos", json={}).status_code == 422
    assert presupuestos == {}


def test_crear_presupuesto_sin_items_es_422():
    cli, *_ = _app()
    r = cli.post("/presupuestos", json={**_BODY, "items": []})
    assert r.status_code == 422


def test_crear_presupuesto_con_monto_no_numerico_es_400_nombrando_el_campo():
    cli, *_ = _app()
    r = cli.post("/presupuestos", json={
        **_BODY, "items": [{"descripcion": "x", "cantidad": "1", "precio_unitario": "cero pesos"}]})
    assert r.status_code == 400
    assert "precio_unitario" in r.json()["detail"]


def test_crear_presupuesto_con_monto_negativo_es_400():
    cli, *_ = _app()
    r = cli.post("/presupuestos", json={
        **_BODY, "items": [{"descripcion": "x", "cantidad": "1", "precio_unitario": "-5"}]})
    assert r.status_code == 400


def test_el_presupuesto_se_crea_AUNQUE_falle_el_doc():
    """Regla dura: el Doc es una proyección. Que Google se caiga no puede dejar al usuario sin
    presupuesto — es el mismo criterio del archivado del PDF en Drive."""
    def _doc_que_explota(cid, presupuesto):
        raise RuntimeError("Google dijo que no")

    cli, *_ = _app(generar_doc=_doc_que_explota)
    r = cli.post("/presupuestos", json=_BODY)
    assert r.status_code == 201
    assert r.json()["presupuesto"]["doc_link"] is None


def test_el_doc_cuando_funciona_queda_pegado_al_presupuesto():
    cli, *_ = _app(generar_doc=lambda cid, p: {"doc_id": "doc-1", "doc_link": "https://docs/x",
                                               "sheet_fila": "Presupuestos!A2"})
    p = cli.post("/presupuestos", json=_BODY).json()["presupuesto"]
    assert (p["doc_id"], p["doc_link"], p["sheet_fila"]) == ("doc-1", "https://docs/x",
                                                             "Presupuestos!A2")


# --- presupuestos: lectura ----------------------------------------------------

def test_listado_vacio_es_200_con_lista_vacia_no_404():
    cli, *_ = _app()
    r = cli.get("/presupuestos")
    assert r.status_code == 200
    assert r.json() == {"presupuestos": []}


def test_detalle_inexistente_es_404():
    cli, *_ = _app()
    r = cli.get("/presupuestos/999999")
    assert r.status_code == 404


def test_detalle_con_id_no_entero_es_422():
    """Declarado en el contrato: basura en el path es 422 de pydantic, no 404 — el cliente tiene que
    poder distinguir "no existe" de "mandé cualquier cosa"."""
    cli, *_ = _app()
    assert cli.get("/presupuestos/abc").status_code == 422


# --- 🔴 adversarial: aislamiento cross-tenant ---------------------------------

def test_ADVERSARIAL_un_tenant_no_lee_el_presupuesto_de_otro():
    """Regla dura del repo: un control de aislamiento sin caso hostil ejercitado queda [UNVERIFIED].

    B crea el suyo; A pide ESE id. Tiene que ser 404 — y 404, no 403: confirmar que el recurso existe
    ya filtra información."""
    presupuestos: dict = {}
    cli_b, *_ = _app(cliente_id="cid-B", presupuestos=presupuestos)
    id_de_b = cli_b.post("/presupuestos", json=_BODY).json()["presupuesto"]["id"]

    cli_a, *_ = _app(cliente_id="cid-A", presupuestos=presupuestos)
    assert cli_a.get(f"/presupuestos/{id_de_b}").status_code == 404
    assert cli_a.get("/presupuestos").json()["presupuestos"] == []


def test_ADVERSARIAL_un_tenant_no_factura_el_presupuesto_de_otro():
    """El caso caro: facturar lo ajeno emitiría un comprobante fiscal con datos de otra persona."""
    presupuestos: dict = {}
    espia = _EspiaFactura()
    cli_b, *_ = _app(cliente_id="cid-B", presupuestos=presupuestos, espia=espia)
    id_de_b = cli_b.post("/presupuestos", json=_BODY).json()["presupuesto"]["id"]

    cli_a, *_ = _app(cliente_id="cid-A", presupuestos=presupuestos, espia=espia)
    r = cli_a.post(f"/presupuestos/{id_de_b}/facturar")
    assert r.status_code == 404
    assert espia.iniciadas == [], "no se armó NINGÚN borrador con datos ajenos"


def test_CONTROL_el_test_adversarial_puede_fallar():
    """Control del par de arriba: si el store NO aislara por tenant, ¿lo cazaríamos?

    Se simula el store permeable (los dos tenants comparten el mismo bucket) y se verifica que A SÍ
    ve lo de B. Sin esto, los adversariales podrían estar pasando porque el fake no ejercita nada —
    que es el modo en que un control se vuelve decorativo."""
    compartido: dict = {}
    permeable = _FakePresupuestoStore(compartido, "MISMO-BUCKET")
    permeable.crear(concepto="de B", receptor={"nombre": "B"},
                    items=[{"descripcion": "x", "cantidad": "1", "precio_unitario": "1"}])
    otro = _FakePresupuestoStore(compartido, "MISMO-BUCKET")
    assert otro.detalle(1) is not None, "el fake tiene que poder mostrar la fuga si existiera"


# --- facturar -----------------------------------------------------------------

def test_facturar_arma_el_borrador_y_NO_emite():
    """Emitir es un acto fiscal: el botón deposita al usuario en el gate de confirmación que ya
    existe. Acá se verifica QUÉ se transfirió, no sólo que respondió 200."""
    cli, espia, *_ = _app()
    pid = cli.post("/presupuestos", json=_BODY).json()["presupuesto"]["id"]
    r = cli.post(f"/presupuestos/{pid}/facturar")
    assert r.status_code == 200
    factura_id = r.json()["factura_id"]

    assert espia.iniciadas == [("cid-A", "20111111112")]
    nombres = [s[2] for s in espia.senales]
    assert nombres == ["cargar_cliente", "agregar_item", "agregar_item"]
    assert "confirmar" not in nombres, "el botón NUNCA emite"

    cliente = espia.senales[0][3]
    assert cliente["nombre"] == "Juan Pérez"
    items = [s[3] for s in espia.senales[1:]]
    assert [i["descripcion"] for i in items] == ["Mano de obra", "Materiales"]
    # Las claves son EXACTAMENTE las que consume FacturaWorkflow.agregar_item: si alguien renombra
    # una acá, la factura saldría con ítems vacíos y CON CAE.
    assert set(items[0]) == {"descripcion", "cantidad", "precio_unitario", "codigo"}
    assert espia.senales[0][1] == factura_id


def test_facturar_presupuesto_inexistente_es_404():
    cli, espia, *_ = _app()
    assert cli.post("/presupuestos/999999/facturar").status_code == 404
    assert espia.iniciadas == []


def test_facturar_sin_perfil_fiscal_es_409():
    cli, espia, *_ = _app(cuit=None)
    pid = cli.post("/presupuestos", json=_BODY).json()["presupuesto"]["id"]
    r = cli.post(f"/presupuestos/{pid}/facturar")
    assert r.status_code == 409
    assert espia.iniciadas == []


def test_facturar_dos_veces_un_presupuesto_YA_FACTURADO_es_409():
    """Bloquea por `facturado` (el comprobante con CAE), NO por `factura_id`: un borrador que el
    usuario canceló deja `factura_id` puesto, y bloquear por eso dejaría el presupuesto imposible de
    facturar para siempre."""
    presupuestos: dict = {}
    cli, espia, _, _ = _app(presupuestos=presupuestos)
    pid = cli.post("/presupuestos", json=_BODY).json()["presupuesto"]["id"]
    presupuestos["cid-A"][pid]["facturado"] = True
    r = cli.post(f"/presupuestos/{pid}/facturar")
    assert r.status_code == 409
    assert espia.iniciadas == []


def test_facturar_un_borrador_CANCELADO_se_puede_reintentar():
    """El complemento del anterior, y el que evita el bug: `factura_id` puesto pero `facturado` False
    (el usuario canceló) DEBE dejar facturar de nuevo."""
    presupuestos: dict = {}
    cli, espia, _, _ = _app(presupuestos=presupuestos)
    pid = cli.post("/presupuestos", json=_BODY).json()["presupuesto"]["id"]
    presupuestos["cid-A"][pid].update({"factura_id": "borrador-viejo", "facturado": False})
    assert cli.post(f"/presupuestos/{pid}/facturar").status_code == 200
    assert len(espia.iniciadas) == 1


def test_facturar_sin_token_es_401():
    cli, *_ = _app(require_tenant=_require_tenant_401())
    assert cli.post("/presupuestos/1/facturar").status_code == 401
