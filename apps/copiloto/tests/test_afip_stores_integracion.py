"""Tests de integración de los stores AFIP — contra Postgres REAL, no fakes.

**Por qué real.** El test central de este archivo es el adversarial cross-tenant: que el tenant A no
pueda leer el certificado del tenant B. Con una conexión falsa estaríamos probando el fake, no el
aislamiento — y un control de acceso que nadie ejercitó con un actor hostil es indistinguible de uno
ausente. El happy-path ("cada uno ve lo suyo") pasa igual si el aislamiento no existe.

Corre en el VPS, con `DATABASE_URL` cargada:

    set -a; . /etc/unreal-copilot/fusion-pg.env; set +a
    /opt/uc-copiloto-venv/bin/python -m pytest tests/test_afip_stores_integracion.py -q

Si falta `DATABASE_URL` los tests se saltean (no se inventa un verde con fakes).
"""
from __future__ import annotations

import os
import uuid
from datetime import date

import pytest

from afip_credential_store import (
    AfipCredentialStore,
    AfipPerfilStore,
    AfipSecretHandoff,
    ClaveFiscal,
)

DATABASE_URL = os.environ.get("DATABASE_URL")
pytestmark = pytest.mark.skipif(not DATABASE_URL, reason="requiere DATABASE_URL (corre en el VPS)")

CERT_FALSO = "-----BEGIN CERTIFICATE-----\nMIIB-falso-de-test\n-----END CERTIFICATE-----"
KEY_FALSA = "-----BEGIN PRIVATE KEY-----\nMIIE-falsa-de-test\n-----END PRIVATE KEY-----"


class CryptoFake:
    """Cifrado de juguete: acá se prueba el AISLAMIENTO, no la criptografía (Fernet ya está probado)."""

    def encrypt(self, plaintext: str) -> str:
        return f"enc::{plaintext}"

    def decrypt(self, token: str) -> str:
        return token.removeprefix("enc::")


@pytest.fixture
def tenant_a():
    return str(uuid.uuid4())


@pytest.fixture
def tenant_b():
    return str(uuid.uuid4())


@pytest.fixture(autouse=True)
def limpiar(conn_de_tenant, tenant_a, tenant_b):
    """Los tests escriben en la DB viva: se borra lo propio al terminar, filtrando por los UUID del
    test. Con RLS, cada tenant borra SOLO lo suyo con su propia conexión declarada (una fila de A es
    invisible para una conexión declarada como B, así que hay que pasar dos veces, una por tenant)."""
    yield
    for cid in (tenant_a, tenant_b):
        conn_propia = conn_de_tenant(cid)()
        try:
            with conn_propia.cursor() as cur:
                # `afip_comprobantes` + `copiloto_eventos`: el test del row-id registra un
                # comprobante, y `registrar` loguea a `copiloto_eventos` (hito 5 §1.1). Sin
                # barrerlos, cada corrida deja huérfanos en producción.
                for tabla in ("afip_credentials", "afip_perfil", "afip_secret_handoff",
                              "afip_comprobantes", "copiloto_eventos"):
                    cur.execute(
                        f"DELETE FROM uc_factory.{tabla} WHERE cliente_id = %s", (cid,))
        finally:
            conn_propia.close()


# ---------------------------------------------------------------------------
# EL test del DoD: aislamiento cross-tenant
# ---------------------------------------------------------------------------


def test_adversarial_un_tenant_no_lee_el_certificado_de_otro(conn_de_tenant, tenant_a, tenant_b):
    """ADVERSARIAL: A guarda su certificado; B intenta leerlo con el mismo CUIT. Debe recibir nada.

    Se usa el MISMO cuit a propósito: si el filtro por `cliente_id` faltara en la query, B se llevaría
    la credencial de A. Con CUITs distintos el test pasaría igual aunque el aislamiento no existiera.

    Ahora hay DOS barreras y el test las cruza las dos: el filtro `cliente_id` explícito del store, y
    el RLS de la base — la conexión de B nace declarando B (`conn_de_tenant(tenant_b)`), así que la
    fila de A le es invisible incluso si la query se olvidara del WHERE.
    """
    cuit = "20409378472"
    AfipCredentialStore(conn_de_tenant(tenant_a), tenant_a, CryptoFake()).save(cuit, cert=CERT_FALSO, key=KEY_FALSA)

    store_b = AfipCredentialStore(conn_de_tenant(tenant_b), tenant_b, CryptoFake())
    assert store_b.get(cuit) is None, (
        "FUGA CROSS-TENANT: el tenant B leyó el certificado fiscal del tenant A. "
        "Revisar el filtro cliente_id en AfipCredentialStore.get."
    )
    assert store_b.primer_cuit() is None
    assert not store_b.tiene_credencial(cuit)


def test_adversarial_un_tenant_no_lee_el_perfil_de_otro(conn_de_tenant, tenant_a, tenant_b):
    """Cruza DOS barreras: el filtro `cliente_id` del store y el RLS de la conexión de B (declarada
    aparte con `conn_de_tenant(tenant_b)`)."""
    cuit = "20409378472"
    AfipPerfilStore(conn_de_tenant(tenant_a), tenant_a).save(
        cuit, razon_social="Emprendimiento A", domicilio_comercial="Calle 1",
        condicion_iva="monotributo", ingresos_brutos="20-1-2",
        inicio_actividades=date(2020, 1, 1), punto_venta=1)

    assert AfipPerfilStore(conn_de_tenant(tenant_b), tenant_b).get(cuit) is None


def test_adversarial_un_tenant_no_consume_el_secreto_de_otro(conn_de_tenant, tenant_a, tenant_b):
    """El handle es un UUID, pero el filtro por tenant es la defensa que no depende de adivinar.

    Cruza DOS barreras: el filtro `cliente_id` del store y el RLS de la conexión de B, declarada
    aparte con `conn_de_tenant(tenant_b)`."""
    handle = AfipSecretHandoff(conn_de_tenant(tenant_a), tenant_a, CryptoFake()).stash(ClaveFiscal("clave-de-a"))

    assert AfipSecretHandoff(conn_de_tenant(tenant_b), tenant_b, CryptoFake()).consume(handle) is None
    # y sigue disponible para su dueño
    assert AfipSecretHandoff(conn_de_tenant(tenant_a), tenant_a, CryptoFake()).consume(handle) is not None


def test_cada_tenant_ve_lo_suyo(conn_de_tenant, tenant_a, tenant_b):
    """Happy-path. Por sí solo NO prueba aislamiento — por eso están los adversariales de arriba."""
    cuit = "20409378472"
    AfipCredentialStore(conn_de_tenant(tenant_a), tenant_a, CryptoFake()).save(cuit, cert="cert-a", key="key-a")
    AfipCredentialStore(conn_de_tenant(tenant_b), tenant_b, CryptoFake()).save(cuit, cert="cert-b", key="key-b")

    assert AfipCredentialStore(conn_de_tenant(tenant_a), tenant_a, CryptoFake()).get(cuit)["cert"] == "cert-a"
    assert AfipCredentialStore(conn_de_tenant(tenant_b), tenant_b, CryptoFake()).get(cuit)["cert"] == "cert-b"


# ---------------------------------------------------------------------------
# Certificado
# ---------------------------------------------------------------------------


def test_el_certificado_se_guarda_cifrado_en_la_columna(conn_de_tenant, tenant_a):
    """Verificación directa contra la tabla: en la columna NO puede estar el texto plano."""
    AfipCredentialStore(conn_de_tenant(tenant_a), tenant_a, CryptoFake()).save(
        "20409378472", cert=CERT_FALSO, key=KEY_FALSA)

    conn_propia = conn_de_tenant(tenant_a)()
    with conn_propia.cursor() as cur:
        cur.execute(
            "SELECT cert_enc, key_enc FROM uc_factory.afip_credentials WHERE cliente_id=%s", (tenant_a,))
        cert_enc, key_enc = cur.fetchone()
    conn_propia.close()

    assert cert_enc.startswith("enc::") and key_enc.startswith("enc::")
    assert "BEGIN CERTIFICATE" not in cert_enc.removeprefix("enc::") or cert_enc != CERT_FALSO
    assert key_enc != KEY_FALSA, "la clave privada quedó en claro en la DB"


def test_save_es_idempotente_actualiza_no_duplica(conn_de_tenant, tenant_a):
    cuit = "20409378472"
    store = AfipCredentialStore(conn_de_tenant(tenant_a), tenant_a, CryptoFake())
    store.save(cuit, cert="v1", key="k1")
    store.save(cuit, cert="v2", key="k2")

    conn_propia = conn_de_tenant(tenant_a)()
    with conn_propia.cursor() as cur:
        cur.execute(
            "SELECT count(*) FROM uc_factory.afip_credentials WHERE cliente_id=%s AND cuit=%s",
            (tenant_a, cuit))
        assert cur.fetchone()[0] == 1
    conn_propia.close()
    assert store.get(cuit)["cert"] == "v2"


def test_ws_autorizados_va_y_vuelve(conn_de_tenant, tenant_a):
    store = AfipCredentialStore(conn_de_tenant(tenant_a), tenant_a, CryptoFake())
    store.save("20409378472", cert="c", key="k", ws_autorizados=["wsfe"])
    assert store.get("20409378472")["ws_autorizados"] == ["wsfe"]


# ---------------------------------------------------------------------------
# Claim-check de la clave fiscal
# ---------------------------------------------------------------------------


def test_el_secreto_se_consume_una_sola_vez(conn_de_tenant, tenant_a):
    """One-shot: el segundo consumidor no obtiene nada. Es un DELETE...RETURNING, no un SELECT+DELETE."""
    handoff = AfipSecretHandoff(conn_de_tenant(tenant_a), tenant_a, CryptoFake())
    handle = handoff.stash(ClaveFiscal("mi-clave-fiscal"))

    primero = handoff.consume(handle)
    segundo = handoff.consume(handle)

    assert primero is not None and primero.revelar() == "mi-clave-fiscal"
    assert segundo is None, "el secreto se pudo leer dos veces: el consume no es one-shot"


def test_el_secreto_vencido_no_se_consume(conn_de_tenant, tenant_a):
    handoff = AfipSecretHandoff(conn_de_tenant(tenant_a), tenant_a, CryptoFake())
    handle = handoff.stash(ClaveFiscal("clave"), ttl_segundos=-1)  # ya nació vencido
    assert handoff.consume(handle) is None


def test_purgar_vencidos_borra_solo_los_vencidos(conn_de_tenant, tenant_a):
    handoff = AfipSecretHandoff(conn_de_tenant(tenant_a), tenant_a, CryptoFake())
    handoff.stash(ClaveFiscal("vieja"), ttl_segundos=-1)
    vigente = handoff.stash(ClaveFiscal("nueva"))

    handoff.purgar_vencidos()
    assert handoff.consume(vigente) is not None


def test_handle_inexistente_devuelve_none(conn_de_tenant, tenant_a):
    assert AfipSecretHandoff(conn_de_tenant(tenant_a), tenant_a, CryptoFake()).consume(str(uuid.uuid4())) is None


def test_el_secreto_no_queda_en_claro_en_la_tabla(conn_de_tenant, tenant_a):
    AfipSecretHandoff(conn_de_tenant(tenant_a), tenant_a, CryptoFake()).stash(ClaveFiscal("clave-secreta-afip"))
    conn_propia = conn_de_tenant(tenant_a)()
    with conn_propia.cursor() as cur:
        cur.execute("SELECT secreto_enc FROM uc_factory.afip_secret_handoff WHERE cliente_id=%s", (tenant_a,))
        assert cur.fetchone()[0] != "clave-secreta-afip"
    conn_propia.close()


# ---------------------------------------------------------------------------
# La clave fiscal no se imprime
# ---------------------------------------------------------------------------


def test_la_clave_fiscal_no_aparece_en_repr_ni_str():
    """Un log descuidado o un traceback con locales no puede filtrar el secreto."""
    clave = ClaveFiscal("mi-clave-real")
    assert "mi-clave-real" not in repr(clave)
    assert "mi-clave-real" not in str(clave)
    assert "mi-clave-real" not in f"{clave}"
    assert clave.revelar() == "mi-clave-real"


def test_la_clave_fiscal_no_se_filtra_en_un_dict_logueado():
    """El caso realista: alguien loguea el payload entero."""
    payload = {"cuit": "20409378472", "clave": ClaveFiscal("mi-clave-real")}
    assert "mi-clave-real" not in str(payload)


# ---------------------------------------------------------------------------
# Ambiente: dos credenciales por CUIT, una sola activa (pedido de frontend, 2026-07-21)
# ---------------------------------------------------------------------------


def test_dev_y_prod_conviven_para_el_mismo_cuit(conn_de_tenant, tenant_a):
    """El certificado de homologación y el de producción son credenciales DISTINTAS.

    Antes el unique era (cliente_id, cuit): vincular producción pisaba el certificado de homologación,
    y volver a probar exigía rehacer el alta con la clave fiscal — rompiendo la promesa de pedirla una
    sola vez.
    """
    cuit = "20409378472"
    store = AfipCredentialStore(conn_de_tenant(tenant_a), tenant_a, CryptoFake())
    store.save(cuit, cert="cert-dev", key="key-dev", ambiente="dev")
    store.save(cuit, cert="cert-prod", key="key-prod", ambiente="prod")

    assert store.ambientes_vinculados(cuit) == ["dev", "prod"]
    assert store.get(cuit, "dev")["cert"] == "cert-dev"
    assert store.get(cuit, "prod")["cert"] == "cert-prod"


def test_solo_una_credencial_activa_a_la_vez(conn_de_tenant, tenant_a):
    """El invariante lo garantiza la BASE (índice único parcial), no el código que hace el toggle."""
    cuit = "20409378472"
    store = AfipCredentialStore(conn_de_tenant(tenant_a), tenant_a, CryptoFake())
    store.save(cuit, cert="c1", key="k1", ambiente="dev")
    store.save(cuit, cert="c2", key="k2", ambiente="prod")

    conn_propia = conn_de_tenant(tenant_a)()
    with conn_propia.cursor() as cur:
        cur.execute(
            "SELECT count(*) FROM uc_factory.afip_credentials "
            "WHERE cliente_id=%s AND cuit=%s AND activo", (tenant_a, cuit))
        assert cur.fetchone()[0] == 1
    conn_propia.close()


def test_get_sin_ambiente_devuelve_la_activa(conn_de_tenant, tenant_a):
    """La emisión NO elige ambiente: usa el que el emprendedor dejó activo."""
    cuit = "20409378472"
    store = AfipCredentialStore(conn_de_tenant(tenant_a), tenant_a, CryptoFake())
    store.save(cuit, cert="c-dev", key="k", ambiente="dev")
    store.save(cuit, cert="c-prod", key="k", ambiente="prod")   # activa la última guardada
    assert store.get(cuit)["ambiente"] == "prod"

    assert store.activar(cuit, "dev") is True
    assert store.get(cuit)["ambiente"] == "dev"


def test_activar_un_ambiente_sin_credencial_devuelve_false(conn_de_tenant, tenant_a):
    """No es una excepción: es un caso del producto. El endpoint lo traduce a 409 + camino al alta."""
    cuit = "20409378472"
    store = AfipCredentialStore(conn_de_tenant(tenant_a), tenant_a, CryptoFake())
    store.save(cuit, cert="c", key="k", ambiente="dev")
    assert store.activar(cuit, "prod") is False
    assert store.get(cuit)["ambiente"] == "dev", "un activar fallido no puede dejar al tenant sin activa"


def test_ambiente_invalido_no_llega_a_la_base(conn_de_tenant, tenant_a):
    cuit = "20409378472"
    for llamada in (lambda s: s.save(cuit, cert="c", key="k", ambiente="staging"),
                    lambda s: s.activar(cuit, "staging")):
        with pytest.raises(ValueError):
            llamada(AfipCredentialStore(conn_de_tenant(tenant_a), tenant_a, CryptoFake()))


def test_adversarial_el_ambiente_no_permite_leer_la_credencial_de_otro_tenant(
        conn_de_tenant, tenant_a, tenant_b):
    """El parámetro nuevo no puede abrir una puerta lateral al aislamiento.

    Cruza DOS barreras: el filtro `cliente_id` del store y el RLS de la conexión de B, declarada
    aparte con `conn_de_tenant(tenant_b)`."""
    cuit = "20409378472"
    AfipCredentialStore(conn_de_tenant(tenant_a), tenant_a, CryptoFake()).save(
        cuit, cert="cert-de-A", key="key-de-A", ambiente="prod")
    store_b = AfipCredentialStore(conn_de_tenant(tenant_b), tenant_b, CryptoFake())
    assert store_b.get(cuit, "prod") is None
    assert store_b.ambientes_vinculados(cuit) == []


# ---------------------------------------------------------------------------
# El pedido_ de FRONTEND: el `id` de fila viaja para que la card de éxito pueda cobrar
# ---------------------------------------------------------------------------


def test_registrar_devuelve_el_id_y_por_idem_key_lo_expone(conn_de_tenant, tenant_a):
    """Contra la base real: `registrar` devuelve el `id` de fila (RETURNING) y `por_idem_key` lo trae
    de vuelta (el SELECT con `id` + `_fila(con_id=True)`). Es lo que hace que la card de éxito ofrezca
    el cobro sin rebuscar por (punto_venta, nro). El fake del unit test no ejercita este mapeo real."""
    from afip_comprobante_store import AfipComprobanteStore
    store = AfipComprobanteStore(conn_de_tenant(tenant_a), tenant_a)
    kw = dict(cuit="30712345678", tipo_cbte=6, punto_venta=1, nro=1234, cae="CAE-X",
              cae_vto=None, fecha_emision=date(2026, 7, 22), doc_tipo=96, doc_nro="20111111112",
              total="1000.00", idem_key="idem-rowid", workflow_id="wf-x")

    rid = store.registrar(**kw)
    assert isinstance(rid, int)

    ya = store.por_idem_key("idem-rowid")
    assert ya is not None and ya["id"] == rid

    # Idempotente por la tupla única: re-registrar devuelve el MISMO id (camino ON CONFLICT), no otra fila.
    assert store.registrar(**kw) == rid


def test_adjuntar_pdf_persiste_params_pdf_json_y_get_lo_trae(conn_de_tenant, tenant_a):
    """Residuo AFIP (Bandeja 2026-08-04): `params_pdf_json` es lo que le permite a una anulación
    reconstruir el PDF de la nota de crédito sin un `BorradorFactura` vivo. Contra la base real
    porque es una columna `jsonb` nueva — un fake no detecta un `ALTER TABLE` que faltó correr."""
    from afip_comprobante_store import AfipComprobanteStore
    store = AfipComprobanteStore(conn_de_tenant(tenant_a), tenant_a)
    kw = dict(cuit="30712345678", tipo_cbte=11, punto_venta=1, nro=9001, cae="CAE-PDF",
              cae_vto=None, fecha_emision=date(2026, 8, 4), doc_tipo=99, doc_nro="0",
              total="500.00", idem_key="idem-pdf-json", workflow_id="wf-pdf")
    store.registrar(**kw)

    params = {"voucher_number": 9001, "items": [{"code": "001", "description": "algo",
              "quantity": 1, "unit_price": 500.0, "subtotal": 500.0}], "total_amount": 500.0}
    store.adjuntar_pdf(cuit="30712345678", tipo_cbte=11, punto_venta=1, nro=9001,
                       pdf_url="https://x/a.pdf", pdf_expira_at=None, params_pdf=params)

    fila = store.get(cuit="30712345678", tipo_cbte=11, punto_venta=1, nro=9001)
    assert fila["params_pdf_json"] == params

    # `params_pdf=None` (default) NO pisa lo ya guardado — es el camino que toma `adjuntar_pdf` cuando
    # se llama SIN el kwarg (ningún caller de hoy lo hace para el PDF de una NC re-generado a mano,
    # pero el contrato del COALESCE es lo que se está probando acá).
    store.adjuntar_pdf(cuit="30712345678", tipo_cbte=11, punto_venta=1, nro=9001,
                       pdf_url="https://x/a-v2.pdf", pdf_expira_at=None)
    fila_v2 = store.get(cuit="30712345678", tipo_cbte=11, punto_venta=1, nro=9001)
    assert fila_v2["params_pdf_json"] == params
    assert fila_v2["pdf_url"] == "https://x/a-v2.pdf"

    # Las otras lecturas (listar/por_idem_key) NO traen `params_pdf_json` — es opt-in sólo en `get()`
    # (ver `_fila(con_params_pdf=...)`), para no inflar el resultado de la activity que las usa.
    listado = store.listar(cuit="30712345678")
    assert all("params_pdf_json" not in f for f in listado)


def test_ADVERSARIAL_A_no_ve_el_listado_ni_el_detalle_de_los_comprobantes_de_B(conn_de_tenant,
                                                                                tenant_a, tenant_b):
    """Hallazgo 2026-08-04 (M-WEB RLS): `AfipComprobanteStore` sólo se ejercitaba con un único tenant
    en este archivo — nunca con un actor A pidiendo activamente el comprobante de B. `listar` y
    `detalle_por_id` alimentan `GET /afip/comprobantes` y `GET /afip/comprobantes/{id}`."""
    from afip_comprobante_store import AfipComprobanteStore
    de_b = AfipComprobanteStore(conn_de_tenant(tenant_b), tenant_b)
    rid_b = de_b.registrar(cuit="30712345678", tipo_cbte=6, punto_venta=1, nro=5001,
                           cae="CAE-SECRETO-B", cae_vto=None, fecha_emision=date(2026, 8, 4),
                           doc_tipo=96, doc_nro="20222222223", total="777777.00",
                           receptor_nombre="Secreto de B")

    de_a = AfipComprobanteStore(conn_de_tenant(tenant_a), tenant_a)
    assert de_a.listar(cuit="30712345678") == []
    assert de_a.detalle_por_id(rid_b) is None

    # y B sigue viendo lo suyo — si el fixture de alta fallara en silencio, todo daría vacío por igual
    assert de_b.detalle_por_id(rid_b)["receptor_nombre"] == "Secreto de B"
