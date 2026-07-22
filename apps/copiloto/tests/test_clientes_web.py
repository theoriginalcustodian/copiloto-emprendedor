"""Endpoints de CLIENTES — hito 1 del contrato (el punto de encuentro: los dos GET).

Se prueba por HTTP con `TestClient` y no llamando a los handlers: el bug de routing que FRONTEND cazó
en Gastos (`/gastos/resumen` cayendo en `/gastos/{id}`) **es de routing**, y un test que invoca el
handler directo no lo ve nunca. Acá todavía no hay segmento fijo, pero el guard se ejercita igual —
ver `test_el_guard_del_orden_de_rutas_DISCRIMINA`.
"""
from __future__ import annotations

import pytest
from fastapi import Header, HTTPException
from fastapi.testclient import TestClient

from cliente_store import (DOC_CONSUMIDOR_FINAL, DOC_CUIT, DOC_DNI, ClienteDuplicado,
                           es_consumidor_final, inferir_doc_tipo, nombre_derivado,
                           normalizar_documento, normalizar_nombre)
from clientes_web import create_clientes_app


def _tenant_fijo(cliente_id: str):
    def dep() -> str:
        return cliente_id
    return dep


def _tenant_401():
    def dep(authorization: str | None = Header(default=None)) -> str:
        raise HTTPException(status_code=401, detail="sin token")
    return dep


class _FakeClienteStore:
    """Comparte el dict entre tenants A PROPÓSITO: si el filtro por `cliente_id` no existiera, el test
    adversarial tiene que poder VERLO. Un fake con un dict por tenant haría pasar el test aunque el
    store real no filtrara nada."""

    def __init__(self, bucket: dict, cliente_id: str) -> None:
        self._b = bucket
        self._cid = cliente_id
        self._b.setdefault("_seq", 0)

    def sembrar(self, nombre: str, **extra) -> dict:
        self._b["_seq"] += 1
        c = {"id": self._b["_seq"], "nombre": nombre, "doc_tipo": None, "doc_nro": None,
             "condicion_iva": None, "domicilio": None, "contacto": None, "notas": None,
             "origen": "manual", "creado_en": "2026-07-22T10:00:00+00:00", **extra}
        self._b.setdefault(self._cid, {})[c["id"]] = c
        return c

    def listar(self, *, q="", limit=50):
        mios = list(self._b.get(self._cid, {}).values())
        if q:
            mios = [c for c in mios if normalizar_nombre(q) in normalizar_nombre(c["nombre"])]
        return mios[:limit], len(mios)

    def detalle(self, cliente: int):
        return self._b.get(self._cid, {}).get(cliente)

    # --- hito 3 ---
    #
    # El fake imita el EFECTO del índice único (chocar y devolver el dueño), no su mecanismo. Sirve
    # para fijar los códigos y la forma de la respuesta, que es lo que la app consume. **Que el
    # índice real exista y bloquee de verdad no lo prueba esto** — lo prueba el script contra la base
    # del VPS, y está declarado así a propósito: un fake que "verifica" la atomicidad sólo verifica
    # que yo escribí dos veces la misma suposición.

    def _clave(self, c: dict):
        doc = normalizar_documento(c.get("doc_nro"))
        if doc:
            return ("doc", c.get("doc_tipo"), doc)
        # `homonimo` entra en la clave por nombre, igual que en el índice real: es lo que deja
        # convivir a dos «Juan Pérez» legítimos sin aflojarle la dedup al backfill.
        return ("nom", normalizar_nombre(c["nombre"]), c.get("homonimo", 0))

    def _duenio(self, clave, excepto=None):
        for c in self._b.get(self._cid, {}).values():
            if self._clave(c) == clave and c["id"] != excepto:
                return c
        return None

    def _siguiente_homonimo(self, nombre):
        norm = normalizar_nombre(nombre)
        previos = [c.get("homonimo", 0) for c in self._b.get(self._cid, {}).values()
                   if not normalizar_documento(c.get("doc_nro"))
                   and normalizar_nombre(c["nombre"]) == norm]
        return max(previos or [0]) + 1

    def crear(self, forzar=False, **datos):
        datos.setdefault("doc_nro", "")
        duenio = self._duenio(self._clave(datos))
        if duenio is not None:
            por = "documento" if normalizar_documento(datos.get("doc_nro")) else "nombre"
            if not (forzar and por == "nombre"):
                raise ClienteDuplicado(duenio, por)
            datos["homonimo"] = self._siguiente_homonimo(datos["nombre"])
        guardado = {**{"doc_tipo": None, "condicion_iva": None, "domicilio": None,
                       "contacto": None, "notas": None, "origen": "manual"}, **datos}
        # El vacío sale como `null`, igual que `ClienteStore._fila`: en la base los opcionales son
        # `text NOT NULL DEFAULT ''` y el store traduce '' → None al devolverlos. Si el fake dejara
        # el '' pasar, este test estaría fijando una forma que el backend real no produce.
        return self.sembrar(**{k: (v or None) if k in ("doc_nro", "domicilio", "contacto", "notas")
                               else v for k, v in guardado.items()})

    def editar(self, cliente: int, cambios: dict, *, forzar=False):
        actual = self._b.get(self._cid, {}).get(cliente)
        if actual is None:
            return None
        propuesto = {**actual, **cambios}
        duenio = self._duenio(self._clave(propuesto), excepto=cliente)
        if duenio is not None:
            por = "documento" if normalizar_documento(propuesto.get("doc_nro")) else "nombre"
            if not (forzar and por == "nombre"):
                raise ClienteDuplicado(duenio, por)
            cambios = {**cambios, "homonimo": self._siguiente_homonimo(propuesto["nombre"])}
        actual.update(cambios)
        return actual


def _app(*, cliente_id="cid-A", bucket=None, require_tenant=None):
    bucket = bucket if bucket is not None else {}
    app = create_clientes_app(require_tenant=require_tenant or _tenant_fijo(cliente_id),
                              cliente_store_factory=lambda cid: _FakeClienteStore(bucket, cid))
    return TestClient(app), bucket


# --- el punto de encuentro: los dos GET, vacíos ---

def test_la_cartera_vacia_es_200_con_lista_vacia_no_404():
    """El estado hasta que corra el backfill del hito 2. Un 404 acá haría que la app trate «todavía no
    hay clientes» como «algo salió mal»."""
    cli, _ = _app()
    r = cli.get("/clientes")
    assert r.status_code == 200 and r.json() == {"clientes": [], "total": 0}


def test_una_ficha_inexistente_es_404():
    cli, _ = _app()
    r = cli.get("/clientes/999")
    assert r.status_code == 404 and "cliente" in r.json()["detail"]


def test_la_ficha_devuelve_SECCIONES_no_un_objeto_plano():
    """Contrato §13: sumar «sus pagos» después no cambia el contrato de los consumidores actuales.
    `presupuestos` y `facturas` viajan vacías y DECLARADAS, que es distinto de no estar."""
    cli, bucket = _app()
    _FakeClienteStore(bucket, "cid-A").sembrar("Panadería Los Tilos")
    r = cli.get("/clientes/1")
    assert r.status_code == 200
    assert set(r.json()) == {"cliente", "presupuestos", "facturas"}
    assert r.json()["presupuestos"] == [] and r.json()["facturas"] == []


def test_el_total_del_listado_es_el_del_TENANT_no_el_de_la_pagina():
    cli, bucket = _app()
    store = _FakeClienteStore(bucket, "cid-A")
    for i in range(5):
        store.sembrar(f"Cliente {i}")
    r = cli.get("/clientes?limit=2").json()
    assert len(r["clientes"]) == 2 and r["total"] == 5


def test_la_busqueda_por_q_ignora_tildes_y_mayusculas():
    cli, bucket = _app()
    _FakeClienteStore(bucket, "cid-A").sembrar("Panadería Los Tilos")
    assert cli.get("/clientes?q=PANADERIA").json()["total"] == 1
    assert cli.get("/clientes?q=ferretería").json()["total"] == 0


# --- 🔴 el guard del orden de rutas ---

def test_el_guard_del_orden_de_rutas_DISCRIMINA():
    """Hoy no hay ningún segmento fijo bajo `/clientes`, así que no hay nada que romper — y por eso
    mismo el guard tiene que existir: el que agregue el primero es el que no va a saber.

    Este test comprueba que el mecanismo del bug ESTÁ ACTIVO: un segmento textual cae en la ruta del
    id y muere con `422 int_parsing`. Si mañana alguien agrega `/clientes/opciones` DESPUÉS de
    `/clientes/{cliente}`, va a ver exactamente este 422 y va a saber por qué."""
    cli, _ = _app()
    r = cli.get("/clientes/loquesea")
    assert r.status_code == 422
    assert r.json()["detail"][0]["type"] == "int_parsing", \
        "si esto deja de ser int_parsing, el guard del comentario en clientes_web.py quedó obsoleto"


# --- 🔴 aislamiento cross-tenant (regla dura del proyecto) ---

def test_ADVERSARIAL_un_tenant_no_ve_la_ficha_de_otro():
    """404, NO 403: confirmarle que ese id existe ya es filtrar información."""
    bucket: dict = {}
    id_de_b = _FakeClienteStore(bucket, "cid-B").sembrar("Cliente de B")["id"]
    cli_a, _ = _app(cliente_id="cid-A", bucket=bucket)
    assert cli_a.get(f"/clientes/{id_de_b}").status_code == 404


def test_ADVERSARIAL_el_listado_de_uno_no_trae_los_del_otro():
    bucket: dict = {}
    _FakeClienteStore(bucket, "cid-B").sembrar("Cliente de B")
    cli_a, _ = _app(cliente_id="cid-A", bucket=bucket)
    assert cli_a.get("/clientes").json() == {"clientes": [], "total": 0}


def test_CONTROL_el_test_adversarial_PUEDE_fallar():
    """Sin este control, los dos de arriba pasarían igual si el fake guardara en buckets separados —
    estarían midiendo el fake, no el filtro."""
    bucket: dict = {}
    id_de_b = _FakeClienteStore(bucket, "cid-B").sembrar("Cliente de B")["id"]
    mismo = _FakeClienteStore(bucket, "cid-B")
    assert mismo.detalle(id_de_b) is not None, "el fake tiene que poder mostrar la fuga si existiera"


def test_sin_token_es_401():
    cli, _ = _app(require_tenant=_tenant_401())
    assert cli.get("/clientes").status_code == 401


# --- 🔴 §3.2: el consumidor final no crea cliente ---

def test_el_consumidor_final_NO_es_un_cliente():
    """Verificado contra `afip_rules.TipoDoc.CONSUMIDOR_FINAL = 99`. Si la deduplicación por documento
    lo aceptara, TODAS las ventas de mostrador colapsarían en un único registro fantasma con el grueso
    de la facturación adentro — que además encabezaría el ranking de mejores clientes."""
    assert es_consumidor_final(DOC_CONSUMIDOR_FINAL) is True
    assert es_consumidor_final(99) is True and es_consumidor_final("99") is True


@pytest.mark.parametrize("doc_tipo", [DOC_CUIT, 96, None])
def test_CONTROL_los_demas_tipos_SI_son_clientes(doc_tipo):
    """El control del anterior: que 99 no sea cliente no puede significar que nada lo sea."""
    assert es_consumidor_final(doc_tipo) is False


# --- la normalización, que es la clave de dedup sin documento ---

@pytest.mark.parametrize("crudo, esperado", [
    ("Panadería  Los Tilos.", "panaderia los tilos"),
    ("PANADERIA LOS TILOS", "panaderia los tilos"),
    ("Panadería Los Tilos", "panaderia los tilos"),
    ("  Ferretería   El Tornillo  ", "ferreteria el tornillo"),
    ("Juan Pérez", "juan perez"),
    ("S.A. Gómez & Hnos", "s a gomez hnos"),
])
def test_la_normalizacion_colapsa_lo_que_es_el_mismo_nombre(crudo, esperado):
    assert normalizar_nombre(crudo) == esperado


def test_CONTROL_la_normalizacion_NO_colapsa_nombres_distintos():
    """Sin esto, una normalización demasiado agresiva —que borrara todo y devolviera ''— pasaría todos
    los tests de arriba y fusionaría clientes que no tienen nada que ver."""
    assert normalizar_nombre("Panadería Los Tilos") != normalizar_nombre("Ferretería El Tornillo")
    assert normalizar_nombre("Juan Pérez") != normalizar_nombre("Juan Gómez")
    assert normalizar_nombre("Los Tilos") != ""


# ══════════════════════════════════════════════════════════════════════════════════════════════════
# HITO 2 — las tres decisiones del backfill, sin base de datos
# ══════════════════════════════════════════════════════════════════════════════════════════════════

def test_el_consumidor_final_no_entra_a_la_cartera_NI_CON_SU_ETIQUETA():
    """🔴 Los comprobantes reales del operador tienen `doc_tipo = 99` y un `receptor_nombre` que dice
    literalmente «Consumidor Final». Ese literal es el registro fantasma de §3.2 entrando **por la
    puerta del nombre** en vez de la del documento — tiene nombre, así que sin la lista de etiquetas
    que no son nombre pasaría el filtro. **23 de los 24 comprobantes reales son 99.**"""
    assert nombre_derivado("Consumidor Final", DOC_CONSUMIDOR_FINAL, "") is None
    assert nombre_derivado("CONSUMIDOR  FINAL", DOC_CONSUMIDOR_FINAL, "") is None
    assert nombre_derivado("", DOC_CONSUMIDOR_FINAL, "") is None


def test_un_presupuesto_SIN_IDENTIFICAR_pero_CON_nombre_SI_es_cliente():
    """🔴 El bug que cacé en el device, y el más caro de los tres del día.

    El formulario de presupuestos rotula el 99 como «Sin identificar», y ahí no significa «venta de
    mostrador» sino **«todavía no le pedí el documento»** — el presupuesto igual tiene nombre. Yo
    apliqué §3.2 (que habla de COMPROBANTES) a todo, y el resultado medido fue: cargué «Marta Sin
    Documento» a mano desde el teléfono, corrí el backfill, `omitidos: 24 · creados: 0`. Marta no iba
    a entrar a la cartera nunca, contra lo que §3.3 punto 2 manda explícitamente.

    Lo que decide no es el código: es si hay un nombre usable."""
    assert nombre_derivado("Marta Sin Documento", DOC_CONSUMIDOR_FINAL, "") == "Marta Sin Documento"
    assert nombre_derivado("Panadería Los Tilos", 99, "") == "Panadería Los Tilos"


def test_sin_nombre_y_sin_documento_no_hay_cliente():
    assert nombre_derivado("", None, "") is None
    assert nombre_derivado("   ", None, None) is None


def test_con_documento_y_sin_nombre_el_nombre_ES_el_documento():
    """Feo y honesto: el emprendedor lo reconoce y lo edita. Un cliente sin nombre no se puede
    mostrar en ninguna lista, así que la alternativa a esto es una fila invisible."""
    assert nombre_derivado("", DOC_CUIT, "30-71234567-8") == "CUIT 30712345678"
    assert nombre_derivado("", DOC_DNI, "26123456") == "DNI 26123456"


def test_CONTROL_cuando_HAY_nombre_gana_el_nombre():
    """El control de los dos de arriba: si `nombre_derivado` devolviera siempre el documento, la
    cartera saldría entera en códigos — que es exactamente lo que §4 quiere evitar."""
    assert nombre_derivado("Panadería Los Tilos", DOC_CUIT, "30712345678") == "Panadería Los Tilos"
    assert nombre_derivado("  Los Tilos  ", None, "") == "Los Tilos"


# ══════════════════════════════════════════════════════════════════════════════════════════════════
# HITO 3 — el alta, la edición parcial y el 409
# ══════════════════════════════════════════════════════════════════════════════════════════════════

# --- la sonda de despliegue de §7 ---

def test_la_sonda_de_despliegue_body_vacio_da_400():
    """§7: `POST /clientes` con `{}` → 400 = VIVO, 405 = no desplegado. Y no escribe nada."""
    cli, bucket = _app()
    r = cli.post("/clientes", json={})
    assert r.status_code == 400 and "nombre" in r.json()["detail"]
    assert cli.get("/clientes").json()["total"] == 0, "la sonda no puede dejar filas"


# --- 🔴 el DoD que protege el caso más común ---

def test_el_alta_con_SOLO_el_nombre_alcanza():
    """🔴 DoD §11 y §6.bis punto 2. Es el control por HTTP de la regla «la UI no puede exigir más que
    el backend»: si el formulario pide el CUIT y esto da 201, el bug es de la UI — y estaría trabando
    el cliente de mostrador, del que sólo se sabe el nombre."""
    cli, _ = _app()
    r = cli.post("/clientes", json={"nombre": "Panadería Los Tilos"})
    assert r.status_code == 201, r.text
    creado = r.json()
    assert creado["nombre"] == "Panadería Los Tilos"
    assert creado["doc_tipo"] is None and creado["doc_nro"] is None
    assert creado["origen"] == "manual"
    assert cli.get("/clientes").json()["total"] == 1


def test_el_alta_aparece_en_la_cartera_sin_pasos_intermedios():
    cli, _ = _app()
    cli.post("/clientes", json={"nombre": "Ferretería El Tornillo"})
    listado = cli.get("/clientes").json()
    assert [c["nombre"] for c in listado["clientes"]] == ["Ferretería El Tornillo"]


@pytest.mark.parametrize("crudo", ["30-71234567-8", "30.712.345.678", " 30712345678 "])
def test_el_documento_se_guarda_SOLO_con_digitos(crudo):
    """El mismo CUIT escrito de tres maneras son tres filas distintas para el índice único: el
    duplicado entraría por la puerta de al lado sin chocar contra nada."""
    assert normalizar_documento(crudo) == "30712345678"
    cli, _ = _app()
    r = cli.post("/clientes", json={"nombre": "Los Tilos", "doc_nro": crudo})
    assert r.status_code == 201 and r.json()["doc_nro"] == "30712345678"


def test_el_tipo_de_documento_se_deriva_del_largo_cuando_no_vino():
    cli, _ = _app()
    assert cli.post("/clientes", json={"nombre": "A", "doc_nro": "30712345678"}
                    ).json()["doc_tipo"] == DOC_CUIT
    assert cli.post("/clientes", json={"nombre": "B", "doc_nro": "26123456"}
                    ).json()["doc_tipo"] == DOC_DNI


def test_CONTROL_un_documento_de_largo_imposible_es_400_no_un_tipo_inventado():
    """El control del anterior: derivar de un formato que no se solapa es legítimo; completar con
    cualquier cosa cuando no se puede, no. Sin esto, `inferir_doc_tipo` podría devolver CUIT siempre
    y los dos tests de arriba pasarían igual."""
    assert inferir_doc_tipo("123") is None
    cli, _ = _app()
    r = cli.post("/clientes", json={"nombre": "A", "doc_nro": "123"})
    assert r.status_code == 400 and "11 dígitos" in r.json()["detail"]


def test_el_doc_tipo_explicito_le_gana_a_la_derivacion():
    cli, _ = _app()
    r = cli.post("/clientes", json={"nombre": "A", "doc_nro": "26123456", "doc_tipo": DOC_CUIT})
    assert r.json()["doc_tipo"] == DOC_CUIT


# --- §3.2 por HTTP, no sólo en la función pura ---

def test_dar_de_alta_un_CONSUMIDOR_FINAL_es_400():
    """La función `es_consumidor_final` ya estaba testeada, y eso no probaba que el endpoint la use:
    una regla verificada en la función pura y no cableada al handler es una regla que no existe."""
    cli, bucket = _app()
    r = cli.post("/clientes", json={"nombre": "Mostrador", "doc_tipo": DOC_CONSUMIDOR_FINAL})
    assert r.status_code == 400 and "consumidor final" in r.json()["detail"]
    assert cli.get("/clientes").json()["total"] == 0


# --- 🔴 el 409 de §3.4 ---

def test_repetir_el_documento_da_409_con_el_DUENO_no_una_segunda_fila():
    cli, _ = _app()
    primero = cli.post("/clientes", json={"nombre": "Juan Pérez",
                                          "doc_nro": "20-12345678-9"}).json()
    r = cli.post("/clientes", json={"nombre": "J. Perez S.A.", "doc_nro": "20123456789"})
    assert r.status_code == 409
    cuerpo = r.json()
    assert cuerpo["cliente"]["id"] == primero["id"], "el body tiene que traer al dueño"
    assert cuerpo["cliente"]["nombre"] == "Juan Pérez", \
        "con el id pelado la app no puede decir «ese documento ya es de Juan Pérez»"
    assert cuerpo["por"] == "documento"
    assert cli.get("/clientes").json()["total"] == 1, "el 409 no puede haber creado nada"


def test_repetir_el_nombre_sin_documento_tambien_da_409():
    """No está en la tabla de §7 —que sólo nombra el documento— y es la única salida posible: el
    índice parcial por nombre normalizado ya lo impide, así que la alternativa no es «crear igual»
    sino mentirle a la app diciendo 201 sobre una fila que no se creó."""
    cli, _ = _app()
    cli.post("/clientes", json={"nombre": "Panadería Los Tilos"})
    r = cli.post("/clientes", json={"nombre": "panaderia  los  tilos."})
    assert r.status_code == 409 and r.json()["por"] == "nombre"


def test_CONTROL_dos_clientes_DISTINTOS_no_chocan():
    """Sin este control, un `crear` que devolviera 409 siempre pasaría los dos de arriba."""
    cli, _ = _app()
    assert cli.post("/clientes", json={"nombre": "Los Tilos"}).status_code == 201
    assert cli.post("/clientes", json={"nombre": "El Tornillo"}).status_code == 201
    assert cli.post("/clientes", json={"nombre": "Otro", "doc_nro": "20123456789"}
                    ).status_code == 201


# --- 🔴 la edición PARCIAL ---

def test_editar_SOLO_el_contacto_no_borra_el_domicilio():
    """🔴 DoD §11, y el bug que la regla evita: el domicilio lo puso el backfill desde una factura de
    AFIP, ningún formulario lo muestra, y mandar el objeto entero del form lo borraría sin error."""
    cli, bucket = _app()
    creado = _FakeClienteStore(bucket, "cid-A").sembrar(
        "Los Tilos", domicilio="Av. Mitre 1234", contacto="11-1111-1111")
    r = cli.post(f"/clientes/{creado['id']}", json={"contacto": "11-5555-4444"})
    assert r.status_code == 200
    assert r.json()["contacto"] == "11-5555-4444"
    assert r.json()["domicilio"] == "Av. Mitre 1234", "la clave ausente NO se toca"


def test_CONTROL_mandar_el_domicilio_en_null_SI_lo_borra():
    """El control del anterior, y la distinción entera del `exclude_unset`: ausente ≠ null. Sin esto,
    un handler que ignorara TODOS los null pasaría el test de arriba y dejaría al emprendedor sin
    forma de borrar un dato mal cargado."""
    cli, bucket = _app()
    creado = _FakeClienteStore(bucket, "cid-A").sembrar("Los Tilos", domicilio="Av. Mitre 1234")
    r = cli.post(f"/clientes/{creado['id']}", json={"domicilio": None})
    assert r.status_code == 200 and r.json()["domicilio"] is None


def test_editar_un_cliente_que_no_existe_es_404():
    cli, _ = _app()
    assert cli.post("/clientes/999", json={"contacto": "x"}).status_code == 404


def test_ponerle_a_uno_el_documento_de_otro_da_409_con_el_dueno():
    """El caso concreto de §3.4: «Juan Pérez» sin documento y «Juan Perez» con CUIT quedaron como dos,
    y al editar el primero para ponerle el CUIT choca. La app ofrece abrir la ficha del dueño — sin
    fusionar, que es una operación destructiva que este contrato deja fuera de alcance."""
    cli, bucket = _app()
    store = _FakeClienteStore(bucket, "cid-A")
    con_doc = store.sembrar("Juan Perez", doc_tipo=DOC_CUIT, doc_nro="20123456789")
    sin_doc = store.sembrar("Juan Pérez")
    r = cli.post(f"/clientes/{sin_doc['id']}", json={"doc_nro": "20-12345678-9"})
    assert r.status_code == 409 and r.json()["cliente"]["id"] == con_doc["id"]


def test_el_origen_no_se_puede_editar():
    """`origen` dice CÓMO nació el cliente (§13: «¿la cartera se armó sola o la cargaron?»). Un campo
    de procedencia que se puede reescribir deja de responder esa pregunta."""
    cli, bucket = _app()
    creado = _FakeClienteStore(bucket, "cid-A").sembrar("Los Tilos", origen="derivado")
    r = cli.post(f"/clientes/{creado['id']}", json={"origen": "manual", "contacto": "x"})
    assert r.status_code == 200 and r.json()["origen"] == "derivado"


def test_un_origen_invalido_en_el_alta_es_400():
    cli, _ = _app()
    r = cli.post("/clientes", json={"nombre": "A", "origen": "importado"})
    assert r.status_code == 400 and "origen" in r.json()["detail"]


def test_un_nombre_demasiado_largo_es_400():
    cli, _ = _app()
    r = cli.post("/clientes", json={"nombre": "x" * 201})
    assert r.status_code == 400 and "200" in r.json()["detail"]


# --- 🔴 `forzar`: la salida del homónimo legítimo ---

def test_forzar_deja_crear_al_SEGUNDO_Juan_Perez():
    """Dos clientes se pueden llamar igual de verdad. La dedup por nombre existe para el BACKFILL
    —donde no hay nadie mirando y sin ella se inventa cartera—; aplicársela al alta explícita de un
    humano lo deja trabado y sin maniobra, pidiéndole un CUIT que no tiene."""
    cli, _ = _app()
    cli.post("/clientes", json={"nombre": "Juan Pérez"})
    assert cli.post("/clientes", json={"nombre": "Juan Pérez"}).status_code == 409
    r = cli.post("/clientes", json={"nombre": "Juan Pérez", "forzar": True})
    assert r.status_code == 201, r.text
    assert cli.get("/clientes").json()["total"] == 2


def test_forzar_TAMBIEN_deja_un_tercero():
    """Si el discriminador no avanzara, el tercer homónimo chocaría contra el segundo y `forzar`
    serviría exactamente una vez — un botón que funciona la primera vez es peor que no tenerlo."""
    cli, _ = _app()
    for _ in range(3):
        cli.post("/clientes", json={"nombre": "Kiosco", "forzar": True})
    assert cli.get("/clientes").json()["total"] == 3


def test_CONTROL_forzar_NO_pisa_el_choque_por_DOCUMENTO():
    """🔴 El control que le da sentido a `forzar`: dos CUIT iguales no son dos personas, son un error
    de tipeo. Sin este test, un `forzar` que abriera las dos puertas pasaría el de arriba y dejaría
    entrar el duplicado que toda la §3.3 existe para impedir."""
    cli, _ = _app()
    cli.post("/clientes", json={"nombre": "Juan Pérez", "doc_nro": "20123456789"})
    r = cli.post("/clientes", json={"nombre": "Otro", "doc_nro": "20123456789", "forzar": True})
    assert r.status_code == 409 and r.json()["por"] == "documento"
    assert cli.get("/clientes").json()["total"] == 1


def test_forzar_sirve_tambien_al_RENOMBRAR_desde_la_ficha():
    """Renombrar «Kiosco 2» a «Kiosco» tiene el mismo callejón sin salida que el alta. Que una puerta
    tenga salida y la otra no es peor que ninguna: el que la encuentra cerrada supone que la función
    no existe."""
    cli, bucket = _app()
    cli.post("/clientes", json={"nombre": "Kiosco"})
    otro = cli.post("/clientes", json={"nombre": "Kiosco 2"}).json()
    assert cli.post(f"/clientes/{otro['id']}", json={"nombre": "Kiosco"}).status_code == 409
    r = cli.post(f"/clientes/{otro['id']}", json={"nombre": "Kiosco", "forzar": True})
    assert r.status_code == 200 and r.json()["nombre"] == "Kiosco"


def test_forzar_no_se_guarda_como_un_campo_del_cliente():
    cli, _ = _app()
    creado = cli.post("/clientes", json={"nombre": "Los Tilos", "forzar": True}).json()
    assert "forzar" not in creado


# --- 🔴 aislamiento cross-tenant de las rutas nuevas ---

def test_ADVERSARIAL_un_tenant_no_puede_EDITAR_el_cliente_de_otro():
    """404, no 403 — y sobre todo: no lo modifica. Un control de acceso sin test adversarial es un
    control no verificado (regla dura del repo)."""
    bucket: dict = {}
    ajeno = _FakeClienteStore(bucket, "cid-B").sembrar("Cliente de B", contacto="11-0000-0000")
    cli_a, _ = _app(cliente_id="cid-A", bucket=bucket)
    assert cli_a.post(f"/clientes/{ajeno['id']}", json={"contacto": "robado"}).status_code == 404
    assert _FakeClienteStore(bucket, "cid-B").detalle(ajeno["id"])["contacto"] == "11-0000-0000"


def test_el_alta_de_un_tenant_no_aparece_en_la_cartera_del_otro():
    bucket: dict = {}
    cli_a, _ = _app(cliente_id="cid-A", bucket=bucket)
    cli_b, _ = _app(cliente_id="cid-B", bucket=bucket)
    cli_a.post("/clientes", json={"nombre": "Sólo de A"})
    assert cli_b.get("/clientes").json() == {"clientes": [], "total": 0}


def test_el_mismo_nombre_en_DOS_tenants_no_choca():
    """La dedup es POR TENANT (los índices llevan `cliente_id` adelante). Si el 409 saliera acá, dos
    emprendedores distintos no podrían tener un cliente que se llama igual — que es lo normal."""
    bucket: dict = {}
    cli_a, _ = _app(cliente_id="cid-A", bucket=bucket)
    cli_b, _ = _app(cliente_id="cid-B", bucket=bucket)
    assert cli_a.post("/clientes", json={"nombre": "Kiosco"}).status_code == 201
    assert cli_b.post("/clientes", json={"nombre": "Kiosco"}).status_code == 201
