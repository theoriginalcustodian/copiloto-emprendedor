"""SM-P20 punto 1: «Para hoy» sale críticas primero, después por vencimiento, con desempate estable."""
import datetime

from mi_dia_clasificacion import clasificar
from mi_dia_tarjeta_store import ordenar_para_hoy

HOY = datetime.date.today()


def _t(id_, regla, datos, creada="2026-11-01T12:00:00+00:00"):
    return {"id": id_, "regla": regla, "datos": datos, "creada_en": creada, **clasificar(regla)}


def test_critica_sin_vencimiento_luego_la_que_vence_hoy_luego_sin_vencimiento():
    no_critica_sin_venc = _t("3", "presupuestos_enfriandose", {})
    vence_hoy = _t("2", "cae_por_vencer", {"cae_vto": HOY.isoformat()})
    critica_sin_venc = _t("1", "conexion_caida", {})
    # Entrada en el orden del SQL (creada_en DESC), a propósito al revés de lo esperado.
    salida = ordenar_para_hoy([no_critica_sin_venc, vence_hoy, critica_sin_venc])
    assert [t["id"] for t in salida] == ["1", "2", "3"]


def test_dentro_de_la_misma_criticidad_vence_antes_arriba():
    tarde = _t("a", "cae_por_vencer", {"cae_vto": (HOY + datetime.timedelta(days=9)).isoformat()})
    pronto = _t("b", "cae_por_vencer", {"cae_vto": (HOY + datetime.timedelta(days=1)).isoformat()})
    assert [t["id"] for t in ordenar_para_hoy([tarde, pronto])] == ["b", "a"]


def test_empate_conserva_el_orden_de_entrada_y_es_estable_entre_lecturas():
    # Misma criticidad, ambos sin vencimiento: manda el creada_en DESC con que llegan del SQL.
    nueva = _t("n", None, {}, creada="2026-11-05T10:00:00+00:00")
    vieja = _t("v", None, {}, creada="2026-11-01T10:00:00+00:00")
    primera = [t["id"] for t in ordenar_para_hoy([nueva, vieja])]
    segunda = [t["id"] for t in ordenar_para_hoy([nueva, vieja])]
    assert primera == segunda == ["n", "v"]
