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

import trabajo_store
from presupuesto_store import workflow_id_de_factura


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
