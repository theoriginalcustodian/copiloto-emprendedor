"""Wiring REAL del `workflow_id` del router de mensajes — el GEMELO de `test_wf_id_wiring_adversarial.py`
del otro lado del boundary (hallazgo C del barrido de autorización, 2026-10-06).

QUÉ PRUEBA: que el `id=` con el que los CUATRO endpoints de ruteo arrancan un ConversationWorkflow sale
del `cliente_id` del token, ejercitando el código REAL de `route_inbound` + `workflow_id_for`
(`motor/backend/agent/inbound_router.py:17,32,37`) y el `WebChannelAdapter` real.

POR QUÉ NO LO CUBRÍA NADA. `workflow_id_for` aparecía DOS veces en el repo entero: su definición (`:17`)
y su único llamador (`:32`). Cero en tests. Los tres archivos que ejercitan estos endpoints
monkeypatchean `route_inbound` COMPLETO con un fake que RE-IMPLEMENTA la fórmula
(`test_web_app.py:46`, `test_audio.py:38`, `test_soporte_audio.py:30`):

    return f"conv-web-{cliente_id}-{msg.channel_ref}"

…y después afirman sobre lo que ese fake devolvió. `test_web_app.py:326` incluso lo comenta
«# cliente_id vino del token, NUNCA hardcoded»: el comentario describe lo que el test QUIERE probar, no
lo que PUEDE ver — el valor lo produjo el f-string del propio archivo de test. Si `workflow_id_for`
dejara de poner el `cliente_id` en el id, los tres archivos seguirían VERDES y dos emprendedores
compartirían el mismo ConversationWorkflow.

CÓMO LO EVITA: acá NO se monkeypatchea `route_inbound`. El único doble es el cliente Temporal, y
registra el kwarg `id=` EXACTO que recibe, sin recomponerlo. Ese fue el defecto que volvió circular al
primer adversarial del gemelo (#820): un espía que re-compone el id prueba el contrato del espía.

DIFERENCIA MEDIDA CONTRA EL GEMELO — la pregunta «¿es el mismo defecto o sólo la misma línea?»: la
fórmula y su dependencia son las MISMAS (el `cliente_id` sale de `Depends(require_tenant)`, el
`channel_ref` del request), así que el defecto porta. Pero la cadena de ejecución difiere, y en la
dirección que lo hacía PEOR: en `web.py` las 6 fábricas sí corrían con su código real y mentía sólo el
instrumento; acá el productor real NO SE EJECUTABA EN NINGÚN TEST.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import web as web_module
from backend.agent import inbound_router
from clients.agent.channels.web import WebChannelAdapter
from clients.agent.providers.crypto import FernetCrypto

TENANT_A = "cid-A"
TENANT_B = "cid-B"
SESSION = "s1"
FUNCION_SOPORTE = "soporte_tecnico"

# D6 (mismo criterio que test_audio.py:77): firma EBML real. `web.py` valida magic bytes, y un blob sin
# firma se rechaza con 415 ANTES de rutear — el test quedaría verde sin ejercitar el ruteo.
_WEBM_HEADER = b"\x1a\x45\xdf\xa3"


# --- el ÚNICO doble: el cliente Temporal --------------------------------------------

class _HandleFake:
    """Lo que devuelve `start_workflow`. `route_inbound` lo ignora (`inbound_router.py:33`), pero
    devolver algo inocuo evita que un AttributeError enmascare el registro del id."""

    id = "handle-fake"

    async def signal(self, *a, **kw):
        return None


class _ClienteEspia:
    """Doble del cliente Temporal.

    REGLA DURA: registra el kwarg `id=` TAL CUAL llega. Nunca lo recompone a partir de
    `cliente_id`/`channel_ref` — un espía que reconstruye el id prueba su propia fórmula y no el wiring
    de producción (defecto circular cerrado en #820)."""

    def __init__(self) -> None:
        self.ids: list[str] = []
        self.payloads: list[dict] = []

    async def start_workflow(self, *args, **kw):
        self.ids.append(kw["id"])                      # EXACTO, sin derivar nada
        if len(args) >= 2 and isinstance(args[1], dict):
            self.payloads.append(args[1])              # el config de arranque (`inbound_router.py:35`)
        return _HandleFake()


class _FakeMpGateway:
    def connect_url(self, state):
        return f"https://mp.example/auth?state={state}"


class _FakeComposioGateway:
    def list_connections(self, user_id):
        return []

    def authorize(self, user_id, toolkit):
        return "https://composio.example/connect"


@pytest.fixture(autouse=True)
def _fernet_key_env(monkeypatch):
    """`create_web_app` construye su propio `FernetCrypto()` para /me/mp-connect sin importar qué rutas
    ejercite este archivo — mismo fixture que el resto de la suite de web.py."""
    monkeypatch.setenv("COPILOTO_FERNET_KEY", FernetCrypto.generate_key())


def _build_app(cliente_id: str, espia: _ClienteEspia):
    """Mismo constructor que `test_audio.py:60`, con DOS diferencias deliberadas: el `temporal_client`
    es el espía (no un stand-in vacío) y NO se monkeypatchea `route_inbound`."""
    return web_module.create_web_app(
        temporal_client=espia,
        adapter=WebChannelAdapter(reply_sink=lambda *a, **kw: None),
        conn_factory=lambda: None,       # el ruteo no toca DB; /me y /auth ya están en test_web_app.py
        require_tenant=lambda: cliente_id,
        mp_app=FastAPI(),
        gotrue=None,
        mp_gateway=_FakeMpGateway(),
        composio_gateway=_FakeComposioGateway(),
        transcribe=lambda audio_bytes, content_type: "hola",
    )


# --- los CUATRO endpoints de ruteo, con el channel_ref que cada uno compone ----------

def _audio_multipart() -> dict:
    return {"audio": ("clip.webm", _WEBM_HEADER + b"fake-audio-bytes", "audio/webm")}


def _post_chat(cli):
    return cli.post("/chat", json={"session_id": SESSION, "text": "hola"})


def _post_chat_audio(cli):
    return cli.post("/chat/audio", data={"session_id": SESSION}, files=_audio_multipart())


def _post_soporte_chat(cli):
    return cli.post("/soporte/chat",
                    json={"session_id": SESSION, "text": "hola", "funcion": FUNCION_SOPORTE})


def _post_soporte_chat_audio(cli):
    return cli.post("/soporte/chat/audio",
                    data={"session_id": SESSION, "funcion": FUNCION_SOPORTE},
                    files=_audio_multipart())


# `/soporte/*` namespacea el channel_ref por función (`web.py:850`): sin ese prefijo, abrir soporte con
# el MISMO session_id que el chat normal caería en el workflow de la conversación de negocio.
_REF_SOPORTE = f"soporte:{FUNCION_SOPORTE}:{SESSION}"

_ENDPOINTS = (
    ("/chat", _post_chat, SESSION),
    ("/chat/audio", _post_chat_audio, SESSION),
    ("/soporte/chat", _post_soporte_chat, _REF_SOPORTE),
    ("/soporte/chat/audio", _post_soporte_chat_audio, _REF_SOPORTE),
)

# Piso del barrido: un paramétrico vacío pasa SIEMPRE. Si alguien renombra o borra una ruta de ruteo,
# este test grita en vez de saltearla en silencio.
_ENDPOINTS_MINIMOS = 4


def _rutear(cliente_id: str, poster) -> tuple[list[str], list[dict], int]:
    espia = _ClienteEspia()
    respuesta = poster(TestClient(_build_app(cliente_id, espia)))
    return espia.ids, espia.payloads, respuesta.status_code


# --- controles de que el instrumento MIRA, y mira producción -------------------------

def test_el_barrido_MIRA_los_cuatro_endpoints_de_ruteo():
    assert len(_ENDPOINTS) >= _ENDPOINTS_MINIMOS, (
        f"sólo {len(_ENDPOINTS)} endpoints en la tabla; el piso es {_ENDPOINTS_MINIMOS}")
    registradas = {r.path for r in _build_app(TENANT_A, _ClienteEspia()).routes if hasattr(r, "path")}
    faltantes = [ruta for ruta, _, _ in _ENDPOINTS if ruta not in registradas]
    assert not faltantes, f"la app ya no expone estas rutas de la tabla: {faltantes}"


def test_el_router_que_corre_es_el_REAL_no_un_fake():
    """Control de que este archivo prueba el camino de producción. Si alguien vuelve a monkeypatchear
    `route_inbound` a nivel módulo, el resto de los tests de acá dejarían de medir lo que dicen."""
    assert web_module.route_inbound is inbound_router.route_inbound, (
        "`web.py` no está usando el `route_inbound` real: este archivo dejó de probar producción")


# --- el invariante, sobre los 4 endpoints -------------------------------------------

@pytest.mark.parametrize("ruta,poster,ref_esperado", _ENDPOINTS, ids=[e[0] for e in _ENDPOINTS])
def test_el_id_del_workflow_lleva_el_cliente_id_del_TOKEN(ruta, poster, ref_esperado):
    ids, _, status = _rutear(TENANT_A, poster)
    assert status == 200, f"{ruta} devolvió {status}"
    assert len(ids) == 1, f"{ruta} arrancó {len(ids)} workflows, esperaba 1"
    assert ids[0] == f"conv-web-{TENANT_A}-{ref_esperado}", (
        f"{ruta} arrancó el workflow con id {ids[0]!r} — el `cliente_id` del token no está donde debe")


@pytest.mark.parametrize("ruta,poster,ref_esperado", _ENDPOINTS, ids=[e[0] for e in _ENDPOINTS])
def test_ADVERSARIAL_dos_tenants_con_el_MISMO_session_id_arrancan_workflows_DISTINTOS(
        ruta, poster, ref_esperado):
    """El caso hostil: dos emprendedores mandan el MISMO `session_id` (lo elige el cliente, no el
    servidor). Si el id no derivara del token, el segundo caería en el workflow del primero con
    `USE_EXISTING` (`inbound_router.py:38`) y leería su conversación."""
    de_a, _, st_a = _rutear(TENANT_A, poster)
    de_b, _, st_b = _rutear(TENANT_B, poster)
    assert (st_a, st_b) == (200, 200), f"{ruta} devolvió {st_a}/{st_b}"
    assert de_a and de_b, f"{ruta} no arrancó workflow para alguno de los dos tenants"
    assert de_a[0] != de_b[0], (
        f"{ruta}: FUGA CROSS-TENANT — los dos tenants comparten el workflow {de_a[0]!r}")
    assert TENANT_A in de_a[0] and TENANT_A not in de_b[0]
    assert TENANT_B in de_b[0] and TENANT_B not in de_a[0]


@pytest.mark.parametrize("ruta,poster,ref_esperado", _ENDPOINTS, ids=[e[0] for e in _ENDPOINTS])
def test_el_config_de_arranque_tambien_lleva_el_cliente_id_del_TOKEN(ruta, poster, ref_esperado):
    """La otra mitad del aislamiento: `inbound_router.py:35` pone el `cliente_id` TAMBIÉN en el arg de
    arranque del workflow, y de ahí sale el tenant con el que las activities tocan la DB. Un id correcto
    con un payload de otro tenant aislaría la conversación y filtraría los datos."""
    _, payloads, status = _rutear(TENANT_A, poster)
    assert status == 200 and len(payloads) == 1, f"{ruta}: status {status}, {len(payloads)} payloads"
    assert payloads[0].get("cliente_id") == TENANT_A, (
        f"{ruta}: el workflow arranca con cliente_id={payloads[0].get('cliente_id')!r}")
    assert payloads[0].get("channel_ref") == ref_esperado


def test_la_AMBIGUEDAD_de_la_formula_depende_de_la_LONGITUD_del_cliente_id():
    """Riesgo documentado, hoy NO alcanzable — y el test existe para que deje de serlo en silencio.

    `workflow_id_for` concatena con `-` sin escapar (`inbound_router.py:18`), así que el id es ambiguo
    ante `cliente_id` de longitud VARIABLE: el tenant `cid` con `channel_ref='A-s1'` produce el MISMO id
    que el tenant `cid-A` con `channel_ref='s1'`, y el `channel_ref` lo elige el cliente.

    Por qué hoy no se puede explotar: `require_tenant` entrega el `sub` del JWT, un UUID de 36
    caracteres fijos, y ningún UUID es prefijo de otro. El aislamiento se apoya en esa longitud fija —
    una propiedad que NINGÚN otro test ni comentario declaraba. Si el `cliente_id` pasara a ser un slug
    de longitud variable, esto se vuelve una fuga cross-tenant real.

    Si alguien escapa el separador (una MEJORA), el primer assert falla: actualizar el test, no la
    fórmula."""
    assert (inbound_router.workflow_id_for("web", "cid", "A-s1")
            == inbound_router.workflow_id_for("web", "cid-A", "s1")), (
        "el separador ya está escapado: la ambigüedad documentada acá quedó cerrada, actualizá el test")

    uuid_a = "4f3ecb78-2e36-4044-a56e-0e7ef6c4a655"
    uuid_b = "4f3ecb78-2e36-4044-a56e-0e7ef6c4a656"
    assert len(uuid_a) == len(uuid_b) == 36
    assert (inbound_router.workflow_id_for("web", uuid_a, "s1")
            != inbound_router.workflow_id_for("web", uuid_b, "s1"))
