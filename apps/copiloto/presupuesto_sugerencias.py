"""Sugerencias de próximo paso tras guardar / aprobar un presupuesto (K-07, BL-J9).

Puras y aditivas: un cliente que no lee `sugerencias` / `sugerencia` sigue funcionando igual. La forma es
un objeto por tipo de sugerencia (no un array de strings) para poder agregar tipos sin romper a nadie.
"""
from __future__ import annotations

KIND_ARMAR_FACTURA = "armar_factura"


def sugerencias_de_guardado(presupuesto: dict) -> dict | None:
    """`POST /presupuestos`: «Mandalo por mail» sólo si hay un Doc que mandar (`doc_link`); si no, `None`."""
    doc_link = presupuesto.get("doc_link")
    if not doc_link:
        return None
    return {"mandar_por_mail": {"doc_link": doc_link}}


def sugerencia_de_aprobacion(presupuesto: dict) -> dict:
    """`marcar_presupuesto` → aprobado: el chip «¿Te armo la factura?» del cliente."""
    return {"kind": KIND_ARMAR_FACTURA, "presupuesto_id": presupuesto["id"], "texto": "¿Te armo la factura?"}
