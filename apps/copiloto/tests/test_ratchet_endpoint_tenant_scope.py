"""RATCH — ratchet de endpoint para el aislamiento cross-tenant.

Origen: `coordinacion/abierto/2026-09-23_dato_planificacion-a-backend_no-hay-ratchet-de-endpoint-
para-el-aislamiento-cross-tenant.md`, escalado a tarea en `coordinacion/PLAN.md` (fila RATCH). El
re-check A5 encontró la mitad que le faltaba al aislamiento cross-tenant: RLS tiene ratchet propio
(`test_rls_invariantes.py`, consulta `pg_policy` y no depende de ninguna lista), pero a nivel
ENDPOINT no había ninguno — `test_adversarial_multitenant.py` son 17 casos hostiles escritos a
mano que ejercitan un puñado de paths fijos, y nada rompía si una ruta tenant-scoped nueva se
sumaba sin su caso hostil. Es el modo de falla exacto de ADR-013 §3.3.4: un control especificado
pero nunca ejercitado, drift vivo ~2 meses hasta que lo cazó un spike externo. Este archivo es el
aviso ANTES del incidente, no después.

## Qué hace (y qué NO hace)

1. Arma el front-door COMPLETO con los 10 sub-apps reales (mismo set que `serve.py`) y enumera
   `app.routes` -- fuente de verdad, no una lista a mano (mismo patrón que
   `test_rls_invariantes.py` consulta `pg_policy` en vez de mantener una lista de tablas).
2. Clasifica cada ruta en exactamente una de tres categorías:
   - **tenant-scoped**: su firma resuelve `cliente_id` vía `Depends(require_tenant)` -- detectado
     por IDENTIDAD del callable (la misma instancia se pasa a los 11 `create_*_app`, igual que
     `serve.py` hace en producción), no por nombre de parámetro.
   - **cross-tenant por diseño**: excepción EXPLÍCITA y con motivo (`_CROSS_TENANT_POR_DISENO`) --
     hoy sólo `/admin/*` (usa `require_admin`, ve TODOS los tenants a propósito).
   - **sin estado**: excepción EXPLÍCITA y con motivo (`_SIN_ESTADO`) -- rutas que no leen dato de
     ningún tenant (`/healthz`, `/auth/signup` antes de que exista tenant, `/mp/callback`+`/mp/
     webhook` que autentican por firma/state cifrado y no por JWT, el SPA catch-all).
   - Una ruta que no cae en ninguna de las tres -> el test FALLA nombrándola. Así se cierra el
     "no bloquea nada": una ruta nueva sin clasificar rompe el ratchet, no queda silenciosa.
3. De las tenant-scoped, separa las que YA ejercita `test_adversarial_multitenant.py` -- ese
   conjunto se EXTRAE por AST del archivo real (no se hand-listea "7" ni "8": los dos números que
   circularon en el buzón esta noche quedan obsoletos apenas ese archivo cambie, el ratchet no).
4. Lo que queda (tenant-scoped, sin caso hostil) es DEUDA -- hoy es real y grande (~80 rutas: AFIP,
   presupuestos, gastos, clientes, contabilidad, inteligencia, mi-dia, el front-door directo).
   Escribir los 80 casos hostiles NO es el alcance de RATCH (ver el dato original: "no bloqueante,
   no es para este sprint"). Lo que el ratchet exige es que esa deuda sea VISIBLE y CONTADA, no
   impaga-e-invisible (regla del repo, `cero-deuda-no-gestionada`): `_DEUDA_TENANT_SCOPED_SIN_TEST`
   fija el número exacto medido hoy. Sumar una ruta tenant-scoped nueva sin adversarial test SUBE
   ese número -> el ratchet la detecta aunque nadie la haya nombrado (control positivo: abajo hay
   un test que inyecta una ruta fake y prueba que el conteo la atrapa). Bajar el número (alguien
   escribe el caso hostil que faltaba) también rompe el ratchet -- a propósito: obliga a bajar el
   número a mano, dejando ese progreso escrito en el diff en vez de que se pierda en silencio.

## Reutilización (regla del repo, §0 de todo diseño)

- El iterador de `app.routes` ya existía en `test_web_app.py` (`_route_endpoint`, ratchet de
  ESCALA `def`/`async def` sobre lista fija) -- acá se generaliza a una enumeración real y a un
  ratchet de AUTORIZACIÓN, no de escala.
- La forma "consultar la fuente en vez de mantener una lista" es la de `test_rls_invariantes.py`.
- Las fakes de construcción (`WebChannelAdapter`, `FernetCrypto`, `_build_app`) son las mismas que
  `test_web_app.py` ya usa para construir el front-door sin infra real.
"""
from __future__ import annotations

import ast
import inspect
from pathlib import Path
from typing import Callable

import pytest
from fastapi import Depends, FastAPI

import web as web_module
from actividad_web import create_actividad_app
from admin_web import create_admin_app
from afip_web import create_afip_app
from clientes_web import create_clientes_app
from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.crypto import FernetCrypto
from contabilidad_web import create_contabilidad_app
from gastos_web import create_gastos_app
from inteligencia_web import create_inteligencia_app
from mi_dia_web import create_mi_dia_app
from mp_web import create_mp_app
from presupuestos_web import create_presupuestos_app


# --- Excepciones EXPLÍCITAS y con motivo (nunca por ausencia/olvido) ---------------------------

def _cross_tenant_por_diseno() -> dict[str, str]:
    return {
        "/admin/salud": "Consola de Operador (CONS0b): usa require_admin, ve TODOS los tenants a propósito.",
        "/admin/uso": "ídem — Consola de Operador.",
        "/admin/errores": "ídem — Consola de Operador.",
        "/admin/soporte": "ídem — Consola de Operador.",
        "/admin/auditoria": "ídem — Consola de Operador.",
        "/admin/tenants": "ídem — Consola de Operador.",
        "/admin/tenants/{cliente_id}/estado": "ídem — Consola de Operador; el cliente_id viaja por PATH, no por Depends(require_tenant), justamente porque opera sobre un tenant ajeno por diseño.",
        "/admin/errores/{trauma_id}/reintentar": "ídem — Consola de Operador.",
        "/admin/soporte/tickets": "ídem — Consola de Operador.",
        "/admin/soporte/tickets/{ticket_id}": "ídem — Consola de Operador.",
        "/admin/feedback/{feedback_id}/escuchado": "ídem — Consola de Operador.",
        "/admin/soporte/tickets/{ticket_id}/responder": "ídem — Consola de Operador.",
    }


def _sin_estado() -> dict[str, str]:
    return {
        "/healthz": "liveness probe, no lee dato de ningún tenant.",
        "/{full_path:path}": "SPA catch-all (sirve el build de React), no toca la API.",
        "/auth/signup": "no hay tenant todavía -- este endpoint lo CREA.",
        "/auth/login": "autentica contra GoTrue, no resuelve cliente_id.",
        "/auth/refresh": "rota un refresh token, no resuelve cliente_id.",
        "/auth/google/id-token": "intercambia un id_token de Google, no resuelve cliente_id.",
        "/auth/oauth/ensure-tenant": "resuelve `claims` vía Depends(require_claims), NO require_tenant -- flujo OAuth Google (web.py:1327): puede ser la primera vez que ese usuario aparece, así que todavía no hay tenant para resolver; este endpoint decide si CREA uno.",
        "/mp/callback": "autentica por `state` cifrado (Fernet), no por JWT de tenant -- construido en create_mp_app, sin Depends(require_tenant) por diseño (ver docstring de mp_web.py).",
        "/mp/webhook": "autentica por firma `x-signature` de MercadoPago, no por JWT de tenant.",
    }


_CROSS_TENANT_POR_DISENO = _cross_tenant_por_diseno()
_SIN_ESTADO = _sin_estado()

# Rutas que FastAPI agrega SOLO por tener un `FastAPI()` instanciado (Swagger/Redoc/OpenAPI schema) --
# no son superficie de la aplicación, no dependen de ningún dato de tenant, y aparecen tanto en el
# front-door real como en el mini-app del control positivo. Se descartan ANTES de clasificar, no se
# fuerzan a una de las tres categorías.
_RUTAS_DE_FRAMEWORK = {"/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"}


@pytest.fixture(autouse=True)
def _fernet_key_env(monkeypatch):
    """`create_mp_app`/`create_web_app` construyen un `FernetCrypto()` propio (mismo patrón que
    `test_web_app.py::_mp_fernet_key_env`) -- necesita `COPILOTO_FERNET_KEY` en el env aunque acá
    nunca se cifre nada de verdad, sólo se inspeccionan firmas de endpoints."""
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())

# Medido 2026-09-23 corriendo este mismo archivo contra el front-door COMPLETO (11 sub-apps reales,
# `app.routes` desenvuelto recursivamente -- ver `_rutas_reales`). Bajar este número a mano cuando
# alguien cierre un caso hostil nuevo; subirlo a mano -- con motivo en el commit -- cuando una ruta
# tenant-scoped nueva entra sin test adversarial todavía. Lo que el ratchet prohíbe es que suba SOLO,
# sin que nadie lo note.
_DEUDA_TENANT_SCOPED_SIN_TEST = 68


# --- Construcción del front-door COMPLETO (mismo set de sub-apps que serve.py) ------------------

def _noop(*_a, **_k):
    return None


def _require_tenant_marker() -> Callable[[], str]:
    """Identidad ESTABLE: el ratchet detecta `Depends(require_tenant)` por `is`, igual que FastAPI
    resuelve la dependencia en runtime. Por eso la MISMA instancia se pasa a los 11 create_*_app,
    calcando lo que `serve.py` hace con el `require_tenant` real."""
    def _dep() -> str:
        return "cid-ratchet"
    return _dep


def _require_admin_marker() -> Callable[[], dict]:
    def _dep() -> dict:
        return {"role": "admin"}
    return _dep


def _require_claims_marker() -> Callable[[], dict]:
    def _dep() -> dict:
        return {"sub": "auth-ratchet"}
    return _dep


def _build_full_app() -> tuple[FastAPI, Callable]:
    """Arma el front-door con los MISMOS 10 sub-apps que `serve.py` inyecta en producción (línea
    300-311 de `serve.py`), con factories dummy -- ninguna ruta se invoca acá, sólo se inspecciona
    su firma, así que las factories nunca corren."""
    require_tenant = _require_tenant_marker()
    require_admin = _require_admin_marker()
    require_claims = _require_claims_marker()

    mp_app = create_mp_app(gateway=None, crypto=FernetCrypto(),
                            cred_store_factory=_noop, payment_store_factory=_noop)
    afip_app = create_afip_app(require_tenant=require_tenant, perfil_store_factory=_noop,
                                cred_store_factory=_noop, handoff_factory=_noop,
                                start_onboarding=_noop)
    presupuestos_app = create_presupuestos_app(require_tenant=require_tenant,
                                                perfil_negocio_store_factory=_noop,
                                                presupuesto_store_factory=_noop)
    gastos_app = create_gastos_app(require_tenant=require_tenant, gasto_store_factory=_noop)
    clientes_app = create_clientes_app(require_tenant=require_tenant, cliente_store_factory=_noop)
    contabilidad_app = create_contabilidad_app(require_tenant=require_tenant,
                                                cobro_store_factory=_noop, gasto_store_factory=_noop,
                                                afip_comprobante_store_factory=_noop)
    actividad_app = create_actividad_app(require_tenant=require_tenant)
    admin_app = create_admin_app(require_admin=require_admin)
    inteligencia_app = create_inteligencia_app(require_tenant=require_tenant)
    mi_dia_app = create_mi_dia_app(require_tenant=require_tenant)

    app = web_module.create_web_app(
        temporal_client=None,
        adapter=WebChannelAdapter(reply_sink=lambda *a: None),
        conn_factory=_noop,
        require_tenant=require_tenant,
        require_claims=require_claims,
        mp_app=mp_app,
        gotrue=None,
        mp_gateway=None,
        composio_gateway=None,
        afip_app=afip_app,
        presupuestos_app=presupuestos_app,
        gastos_app=gastos_app,
        clientes_app=clientes_app,
        contabilidad_app=contabilidad_app,
        actividad_app=actividad_app,
        inteligencia_app=inteligencia_app,
        mi_dia_app=mi_dia_app,
        admin_app=admin_app,
    )
    return app, require_tenant


def _es_tenant_scoped(endpoint, require_tenant: Callable) -> bool:
    """Detección por IDENTIDAD del callable, no por nombre de parámetro -- un endpoint que se
    llamara `cliente_id: str = Depends(otra_cosa)` NO cuenta, que es justo el caso que regla 7
    del CLAUDE.md del repo prohíbe (`cliente_id` nunca por querystring ni por una dependencia
    distinta a `require_tenant`)."""
    sig = inspect.signature(endpoint)
    for param in sig.parameters.values():
        default = param.default
        if isinstance(default, type(Depends())) and default.dependency is require_tenant:
            return True
    return False


def _rutas_reales(routes) -> list:
    """`app.routes` NO es plana: FastAPI >=0.13x (medido: 0.138.2) NO copia las rutas de un
    sub-app incluido -- las envuelve en un `_IncludedRouter` lazy (optimización de arranque) que
    referencia el `APIRouter` original. Confirmado empíricamente (ver historia de esta sesión:
    `test_web_app.py` ya lo documentaba para `/actividad` en un docstring de 2026-07, que este
    archivo antes no le había creído). Se camina recursivo por duck-typing (`original_router`) en
    vez de importar `fastapi.routing._IncludedRouter` (privado) -- mismo efecto, menos acoplado al
    nombre interno exacto."""
    reales: list = []
    for route in routes:
        anidado = getattr(route, "original_router", None)
        if anidado is not None:
            reales.extend(_rutas_reales(anidado.routes))
        elif hasattr(route, "path") and hasattr(route, "endpoint"):
            reales.append(route)
    return reales


def _clasificar_rutas(app: FastAPI, require_tenant: Callable) -> dict[str, list[str]]:
    tenant_scoped: list[str] = []
    cross_tenant: list[str] = []
    sin_estado: list[str] = []
    sin_clasificar: list[str] = []

    for route in _rutas_reales(app.routes):
        path = getattr(route, "path", None)
        endpoint = getattr(route, "endpoint", None)
        if path is None or endpoint is None or path in _RUTAS_DE_FRAMEWORK:
            continue
        if _es_tenant_scoped(endpoint, require_tenant):
            tenant_scoped.append(path)
        elif path in _CROSS_TENANT_POR_DISENO:
            cross_tenant.append(path)
        elif path in _SIN_ESTADO:
            sin_estado.append(path)
        else:
            sin_clasificar.append(path)

    return {
        "tenant_scoped": sorted(set(tenant_scoped)),
        "cross_tenant_por_diseno": sorted(set(cross_tenant)),
        "sin_estado": sorted(set(sin_estado)),
        "sin_clasificar": sorted(set(sin_clasificar)),
    }


# --- Paths que YA ejercita test_adversarial_multitenant.py, extraídos por AST -------------------
# Reemplaza el "7" (o "8") que circuló esta noche en el buzón: se mide contra el archivo real en
# cada corrida, no se cita de memoria.

_VERBOS_HTTP = {"get", "post", "put", "patch", "delete"}


def _paths_ejercitados_por_adversarial() -> set[str]:
    ruta = Path(__file__).with_name("test_adversarial_multitenant.py")
    arbol = ast.parse(ruta.read_text(encoding="utf-8"), filename=str(ruta))
    paths: set[str] = set()
    for nodo in ast.walk(arbol):
        if not isinstance(nodo, ast.Call):
            continue
        func = nodo.func
        if not isinstance(func, ast.Attribute) or func.attr not in _VERBOS_HTTP:
            continue
        if not nodo.args:
            continue
        primero = nodo.args[0]
        if isinstance(primero, ast.Constant) and isinstance(primero.value, str) \
                and primero.value.startswith("/"):
            paths.add(primero.value)
    return paths


# --- El ratchet ----------------------------------------------------------------------------------

def test_toda_ruta_del_frontdoor_esta_clasificada_tenant_scoped_cross_tenant_o_sin_estado():
    """Ninguna ruta puede quedar sin clasificar. Si esto falla, la ruta nombrada es NUEVA y no
    entra en ninguna de las tres categorías -- agregala a `_CROSS_TENANT_POR_DISENO` o
    `_SIN_ESTADO` con motivo explícito, o dejá que caiga en tenant-scoped si de verdad usa
    `Depends(require_tenant)`."""
    app, require_tenant = _build_full_app()
    clasificacion = _clasificar_rutas(app, require_tenant)
    assert clasificacion["sin_clasificar"] == [], (
        f"Rutas nuevas sin clasificar (agregalas a _CROSS_TENANT_POR_DISENO o _SIN_ESTADO, con "
        f"motivo, o confirmá que deberían depender de require_tenant): {clasificacion['sin_clasificar']}"
    )


def test_deuda_de_cobertura_adversarial_no_crece_en_silencio():
    """El ratchet en sí: cuenta las rutas tenant-scoped SIN caso hostil en
    test_adversarial_multitenant.py y la compara contra `_DEUDA_TENANT_SCOPED_SIN_TEST`, el número
    medido hoy (2026-09-23). Subir la deuda sin bajar este número a mano -> rojo (la regresión que
    ADR-013 §3.3.4 pagó 2 meses después). Bajar la deuda (alguien escribe el caso hostil que
    faltaba) sin bajar este número -> también rojo, a propósito: el progreso se declara, no se
    pierde en el ruido."""
    app, require_tenant = _build_full_app()
    clasificacion = _clasificar_rutas(app, require_tenant)
    cubiertas = _paths_ejercitados_por_adversarial()
    sin_cobertura = sorted(set(clasificacion["tenant_scoped"]) - cubiertas)

    assert len(sin_cobertura) == _DEUDA_TENANT_SCOPED_SIN_TEST, (
        f"La deuda de rutas tenant-scoped sin test adversarial pasó de "
        f"{_DEUDA_TENANT_SCOPED_SIN_TEST} a {len(sin_cobertura)}. Si SUBIÓ: una ruta nueva entró "
        f"sin su caso hostil en test_adversarial_multitenant.py -- escribilo, o si es deuda "
        f"deliberada, subí `_DEUDA_TENANT_SCOPED_SIN_TEST` a {len(sin_cobertura)} con el motivo "
        f"en el commit. Si BAJÓ: buena noticia, bajá el número a {len(sin_cobertura)}. "
        f"Conjunto actual: {sin_cobertura}"
    )


def test_el_conteo_de_cobertura_coincide_con_lo_que_cita_el_buzon():
    """Documenta, no ratchea: cuántos paths distintos ejercita HOY test_adversarial_multitenant.py
    por AST. El dato original citaba 7; con /me/legal/aceptar (BL-O6 Parte B, recién mergeada) ya
    son 8. Este test es el que resuelve esa discrepancia contra el archivo real en vez de que quede
    como un número citado de memoria."""
    cubiertas = _paths_ejercitados_por_adversarial()
    assert cubiertas == {
        "/mi-dia/calendario", "/reply", "/me", "/catalog", "/mp/connection",
        "/me/onboarding/completar", "/me/legal/aceptar", "/feedback",
    }


# --- Control positivo: una ruta tenant-scoped nueva y sin cobertura tiene que romper el ratchet --

def test_control_positivo_una_ruta_fake_sin_cobertura_rompe_el_ratchet():
    """Sin esto, los dos tests de arriba podrían estar siempre en verde por construcción (ningún
    caso ejercita jamás la rama de falla) y nadie lo notaría -- el mismo modo de falla que este
    ratchet existe para cerrar, aplicado a sí mismo. Se arma un front-door mínimo con UNA ruta
    tenant-scoped deliberadamente fuera de `_CROSS_TENANT_POR_DISENO`/`_SIN_ESTADO` y sin caso
    hostil, y se prueba que la clasificación la cuenta como deuda nueva."""
    require_tenant = _require_tenant_marker()
    app = FastAPI()

    @app.get("/ratchet-control-positivo-fake-e2e2f4")
    def _fake(cliente_id: str = Depends(require_tenant)) -> dict:
        return {"cliente_id": cliente_id}

    clasificacion = _clasificar_rutas(app, require_tenant)
    assert clasificacion["sin_clasificar"] == []
    assert "/ratchet-control-positivo-fake-e2e2f4" in clasificacion["tenant_scoped"]

    cubiertas = _paths_ejercitados_por_adversarial()
    assert "/ratchet-control-positivo-fake-e2e2f4" not in cubiertas, \
        "el path del control positivo no puede coincidir con uno real cubierto"


@pytest.mark.parametrize("path,motivo_no_vacio", list(_CROSS_TENANT_POR_DISENO.items()))
def test_cada_excepcion_cross_tenant_tiene_motivo_explicito(path, motivo_no_vacio):
    assert isinstance(motivo_no_vacio, str) and len(motivo_no_vacio) > 10


@pytest.mark.parametrize("path,motivo_no_vacio", list(_SIN_ESTADO.items()))
def test_cada_excepcion_sin_estado_tiene_motivo_explicito(path, motivo_no_vacio):
    assert isinstance(motivo_no_vacio, str) and len(motivo_no_vacio) > 10
