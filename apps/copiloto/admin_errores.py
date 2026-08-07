"""CONS3 · A5 — DLQ agrupada por `fingerprint`, cross-tenant, vía `copiloto_consola`. Read-only.
CONS7b agrega `buscar_por_id` + `motivo_prohibido`, el sustrato de lectura para "reintentar".
Pedido de frontend (`..._CONS7b-no-se-puede-construir-A5-no-da-el-id-ni-el-motivo`): sin `id` no hay
qué mandarle a `POST /admin/errores/{id}/reintentar`, y sin `motivo_prohibido` no se puede deshabilitar
el botón ANTES de apretarlo. `resumen_errores` ahora trae los dos, calculados acá -- el frontend no
puede calcularlos sin violar el boundary de abajo.

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

import json

from autosanacion_gates import dominio_prohibido

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
                        id, fingerprint, workflow, error_type, costura, estado,
                        contexto ->> 'ultima_nota' AS ultima_nota,
                        contexto -> 'origen' ->> 'archivo' AS origen_archivo,
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
    filas = filas[:limite]

    # `motivo_prohibido` exige `contexto.origen.archivo`, pero esta consulta NUNCA trae `contexto`
    # completo (boundary de arriba) -- `origen_archivo` es la única fracción extraída vía JSON path,
    # se arma un trauma sintético con ella y se descarta antes de responder: no sale de esta función.
    for fila in filas:
        archivo = fila.pop("origen_archivo")
        fila["motivo_prohibido"] = motivo_prohibido({
            "workflow": fila["workflow"], "costura": fila["costura"],
            "contexto": {"origen": {"archivo": archivo}} if archivo else {},
        })
    return filas


def buscar_por_id(conn_factory, trauma_id: int) -> dict | None:
    """UN trauma completo (`cliente_id` + `contexto` INCLUIDOS) -- a diferencia de `resumen_errores`,
    esto NO es para mostrar en la consola, es el insumo interno de CONS7b (reintentar): necesita
    `cliente_id` para declarar el tenant al escribir, y `contexto.origen.archivo` para el gate.
    `conn_factory` cross-tenant (`copiloto_consola`), igual que `resumen_errores`."""
    conn = conn_factory()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""SELECT id, cliente_id::text, fingerprint, workflow, error_type, costura,
                        contexto, estado
                    FROM {TABLA} WHERE id = %s""",
                (trauma_id,))
            fila = cur.fetchone()
            if fila is None:
                return None
            cols = [d[0] for d in cur.description]
            return dict(zip(cols, fila))
    finally:
        conn.close()


def motivo_prohibido(trauma: dict) -> str | None:
    """¿Este trauma cae en un dominio `DIAGNOSTIC_ONLY` (CONS7b)? Reusa `dominio_prohibido`
    (`autosanacion_gates.py:166`) -- NO es un catálogo nuevo, es la MISMA pregunta que ya se hace
    `evaluar_gates_de_reparacion` para el ciclo automático, aplicada acá al reintento manual.

    Chequea `workflow`, `costura` y (si está) `contexto.origen.archivo` -- el ciclo automático sólo
    mira el archivo (`autosanacion_activities.py:273`, "confiar en el nombre sería como se cuela un
    permiso que no debía darse"), pero un reintento MANUAL puede aplicar a un trauma sin `origen`
    (nunca llegó a forjarse). Ahí `workflow`/`costura` son la única señal disponible, y equivocarse
    hacia el rechazo es gratis -- equivocarse hacia el permiso emite una factura."""
    contexto = trauma.get("contexto") or {}
    if isinstance(contexto, str):
        try:
            contexto = json.loads(contexto)
        except (ValueError, TypeError):
            # Degradar acá es correcto (caso (c) del censo de `except`, mismo criterio que
            # `autosanacion_activities._contexto_de`): un `contexto` corrupto o de otra época sin
            # `origen` legible no puede volver PERMISIVO el gate -- sin archivo, `workflow`/
            # `costura` siguen chequeándose abajo, y si tampoco delatan nada, el default es
            # "no prohibido" recién ahí. Propagar tumbaría el reintento por un dato viejo de UNA fila.
            contexto = {}
    origen = contexto.get("origen") if isinstance(contexto, dict) else None
    archivo = origen.get("archivo") if isinstance(origen, dict) else None
    for ruta in (trauma.get("workflow"), trauma.get("costura"), archivo):
        dominio = dominio_prohibido(ruta) if ruta else None
        if dominio:
            return dominio
    return None
