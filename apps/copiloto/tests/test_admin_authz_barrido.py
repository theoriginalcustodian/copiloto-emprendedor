"""Barrido adversarial de **todas** las rutas `/admin` del app de Consola.

Por qué hace falta un archivo nuevo y no alcanzaba con los que ya existen. El gate `require_admin`
está puesto en el código de cada ruta de `admin_web.py` (lo verifiqué ruta por ruta), pero sólo
**cuatro** de las nueve lo tenían ejercitado por un test hostil:

- `test_admin_web.py:40,47,54` → `/admin/salud` (403, escalada por `user_metadata`, 401);
- `test_admin_soporte_tickets.py:94` → las 3 de `/admin/soporte/tickets` (parametrizado).

Las otras cinco —`/admin/uso`, `/admin/errores`, `/admin/soporte`, `/admin/auditoria`,
`/admin/tenants/{cliente_id}/estado` y `/admin/errores/{id}/reintentar`— quedaban con el guard
escrito y **nada** que lo ejercitara. `test_admin_uso.py`, `test_admin_errores.py` y
`test_admin_soporte.py` existen, pero tienen **0 menciones de 403**: testean el store, no el gate.

Eso las dejaba `[UNVERIFIED]` por la regla dura del repo —un control de autorización sin test
adversarial es indistinguible de uno ausente— y la más grave es
`POST /admin/tenants/{cliente_id}/estado`, que **suspende o reactiva cualquier tenant**.

El ratchet no las cubre: `test_ratchet_endpoint_tenant_scope.py:85-99` clasifica todo `/admin/*`
como «cross-tenant por diseño» **por el nombre del path**, sin probar el guard. Si una ruta perdiera
su `Depends(require_admin)`, el ratchet seguiría verde — es un instrumento que mira el nombre, no el
comportamiento (`memoria/instrumento-que-no-mira-nunca-falla.md`).

**Por qué el barrido es dinámico sobre `app.routes` y no una lista a mano:** una lista a mano cubre
las rutas de hoy y no la que alguien agregue mañana sin el guard — que es el modo de falla real
(control especificado, nunca codificado, sin síntoma). Enumerando las rutas del app, una ruta nueva
entra al barrido **sola**. El precio de esa ganancia es que un barrido dinámico puede quedarse en
**cero casos** si el filtro se rompe, y un test de cero casos pasa siempre: por eso
`test_el_barrido_MIRA_algo` abajo es parte del control, no decoración.
"""
from __future__ import annotations

import re
import time

import jwt
import pytest
from fastapi.testclient import TestClient

from admin_web import create_admin_app
from auth import make_require_admin

SECRET = "test-secret-not-real"

# Mínimo que el barrido TIENE que ver. Medido sobre `admin_web.py` al escribir este archivo: 9 rutas
# con `Depends(require_admin)`. Si alguien agrega rutas, el barrido las toma solo y este piso sigue
# valiendo; si el filtro se rompe y el barrido se queda corto, falla acá y no en silencio.
RUTAS_ADMIN_MINIMAS = 9


def _app():
    """Sin `temporal_client` ni `conn_factory`: lo que se ejercita es el GATE, no el cuerpo.

    Una ruta que pasa el gate y no tiene su dependencia conectada responde 503 — y 503 es
    exactamente la prueba de que el gate se pasó, que es lo que un 403/401 impediría. Mismo
    razonamiento que `test_admin_web.py:33-35`.
    """
    return create_admin_app(require_admin=make_require_admin(secret=SECRET))


def _tok(claims: dict) -> str:
    base = {"sub": "u-1", "aud": "authenticated", "exp": int(time.time()) + 3600}
    return jwt.encode({**base, **claims}, SECRET, algorithm="HS256")


def _rutas_admin() -> list[tuple[str, str]]:
    """Cada `(metodo, path)` de `/admin/*`, con los path params ya rellenados."""
    out: list[tuple[str, str]] = []
    for r in _app().routes:
        path = getattr(r, "path", "")
        if not path.startswith("/admin"):
            continue
        for metodo in sorted(getattr(r, "methods", set()) - {"HEAD", "OPTIONS"}):
            out.append((metodo, re.sub(r"\{[^}]+\}", "x", path)))
    return sorted(set(out))


RUTAS = _rutas_admin()
IDS = [f"{m} {p}" for m, p in RUTAS]


def test_el_barrido_MIRA_algo():
    """CONTROL DE CEGUERA — va PRIMERO y sin depender de ningún otro.

    Un barrido parametrizado sobre una lista vacía reporta «todo verde» sin haber mirado nada. Este
    test es lo único que distingue «las 9 rutas pasaron el adversarial» de «el filtro devolvió 0».
    """
    assert len(RUTAS) >= RUTAS_ADMIN_MINIMAS, (
        f"el barrido sólo ve {len(RUTAS)} ruta(s) de /admin y esperaba >= {RUTAS_ADMIN_MINIMAS}: "
        f"el filtro se rompió y los adversariales de abajo estarían pasando en vacío. Vistas: {RUTAS}"
    )


@pytest.mark.parametrize("metodo,ruta", RUTAS, ids=IDS)
def test_ADVERSARIAL_sin_claim_de_admin_es_403(metodo, ruta):
    """Un usuario autenticado y SIN el claim no entra a ninguna ruta de la Consola."""
    resp = TestClient(_app()).request(
        metodo, ruta, headers={"Authorization": f"Bearer {_tok({})}"}, json={})
    assert resp.status_code == 403, f"{metodo} {ruta} respondió {resp.status_code}, esperaba 403"


@pytest.mark.parametrize("metodo,ruta", RUTAS, ids=IDS)
def test_ADVERSARIAL_escalada_por_user_metadata_es_403(metodo, ruta):
    """`user_metadata` es el único lugar que GoTrue deja auto-editar: no debe otorgar admin."""
    tok = _tok({"user_metadata": {"copiloto_admin": True}})
    resp = TestClient(_app()).request(
        metodo, ruta, headers={"Authorization": f"Bearer {tok}"}, json={})
    assert resp.status_code == 403, f"{metodo} {ruta} respondió {resp.status_code}, esperaba 403"


@pytest.mark.parametrize("metodo,ruta", RUTAS, ids=IDS)
def test_ADVERSARIAL_sin_header_es_401(metodo, ruta):
    resp = TestClient(_app()).request(metodo, ruta, json={})
    assert resp.status_code == 401, f"{metodo} {ruta} respondió {resp.status_code}, esperaba 401"


@pytest.mark.parametrize("metodo,ruta", RUTAS, ids=IDS)
def test_CONTROL_POSITIVO_con_el_claim_pasa_el_gate(metodo, ruta):
    """En la MISMA corrida que los adversariales, y es lo que los hace atribuibles.

    Sin esto, un 403 en todas las rutas probaría igual de bien que el gate funciona **o** que el app
    está roto para todos (`memoria/un-mecanismo-roto-hacia-el-no-no-da-sintoma.md`). Acá sólo se
    afirma que con el claim NO se ve 401/403: el status concreto (200, 422, 503) es asunto del cuerpo
    del endpoint, no del gate.
    """
    tok = _tok({"app_metadata": {"copiloto_admin": True}})
    resp = TestClient(_app()).request(
        metodo, ruta, headers={"Authorization": f"Bearer {tok}"}, json={})
    assert resp.status_code not in (401, 403), (
        f"{metodo} {ruta} dio {resp.status_code} CON el claim de admin: el gate no discrimina, "
        f"rechaza a todos, y los adversariales de arriba estarían pasando por el motivo equivocado"
    )
