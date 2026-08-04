"""Tests de apps/copiloto/rate_limit.py (BETA-2.d) — middleware ASGI standalone, sin depender de
`create_web_app`: la unidad bajo test es el sliding-window en sí, no el front-door completo."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from rate_limit import RateLimitMiddleware, _client_key


def _build_app(*, max_requests: int, window_seconds: int = 60) -> FastAPI:
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, max_requests=max_requests, window_seconds=window_seconds)

    @app.get("/ping")
    def ping() -> dict:
        return {"ok": True}

    return app


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
