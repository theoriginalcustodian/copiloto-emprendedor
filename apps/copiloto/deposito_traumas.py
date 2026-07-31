"""El puente entre las costuras y la DLQ — Fase 2.

Las dos costuras (C2 HTTP y C3 activities) ya **loguean** todos los errores. Depositar es el otro
paso: dejarlos **con estado**, deduplicados y contados, para que algo los reintente. Este módulo es
lo único que las costuras necesitan saber de la DLQ.

**Por qué una fábrica inyectada y no un singleton global.** El `cliente_id` cambia por operación y la
conexión tiene que venir de la `conn_factory` **envuelta con `conexion_con_tenant`** — la misma que
usa el resto de la app. Un global aquí obligaría a resolver el tenant por fuera del borde, que es
justo lo que el diseño del RLS prohíbe.

**Y por qué puede no haber DLQ.** Las costuras se instalan también en contextos sin base (tests,
arranque temprano, un front-door sin `DATABASE_URL`). En esos casos la captura tiene que seguir
funcionando **igual**: se loguea y no se deposita. La DLQ es una mejora del registro, nunca una
condición para registrar.
"""
from __future__ import annotations

from typing import Any, Callable

from trauma_store import TraumaStore

#: `fabrica(cliente_id) -> TraumaStore | None`. La arma el composition root (`serve.py`, `worker_b.py`)
#: a partir de la `conn_factory` ya envuelta con `conexion_con_tenant`.
FabricaDeTraumas = Callable[[str], "TraumaStore | None"]


def fabrica_desde(conn_factory) -> FabricaDeTraumas:  # noqa: ANN001
    """Arma la fábrica a partir de la `conn_factory` de la app. Un solo lugar, como las costuras."""

    def fabrica(cliente_id: str) -> TraumaStore | None:
        return TraumaStore(conn_factory, cliente_id)

    return fabrica


def depositar(fabrica: FabricaDeTraumas | None, *, fingerprint: str, workflow: str,
              error_type: str, cliente_id: str | None, costura: str,
              contexto: dict[str, Any] | None = None) -> None:
    """Deposita el trauma si hay DLQ y hay tenant. **Nunca lanza, nunca devuelve nada.**

    Tres motivos legítimos para no depositar, y ninguno es un fallo:

    - **no hay fábrica** — el proceso corre sin base (tests, arranque temprano);
    - **no hay `cliente_id`** — ruta pública (health, webhook) o una activity cuyo payload no lo trae.
      Sin tenant, la fila no tendría dueño y el `WITH CHECK` de la policy la rechazaría: el error
      igual quedó logueado, que es donde se lo va a encontrar;
    - **la DLQ falló** — `TraumaStore.depositar` ya devuelve `None` en vez de lanzar.

    El `try` de acá es la última red: esto corre **dentro del manejo de errores**, y una excepción
    escapando por este camino reemplazaría el error original del usuario por uno nuestro.
    """
    if fabrica is None or not cliente_id:
        return
    try:
        store = fabrica(cliente_id)
        if store is not None:
            store.depositar(fingerprint=fingerprint, workflow=workflow, error_type=error_type,
                            costura=costura, contexto=contexto)
    except Exception:  # noqa: BLE001 — depositar un error jamás puede generar uno nuevo
        return
