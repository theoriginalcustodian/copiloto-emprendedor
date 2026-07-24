"""Activity del Schedule diario de Mi día — hito 7 (`contrato_mi-dia-y-el-detector-proactivo` §1.1).

Corre fuera del sandbox de Temporal (mismo criterio que `afip_factura_activities.py`), así que puede
importar `mi_dia_orquestador` y abrir conexiones psycopg2 de verdad.
"""
from __future__ import annotations

import asyncio
from typing import Callable

from temporalio import activity

_conn_factory: Callable | None = None


def set_mi_dia_deps(conn_factory: Callable) -> None:
    """Inyecta la fábrica de conexión compartida. SYNC, se llama en el composition root del worker
    (`worker_b.py::build_worker_config`) — el MISMO `conn_factory` que usa el resto de los stores,
    nunca uno nuevo: `conn_factory` no cruza el boundary de Temporal como argumento (no es
    serializable), así que vive en una variable de módulo fijada una vez al arrancar el worker."""
    global _conn_factory
    _conn_factory = conn_factory


@activity.defn
async def avanzar_tablero_mi_dia(cliente_id: str) -> dict:
    """Corre el pipeline completo (DETECTAR→PRIORIZAR→REDACTAR→ENTREGAR) para UN tenant.

    Wrapper delgado sobre `mi_dia_orquestador.avanzar_tablero` — la MISMA función que llama
    `GET /mi-dia/tablero` (`mi_dia_web.py`), para que el Schedule y el endpoint nunca diverjan en
    qué hace "avanzar el tablero" (un solo lugar que lo define, dos disparadores).
    """
    from mi_dia_orquestador import avanzar_tablero
    assert _conn_factory is not None, "set_mi_dia_deps() no se llamó — ver worker_b.py"
    return await asyncio.to_thread(avanzar_tablero, _conn_factory, cliente_id)
