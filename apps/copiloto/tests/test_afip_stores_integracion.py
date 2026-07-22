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


@pytest.fixture(scope="module")
def conn():
    import psycopg2

    c = psycopg2.connect(DATABASE_URL)
    c.autocommit = True
    yield c
    c.close()


@pytest.fixture
def conn_factory(conn):
    return lambda: conn


@pytest.fixture
def tenant_a():
    return str(uuid.uuid4())


@pytest.fixture
def tenant_b():
    return str(uuid.uuid4())


@pytest.fixture(autouse=True)
def limpiar(conn, tenant_a, tenant_b):
    """Los tests escriben en la DB viva: se borra lo propio al terminar, filtrando por los UUID del test."""
    yield
    with conn.cursor() as cur:
        for tabla in ("afip_credentials", "afip_perfil", "afip_secret_handoff"):
            # `cliente_id` es uuid en la tabla: hay que castear el array explícitamente. En un
            # `WHERE cliente_id=%s` Postgres castea el literal solo, pero con ANY(ARRAY[...]) no.
            cur.execute(
                f"DELETE FROM uc_factory.{tabla} WHERE cliente_id = ANY(%s::uuid[])",
                ([tenant_a, tenant_b],),
            )


# ---------------------------------------------------------------------------
# EL test del DoD: aislamiento cross-tenant
# ---------------------------------------------------------------------------


def test_adversarial_un_tenant_no_lee_el_certificado_de_otro(conn_factory, tenant_a, tenant_b):
    """ADVERSARIAL: A guarda su certificado; B intenta leerlo con el mismo CUIT. Debe recibir nada.

    Se usa el MISMO cuit a propósito: si el filtro por `cliente_id` faltara en la query, B se llevaría
    la credencial de A. Con CUITs distintos el test pasaría igual aunque el aislamiento no existiera.
    """
    cuit = "20409378472"
    AfipCredentialStore(conn_factory, tenant_a, CryptoFake()).save(cuit, cert=CERT_FALSO, key=KEY_FALSA)

    store_b = AfipCredentialStore(conn_factory, tenant_b, CryptoFake())
    assert store_b.get(cuit) is None, (
        "FUGA CROSS-TENANT: el tenant B leyó el certificado fiscal del tenant A. "
        "Revisar el filtro cliente_id en AfipCredentialStore.get."
    )
    assert store_b.primer_cuit() is None
    assert not store_b.tiene_credencial(cuit)


def test_adversarial_un_tenant_no_lee_el_perfil_de_otro(conn_factory, tenant_a, tenant_b):
    cuit = "20409378472"
    AfipPerfilStore(conn_factory, tenant_a).save(
        cuit, razon_social="Emprendimiento A", domicilio_comercial="Calle 1",
        condicion_iva="monotributo", ingresos_brutos="20-1-2",
        inicio_actividades=date(2020, 1, 1), punto_venta=1)

    assert AfipPerfilStore(conn_factory, tenant_b).get(cuit) is None


def test_adversarial_un_tenant_no_consume_el_secreto_de_otro(conn_factory, tenant_a, tenant_b):
    """El handle es un UUID, pero el filtro por tenant es la defensa que no depende de adivinar."""
    handle = AfipSecretHandoff(conn_factory, tenant_a, CryptoFake()).stash(ClaveFiscal("clave-de-a"))

    assert AfipSecretHandoff(conn_factory, tenant_b, CryptoFake()).consume(handle) is None
    # y sigue disponible para su dueño
    assert AfipSecretHandoff(conn_factory, tenant_a, CryptoFake()).consume(handle) is not None


def test_cada_tenant_ve_lo_suyo(conn_factory, tenant_a, tenant_b):
    """Happy-path. Por sí solo NO prueba aislamiento — por eso están los adversariales de arriba."""
    cuit = "20409378472"
    AfipCredentialStore(conn_factory, tenant_a, CryptoFake()).save(cuit, cert="cert-a", key="key-a")
    AfipCredentialStore(conn_factory, tenant_b, CryptoFake()).save(cuit, cert="cert-b", key="key-b")

    assert AfipCredentialStore(conn_factory, tenant_a, CryptoFake()).get(cuit)["cert"] == "cert-a"
    assert AfipCredentialStore(conn_factory, tenant_b, CryptoFake()).get(cuit)["cert"] == "cert-b"


# ---------------------------------------------------------------------------
# Certificado
# ---------------------------------------------------------------------------


def test_el_certificado_se_guarda_cifrado_en_la_columna(conn, conn_factory, tenant_a):
    """Verificación directa contra la tabla: en la columna NO puede estar el texto plano."""
    AfipCredentialStore(conn_factory, tenant_a, CryptoFake()).save(
        "20409378472", cert=CERT_FALSO, key=KEY_FALSA)

    with conn.cursor() as cur:
        cur.execute(
            "SELECT cert_enc, key_enc FROM uc_factory.afip_credentials WHERE cliente_id=%s", (tenant_a,))
        cert_enc, key_enc = cur.fetchone()

    assert cert_enc.startswith("enc::") and key_enc.startswith("enc::")
    assert "BEGIN CERTIFICATE" not in cert_enc.removeprefix("enc::") or cert_enc != CERT_FALSO
    assert key_enc != KEY_FALSA, "la clave privada quedó en claro en la DB"


def test_save_es_idempotente_actualiza_no_duplica(conn, conn_factory, tenant_a):
    cuit = "20409378472"
    store = AfipCredentialStore(conn_factory, tenant_a, CryptoFake())
    store.save(cuit, cert="v1", key="k1")
    store.save(cuit, cert="v2", key="k2")

    with conn.cursor() as cur:
        cur.execute(
            "SELECT count(*) FROM uc_factory.afip_credentials WHERE cliente_id=%s AND cuit=%s",
            (tenant_a, cuit))
        assert cur.fetchone()[0] == 1
    assert store.get(cuit)["cert"] == "v2"


def test_ws_autorizados_va_y_vuelve(conn_factory, tenant_a):
    store = AfipCredentialStore(conn_factory, tenant_a, CryptoFake())
    store.save("20409378472", cert="c", key="k", ws_autorizados=["wsfe"])
    assert store.get("20409378472")["ws_autorizados"] == ["wsfe"]


# ---------------------------------------------------------------------------
# Claim-check de la clave fiscal
# ---------------------------------------------------------------------------


def test_el_secreto_se_consume_una_sola_vez(conn_factory, tenant_a):
    """One-shot: el segundo consumidor no obtiene nada. Es un DELETE...RETURNING, no un SELECT+DELETE."""
    handoff = AfipSecretHandoff(conn_factory, tenant_a, CryptoFake())
    handle = handoff.stash(ClaveFiscal("mi-clave-fiscal"))

    primero = handoff.consume(handle)
    segundo = handoff.consume(handle)

    assert primero is not None and primero.revelar() == "mi-clave-fiscal"
    assert segundo is None, "el secreto se pudo leer dos veces: el consume no es one-shot"


def test_el_secreto_vencido_no_se_consume(conn_factory, tenant_a):
    handoff = AfipSecretHandoff(conn_factory, tenant_a, CryptoFake())
    handle = handoff.stash(ClaveFiscal("clave"), ttl_segundos=-1)  # ya nació vencido
    assert handoff.consume(handle) is None


def test_purgar_vencidos_borra_solo_los_vencidos(conn_factory, tenant_a):
    handoff = AfipSecretHandoff(conn_factory, tenant_a, CryptoFake())
    handoff.stash(ClaveFiscal("vieja"), ttl_segundos=-1)
    vigente = handoff.stash(ClaveFiscal("nueva"))

    handoff.purgar_vencidos()
    assert handoff.consume(vigente) is not None


def test_handle_inexistente_devuelve_none(conn_factory, tenant_a):
    assert AfipSecretHandoff(conn_factory, tenant_a, CryptoFake()).consume(str(uuid.uuid4())) is None


def test_el_secreto_no_queda_en_claro_en_la_tabla(conn, conn_factory, tenant_a):
    AfipSecretHandoff(conn_factory, tenant_a, CryptoFake()).stash(ClaveFiscal("clave-secreta-afip"))
    with conn.cursor() as cur:
        cur.execute("SELECT secreto_enc FROM uc_factory.afip_secret_handoff WHERE cliente_id=%s", (tenant_a,))
        assert cur.fetchone()[0] != "clave-secreta-afip"


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


def test_dev_y_prod_conviven_para_el_mismo_cuit(conn_factory, tenant_a):
    """El certificado de homologación y el de producción son credenciales DISTINTAS.

    Antes el unique era (cliente_id, cuit): vincular producción pisaba el certificado de homologación,
    y volver a probar exigía rehacer el alta con la clave fiscal — rompiendo la promesa de pedirla una
    sola vez.
    """
    cuit = "20409378472"
    store = AfipCredentialStore(conn_factory, tenant_a, CryptoFake())
    store.save(cuit, cert="cert-dev", key="key-dev", ambiente="dev")
    store.save(cuit, cert="cert-prod", key="key-prod", ambiente="prod")

    assert store.ambientes_vinculados(cuit) == ["dev", "prod"]
    assert store.get(cuit, "dev")["cert"] == "cert-dev"
    assert store.get(cuit, "prod")["cert"] == "cert-prod"


def test_solo_una_credencial_activa_a_la_vez(conn_factory, tenant_a, conn):
    """El invariante lo garantiza la BASE (índice único parcial), no el código que hace el toggle."""
    cuit = "20409378472"
    store = AfipCredentialStore(conn_factory, tenant_a, CryptoFake())
    store.save(cuit, cert="c1", key="k1", ambiente="dev")
    store.save(cuit, cert="c2", key="k2", ambiente="prod")

    with conn.cursor() as cur:
        cur.execute(
            "SELECT count(*) FROM uc_factory.afip_credentials "
            "WHERE cliente_id=%s AND cuit=%s AND activo", (tenant_a, cuit))
        assert cur.fetchone()[0] == 1


def test_get_sin_ambiente_devuelve_la_activa(conn_factory, tenant_a):
    """La emisión NO elige ambiente: usa el que el emprendedor dejó activo."""
    cuit = "20409378472"
    store = AfipCredentialStore(conn_factory, tenant_a, CryptoFake())
    store.save(cuit, cert="c-dev", key="k", ambiente="dev")
    store.save(cuit, cert="c-prod", key="k", ambiente="prod")   # activa la última guardada
    assert store.get(cuit)["ambiente"] == "prod"

    assert store.activar(cuit, "dev") is True
    assert store.get(cuit)["ambiente"] == "dev"


def test_activar_un_ambiente_sin_credencial_devuelve_false(conn_factory, tenant_a):
    """No es una excepción: es un caso del producto. El endpoint lo traduce a 409 + camino al alta."""
    cuit = "20409378472"
    store = AfipCredentialStore(conn_factory, tenant_a, CryptoFake())
    store.save(cuit, cert="c", key="k", ambiente="dev")
    assert store.activar(cuit, "prod") is False
    assert store.get(cuit)["ambiente"] == "dev", "un activar fallido no puede dejar al tenant sin activa"


def test_ambiente_invalido_no_llega_a_la_base(conn_factory, tenant_a):
    cuit = "20409378472"
    for llamada in (lambda s: s.save(cuit, cert="c", key="k", ambiente="staging"),
                    lambda s: s.activar(cuit, "staging")):
        with pytest.raises(ValueError):
            llamada(AfipCredentialStore(conn_factory, tenant_a, CryptoFake()))


def test_adversarial_el_ambiente_no_permite_leer_la_credencial_de_otro_tenant(
        conn_factory, tenant_a, tenant_b):
    """El parámetro nuevo no puede abrir una puerta lateral al aislamiento."""
    cuit = "20409378472"
    AfipCredentialStore(conn_factory, tenant_a, CryptoFake()).save(
        cuit, cert="cert-de-A", key="key-de-A", ambiente="prod")
    store_b = AfipCredentialStore(conn_factory, tenant_b, CryptoFake())
    assert store_b.get(cuit, "prod") is None
    assert store_b.ambientes_vinculados(cuit) == []
