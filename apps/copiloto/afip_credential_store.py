"""Stores de AFIP (capa CLIENTE, multi-tenant): certificado, perfil fiscal y claim-check del secreto.

Aislamiento por tenant: igual que `mp_credential_store`, el filtro EXPLÍCITO por `cliente_id` en CADA
query es la barrera efectiva — el worker usa el rol owner de `DATABASE_URL`, que BYPASSA la policy RLS.
La policy protege sólo si algo accede con un rol no-owner (PostgREST/anon).

Tres responsabilidades separadas a propósito:

- `AfipCredentialStore`  — certificado + clave privada, cifrados. Es lo ÚNICO que persiste para facturar.
- `AfipPerfilStore`      — perfil fiscal del emisor (no es secreto, pero sin él no se puede emitir).
- `AfipSecretHandoff`    — claim-check de la clave fiscal. Ver la nota grande abajo.

🔴 **Por qué existe `AfipSecretHandoff`.** La clave fiscal de AFIP NO se almacena (decisión del operador,
2026-07-21): se usa una vez para generar el certificado y se descarta. Pero hay un segundo filo menos
obvio: **los argumentos de un workflow y de sus activities quedan grabados en claro en el event history
de Temporal, para siempre.** Pasar la clave como argumento la persistiría igual, aunque no la
guardáramos en ninguna tabla. Por eso el endpoint la deja acá cifrada con TTL corto, el workflow recibe
sólo un `handle` opaco, y la activity la consume (lee Y borra en una sola sentencia atómica). El history
nunca ve el secreto.
"""
from __future__ import annotations

import json
import uuid
from datetime import date
from typing import Callable

_SCHEMA = "uc_factory"
_T_CRED = f"{_SCHEMA}.afip_credentials"
_T_PERFIL = f"{_SCHEMA}.afip_perfil"
_T_HANDOFF = f"{_SCHEMA}.afip_secret_handoff"

TTL_HANDOFF_SEGUNDOS = 900  # 15 minutos: alcanza de sobra para el RPA de AfipSDK


class ClaveFiscal(str):
    """Envoltorio de la clave fiscal que NO se imprime.

    Un `print` de debug, un `logger.info(payload)` o un traceback con variables locales alcanzan para
    filtrar el secreto a un archivo de log que nadie está mirando. Enmascarar en `__repr__` no es
    paranoia: es la única defensa contra el descuido, que es el vector real.
    """

    __slots__ = ()

    def __repr__(self) -> str:
        return "<ClaveFiscal oculta>"

    def __str__(self) -> str:  # noqa: D105 - str() tampoco debe filtrarla
        return "<ClaveFiscal oculta>"

    def revelar(self) -> str:
        """Único camino explícito al valor. Que se vea feo en el call site es intencional."""
        return str.__str__(self)


class AfipCredentialStore:
    """Certificado + clave privada del emprendedor, cifrados con Fernet."""

    def __init__(self, conn_factory: Callable, cliente_id: str, crypto) -> None:
        self._conn_factory = conn_factory
        self._cid = cliente_id
        self._crypto = crypto

    def save(self, cuit: str, *, cert: str, key: str, ambiente: str = "dev",
             ws_autorizados: list[str] | None = None) -> None:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_T_CRED} "
                f"(cliente_id, cuit, cert_enc, key_enc, ambiente, ws_autorizados) "
                f"VALUES (%s,%s,%s,%s,%s,%s) "
                f"ON CONFLICT (cliente_id, cuit) DO UPDATE SET "
                f"cert_enc=EXCLUDED.cert_enc, key_enc=EXCLUDED.key_enc, "
                f"ambiente=EXCLUDED.ambiente, ws_autorizados=EXCLUDED.ws_autorizados, updated_at=now()",
                # `ws_autorizados` es jsonb: el provisioner no admite arrays nativos (`text[]` no está en
                # su allowlist de tipos), así que va serializado. Postgres castea el string a jsonb solo.
                (self._cid, cuit, self._crypto.encrypt(cert), self._crypto.encrypt(key),
                 ambiente, json.dumps(list(ws_autorizados or []))))

    def get(self, cuit: str) -> dict | None:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT cert_enc, key_enc, ambiente, ws_autorizados FROM {_T_CRED} "
                f"WHERE cliente_id=%s AND cuit=%s", (self._cid, cuit))
            row = cur.fetchone()
        if not row:
            return None
        cert_enc, key_enc, ambiente, ws = row
        return {"cert": self._crypto.decrypt(cert_enc), "key": self._crypto.decrypt(key_enc),
                "ambiente": ambiente, "ws_autorizados": list(ws or [])}

    def primer_cuit(self) -> str | None:
        """El CUIT más recientemente vinculado por ESTE tenant (MVP: un CUIT por emprendedor)."""
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT cuit FROM {_T_CRED} WHERE cliente_id=%s ORDER BY updated_at DESC LIMIT 1",
                (self._cid,))
            row = cur.fetchone()
        return row[0] if row else None

    def tiene_credencial(self, cuit: str) -> bool:
        return self.get(cuit) is not None


class AfipPerfilStore:
    """Perfil fiscal del emisor. Sin perfil completo no se habilita emitir (regla R7)."""

    def __init__(self, conn_factory: Callable, cliente_id: str) -> None:
        self._conn_factory = conn_factory
        self._cid = cliente_id

    def save(self, cuit: str, *, razon_social: str, domicilio_comercial: str, condicion_iva: str,
             ingresos_brutos: str, inicio_actividades: date, punto_venta: int) -> None:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_T_PERFIL} "
                f"(cliente_id, cuit, razon_social, domicilio_comercial, condicion_iva, "
                f"ingresos_brutos, inicio_actividades, punto_venta) "
                f"VALUES (%s,%s,%s,%s,%s,%s,%s,%s) "
                f"ON CONFLICT (cliente_id, cuit) DO UPDATE SET "
                f"razon_social=EXCLUDED.razon_social, domicilio_comercial=EXCLUDED.domicilio_comercial, "
                f"condicion_iva=EXCLUDED.condicion_iva, ingresos_brutos=EXCLUDED.ingresos_brutos, "
                f"inicio_actividades=EXCLUDED.inicio_actividades, punto_venta=EXCLUDED.punto_venta, "
                f"updated_at=now()",
                (self._cid, cuit, razon_social, domicilio_comercial, condicion_iva,
                 ingresos_brutos, inicio_actividades, punto_venta))

    def get(self, cuit: str) -> dict | None:
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT cuit, razon_social, domicilio_comercial, condicion_iva, ingresos_brutos, "
                f"inicio_actividades, punto_venta FROM {_T_PERFIL} "
                f"WHERE cliente_id=%s AND cuit=%s", (self._cid, cuit))
            row = cur.fetchone()
        if not row:
            return None
        campos = ("cuit", "razon_social", "domicilio_comercial", "condicion_iva",
                  "ingresos_brutos", "inicio_actividades", "punto_venta")
        return dict(zip(campos, row))


class AfipSecretHandoff:
    """Claim-check de la clave fiscal: entra por HTTPS, sale una sola vez, nunca toca el event history."""

    def __init__(self, conn_factory: Callable, cliente_id: str, crypto) -> None:
        self._conn_factory = conn_factory
        self._cid = cliente_id
        self._crypto = crypto

    def stash(self, clave: ClaveFiscal | str, *, ttl_segundos: int = TTL_HANDOFF_SEGUNDOS) -> str:
        """Guarda la clave cifrada y devuelve un handle opaco. Lo único que puede viajar a Temporal."""
        valor = clave.revelar() if isinstance(clave, ClaveFiscal) else clave
        handle = str(uuid.uuid4())
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"INSERT INTO {_T_HANDOFF} (cliente_id, handle, secreto_enc, expira_at) "
                f"VALUES (%s,%s,%s, now() + make_interval(secs => %s))",
                (self._cid, handle, self._crypto.encrypt(valor), ttl_segundos))
        return handle

    def consume(self, handle: str) -> ClaveFiscal | None:
        """Lee Y BORRA en una sola sentencia atómica. One-shot real, no 'leer y después borrar'.

        El `DELETE ... RETURNING` garantiza que dos consumidores concurrentes no puedan obtener ambos
        la clave: el segundo se lleva cero filas. Si en cambio hiciéramos SELECT y luego DELETE, entre
        ambos habría una ventana en la que el secreto es legible dos veces.
        """
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(
                f"DELETE FROM {_T_HANDOFF} WHERE cliente_id=%s AND handle=%s AND expira_at > now() "
                f"RETURNING secreto_enc", (self._cid, handle))
            row = cur.fetchone()
        if not row:
            return None
        return ClaveFiscal(self._crypto.decrypt(row[0]))

    def purgar_vencidos(self) -> int:
        """Higiene: un secreto vencido que nadie consumió no debe quedar en la tabla."""
        conn = self._conn_factory()
        with conn.cursor() as cur:
            cur.execute(f"DELETE FROM {_T_HANDOFF} WHERE expira_at <= now()")
            return cur.rowcount or 0
