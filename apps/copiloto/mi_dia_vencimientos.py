"""SM-P20 punto 2: «Vencen esta semana» = obligaciones del NEGOCIO que vencen, NO eventos de Calendar.

Mismas dos fuentes que el detector de «Mi día» (`mi_dia_detector._candidatos_cae_por_vencer` /
`_candidatos_certificado_por_vencer`), sin duplicar ninguna query:
  * CAE de cada comprobante no anulado → `AfipComprobanteStore.con_cae_vigente()` (`dias_para_vencer` en SQL).
  * certificado de ARCA → `AfipCredentialStore.vencimientos()` (la fecha sale del propio certificado).

Forma de cada item (`GET /mi-dia/vencimientos`):
    {"tipo": "cae"|"certificado", "id": str, "titulo": str, "fecha": "YYYY-MM-DD"|None,
     "dias": int|None, "vencido": bool}

Ventana: lo que vence de hoy a `dias` (inclusive) MÁS lo ya vencido, porque una obligación vencida es lo
más urgente de la lista, no algo que se cae de ella. Un certificado ILEGIBLE sale igual (`dias=None`): si se
omitiera, el tenant con un certificado roto se vería igual que uno sin nada que vencer."""
from __future__ import annotations

from datetime import date, datetime
from typing import Callable, Iterable

DIAS_VENTANA_DEFAULT = 7


def _iso(v) -> str | None:
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    return v[:10] if isinstance(v, str) and v else None


def armar(caes: Iterable[dict], certificados: Iterable[dict], dias: int = DIAS_VENTANA_DEFAULT) -> list[dict]:
    """Pura: une las dos fuentes, filtra por ventana y ordena (vence antes arriba; ilegibles al final)."""
    items: list[dict] = []
    for c in caes:
        d = c.get("dias_para_vencer")
        if d is None or d > dias:
            continue
        nro = c.get("nro")
        items.append({"tipo": "cae", "id": str(c["id"]),
                      "titulo": f"CAE de la factura N° {nro}" if nro is not None else "CAE de una factura",
                      "fecha": _iso(c.get("cae_vto")), "dias": d, "vencido": d < 0})
    for k in certificados:
        d = k.get("dias_para_vencer")
        if not k.get("ilegible") and (d is None or d > dias):
            continue
        items.append({"tipo": "certificado", "id": str(k.get("cuit")),
                      "titulo": ("No se pudo leer el certificado de ARCA" if k.get("ilegible")
                                 else "Certificado de ARCA"),
                      "fecha": _iso(k.get("vence_at")), "dias": d, "vencido": d is not None and d < 0})
    return sorted(items, key=lambda i: (i["dias"] is None, i["dias"] if i["dias"] is not None else 0))


def make_listar_vencimientos(conn_factory: Callable, crypto) -> Callable[[str, int], list[dict]]:
    """Composition root: `listar(cliente_id, dias)`. `cliente_id` lo pasa el endpoint desde el token."""
    from afip_comprobante_store import AfipComprobanteStore
    from afip_credential_store import AfipCredentialStore

    def listar(cliente_id: str, dias: int = DIAS_VENTANA_DEFAULT) -> list[dict]:
        return armar(AfipComprobanteStore(conn_factory, cliente_id).con_cae_vigente(),
                     AfipCredentialStore(conn_factory, cliente_id, crypto).vencimientos(), dias)
    return listar
