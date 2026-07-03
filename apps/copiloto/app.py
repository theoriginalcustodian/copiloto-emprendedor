"""apps/copiloto/app.py — SUPERSEDED por apps/copiloto/web.py::create_web_app (Task 6).

`create_app` (BFF single-tenant: `cliente_id` horneado en el closure del composition root) fue el
walking-skeleton previo al multitenant real. `create_web_app` lo reemplaza por completo: `/chat` y
`/reply` resuelven `cliente_id` per-request vía `require_tenant` (Task 2, JWT Supabase), y además
monta `/auth/signup` (Task 3), `/me`, `/healthz` y el router `/mp/*` (exento de auth) en el MISMO
front-door. Mantener las dos puertas de entrada sería deuda no-gestionada ("cero fricción para
escalar" — CLAUDE.md §4.9): se decidió REMOVER `create_app` (y su `tests/test_app.py`, que solo
ejercitaba la API single-tenant retirada) en vez de convivir con un segundo BFF horneado.

Se re-exporta `create_web_app` acá para que un import histórico (`from app import create_web_app`)
no rompa; el composition root real vive en `web.py`."""
from __future__ import annotations

from web import create_web_app

__all__ = ["create_web_app"]
