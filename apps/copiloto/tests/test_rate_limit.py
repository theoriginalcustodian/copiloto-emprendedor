"""Tests de apps/copiloto/rate_limit.py (BETA-2.d) — middleware ASGI standalone, sin depender de
`create_web_app`: la unidad bajo test es el sliding-window en sí, no el front-door completo."""
from __future__ import annotations

import time

import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient

from rate_limit import RateLimitMiddleware, _client_key, _is_static_path

_JWT_SECRET = "test-secret-no-es-el-real-treinta-y-dos-bytes"


def _build_app(*, max_requests: int, window_seconds: int = 60,
              jwt_secret: str | None = None, jwt_issuer: str | None = None) -> FastAPI:
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, max_requests=max_requests, window_seconds=window_seconds,
                       jwt_secret=jwt_secret, jwt_issuer=jwt_issuer)

    @app.get("/ping")
    def ping() -> dict:
        return {"ok": True}

    @app.get("/assets/{name}")
    def asset(name: str) -> dict:
        return {"ok": True}

    return app


def _bearer(sub: str, *, secret: str = _JWT_SECRET) -> dict:
    token = jwt.encode({"sub": sub, "aud": "authenticated", "exp": int(time.time()) + 300},
                       secret, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


def test_bajo_el_limite_pasa_200():
    client = TestClient(_build_app(max_requests=3))
    for _ in range(3):
        assert client.get("/ping").status_code == 200


def test_excede_el_limite_devuelve_429_con_retry_after():
    client = TestClient(_build_app(max_requests=2))
    assert client.get("/ping").status_code == 200
    assert client.get("/ping").status_code == 200
    r = client.get("/ping")
    assert r.status_code == 429
    assert "Retry-After" in r.headers
    assert int(r.headers["Retry-After"]) >= 1


def test_ips_distintas_no_comparten_cupo():
    client = TestClient(_build_app(max_requests=1))
    r1 = client.get("/ping", headers={"X-Forwarded-For": "1.1.1.1"})
    r2 = client.get("/ping", headers={"X-Forwarded-For": "2.2.2.2"})
    assert r1.status_code == 200
    assert r2.status_code == 200
    # la 1.1.1.1 ya gastó su cupo de 1 -> la próxima de la MISMA ip cae en 429
    r3 = client.get("/ping", headers={"X-Forwarded-For": "1.1.1.1"})
    assert r3.status_code == 429


def test_max_requests_cero_desactiva_el_limite():
    client = TestClient(_build_app(max_requests=0))
    for _ in range(10):
        assert client.get("/ping").status_code == 200


def test_client_key_prioriza_x_forwarded_for_sobre_client_host():
    class _FakeClient:
        host = "127.0.0.1"

    class _FakeRequest:
        client = _FakeClient()
        headers = {"x-forwarded-for": "9.9.9.9, 127.0.0.1"}

    assert _client_key(_FakeRequest()) == "9.9.9.9"


def test_client_key_cae_a_client_host_sin_forwarded_for():
    class _FakeClient:
        host = "10.0.0.5"

    class _FakeRequest:
        client = _FakeClient()
        headers = {}

    assert _client_key(_FakeRequest()) == "10.0.0.5"


# ── H-A4-10: estáticos no cuentan, ruta autenticada cupa por usuario no por IP ────────────────────

def test_is_static_path_assets_y_app_shell():
    assert _is_static_path("/assets/index-C77RqHAK.js")
    assert _is_static_path("/")
    assert _is_static_path("/index.html")
    assert _is_static_path("/sw.js")
    assert _is_static_path("/registerSW.js")
    assert _is_static_path("/manifest.webmanifest")
    assert _is_static_path("/workbox-9c191d2f.js")
    assert not _is_static_path("/chat")
    assert not _is_static_path("/reply")
    assert not _is_static_path("/login")           # ruta cliente de la SPA -- NO es un archivo real


def test_assets_estaticos_no_gastan_el_cupo():
    """H-A4-10: antes, cargar la página (varios /assets/*.js) ya comía el cupo de 60/min pensado
    para mensajes de chat. Ahora ni cuenta: pueden pedirse sin límite y el cupo de /ping (compartida
    la MISMA IP/bucket) sigue intacto."""
    client = TestClient(_build_app(max_requests=1))
    for _ in range(5):
        assert client.get("/assets/index-ABC123.js").status_code == 200
    assert client.get("/ping").status_code == 200    # el cupo de /ping no lo tocó ningún /assets/*


def test_app_shell_no_gasta_el_cupo():
    client = TestClient(_build_app(max_requests=1))
    for path in ("/", "/index.html", "/sw.js", "/manifest.webmanifest"):
        r = client.get(path)
        assert r.status_code != 429
    assert client.get("/ping").status_code == 200


def test_dos_usuarios_mismo_ip_no_comparten_cupo():
    """DoD H-A4-10: 2 usuarios detrás del mismo NAT (misma IP) NO se pisan el cupo -- cada `sub`
    verificado del JWT tiene su propio bucket."""
    client = TestClient(_build_app(max_requests=1, jwt_secret=_JWT_SECRET))
    ip = {"X-Forwarded-For": "5.5.5.5"}
    r1 = client.get("/ping", headers={**_bearer("user-A"), **ip})
    r2 = client.get("/ping", headers={**_bearer("user-B"), **ip})
    assert r1.status_code == 200
    assert r2.status_code == 200                     # NO 429 -- son usuarios distintos


def test_control_negativo_mismo_usuario_sobre_el_limite_da_429():
    """Control negativo del test anterior: el cupo por-usuario SIGUE aplicando -- el mismo `sub`
    excediendo `max_requests` recibe 429 igual que antes (no es que H-A4-10 desactivó el límite)."""
    client = TestClient(_build_app(max_requests=1, jwt_secret=_JWT_SECRET))
    ip = {"X-Forwarded-For": "5.5.5.5"}
    headers = {**_bearer("user-A"), **ip}
    assert client.get("/ping", headers=headers).status_code == 200
    r = client.get("/ping", headers=headers)
    assert r.status_code == 429


def test_token_invalido_cae_a_ip_sin_romper():
    """Un Bearer roto/con firma ajena no debe poder inventarse un `sub` para evadir el límite --
    cae al cupo por IP de siempre, el mismo que ya cubre este caso."""
    client = TestClient(_build_app(max_requests=1, jwt_secret=_JWT_SECRET))
    ip = {"X-Forwarded-For": "6.6.6.6"}
    forjado = {**_bearer("quien-sea", secret="secreto-equivocado"), **ip}
    assert client.get("/ping", headers=forjado).status_code == 200
    # mismo IP, token igual de inválido con OTRO sub -- si cupara por el sub sin verificar, esto
    # pasaría; como cae a IP, comparte el cupo YA gastado y da 429.
    otro_forjado = {**_bearer("otro-sub-cualquiera", secret="secreto-equivocado"), **ip}
    r = client.get("/ping", headers=otro_forjado)
    assert r.status_code == 429


def test_sin_jwt_secret_configurado_sigue_cupando_por_ip():
    """Backward-compat: `jwt_secret=None` (default) -- el comportamiento es IDÉNTICO al de antes de
    H-A4-10, cupa por IP aunque venga un Bearer válido."""
    client = TestClient(_build_app(max_requests=1))  # sin jwt_secret
    ip = {"X-Forwarded-For": "7.7.7.7"}
    assert client.get("/ping", headers={**_bearer("user-A"), **ip}).status_code == 200
    r = client.get("/ping", headers={**_bearer("user-B"), **ip})   # otro sub, MISMA ip
    assert r.status_code == 429                       # sin jwt_secret no distingue por usuario
