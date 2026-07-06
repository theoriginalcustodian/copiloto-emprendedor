# apps/copiloto/tests/test_mp_tables.py
import json
import sys
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
from provision_tables import _coldef  # noqa: E402


def test_mp_tables_declared_and_valid():
    spec = json.load(open(APP / "uc_tables.json", encoding="utf-8"))
    for table in ("mp_credentials", "mp_payments"):
        assert table in spec, f"falta {table} en uc_tables.json"
        for col in spec[table]:
            _coldef(col)  # no raise = nombre/tipo/modificador válidos y anti-injection-safe


def test_mp_credentials_has_required_columns():
    spec = json.load(open(APP / "uc_tables.json", encoding="utf-8"))
    cols = {c.split()[0] for c in spec["mp_credentials"]}
    assert {"seller_user_id", "access_token_enc", "refresh_token_enc", "expires_at"} <= cols


def test_mp_payments_has_required_columns():
    spec = json.load(open(APP / "uc_tables.json", encoding="utf-8"))
    cols = {c.split()[0] for c in spec["mp_payments"]}
    assert {"payment_id", "seller_user_id", "status", "amount", "external_reference"} <= cols
