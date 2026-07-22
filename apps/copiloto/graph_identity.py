"""Identidad determinista del grafo de negocio — hito 5 §1.2 (primitivos).

Ningún LLM decide qué es "el mismo nodo": lo decide un `uuid5` que **calculamos nosotros**, con la
MISMA semilla que usa el servidor de Graphity. Que sea calculable acá es lo que hace posible
**invalidar una arista sin buscarla** — y sin eso, la bitemporalidad del grafo (`valid_at`/`invalid_at`)
no existiría. Verificado contra el servidor real en el spike de documed (`RESULT.md` pregunta 1: el
`uuid5` client-side coincide **exactamente** con el que Graphity persistió).

Portado tal cual desde `documed/apps/documed/graph_identity.py` — los primitivos son **agnósticos de
dominio** y **no pueden cambiar**: `STRUCTURED_NS` y `normalize_key` tienen que coincidir con los del
servidor, o el `uuid5` apunta a un nodo que no existe y **no falla: devuelve vacío** (trampa de la
`ingesta-determinista-grafo.md` §2). Este módulo es SOLO los primitivos; la tabla `clave_natural`
—qué se deduplica, qué es evento, y cómo la identidad de una arista de ESTADO incluye el evento del
log que la originó para no resucitar la invalidada (§2.3)— vive en el mapeo del derivador y se define
con la ontología coordinada del §1.3, no acá.

🔴 **El seed usa el `group_id` LÓGICO** (sin el prefijo `{tenant}__` que Graphity agrega del lado del
servidor). Con el físico, los uuid calculados no son los que Graphity persistió (§1.2 doc, punto 8 del
"lo que el escritor está obligado a hacer").
"""
from __future__ import annotations

import re
import unicodedata
import uuid

# Mismo namespace que Graphity (`structured_ingest`). NO tocar: cambiarlo re-identifica TODO el grafo.
STRUCTURED_NS = uuid.uuid5(uuid.NAMESPACE_URL, "graphity://structured")

_ESPACIOS = re.compile(r"\s+")


class _Evento:
    """Centinela: esta entidad NO se deduplica — cada mención es un nodo nuevo. Lo consume el mapeo
    del derivador (§1.3), no este módulo; se exporta acá porque es parte del vocabulario de identidad."""

    def __repr__(self) -> str:  # pragma: no cover - solo para debug legible
        return "EVENTO"


EVENTO = _Evento()


def normalize_key(v: str) -> str:
    """NFC + casefold + colapso de espacios. **Tiene que coincidir con la del servidor**: si difiere,
    calculamos un uuid que no es el que Graphity persistió, y todo lo que dependa de localizar ese nodo
    (invalidar, leer, atar) apunta al vacío — sin error, con lista vacía."""
    v = unicodedata.normalize("NFC", str(v)).casefold()
    return _ESPACIOS.sub(" ", v).strip()


def node_uuid(group_logico: str, entity_type: str, natural_key: str) -> str:
    return str(uuid.uuid5(STRUCTURED_NS, f"{group_logico}|{entity_type}|{normalize_key(natural_key)}"))


def edge_uuid(group_logico: str, src_uuid: str, edge_type: str, tgt_uuid: str) -> str:
    return str(uuid.uuid5(STRUCTURED_NS, f"{group_logico}|{src_uuid}|{edge_type}|{tgt_uuid}"))
