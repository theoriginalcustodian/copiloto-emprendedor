"""El certificado de AFIP por vencer — el único fallo catastrófico que nadie veía venir.

Contexto de por qué existe esta regla: el certificado WSAA dura ~2 años y cuando vence se cae la
facturación entera de golpe. Es el dominio donde la autosanación NO puede entrar por diseño
(`autosanacion_gates.DOMINIOS_PROHIBIDOS`: el CAE es irreversible), así que la única defensa posible
es avisar ANTES. `mi_dia_detector` lo tenía declarado como deuda explícita ("...no tiene columna de
vencimiento en este schema todavía; queda fuera").

La mitad pura se testea con datos fijos (contrato §5). El parseo se testea contra un certificado
X.509 **de verdad**, generado en el test: un doble que devolviera una fecha fija no probaría nada
sobre `notAfter`, que es justamente lo único que esta regla necesita leer bien.
"""
from __future__ import annotations

import datetime

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

import mi_dia_detector as D
from afip_credential_store import (AfipCredentialStore, CertificadoIlegible,
                                   vencimiento_del_certificado)


def _certificado(vence_en_dias: int) -> str:
    """Un X.509 autofirmado real con `notAfter` a `vence_en_dias` de hoy. EC y no RSA: la generación
    es instantánea y a `notAfter` el algoritmo de la clave le da igual."""
    key = ec.generate_private_key(ec.SECP256R1())
    ahora = datetime.datetime.now(datetime.timezone.utc)
    nombre = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "test-afip")])
    cert = (x509.CertificateBuilder()
            .subject_name(nombre).issuer_name(nombre).public_key(key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(ahora - datetime.timedelta(days=1))
            .not_valid_after(ahora + datetime.timedelta(days=vence_en_dias))
            .sign(key, hashes.SHA256()))
    from cryptography.hazmat.primitives.serialization import Encoding
    return cert.public_bytes(Encoding.PEM).decode()


def _cand(dias: int | None = 10, *, ilegible: bool = False, cuit: str = "20111111112") -> dict:
    return {"cuit": cuit, "ambiente": "prod", "ilegible": ilegible, "dias_para_vencer": dias,
            "vence_at": None}


# ── La mitad pura ─────────────────────────────────────────────────────────────────────────────────

def test_dispara_dentro_de_la_ventana():
    r = D._evaluar_certificado_por_vencer([_cand(dias=10)])
    assert len(r) == 1
    assert r[0]["regla"] == D.REGLA_CERTIFICADO_POR_VENCER
    assert r[0]["entidad_id"] == "20111111112:prod"
    assert r[0]["datos"]["vencido"] is False


def test_NO_dispara_si_falta_mucho():
    assert D._evaluar_certificado_por_vencer([_cand(dias=D.DIAS_CERT_POR_VENCER + 1)]) == []


def test_CONTROL_el_borde_exacto_de_la_ventana_SI_dispara():
    """Control del test de arriba: sin esto, una regla que no disparara NUNCA lo pasaría igual."""
    assert len(D._evaluar_certificado_por_vencer([_cand(dias=D.DIAS_CERT_POR_VENCER)])) == 1


@pytest.mark.parametrize("dias", [-1, -30, -400])
def test_INVARIANTE_un_certificado_YA_VENCIDO_dispara_siempre(dias):
    """🔴 El test que protege la diferencia deliberada con la regla del CAE.

    `_evaluar_cae_por_vencer` excluye `dias < 0` a propósito ("ya vencido es otra alerta, no ésta") y
    para un comprobante puntual está bien. Copiar ese filtro acá —que es lo que haría cualquiera que
    mire la regla de al lado y busque simetría— apagaría el aviso justo en el estado peor: la
    facturación caída AHORA.

    Si alguien "corrige" la ventana a `0 <= dias <= 30`, este test cae y explica por qué.
    """
    r = D._evaluar_certificado_por_vencer([_cand(dias=dias)])
    assert len(r) == 1, "un certificado vencido no puede pasar en silencio"
    assert r[0]["datos"]["vencido"] is True


def test_INVARIANTE_un_certificado_ILEGIBLE_tambien_dispara():
    """Saltearlo dejaría la lista idéntica a la de un tenant sano: el vigilante ciego se vería igual
    que el vigilante sin nada que reportar."""
    r = D._evaluar_certificado_por_vencer([_cand(dias=None, ilegible=True)])
    assert len(r) == 1 and r[0]["datos"]["ilegible"] is True


def test_un_tenant_sin_certificados_no_dispara_nada():
    """El caso normal: no todos los emprendedores facturan por AFIP. Una regla que grita en el caso
    normal se termina ignorando."""
    assert D._evaluar_certificado_por_vencer([]) == []


def test_se_cierra_sola_al_renovar():
    """Renovar el certificado hace desaparecer el candidato — a diferencia del CAE, que no se renueva
    y por eso no está en `REGLAS_AUTO_CIERRE`."""
    assert D.REGLA_CERTIFICADO_POR_VENCER in D.REGLAS_AUTO_CIERRE


# ── El parseo, contra un certificado real ─────────────────────────────────────────────────────────

def test_lee_el_notAfter_de_un_certificado_DE_VERDAD():
    vence = vencimiento_del_certificado(_certificado(vence_en_dias=45))
    dias = (vence - datetime.datetime.now(datetime.timezone.utc)).days
    assert 43 <= dias <= 45, f"leyó {vence!r}"


def test_un_PEM_ilegible_LEVANTA_en_vez_de_devolver_None():
    """`None` significaría "sin vencimiento", que es un estado distinto y sano. Confundirlos apaga
    el aviso."""
    with pytest.raises(CertificadoIlegible):
        vencimiento_del_certificado("-----BEGIN CERTIFICATE-----\nno soy un cert\n")


# ── El store: que un cert roto NO desaparezca de la lista ─────────────────────────────────────────

class _Cur:
    def __init__(self, filas): self._filas = filas
    def __enter__(self): return self
    def __exit__(self, *a): return False
    def execute(self, *a, **k): pass
    def fetchall(self): return self._filas


class _Conn:
    def __init__(self, filas): self._filas = filas
    def cursor(self): return _Cur(self._filas)


class _CryptoFalso:
    """Descifra devolviendo lo mismo — acá lo que se ejercita es el armado de las filas, no Fernet."""
    def decrypt(self, v): return v


def _store(filas):
    return AfipCredentialStore(lambda: _Conn(filas), "cli-1", _CryptoFalso())


def test_el_store_marca_ilegible_en_vez_de_OMITIR_la_fila():
    """El modo de fallo que este test mata: un `except: continue` dejaría la lista vacía y el tenant
    con el certificado roto se vería igual que uno sin certificados."""
    filas = _store([("20111111112", "prod", "esto no es un PEM")]).vencimientos()
    assert len(filas) == 1, "la fila no puede desaparecer"
    assert filas[0]["ilegible"] is True and filas[0]["dias_para_vencer"] is None


def test_el_store_calcula_los_dias_desde_el_certificado():
    filas = _store([("20111111112", "prod", _certificado(vence_en_dias=20))]).vencimientos()
    assert filas[0]["ilegible"] is False
    assert 19 <= filas[0]["dias_para_vencer"] <= 20
