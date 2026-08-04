"""Activity del Schedule incremental de sync evento→grafo — BETA-G0.

Lee `copiloto_eventos` desde el cursor del tenant (`grafo_sync_store.GrafoSyncStore`), mapea con
`grafo_mapeo` (evento + estado, con el `orden` REAL = `id` bigserial del log, nunca un índice
sintético) y postea con `GrafoWriter`. Corre fuera del sandbox de Temporal (mismo criterio que
`mi_dia_schedule_activities.py`): abre conexiones psycopg2 de verdad y hace HTTP real a Graphity.

**Invalidación incremental — el porqué del loop propio.** `construir_datasets_estado` (el atajo de
`grafo_mapeo.py`) sólo sirve para la carga histórica: conoce el futuro completo de una pasada. Acá cada
corrida sólo ve su tramo nuevo, así que hace falta recordar qué transición estaba vigente ANTES de este
batch (`GrafoSyncStore.vigente`, sembrado desde la corrida anterior) y encadenar las supersesiones que
ocurren DENTRO del batch mismo — dos transiciones del mismo `(entidad, campo)` en la misma corrida. El
addendum de ontología ya lo prescribe: "para el modo incremental de producción, la sesión de ingesta
arma su propio loop evento-a-evento reusando `MapeadorEstado.procesar`/`edge_uuid_de`".
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Callable

from temporalio import activity

from contexto_tenant import conexion_con_tenant, tenant
from grafo_mapeo import MapeadorEstado, MapeadorEvento, ontologia
from grafo_sync_store import GrafoSyncStore
from grafo_writer import GrafoWriter, Invalidacion
from graphity_structured_client import GraphityStructuredClient

_conn_factory: Callable | None = None


def set_grafo_sync_deps(conn_factory: Callable) -> None:
    """Mismo criterio que `set_mi_dia_deps`: el `conn_factory` COMPARTIDO, fijado una vez al arrancar
    el worker — nunca uno nuevo por tenant (ver `worker_b.py::build_worker_config`)."""
    global _conn_factory
    _conn_factory = conn_factory


@dataclass(frozen=True)
class _EventoRow:
    orden: int
    entidad_tipo: str
    entidad_id: str
    evento: str
    campo: str | None
    valor_a: object
    ocurrido_en: object
    datos: dict


def _leer_eventos_nuevos(conn_tenant: Callable, cliente_id: str, desde_id: int) -> list[_EventoRow]:
    """`valor_a` es OBLIGATORIO acá aunque `MapeadorEvento` (mitad EVENTO) no lo use: `MapeadorEstado`
    (mitad ESTADO) lee `ev.valor_a` para `_estado_generico`/`_precio`/`_imputacion` — sin esta columna
    en el SELECT, cada transición de estado revienta con `AttributeError` (cazado por
    `test_grafo_sync_activities.py` antes de tocar producción, no en producción)."""
    conn = conn_tenant()
    with conn.cursor() as cur:
        cur.execute(
            "SELECT id, entidad_tipo, entidad_id, evento, campo, valor_a, datos, ocurrido_en "
            "FROM uc_factory.copiloto_eventos WHERE cliente_id=%s AND id > %s ORDER BY id",
            (cliente_id, desde_id))
        rows = cur.fetchall()
    return [_EventoRow(orden=r[0], entidad_tipo=r[1], entidad_id=r[2], evento=r[3], campo=r[4],
                       valor_a=r[5], datos=r[6] or {}, ocurrido_en=r[7]) for r in rows]


def sincronizar_tenant(conn_factory: Callable, cliente_id: str, *, negocio_nombre: str,
                       client: GraphityStructuredClient | None = None) -> dict:
    """La función SYNC real (testeable sin Temporal ni red: inyectar `client` con un
    `httpx.MockTransport`, mismo patrón que `test_graphity_structured_client.py`). `negocio_nombre` es
    el rótulo legible que va en los `fact_template` (§ ontología) — sale de `perfil_negocio`, no de
    acá; el caller lo resuelve. Sin `client`, `from_env()` es el composition root real."""
    with tenant(cliente_id):
        conn_tenant = conexion_con_tenant(conn_factory)
        store = GrafoSyncStore(conn_tenant, cliente_id)
        desde = store.cursor()
        eventos = _leer_eventos_nuevos(conn_tenant, cliente_id, desde)
        if not eventos:
            return {"sincronizados": 0, "cursor": desde}

        group = f"negocio-{cliente_id}"

        mapeador_ev = MapeadorEvento(negocio_key=cliente_id, negocio_nombre=negocio_nombre)
        for ev in eventos:
            if ev.campo is None:
                mapeador_ev.procesar(ev)
        datasets_evento = mapeador_ev.datasets(group)

        # ── mitad ESTADO: loop propio (ver docstring del módulo) — sembrado con lo vigente en DB,
        # encadenado con lo que este mismo batch supersede. `ultimo_edge_por_clave`/`ultimo_orden_por_
        # clave` son SÓLO de este batch: el estado durable entre corridas vive en `GrafoSyncStore`.
        mapeador_es = MapeadorEstado(negocio_key=cliente_id, negocio_nombre=negocio_nombre)
        invalidaciones: list[Invalidacion] = []
        ultimo_edge_por_clave: dict[tuple[str, str, str], str] = {}
        ultimo_orden_por_clave: dict[tuple[str, str, str], int] = {}
        for ev in eventos:
            if ev.campo is None:
                continue
            clave = (ev.entidad_tipo, ev.entidad_id, ev.campo)
            if clave not in ultimo_edge_por_clave:
                vigente_db = store.vigente(*clave)
                if vigente_db is not None:
                    ultimo_edge_por_clave[clave] = vigente_db
            mapeador_es.procesar(ev.orden, ev, group_logico=group)
            nuevo_edge = mapeador_es.edge_uuid_de(ev.orden)
            anterior_edge = ultimo_edge_por_clave.get(clave)
            if anterior_edge is not None and nuevo_edge is not None and anterior_edge != nuevo_edge:
                invalidaciones.append(Invalidacion(edge_uuid=anterior_edge,
                                                   invalid_at=ev.ocurrido_en.isoformat()))
            if nuevo_edge is not None:
                ultimo_edge_por_clave[clave] = nuevo_edge
                ultimo_orden_por_clave[clave] = ev.orden
        datasets_estado = mapeador_es.datasets(group)

        client = client or GraphityStructuredClient.from_env()
        entity_types, edge_types = ontologia()
        client.registrar_ontologia(entity_types, edge_types, group_id=group)
        writer = GrafoWriter(client)
        max_id = eventos[-1].orden
        rep = writer.write(datasets_evento + datasets_estado, invalidaciones, group_id=group,
                           idem_prefix=f"grafo-sync-{cliente_id}-{desde}-{max_id}")

        # SÓLO tras éxito del write (si `writer.write` falló, ya reventó fail-closed y no llegamos
        # acá): avanzar cursor + vigencia. Así un fallo de red/ontología reintenta el MISMO rango en
        # la próxima corrida en vez de perderlo.
        for clave, orden in ultimo_orden_por_clave.items():
            store.marcar_vigente(*clave, orden=orden, edge_uuid=ultimo_edge_por_clave[clave])
        store.avanzar_cursor(max_id)

    return {"sincronizados": len(eventos), "cursor": max_id, "migraciones": rep.migration_ids,
            "invalidadas": rep.invalidadas}


@activity.defn
async def sincronizar_grafo_negocio(cliente_id: str) -> dict:
    """Wrapper delgado de Temporal sobre `sincronizar_tenant`. `negocio_nombre` sale del perfil real
    del negocio (mismo store que arma el prompt) — con fallback al `cliente_id` si el perfil está
    vacío, para que un tenant sin perfil cargado no bloquee el sync."""
    from perfil_negocio_store import PerfilNegocioStore
    assert _conn_factory is not None, "set_grafo_sync_deps() no se llamó — ver worker_b.py"

    def _resolver_y_sincronizar():
        perfil = PerfilNegocioStore(_conn_factory, cliente_id).get()
        nombre = (perfil or {}).get("nombre_comercial") or cliente_id
        return sincronizar_tenant(_conn_factory, cliente_id, negocio_nombre=nombre)

    return await asyncio.to_thread(_resolver_y_sincronizar)
