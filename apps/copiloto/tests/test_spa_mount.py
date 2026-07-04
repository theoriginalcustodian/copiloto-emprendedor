"""tests/test_spa_mount.py — la SPA (PWA) se sirve mismo-origen (Task 8) sin ensombrecer la API.

Verifica el invariante clave del serving mismo-origen: el catch-all de la SPA se monta AL FINAL y
NUNCA se come una ruta de API explícita (regla dura: /healthz, /me, /chat, etc. deben seguir
respondiendo). Import-safe: sin build (`index.html` ausente) el mount es no-op (front-door API-only)."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from web import _mount_spa


def _make_dist(root: Path) -> Path:
    d = root / "dist"
    (d / "assets").mkdir(parents=True)
    (d / "index.html").write_text(
        "<!doctype html><title>Copiloto</title><div id=root></div>", encoding="utf-8")
    (d / "assets" / "app.js").write_text("console.log('copiloto')", encoding="utf-8")
    (d / "manifest.webmanifest").write_text('{"name":"Copiloto"}', encoding="utf-8")
    return d


def _app_with_api() -> FastAPI:
    app = FastAPI()

    @app.get("/healthz")
    def healthz() -> dict:
        return {"status": "ok"}

    return app


def test_mount_false_sin_build(tmp_path):
    """Sin `index.html` (frontend no buildeado todavía) el mount es no-op -> False, front-door API-only."""
    app = _app_with_api()
    assert _mount_spa(app, tmp_path / "dist") is False


def test_sirve_index_y_assets_sin_ensombrecer_api(tmp_path):
    d = _make_dist(tmp_path)
    app = _app_with_api()
    assert _mount_spa(app, d) is True
    c = TestClient(app)
    # la API explícita sigue respondiendo (NO la ensombrece el catch-all de la SPA)
    assert c.get("/healthz").json() == {"status": "ok"}
    # index.html en la raíz
    assert "Copiloto" in c.get("/").text
    # asset real bajo /assets
    assert "copiloto" in c.get("/assets/app.js").text
    # archivo real en la raíz (manifest de la PWA)
    assert '"name":"Copiloto"' in c.get("/manifest.webmanifest").text
    # ruta de cliente desconocida -> fallback a index.html (client-side routing de la SPA)
    r = c.get("/conexiones")
    assert r.status_code == 200 and "id=root" in r.text
