"""CONS4 · A4 — Feedback entrante, su clasificación y si derivó en autosanación. Read-only, v1.

## §0 Reutilización

`FeedbackStore` (`feedback_store.py`) sólo tiene `crear` -- no hay `listar` que reusar, así que este
módulo consulta `copiloto_feedback` directo por SQL, mismo estilo que `admin_uso.py` con
`copiloto_metering`. `copiloto_consola` (CONS0a) ya tenía `SELECT` en `copiloto_feedback` --
provisionado junto con `copiloto_traumas` desde el arranque, cero cambios de rol.

## Cómo se sabe "si derivó en autosanación" -- sin tabla nueva

`clasificar_y_encolar_feedback` (`soporte_feedback_activities.py:90`) deposita el trauma con
`fingerprint=f"feedback:{fid}"` cuando el clasificador resuelve un `origen` -- es la MISMA
convención de nombre que usa `TraumaStore`, sin FK explícita. El `LEFT JOIN` de acá reconstruye esa
relación por convención, no la inventa.

## Lo que NO se puede mostrar, y por qué (no es un bug de este módulo)

Un ticket que salió `necesita_humano` NO deja rastro durable: `soporte_feedback_activities.py`
declara explícitamente ("Por qué NO hay tabla de estado nueva") que la clasificación es efímera --
sólo vive en el valor de retorno de la activity, cada corrida. Sin trauma asociado, este endpoint
sólo puede decir "no derivó en autosanación (todavía, o nunca)", no distinguir "esperando
reprocesarse" de "el clasificador dijo que no". Igual que ese módulo, no se construye una tabla de
estado para resolver esto -- sería sobreingeniería para v1 (regla del repo, spec §6).

## Boundary (SPECS §2)

A diferencia de A5 (DLQ), acá `texto` SÍ se expone: "Feedback y su clasificación" está declarado
DENTRO del boundary. Es la contraparte exacta del hallazgo de CONS3 -- el mismo texto que
`admin_errores.py` debía OCULTAR (`sintoma_no_tecnico` en `copiloto_traumas.contexto`) es
precisamente lo que A4 existe para mostrar.
"""
from __future__ import annotations

SCHEMA = "uc_factory"
TABLA_FEEDBACK = f"{SCHEMA}.copiloto_feedback"
TABLA_TRAUMAS = f"{SCHEMA}.copiloto_traumas"


def resumen_soporte(conn_factory, *, limite: int = 50) -> list[dict]:
    """`conn_factory` es la de `copiloto_consola` (`BYPASSRLS`, `SELECT`-only) -- cross-tenant por
    diseño, igual que `admin_uso.resumen_uso` y `admin_errores.resumen_errores`."""
    conn = conn_factory()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT f.id, f.cliente_id::text, f.tipo, f.texto, f.created_at,
                        (t.id IS NOT NULL) AS derivo_en_autosanacion,
                        t.estado AS estado_reparacion,
                        t.contexto -> 'origen' AS origen,
                        t.contexto ->> 'ultima_nota' AS ultima_nota,
                        t.dedupe_count
                    FROM {TABLA_FEEDBACK} f
                    LEFT JOIN {TABLA_TRAUMAS} t
                        ON t.fingerprint = 'feedback:' || f.id::text AND t.cliente_id = f.cliente_id
                    ORDER BY f.created_at DESC
                    LIMIT %s""",
                (limite,))
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, fila)) for fila in cur.fetchall()]
    finally:
        conn.close()
