"""La máquina de estado del writer del grafo de negocio — POST→poll→PATCH, agnóstica de ontología.

Hito 5 §1.2, capa 3 (sobre `graphity_structured_client`, la plomería HTTP). Materializa `datasets`
(que el mapping de dominio del §1.3 arma) contra Graphity y, DESPUÉS de que TODOS los POST terminaron,
PATCHea las aristas obsoletas. Portada del patrón de `documed/graph_writer.py` (los CRITICAL que
documed cazó adversarialmente); acá sin nada clínico — los tipos van en el `mapping`, no en esta capa.

**Tres invariantes que no se negocian** (cada uno costó un CRITICAL en documed, y su modo de fallo es
`200 y vacío`, no un error):

- **Orden: TODOS los POST+poll antes de cualquier PATCH.** El server hace `SET e = edge` en el re-POST
  (`dedup="exact"` es MERGE + reemplazo total). Si un PATCH que invalida corriera ANTES de un POST que
  todavía incluye esa arista, ese POST le pisaría el `invalid_at` y la **resucitaría** (trampa 4).
- **Guard anti-resurrección (CRITICAL-2): GET de las aristas de identidad ESTABLE ANTES de todo POST.**
  Una arista ya invalidada que esta corrida vuelve a declarar NO se re-emite —se EXCLUYE su fila— o el
  re-POST la resucita. Fail-VISIBLE: va a `resurrecciones_evitadas`, no se descarta en silencio.
- **Nunca invalidar lo que esta MISMA corrida escribió (CRITICAL-1).** Una invalidación cuyo `edge_uuid`
  coincide con una arista recién POSTeada se saltea: si no, el hecho recién firmado nace invalidado.

El writer NO reintenta ni encola: un PATCH que falla se DECLARA en `invalidaciones_pendientes` (insumo
del reconciler), estructurado, en vez de morir como un aviso suelto — la suspensión que no suspende.
Idempotente por diseño (uuid5 + `Idempotency-Key`): re-postear el log entero converge, así que el modo
(histórico/incremental) es del derivador que arma los datasets, no de esta máquina.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable

from graphity_structured_client import GrafoIngestError, GraphityStructuredClient


@dataclass(frozen=True)
class Dataset:
    """Un POST: una entidad raíz + N aristas salientes (el `mapping`) sobre `rows`.

    `aristas_estables` = `(indice_de_fila, edge_uuid)` de las aristas cuya identidad es ESTABLE (el
    mismo hecho da el mismo uuid5 siempre) y que por eso pueden colisionar con una invalidada previa.
    Sólo esas se chequean contra resurrección; las de identidad por-evento (cada mención = nodo nuevo)
    no pueden resucitar nada y no se chequean. El uuid5 lo calcula el mapping con `graph_identity`, no
    esta capa.
    """
    mapping: dict
    rows: tuple[dict, ...]
    aristas_estables: tuple[tuple[int, str], ...] = ()


@dataclass(frozen=True)
class Invalidacion:
    edge_uuid: str
    invalid_at: str   # ISO-8601


@dataclass
class ReporteEscritura:
    migration_ids: list[str] = field(default_factory=list)
    invalidadas: int = 0
    resurrecciones_evitadas: list[str] = field(default_factory=list)   # edge_uuid excluidos del POST
    invalidaciones_pendientes: list[dict] = field(default_factory=list)  # PATCH que fallaron (reconciler)
    chequeos_fallidos: list[str] = field(default_factory=list)         # GET del guard que no respondió
    datasets_vacios: int = 0                                           # quedaron sin filas tras excluir


class GrafoWriter:
    def __init__(self, client: GraphityStructuredClient, *,
                 sleep: Callable[[float], None] = time.sleep) -> None:
        self._client = client
        self._sleep = sleep

    def write(self, datasets: list[Dataset], invalidaciones: list[Invalidacion], *,
              group_id: str, budget_s: float = 90.0, idem_prefix: str) -> ReporteEscritura:
        rep = ReporteEscritura()

        # ── FASE 0 — guard anti-resurrección: GET ANTES de todo POST ─────────────────────────────────
        # Para cada arista estable ya invalidada, se EXCLUYE su fila del dataset (no se re-emite). Las
        # que sobreviven son las que esta corrida escribe → nunca se las invalida después (CRITICAL-1).
        escritas: set[str] = set()
        preparados: list[tuple[Dataset, list[dict]]] = []
        for ds in datasets:
            excluir: set[int] = set()
            for row_idx, edge_uuid in ds.aristas_estables:
                if self._esta_invalidada(edge_uuid, rep):
                    excluir.add(row_idx)
                    rep.resurrecciones_evitadas.append(edge_uuid)
            filas = [r for i, r in enumerate(ds.rows) if i not in excluir]
            if not filas:
                rep.datasets_vacios += 1
                continue
            # Las aristas estables cuya fila NO se excluyó son las que este POST va a materializar.
            for row_idx, edge_uuid in ds.aristas_estables:
                if row_idx not in excluir:
                    escritas.add(edge_uuid)
            preparados.append((ds, filas))

        # ── FASE 1 — POST + poll de TODOS los datasets, antes de cualquier PATCH ──────────────────────
        for i, (ds, filas) in enumerate(preparados):
            resp = self._client.post_structured(
                ds.mapping, filas, group_id=group_id,
                idempotency_key=f"{idem_prefix}:{i}")
            migration_id = resp.get("migration_id")
            if not migration_id:
                raise GrafoIngestError(f"POST del dataset {i} no devolvió migration_id: {resp}")
            self._client.poll_migration(migration_id, budget_s=budget_s)   # revienta si failed/perdidas
            rep.migration_ids.append(migration_id)

        # ── FASE 2 — PATCH de invalidación, excluyendo lo que esta corrida escribió (CRITICAL-1) ──────
        for inv in invalidaciones:
            if inv.edge_uuid in escritas:
                # El hecho se re-declaró en este mismo write: invalidarlo lo mataría recién nacido.
                continue
            try:
                self._client.patch_edge_invalidate(inv.edge_uuid, inv.invalid_at)
                rep.invalidadas += 1
            except GrafoIngestError:
                # No se reintenta acá: se DECLARA para el reconciler. El hecho viejo sigue vigente.
                rep.invalidaciones_pendientes.append(
                    {"edge_uuid": inv.edge_uuid, "invalid_at": inv.invalid_at})

        return rep

    def _esta_invalidada(self, edge_uuid: str, rep: ReporteEscritura) -> bool:
        """¿La arista existe Y tiene `invalid_at` seteado? GET que falla → NO se afirma invalidada
        (fail-open del pre-check, pero VISIBLE en `chequeos_fallidos`): excluir una fila que no está
        realmente invalidada perdería un hecho válido. Sólo se excluye lo CONFIRMADO invalidado."""
        try:
            edge = self._client.get_edge(edge_uuid)
        except GrafoIngestError:
            rep.chequeos_fallidos.append(edge_uuid)
            return False
        if edge is None:
            return False
        attrs = edge.get("attributes") or {}
        return attrs.get("invalid_at") is not None
