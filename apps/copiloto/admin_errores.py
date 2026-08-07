"""CONS3 · A5 — DLQ agrupada por `fingerprint`, cross-tenant, vía `copiloto_consola`. Read-only.

Reutiliza el MISMO patrón de selección de representante que ya usa
`TraumaStore.tomar_un_bug_distinto` (`DISTINCT ON (fingerprint) ... ORDER BY dedupe_count DESC`,
trauma_store.py:205) -- acá de LECTURA, sin `FOR UPDATE` ni filtro a `pendiente`: la consola quiere
ver el bug en cualquier estado, no tomarlo para reparar.

## El boundary que este archivo NO puede cruzar (SPECS §2, "telemetría sí, contenido no")

Sólo se lee `contexto ->> 'ultima_nota'`, **nunca la columna `contexto` completa**. Esa nota la
escribe la autosanación sobre SU PROPIO intento (motivo de gate/auditor/tests, o la URL del PR --
`autosanacion_activities.marcar_trauma`), y es justo lo que A5 pide mostrar ("qué intentó y en qué
terminó"). Pero `contexto` también puede traer, para un trauma de origen `feedback_intake`,
`sintoma_no_tecnico`: el texto libre que el emprendedor tipeó (`soporte_feedback_activities.py:93`).
Eso es "contenido de las conversaciones", explícitamente FUERA del boundary de la consola -- A4 lo
clasifica sin exponerlo. Traer `contexto` entero acá lo filtraría por accidente.
"""
from __future__ import annotations

SCHEMA = "uc_factory"
TABLA = f"{SCHEMA}.copiloto_traumas"


def resumen_errores(conn_factory, *, estado: str | None = None, limite: int = 50) -> list[dict]:
    """`conn_factory` es la de `copiloto_consola` (`BYPASSRLS`, `SELECT`-only) -- cross-tenant por
    diseño, igual que `admin_uso.resumen_uso`. Con la conexión normal de un tenant esto no falla:
    devuelve sólo lo suyo, RLS mediante -- ver el test adversarial."""
    conn = conn_factory()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT DISTINCT ON (fingerprint)
                        fingerprint, workflow, error_type, costura, estado,
                        contexto ->> 'ultima_nota' AS ultima_nota,
                        dedupe_count, intentos, created_at, updated_at,
                        count(*) OVER (PARTITION BY fingerprint) AS tenants_afectados
                    FROM {TABLA}
                    WHERE (%s::text IS NULL OR estado = %s)
                    ORDER BY fingerprint, dedupe_count DESC, updated_at DESC""",
                (estado, estado))
            cols = [d[0] for d in cur.description]
            filas = [dict(zip(cols, fila)) for fila in cur.fetchall()]
    finally:
        conn.close()

    # El `ORDER BY` del `DISTINCT ON` tiene que empezar por `fingerprint` (regla de Postgres para
    # poder deduplicar); el orden que le importa al operador -- lo que más duele primero -- se
    # aplica acá, en Python, sobre el resultado ya deduplicado.
    filas.sort(key=lambda f: (f["dedupe_count"], f["updated_at"]), reverse=True)
    return filas[:limite]
