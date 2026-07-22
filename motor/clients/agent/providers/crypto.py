"""Cifrado simétrico de secretos en reposo (capa PLANTILLA). Fernet (AES-128-CBC + HMAC).

La llave vive SOLO en el env (`COPILOTO_FERNET_KEY`); nunca en el repo. El token cifrado NO es
columna-clave → cifrarlo no rompe RLS/dedup (a diferencia de pgcrypto a nivel columna, prohibido por
convención).

**Por qué ya no se llama `MP_FERNET_KEY`** (renombrada el 2026-07-21). Nació para los tokens de
MercadoPago y después pasó a cifrar también el certificado fiscal de AFIP. El nombre quedó mintiendo
sobre su alcance, y eso tiene una consecuencia concreta: alguien rota "la llave de MercadoPago" y deja
ilegibles los certificados de AFIP sin entender por qué. El nombre de un secreto es documentación
operativa. El VALOR no cambió al renombrar, así que no hubo que re-cifrar nada.

**Rotación no destructiva.** `COPILOTO_FERNET_KEYS` acepta una LISTA separada por comas: la primera
cifra, todas descifran (`MultiFernet`). Sin esto, rotar significa dejar ilegible todo lo cifrado antes
—o sea: nadie rota nunca, y la llave vive para siempre—. Con esto la rotación es: poner la nueva
adelante, re-cifrar cuando convenga, sacar la vieja.
"""
from __future__ import annotations

import os

from cryptography.fernet import Fernet, MultiFernet

CLAVE_ENV = "COPILOTO_FERNET_KEY"
CLAVES_ENV = "COPILOTO_FERNET_KEYS"


class FernetCrypto:
    def __init__(self, *, key_env: str = CLAVE_ENV, keys_env: str = CLAVES_ENV) -> None:
        claves = self._leer_claves(key_env, keys_env)
        if not claves:
            raise RuntimeError(
                f"falta {key_env} (o {keys_env}) en el env (cargalo desde /etc/unreal-copilot/*.env)")
        # La PRIMERA cifra; todas descifran. Con una sola llave el comportamiento es idéntico al de
        # un Fernet pelado, así que esto no cambia nada hasta que efectivamente haya rotación.
        self._f = MultiFernet([Fernet(k.encode()) for k in claves])

    @staticmethod
    def _leer_claves(key_env: str, keys_env: str) -> list[str]:
        """`COPILOTO_FERNET_KEYS` (lista) tiene prioridad; si no está, la llave simple."""
        lista = os.environ.get(keys_env)
        if lista:
            return [k.strip() for k in lista.split(",") if k.strip()]
        una = os.environ.get(key_env)
        return [una.strip()] if una and una.strip() else []

    def encrypt(self, plaintext: str) -> str:
        return self._f.encrypt(plaintext.encode()).decode()

    def decrypt(self, token: str) -> str:
        return self._f.decrypt(token.encode()).decode()

    def rotate(self, token: str) -> str:
        """Re-cifra con la llave ACTUAL un token cifrado con una vieja. Para el barrido de rotación:
        descifrar+cifrar a mano expondría el plaintext en una variable intermedia sin necesidad."""
        return self._f.rotate(token.encode()).decode()

    @staticmethod
    def generate_key() -> str:
        """Genera una llave nueva (para ops: `python -c 'from ... import FernetCrypto; print(FernetCrypto.generate_key())'`)."""
        return Fernet.generate_key().decode()
