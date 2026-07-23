"""El cliente HTTP del camino structured (0-LLM) — a nivel TRANSPORTE con `httpx.MockTransport`, sin red.

Lo que se defiende acá son las posturas fail-closed del doc `ingesta-determinista-grafo.md`, cuyo modo
de fallo es **200 y vacío**, no un error: los defaults `dedup="exact"`/`on_error="strict"` (trampas
1/2), que el 202 obliga a pollear (trampa 3), que una migración `failed` o con filas perdidas revienta
en vez de reportar éxito, y que `get_edge` distingue 404 (no existe) de un error real.
"""
from __future__ import annotations

import httpx
import pytest

from graphity_structured_client import GrafoIngestError, GraphityStructuredClient


def _cliente(handler, **kw) -> GraphityStructuredClient:
    client = httpx.Client(transport=httpx.MockTransport(handler), timeout=5.0)
    return GraphityStructuredClient(base_url="https://graphity.test", api_key="gphy_test",
                                    client=client, sleep=lambda _s: None, **kw)


# ── POST /graph/structured ────────────────────────────────────────────────────────────────────────

def test_post_manda_exact_y_strict_por_default_y_devuelve_migration_id():
    visto = {}

    def handler(req: httpx.Request) -> httpx.Response:
        import json as _j
        visto["body"] = _j.loads(req.content)
        visto["api_key"] = req.headers.get("X-API-Key")
        return httpx.Response(202, json={"migration_id": "mig-1", "status": "pending"})

    r = _cliente(handler).post_structured({"entity_type": "Negocio"}, [{"n": "x"}], group_id="g1")
    assert r["migration_id"] == "mig-1"
    # Trampa 1 y 2: los defaults NO se pueden confiar al server (su on_error default es el peligroso).
    assert visto["body"]["dedup"] == "exact"
    assert visto["body"]["on_error"] == "strict"
    assert visto["body"]["validate_only"] is False
    assert visto["body"]["group_id"] == "g1"
    assert visto["api_key"] == "gphy_test"


def test_validate_only_es_dry_run_200_y_no_pide_migration():
    def handler(req: httpx.Request) -> httpx.Response:
        import json as _j
        assert _j.loads(req.content)["validate_only"] is True
        return httpx.Response(200, json={"valid": True})

    r = _cliente(handler).post_structured({"entity_type": "X"}, [{"a": 1}], group_id="g",
                                          validate_only=True)
    assert r == {"valid": True}


def test_un_422_de_ontologia_revienta_fail_loud_no_devuelve_vacio():
    """El typo de tipo/edge tiene que fallar en 200ms y ruidoso, no envenenar el grafo en silencio."""
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(422, json={"detail": "entity_type 'Negoci' no declarado"})

    with pytest.raises(GrafoIngestError, match="422"):
        _cliente(handler).post_structured({"entity_type": "Negoci"}, [{"a": 1}], group_id="g")


def test_un_400_de_project_scope_tambien_revienta():
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"detail": "Project scope required for structured ingest"})

    with pytest.raises(GrafoIngestError, match="400"):
        _cliente(handler).post_structured({"entity_type": "X"}, [{"a": 1}], group_id="g")


def test_idempotency_key_viaja_en_el_header():
    visto = {}

    def handler(req: httpx.Request) -> httpx.Response:
        visto["idem"] = req.headers.get("Idempotency-Key")
        return httpx.Response(202, json={"migration_id": "m"})

    _cliente(handler).post_structured({"e": "X"}, [{"a": 1}], group_id="g", idempotency_key="idem-abc")
    assert visto["idem"] == "idem-abc"


# ── poll_migration ────────────────────────────────────────────────────────────────────────────────

def test_poll_espera_hasta_completed_y_devuelve_totals():
    llamadas = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        llamadas["n"] += 1
        if llamadas["n"] < 3:
            return httpx.Response(200, json={"status": "pending"})
        return httpx.Response(200, json={"status": "completed",
                                         "totals": {"created": 5, "updated": 1, "skipped": 0, "failed": 0}})

    estado = _cliente(handler).poll_migration("mig-1", budget_s=90, poll_interval_s=1)
    assert estado["status"] == "completed"
    assert estado["totals"]["created"] == 5
    assert llamadas["n"] == 3   # esperó las dos "pending"


def test_poll_de_una_migracion_failed_revienta():
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "failed", "row_errors": [{"row": 2, "err": "boom"}]})

    with pytest.raises(GrafoIngestError, match="failed"):
        _cliente(handler).poll_migration("mig-1", budget_s=10, poll_interval_s=1)


def test_poll_completed_con_filas_perdidas_revienta_ultima_linea_de_defensa():
    """`on_error='strict'` no debería dejar pasar esto, pero si el server cambia, el vacío no se cuela."""
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "completed",
                                         "totals": {"created": 3, "failed": 2},
                                         "row_errors": [{"row": 4}]})

    with pytest.raises(GrafoIngestError, match="perdidas"):
        _cliente(handler).poll_migration("mig-1", budget_s=10, poll_interval_s=1)


def test_poll_agota_el_presupuesto_si_nunca_termina():
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "pending"})

    with pytest.raises(GrafoIngestError, match="presupuesto"):
        _cliente(handler).poll_migration("mig-1", budget_s=4, poll_interval_s=2)


# ── get_edge (guard anti-resurrección) y patch (invalidación) ───────────────────────────────────────

def test_get_edge_distingue_404_de_arista_viva():
    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/viva"):
            return httpx.Response(200, json={"uuid": "viva", "attributes": {"invalid_at": None}})
        return httpx.Response(404, json={"detail": "not found"})

    c = _cliente(handler)
    assert c.get_edge("viva")["attributes"]["invalid_at"] is None
    assert c.get_edge("fantasma") is None   # 404 → None, no excepción


def test_patch_invalidate_manda_invalid_at_y_va_al_edge_singular():
    visto = {}

    def handler(req: httpx.Request) -> httpx.Response:
        import json as _j
        visto["path"] = req.url.path
        visto["body"] = _j.loads(req.content)
        return httpx.Response(200, json={"ok": True})

    _cliente(handler).patch_edge_invalidate("edge-1", "2026-07-22T00:00:00Z")
    assert visto["path"] == "/api/v2/graph/edge/edge-1"   # PATCH usa /edge/ singular (doc §1.1)
    assert visto["body"] == {"invalid_at": "2026-07-22T00:00:00Z"}


def test_reintenta_un_503_transitorio_y_despues_pasa():
    llamadas = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        llamadas["n"] += 1
        if llamadas["n"] == 1:
            return httpx.Response(503, json={"detail": "unavailable"})
        return httpx.Response(202, json={"migration_id": "m"})

    r = _cliente(handler).post_structured({"e": "X"}, [{"a": 1}], group_id="g")
    assert r["migration_id"] == "m" and llamadas["n"] == 2
