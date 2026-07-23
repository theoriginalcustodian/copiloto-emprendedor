"""La máquina del writer — los tres invariantes que costaron un CRITICAL en documed, contra un cliente
fake que registra el ORDEN de las llamadas (el orden POST-antes-de-PATCH no se puede afirmar sin verlo).

El fake no habla HTTP —eso ya lo cubre `test_graphity_structured_client` a nivel transporte—; acá se
defiende la LÓGICA de la máquina: que no resucite, que no invalide lo que acaba de escribir, y que
todos los POST pasen antes del primer PATCH.
"""
from __future__ import annotations

import pytest

from graphity_structured_client import GrafoIngestError
from grafo_writer import Dataset, GrafoWriter, Invalidacion


class ClienteFake:
    """Registra el orden de las operaciones y deja configurar `get_edge` y fallos de `patch`."""

    def __init__(self, edges: dict | None = None, get_raises: set | None = None,
                 patch_raises: set | None = None) -> None:
        self.edges = edges or {}          # edge_uuid -> {"attributes": {"invalid_at": ...}}  |  None
        self.get_raises = get_raises or set()
        self.patch_raises = patch_raises or set()
        self.orden: list[str] = []        # "post" / "poll" / "patch:<uuid>"
        self.posteadas: list[list[dict]] = []
        self._mig = 0

    def get_edge(self, edge_uuid):
        if edge_uuid in self.get_raises:
            raise GrafoIngestError("GET boom")
        return self.edges.get(edge_uuid)

    def post_structured(self, mapping, rows, *, group_id, dedup="exact", on_error="strict",
                        validate_only=False, idempotency_key=None):
        self.orden.append("post")
        self.posteadas.append(rows)
        self._mig += 1
        return {"migration_id": f"mig-{self._mig}"}

    def poll_migration(self, migration_id, *, budget_s=90.0, poll_interval_s=2.0):
        self.orden.append("poll")
        return {"status": "completed", "totals": {"created": 1, "failed": 0}}

    def patch_edge_invalidate(self, edge_uuid, invalid_at):
        self.orden.append(f"patch:{edge_uuid}")
        if edge_uuid in self.patch_raises:
            raise GrafoIngestError("PATCH boom")
        return {}


def _writer(fake) -> GrafoWriter:
    return GrafoWriter(fake, sleep=lambda _s: None)


def _ds(rows, aristas=()):
    return Dataset(mapping={"entity_type": "Negocio"}, rows=tuple(rows), aristas_estables=tuple(aristas))


# ── happy + invalidación normal ─────────────────────────────────────────────────────────────────

def test_happy_postea_y_pollea_sin_invalidar_nada():
    fake = ClienteFake()
    rep = _writer(fake).write([_ds([{"n": "x"}])], [], group_id="g", idem_prefix="run-1")
    assert rep.migration_ids == ["mig-1"]
    assert rep.invalidadas == 0 and rep.resurrecciones_evitadas == []
    assert fake.orden == ["post", "poll"]


def test_invalida_una_arista_ajena_a_lo_escrito():
    fake = ClienteFake()
    rep = _writer(fake).write([_ds([{"n": "x"}])],
                              [Invalidacion("edge-vieja", "2026-07-22T00:00:00Z")],
                              group_id="g", idem_prefix="run-1")
    assert rep.invalidadas == 1
    assert fake.orden == ["post", "poll", "patch:edge-vieja"]


# ── CRITICAL-1: nunca invalidar lo que esta corrida escribió ─────────────────────────────────────

def test_no_invalida_una_arista_que_este_write_acaba_de_escribir():
    """El hecho recién firmado no puede nacer invalidado. La invalidación cuyo uuid está en las
    aristas estables recién POSTeadas se saltea."""
    fake = ClienteFake()
    ds = _ds([{"n": "x"}], aristas=[(0, "edge-A")])   # esta corrida escribe edge-A
    rep = _writer(fake).write([ds], [Invalidacion("edge-A", "2026-07-22T00:00:00Z")],
                              group_id="g", idem_prefix="run-1")
    assert rep.invalidadas == 0
    assert not any(o.startswith("patch") for o in fake.orden)   # NUNCA se PATCHeó edge-A


# ── CRITICAL-2: guard anti-resurrección ──────────────────────────────────────────────────────────

def test_una_arista_estable_ya_invalidada_se_EXCLUYE_del_post_no_se_resucita():
    fake = ClienteFake(edges={"edge-muerta": {"attributes": {"invalid_at": "2026-07-01T00:00:00Z"}}})
    ds = _ds([{"n": "viva"}, {"n": "muerta"}], aristas=[(0, "edge-viva"), (1, "edge-muerta")])
    # edge-viva no está en `edges` → get_edge devuelve None → no invalidada → su fila se postea.
    rep = _writer(fake).write([ds], [], group_id="g", idem_prefix="run-1")
    assert rep.resurrecciones_evitadas == ["edge-muerta"]
    assert fake.posteadas == [[{"n": "viva"}]]   # la fila muerta NO se re-emitió


def test_si_TODAS_las_filas_se_excluyen_el_dataset_no_se_postea():
    fake = ClienteFake(edges={"e0": {"attributes": {"invalid_at": "2026-07-01T00:00:00Z"}}})
    ds = _ds([{"n": "muerta"}], aristas=[(0, "e0")])
    rep = _writer(fake).write([ds], [], group_id="g", idem_prefix="run-1")
    assert rep.datasets_vacios == 1
    assert fake.orden == []   # no hubo POST


def test_get_del_guard_que_falla_no_excluye_pero_queda_VISIBLE():
    """Fail-open del pre-check: no se afirma invalidada una arista que no se pudo leer (excluirla
    perdería un hecho válido), pero el GET fallido queda en `chequeos_fallidos`, no en silencio."""
    fake = ClienteFake(get_raises={"edge-timeout"})
    ds = _ds([{"n": "x"}], aristas=[(0, "edge-timeout")])
    rep = _writer(fake).write([ds], [], group_id="g", idem_prefix="run-1")
    assert rep.chequeos_fallidos == ["edge-timeout"]
    assert rep.resurrecciones_evitadas == []
    assert fake.posteadas == [[{"n": "x"}]]   # se posteó igual


# ── orden: TODOS los POST antes del primer PATCH ─────────────────────────────────────────────────

def test_todos_los_post_van_antes_de_cualquier_patch():
    fake = ClienteFake()
    datasets = [_ds([{"n": "a"}]), _ds([{"n": "b"}])]
    invs = [Invalidacion("e1", "2026-07-22T00:00:00Z"), Invalidacion("e2", "2026-07-22T00:00:00Z")]
    _writer(fake).write(datasets, invs, group_id="g", idem_prefix="run-1")
    primer_patch = next(i for i, o in enumerate(fake.orden) if o.startswith("patch"))
    # Ningún post/poll después del primer patch.
    assert not any(o in ("post", "poll") for o in fake.orden[primer_patch:])
    assert fake.orden[:4] == ["post", "poll", "post", "poll"]


# ── PATCH que falla → pendiente para el reconciler, no revienta ──────────────────────────────────

def test_un_patch_fallido_se_declara_pendiente_y_el_write_no_revienta():
    fake = ClienteFake(patch_raises={"e-cae"})
    rep = _writer(fake).write([_ds([{"n": "x"}])],
                              [Invalidacion("e-ok", "2026-07-22T00:00:00Z"),
                               Invalidacion("e-cae", "2026-07-22T00:00:00Z")],
                              group_id="g", idem_prefix="run-1")
    assert rep.invalidadas == 1   # e-ok
    assert rep.invalidaciones_pendientes == [{"edge_uuid": "e-cae", "invalid_at": "2026-07-22T00:00:00Z"}]
