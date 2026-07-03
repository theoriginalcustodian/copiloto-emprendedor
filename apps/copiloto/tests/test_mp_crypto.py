import sys
from pathlib import Path
import pytest

ARCH = Path(__file__).resolve().parents[2] / "deploy/skeleton_kit/archetypes/conversational_agent/reference"
sys.path.insert(0, str(ARCH))
from clients.agent.providers.crypto import FernetCrypto  # noqa: E402


def test_roundtrip(monkeypatch):
    monkeypatch.setenv("MP_FERNET_KEY", FernetCrypto.generate_key())
    c = FernetCrypto()
    enc = c.encrypt("APP_USR-6186-token")
    assert enc != "APP_USR-6186-token"          # está cifrado, no en claro
    assert c.decrypt(enc) == "APP_USR-6186-token"


def test_missing_key_fails_closed(monkeypatch):
    monkeypatch.delenv("MP_FERNET_KEY", raising=False)
    with pytest.raises(RuntimeError):
        FernetCrypto()


def test_wrong_key_cannot_decrypt(monkeypatch):
    from cryptography.fernet import InvalidToken
    monkeypatch.setenv("MP_FERNET_KEY", FernetCrypto.generate_key())
    enc = FernetCrypto().encrypt("secreto")
    monkeypatch.setenv("MP_FERNET_KEY", FernetCrypto.generate_key())  # otra llave
    with pytest.raises(InvalidToken):
        FernetCrypto().decrypt(enc)
