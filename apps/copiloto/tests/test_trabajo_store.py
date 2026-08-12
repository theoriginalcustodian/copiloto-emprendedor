"""B4/C5 (lote higiene, 2026-08-12): el canario de acople-por-string ya protegía
`presupuesto_store` <-> `web` (`test_presupuesto_derivados.py`, guard 1) pero dejaba afuera los DOS
sitios de `trabajo_store.py` (`resolver()`, líneas ~116 y ~130) que duplican el MISMO formato
`factura-{cliente_id}-{factura_id}` sin FK real -- para subir de comprobante a presupuesto y de
presupuesto a comprobante. Son 5 sitios en total con el mismo string duplicado (`web.py:231`,
`presupuesto_store.py:116/144`, `trabajo_store.py:116/130`); este archivo cierra la cobertura de
los últimos 2, que hasta ahora podían divergir en silencio -- el cruce simplemente deja de encontrar
filas y `resolver()`/`margen()` devuelven un trabajo incompleto sin ningún error visible.

Control positivo (asentado en el `avance_`, no en este archivo): romper a mano cualquiera de los
dos literales de abajo hace caer el test correspondiente -- verificado contra el gate del VPS antes
de cerrar el lote."""
from __future__ import annotations

import inspect
import os
import uuid
from decimal import Decimal

import pytest

import trabajo_store
from gasto_store import GastoStore
from presupuesto_store import PresupuestoStore, workflow_id_de_factura
from trabajo_store import TrabajoStore

necesita_pg = pytest.mark.skipif(not os.environ.get("DATABASE_URL"),
                                 reason="requiere Postgres del VPS (DATABASE_URL)")


@pytest.fixture
def tenants(conn_de_tenant):
    a, b = str(uuid.uuid4()), str(uuid.uuid4())
    yield a, b
    for cid in (a, b):
        conn = conn_de_tenant(cid)()
        with conn.cursor() as cur:
            for t in ("copiloto_eventos", "copiloto_gastos",
                      "copiloto_presupuesto_items", "copiloto_presupuestos"):
                cur.execute(f"DELETE FROM uc_factory.{t} WHERE cliente_id = %s", (cid,))
        conn.close()


def test_trabajo_store_sube_de_comprobante_a_presupuesto_con_el_mismo_formato():
    """`resolver()`, eslabón "comprobante": el SQL concatena `'factura-' || cliente_id || '-' ||
    factura_id` a mano porque no puede llamar a Python -- tiene que seguir coincidiendo con
    `workflow_id_de_factura`, la fuente de verdad del formato."""
    fuente = inspect.getsource(trabajo_store.TrabajoStore.resolver)
    assert "'factura-' || cliente_id::text || '-' || factura_id" in fuente
    assert workflow_id_de_factura("X", "Y") == "factura-X-Y"


def test_trabajo_store_baja_de_presupuesto_a_comprobante_con_el_mismo_formato():
    """El otro sentido del mismo cruce: acá SÍ corre en Python, así que el f-string tiene que
    producir exactamente lo mismo que `workflow_id_de_factura` -- comparado contra el valor real,
    no leído a ojo."""
    fuente = inspect.getsource(trabajo_store.TrabajoStore.resolver)
    assert 'f"factura-{self._cid}-{fila[0]}"' in fuente
    cid, factura_id = "cid-Z", "42"
    assert f"factura-{cid}-{factura_id}" == workflow_id_de_factura(cid, factura_id)


# ═══════════════════ C3 (auditoría, lote C) — adversarial de `imputar()` sobre el GASTO ═══════════════
# `test_imputacion_y_margen.py::test_ADVERSARIAL_A_no_imputa_un_gasto_a_un_trabajo_de_B` ya cubre "el
# gasto de A imputado a una REF de B" (lo frena `resolver()`). Falta el vector complementario, y es
# distinto código: "el gasto_id de B, imputado a una ref VÁLIDA de A" -- ahí `resolver()` no dice nada
# (la ref es de A), y el único guard es el `WHERE cliente_id=%s AND id=%s` del UPDATE final sobre el
# gasto (`trabajo_store.py:207-209`), que en vez de lanzar devuelve `None` -- la web lo traduce a 404
# en `PUT /gastos/{id}/imputacion` (`gastos_web.py`), donde el `id}` de la URL ES el gasto ajeno.

@necesita_pg
def test_ADVERSARIAL_A_no_imputa_el_gasto_de_B_asignandolo_a_su_propio_trabajo(conn_de_tenant, tenants):
    """El otro sentido del cruce cross-tenant: acá la `ref` SÍ es de A (pasa `resolver()` sin quejarse)
    -- lo que ataca es el `gasto_id`, que le pertenece a B. Sin este test, el guard del `UPDATE ...
    WHERE cliente_id=%s` es código sin ejercitar."""
    a, b = tenants
    presupuestos_a = PresupuestoStore(conn_de_tenant(a), a)
    presupuesto_de_a = presupuestos_a.crear(concepto="Pintura", receptor={"nombre": "Cliente A"},
                                             items=[{"descripcion": "Living", "cantidad": Decimal(1),
                                                     "precio_unitario": Decimal("50000"), "codigo": ""}])
    gasto_de_b = GastoStore(conn_de_tenant(b), b).crear(monto=Decimal("1000"), categoria="otros")
    trabajos_de_a = TrabajoStore(conn_de_tenant(a), a)

    resultado = trabajos_de_a.imputar(gasto_de_b["id"], "presupuesto", presupuesto_de_a["id"])
    assert resultado is None, "A pudo imputar un gasto de B a su propio trabajo"

    # el gasto de B sigue sin imputar: el intento de A no pudo ni siquiera ensuciarlo
    conn = conn_de_tenant(b)()
    with conn.cursor() as cur:
        cur.execute("SELECT presupuesto_ref FROM uc_factory.copiloto_gastos "
                    "WHERE cliente_id=%s AND id=%s", (b, gasto_de_b["id"]))
        assert cur.fetchone()[0] is None
    conn.close()

    # control positivo: A SÍ puede imputar SU PROPIO gasto a su propio trabajo
    gasto_de_a = GastoStore(conn_de_tenant(a), a).crear(monto=Decimal("1000"), categoria="otros")
    propio = trabajos_de_a.imputar(gasto_de_a["id"], "presupuesto", presupuesto_de_a["id"])
    assert propio["presupuesto_ref"] == presupuesto_de_a["id"]
