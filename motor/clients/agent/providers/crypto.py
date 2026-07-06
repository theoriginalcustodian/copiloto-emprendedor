"""Cifrado simétrico de secretos en reposo (capa PLANTILLA). Fernet (AES-128-CBC + HMAC).
La llave vive SOLO en el env (MP_FERNET_KEY); nunca en el repo. El token cifrado NO es columna-clave
→ cifrarlo no rompe RLS/dedup (a diferencia de pgcrypto a nivel columna, prohibido por convención)."""
from __future__ import annotations

import os

from cryptography.fernet import Fernet


class FernetCrypto:
    def __init__(self, *, key_env: str = "MP_FERNET_KEY") -> None:
        key = os.environ.get(key_env)
        if not key:
            raise RuntimeError(f"falta {key_env} en el env (cargalo desde /etc/unreal-copilot/*.env)")
        self._f = Fernet(key.encode() if isinstance(key, str) else key)

    def encrypt(self, plaintext: str) -> str:
        return self._f.encrypt(plaintext.encode()).decode()

    def decrypt(self, token: str) -> str:
        return self._f.decrypt(token.encode()).decode()

    @staticmethod
    def generate_key() -> str:
        """Genera una llave nueva (para ops: `python -c 'from ... import FernetCrypto; print(FernetCrypto.generate_key())'`)."""
        return Fernet.generate_key().decode()
