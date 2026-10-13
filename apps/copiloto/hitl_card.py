"""hitl_card — `detalle` y `recibo` de la card HITL (C-D3, contrato 2026-10-13).

Hasta hoy la card del gate viajaba como `{kind:"confirm", service, label}` y el contenido de la acción
sólo existía como TEXTO (`preview`): la app sacaba el destinatario y el monto con regex del markdown, y
tras confirmar no había nada que pintar como recibo. Esto agrega los dos datos estructurados:

    card.detalle = {titulo, filas:[{k, v, sub, editable}], cita, nota}   # en el gate (antes de confirmar)
    card.recibo  = {titulo, meta, accion}                                # sólo en el cierre tras confirmar

**De dónde sale:** de los `arguments` de la acción —los mismos que el workflow parquea
(`pend["tool_call"]["arguments"]`) y vuelve a ejecutar al confirmar—, NUNCA del `preview`. El `preview` es
texto redactado para leerse; parsearlo es exactamente el defecto que esto cierra (dos fuentes de verdad,
con la regex al frente). Lo que se muestra es, por construcción, lo que se va a ejecutar.

**Piloto: un solo servicio (Gmail).** Decisión del contrato C-D3: no se migran los cinco. Un servicio sin
entrada acá devuelve `None` y su card queda exactamente como antes (`{kind, service, label}`). Migrar otro
es agregar UNA entrada a `_POR_TOOLKIT`; el motor no se toca (sólo re-empaqueta lo que le llega).

**Capa:** esto es del dominio (conoce Gmail). El motor (`conversation_workflow`) es domain-blind: copia
`observation["detalle"]` a la card y `observation["recibo"]` al cierre, sin mirar qué dicen.
"""
from __future__ import annotations

import datetime
from typing import Callable

from gasto_store import ZONA_DEL_NEGOCIO

def _hora_del_negocio(now_iso: str | None) -> str | None:
    """`HH:MM` en la zona del negocio (UTC−3). `None` si no hay reloj o no parsea — el recibo igual sale,
    sin hora, antes que inventar una. Un ISO sin zona se toma tal cual (ya viene en hora local)."""
    if not now_iso:
        return None
    try:
        ahora = datetime.datetime.fromisoformat(now_iso)
    except ValueError:
        # Un reloj que no parsea no es un error del envío: el recibo sale igual, sin hora. Es preferible
        # a inventar una, y a tumbar la confirmación (que YA ejecutó) por un detalle de presentación.
        return None
    if ahora.tzinfo is not None:
        ahora = ahora.astimezone(ZONA_DEL_NEGOCIO)
    return ahora.strftime("%H:%M")


def _detalle_gmail(args: dict) -> dict | None:
    para = str(args.get("recipient_email") or "").strip()
    if not para:
        return None
    return {
        "titulo": f"Mail a {para}",
        "filas": [
            {"k": "Para", "v": para, "sub": None, "editable": False},
            {"k": "Asunto", "v": str(args.get("subject") or ""), "sub": None, "editable": False},
        ],
        # El cuerpo va ENTERO, sin recortar: quien confirma tiene que ver LO QUE SE VA A MANDAR, y un
        # cuerpo cortado es una confirmación sobre texto que no leyó.
        "cita": str(args.get("body") or "") or None,
        "nota": "Se manda desde tu Gmail.",
    }


def _recibo_gmail(args: dict, hora: str | None) -> dict | None:
    para = str(args.get("recipient_email") or "").strip()
    if not para:
        return None
    # `accion` es una decisión de pantalla (adónde lleva el botón del recibo): el backend no conoce las
    # pantallas, así que no la inventa. La app pone la suya.
    return {"titulo": f"Mandado a {para}", "meta": hora, "accion": None}


# toolkit (como lo nombra `Module.TOOLKIT`) -> (armar detalle, armar recibo)
_POR_TOOLKIT: dict[str, tuple[Callable[[dict], dict | None], Callable[[dict, str | None], dict | None]]] = {
    "gmail": (_detalle_gmail, _recibo_gmail),
}

TOOLKITS_CON_DETALLE = frozenset(_POR_TOOLKIT)


def detalle_de(toolkit: str, arguments: dict | None) -> dict | None:
    """`card.detalle` del gate de este servicio, o `None` si el servicio no lo tiene (card sin cambios)."""
    entrada = _POR_TOOLKIT.get((toolkit or "").lower())
    return entrada[0](arguments or {}) if entrada else None


def recibo_de(toolkit: str, arguments: dict | None, now_iso: str | None) -> dict | None:
    """`card.recibo` para después de una ejecución CONFIRMADA y exitosa, o `None`."""
    entrada = _POR_TOOLKIT.get((toolkit or "").lower())
    return entrada[1](arguments or {}, _hora_del_negocio(now_iso)) if entrada else None
