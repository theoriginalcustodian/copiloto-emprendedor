#!/usr/bin/env python3
"""R2 — Provisiona (idempotente) las tablas de una app en uc_factory con la convención RLS de fusion.

Absorbe el `ensure_tables.py` del scratchpad al mecanismo de la fábrica (catálogo de errores §C6). Lo invoca
la activity `provision_tables` del SeniorWorkflow ANTES de `validate_real`, leyendo el manifiesto
`<repo>/uc_tables.json` (lo emite el generador del plano; si no existe, la app no tiene tablas → no-op).

Cada tabla recibe: `id bigserial PRIMARY KEY` + `cliente_id uuid NOT NULL` + las columnas dadas; luego
ENABLE ROW LEVEL SECURITY + policy `tenant_isolation` (cliente_id = auth.jwt()->>'cliente_id', idéntica a las
tablas existentes de fusion) + grants a anon/authenticated/service_role. Idempotente (IF NOT EXISTS + DROP/CREATE
policy + GRANT repetible).

SEGURIDAD (anti-injection): el manifiesto viene de output generado (semi-confiable) y el worker tiene la cred de
admin de uc_factory → los nombres de tabla/columna se validan contra una allowlist (`^[a-z_][a-z0-9_]*$`), los
tipos SQL contra una allowlist de tipos base, y los modificadores contra un set cerrado. Nada cruza sin validar.

Uso (VPS, val-venv con psycopg2, env fusion-pg.env cargado):
  set -a; . /etc/unreal-copilot/fusion-pg.env; set +a
  /opt/uc-val-venv/bin/python provision_tables.py <uc_tables.json>
  # uc_tables.json = {"resources": ["name text NOT NULL", "capacity integer"], "bookings": [...]}
"""
import json
import os
import re
import sys

SCHEMA = "uc_factory"
GRANTEES = ["anon", "authenticated", "service_role"]
# IMPORTANTE: validar con re.fullmatch (NO .match): en Python `$` matchea ANTES de un `\n` final, así que un
# `match` con `$` deja pasar identificadores con newline embebido (review adversarial — finding LOW). fullmatch
# + regex sin anclas cierra ese hueco.
_IDENT_RE = re.compile(r"[a-z_][a-z0-9_]*")
# tipos SQL base permitidos (sin el modificador de precisión, que se valida aparte)
_TYPES = {"text", "varchar", "char", "integer", "int", "bigint", "smallint", "boolean", "bool",
          "numeric", "decimal", "real", "double", "timestamptz", "timestamp", "date", "time",
          "uuid", "jsonb", "json"}
# El valor de un DEFAULT es la ÚNICA parte libre del manifiesto -> allowlist ESTRICTA y cerrada (review adversarial
# CRITICAL: un regex laxo permitía `DEFAULT 'x')--` (paren-breakout + comment-out del CREATE TABLE) y
# `DEFAULT pg_sleep(0)`/`current_setting(...)`/`(SELECT ...)` (stored-expression injection ejecutándose con
# privilegio ADMIN en cada INSERT)). Solo: entero, literal-string SIN comilla/newline embebido, o keyword segura.
_DEFAULT_VAL = r"(\d+|'[^'\n]*'|true|false|null|now\(\))"
_MODIFIER_RE = re.compile(rf"(NOT\s+NULL|NULL)?\s*(DEFAULT\s+{_DEFAULT_VAL})?", re.IGNORECASE)
# columnas sin tipo explícito → heurística de inferencia (compat con el formato del generador)
_NUM = {"qty", "stock_qty", "reorder_threshold", "capacity", "current_step", "step_order",
        "interval_days", "reminder_lead_seconds", "delay_seconds", "quantity", "amount", "price"}


def _ident(name: str) -> str:
    """Valida un identificador (tabla/columna) contra la allowlist antes de interpolarlo en SQL.
    fullmatch (no .match): cierra el hueco del `\\n` final que `$` deja pasar."""
    if not _IDENT_RE.fullmatch(name):
        raise ValueError(f"identificador inválido (anti-injection): {name!r}")
    return name


def _infer_type(name: str) -> str:
    n = name.lower()
    if n.endswith("_id"):
        return "bigint"
    if n == "deleted" or n.startswith("is_"):
        return "boolean NOT NULL DEFAULT false"
    if (n in _NUM or n.endswith(("_seconds", "_days", "_qty", "_count", "_step", "_at", "_start", "_end"))
            or n in {"scheduled_at", "current_period_end", "occurred_at"}):
        return "bigint"
    return "text"


def _coldef(col: str) -> str:
    """Acepta 'name text NOT NULL' (tipado) o solo 'name' (infiere). Valida nombre, tipo y modificadores."""
    parts = col.strip().split()
    if not parts:
        raise ValueError("columna vacía en el manifiesto")
    name = _ident(parts[0])
    if len(parts) == 1:                                  # sin tipo → inferir (el inferido es de fuente confiable)
        return f'"{name}" {_infer_type(name)}'
    sqltype = parts[1].lower()
    base = sqltype.split("(")[0]                         # numeric(10,2) -> numeric
    if base not in _TYPES:
        raise ValueError(f"tipo SQL no permitido: {sqltype!r} (col {name})")
    # el modificador de precisión, si lo hay, debe ser solo dígitos/coma: numeric(10,2)
    if "(" in sqltype and not re.fullmatch(r"[a-z]+\(\d+(,\d+)?\)", sqltype):
        raise ValueError(f"tipo SQL malformado: {sqltype!r} (col {name})")
    rest = " ".join(parts[2:])
    if rest and not _MODIFIER_RE.fullmatch(rest):
        raise ValueError(f"modificador de columna no permitido: {rest!r} (col {name})")
    return f'"{name}" {sqltype}' + (f" {rest}" if rest else "")


def provision(spec: dict, conn) -> list:
    """Aplica el manifiesto contra la conexión dada (idempotente). Devuelve la lista de tablas provisionadas.
    `conn` con autocommit (cada DDL es su propia transacción). Separado de main() para testearlo."""
    done = []
    cur = conn.cursor()
    for table, cols in spec.items():
        t = _ident(table)
        coldefs = ",\n  ".join(['id bigserial PRIMARY KEY', 'cliente_id uuid NOT NULL']
                               + [_coldef(c) for c in cols])
        cur.execute(f'CREATE TABLE IF NOT EXISTS {SCHEMA}."{t}" (\n  {coldefs}\n);')
        cur.execute(f'ALTER TABLE {SCHEMA}."{t}" ENABLE ROW LEVEL SECURITY;')
        cur.execute(f'DROP POLICY IF EXISTS tenant_isolation ON {SCHEMA}."{t}";')
        cur.execute(f'CREATE POLICY tenant_isolation ON {SCHEMA}."{t}" '
                    f"FOR ALL USING (cliente_id = ((auth.jwt() ->> 'cliente_id')::uuid));")
        for g in GRANTEES:
            cur.execute(f'GRANT SELECT, INSERT, UPDATE, DELETE ON {SCHEMA}."{t}" TO {g};')
            cur.execute(f'GRANT USAGE, SELECT ON SEQUENCE {SCHEMA}."{t}_id_seq" TO {g};')
        done.append(t)
        print(f"OK {SCHEMA}.{t} (+id +cliente_id +{len(cols)} cols, RLS+policy+grants)", flush=True)
    return done


def main() -> None:
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    if not isinstance(spec, dict):
        raise ValueError("uc_tables.json debe ser un objeto {tabla: [columnas]}")
    import psycopg2
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    conn.autocommit = True
    provision(spec, conn)


if __name__ == "__main__":
    main()
