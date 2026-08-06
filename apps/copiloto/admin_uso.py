"""CONS2 · A3 — Uso y costo, por tenant y agregado. Read-only.

Las 3 queries son las de `queries/metering_dashboard.sql` (BETA-1b) tal cual -- ese archivo hoy dice
"correr esto a mano desde Supabase Studio (superuser)"; con `copiloto_consola` (CONS0a, `BYPASSRLS`
`SELECT`-only en `copiloto_metering`) ya no hace falta un humano con acceso a superuser: la MISMA
query corre por HTTP con un radio de daño acotado a lectura de 4 tablas, no admin de la base entera.
"""
from __future__ import annotations

SCHEMA = "uc_factory"
_TABLA = f"{SCHEMA}.copiloto_metering"


def _filas(cur) -> list[dict]:
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, fila)) for fila in cur.fetchall()]


def resumen_uso(conn_factory, *, horas: int = 24) -> dict:
    """`conn_factory` es la del rol `copiloto_consola` -- cross-tenant por `BYPASSRLS`, nunca la del
    rol normal de la app (que vería 0 filas sin un tenant declarado, RLS `FORCE`)."""
    conn = conn_factory()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT cliente_id::text,
                           count(*) FILTER (WHERE evento = 'llm_turno') AS turnos_llm,
                           COALESCE(sum(tokens) FILTER (WHERE evento = 'llm_turno'), 0) AS tokens_totales,
                           mode() WITHIN GROUP (ORDER BY model)
                             FILTER (WHERE evento = 'llm_turno') AS modelo_mas_usado
                    FROM {_TABLA}
                    WHERE created_at > now() - make_interval(hours => %s)
                    GROUP BY cliente_id ORDER BY tokens_totales DESC""", (horas,))
            gasto = _filas(cur)

            cur.execute(
                f"""SELECT cliente_id::text, split_part(model, ':', 2) AS tool, count(*) AS llamadas
                    FROM {_TABLA}
                    WHERE evento LIKE 'tool_call:%%' AND created_at > now() - make_interval(hours => %s)
                    GROUP BY cliente_id, tool ORDER BY cliente_id, llamadas DESC""", (horas,))
            tools = _filas(cur)

            cur.execute(
                f"""SELECT cliente_id::text,
                           count(*) FILTER (WHERE evento = 'tool_call:error') AS errores,
                           count(*) FILTER (WHERE evento LIKE 'tool_call:%%') AS llamadas_totales,
                           round(100.0 * count(*) FILTER (WHERE evento = 'tool_call:error')
                                 / nullif(count(*) FILTER (WHERE evento LIKE 'tool_call:%%'), 0), 1
                           ) AS error_rate_pct
                    FROM {_TABLA}
                    WHERE created_at > now() - make_interval(hours => %s)
                    GROUP BY cliente_id ORDER BY error_rate_pct DESC NULLS LAST""", (horas,))
            error_rate = _filas(cur)
    finally:
        conn.close()

    return {"horas": horas, "gasto_llm": gasto, "uso_tools": tools, "error_rate_tools": error_rate}
