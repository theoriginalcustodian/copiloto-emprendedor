import sys
from pathlib import Path
import pytest

from clients.agent.providers.crypto import FernetCrypto  # noqa: E402


def test_roundtrip(monkeypatch):
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())
    c = FernetCrypto()
    enc = c.encrypt("APP_USR-6186-token")
    assert enc != "APP_USR-6186-token"          # está cifrado, no en claro
    assert c.decrypt(enc) == "APP_USR-6186-token"


def test_missing_key_fails_closed(monkeypatch):
    monkeypatch.delenv("COPILOTO_FERNET_KEY", raising=False)
    with pytest.raises(RuntimeError):
        FernetCrypto()


def test_wrong_key_cannot_decrypt(monkeypatch):
    from cryptography.fernet import InvalidToken
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())
    enc = FernetCrypto().encrypt("secreto")
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())  # otra llave
    with pytest.raises(InvalidToken):
        FernetCrypto().decrypt(enc)


# ---------------------------------------------------------------------------
# Rotación no destructiva (deuda saldada 2026-07-21)
# ---------------------------------------------------------------------------


def test_la_llave_ya_no_se_llama_mp(monkeypatch):
    """El nombre de un secreto es documentación operativa: `MP_FERNET_KEY` decía "esto es de
    MercadoPago" mientras cifraba además el certificado fiscal de AFIP."""
    monkeypatch.delenv("COPILOTO_FERNET_KEY", raising=False)
    monkeypatch.setenv("MP_FERNET_KEY", FernetCrypto.generate_key())
    with pytest.raises(RuntimeError):
        FernetCrypto()


def test_rotacion_una_llave_nueva_sigue_leyendo_lo_viejo(monkeypatch):
    """El punto entero de MultiFernet: sin esto, rotar deja ilegible todo lo cifrado antes — o sea,
    nadie rota nunca y la llave vive para siempre."""
    vieja = FernetCrypto.generate_key()
    monkeypatch.setenv("COPILOTO_FERNET_KEY", vieja)
    token = FernetCrypto().encrypt("secreto-de-ayer")

    nueva = FernetCrypto.generate_key()
    monkeypatch.delenv("COPILOTO_FERNET_KEY", raising=False)
    monkeypatch.setenv("COPILOTO_FERNET_KEYS", f"{nueva},{vieja}")   # la primera cifra, todas descifran
    c = FernetCrypto()
    assert c.decrypt(token) == "secreto-de-ayer"

    # Y lo NUEVO se cifra con la nueva: sacar la vieja después no rompe nada re-cifrado.
    token_nuevo = c.encrypt("secreto-de-hoy")
    monkeypatch.delenv("COPILOTO_FERNET_KEYS", raising=False)
    monkeypatch.setenv("COPILOTO_FERNET_KEY", nueva)
    assert FernetCrypto().decrypt(token_nuevo) == "secreto-de-hoy"


def test_rotate_reencripta_sin_exponer_el_plaintext(monkeypatch):
    vieja = FernetCrypto.generate_key()
    monkeypatch.setenv("COPILOTO_FERNET_KEY", vieja)
    token = FernetCrypto().encrypt("dato")

    nueva = FernetCrypto.generate_key()
    monkeypatch.delenv("COPILOTO_FERNET_KEY", raising=False)
    monkeypatch.setenv("COPILOTO_FERNET_KEYS", f"{nueva},{vieja}")
    rotado = FernetCrypto().rotate(token)

    monkeypatch.delenv("COPILOTO_FERNET_KEYS", raising=False)
    monkeypatch.setenv("COPILOTO_FERNET_KEY", nueva)   # ya sin la vieja
    assert FernetCrypto().decrypt(rotado) == "dato"
