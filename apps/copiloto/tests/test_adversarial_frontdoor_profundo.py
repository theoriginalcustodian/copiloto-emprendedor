"""Cobertura cross-tenant PROFUNDA del front-door (SEC-A2-2, cierra el límite declarado de
`test_adversarial_frontdoor_por_ruta.py`).

Aquel test corta, en 40 de 42 rutas, con 422 antes de la capa de datos (body inválido). Acá cada ruta
tenant-scoped recibe un body VÁLIDO generado desde su propio esquema OpenAPI, con el `cliente_id` de B
sembrado en todo campo string y en los canales query/header; el token es el de A. Aserto: el espía de
factories JAMÁS ve a B. Un contador de alcance exige que una fracción real de las rutas llegue a la capa de
datos: sin eso el "B no aparece" no distingue aislamiento de rutas que cortan antes (instrumento ciego).
"""
from __future__ import annotations

import pytest

from test_adversarial_frontdoor_por_ruta import frontdoor  # noqa: F401  (fixture)
from contexto_tenant import declarar_tenant

_PUBLICAS = ("/health", "/openapi.json", "/docs", "/redoc", "/auth/", "/legal", "/mp/webhook", "/webhook")


def _resolver(esq: dict, comps: dict, b_id: str, prof: int = 0):
    if prof > 6:
        return None
    if "$ref" in esq:
        return _resolver(comps[esq["$ref"].split("/")[-1]], comps, b_id, prof + 1)
    for k in ("anyOf", "oneOf", "allOf"):
        if k in esq:
            return _resolver(esq[k][0], comps, b_id, prof + 1)
    t = esq.get("type")
    if "enum" in esq:
        return esq["enum"][0]
    if t == "object" or "properties" in esq:
        return {n: _resolver(s, comps, b_id, prof + 1) for n, s in esq.get("properties", {}).items()}
    if t == "array":
        return [_resolver(esq.get("items", {}), comps, b_id, prof + 1)]
    if t == "string":
        return b_id
    if t == "integer":
        return 1
    if t == "number":
        return 1.0
    if t == "boolean":
        return False
    return b_id


def _rutas(app):
    spec = app.openapi()
    comps = spec.get("components", {}).get("schemas", {})
    for path, ops in spec["paths"].items():
        if path.startswith(_PUBLICAS):
            continue
        for verbo, op in ops.items():
            if verbo not in ("get", "post", "put", "patch", "delete"):
                continue
            yield path, verbo, op, comps


def test_cross_tenant_profundo_todas_las_rutas(frontdoor):  # noqa: F811
    c, espia, a, b = frontdoor
    alcanzaron, total, sin_cortar_en_422 = 0, 0, 0
    for path, verbo, op, comps in _rutas(c.app):
        total += 1
        url = path
        for p in op.get("parameters", []):
            if p.get("in") == "path":
                url = url.replace("{" + p["name"] + "}", b.cliente_id)
        body_esq = (op.get("requestBody", {}).get("content", {}).get("application/json", {}) or {}).get("schema")
        kw = {"headers": {"Authorization": f"Bearer {a.token}", "X-Cliente-Id": b.cliente_id},
              "params": {"cliente_id": b.cliente_id, "tenant": b.cliente_id}}
        if body_esq:
            kw["json"] = _resolver(body_esq, comps, b.cliente_id)
        antes = len(espia.vistos)
        r = getattr(c, verbo)(url, **kw)
        assert b.cliente_id not in espia.vistos, f"{verbo.upper()} {path}: la capa de datos operó con el cliente_id de B"
        if r.status_code != 422:
            sin_cortar_en_422 += 1
        if len(espia.vistos) > antes:
            alcanzaron += 1
        declarar_tenant(None)
    assert total >= 40, f"solo {total} rutas recorridas: el generador está ciego"
    assert alcanzaron >= 10, f"solo {alcanzaron}/{total} rutas llegaron a la capa de datos: instrumento ciego"
    print(f"\nPROFUNDO: {total} rutas, {sin_cortar_en_422} pasaron la validación, {alcanzaron} llegaron a la capa de datos")
