"""SM-P19 mitad B (2026-11-06): lo que el emprendedor GUARDA en una función aparece como turno en el chat.

Sin endpoint nuevo: el MISMO handler del GUARDAR, cuando el guardado salió bien y vino `session_id`, inserta
una fila en `copiloto_web_replies` por `make_pg_reply_sink` — el mismo camino de escritura que usa el
worker, así que la app lo lee con el `GET /reply` de siempre. Una segunda llamada (`POST /hilo/actividad`)
podía fallar entre medio (guardado OK, turno perdido) y le hacía armar el texto a la app: descartada.

Contrato de la card (`kind = actividad_registrada`; «actividad» = el feed SQL de NEGOCIO, nunca la memoria
conversacional — ver CONTEXT.md):

    {"kind": "actividad_registrada", "tipo": <TIPOS>, "id": <id de la fila>, "resumen": <respuesta literal del POST>}

`resumen` es EXACTAMENTE lo que el POST devolvió, sin renombrar: una sola fuente para la app.

🔒 Aislamiento: el `cliente_id` sale SIEMPRE del token (lo pasa el handler, nunca el body). Si A manda el
`session_id` de B, la fila queda bajo A y `read_replies` de B —que filtra por SU `cliente_id`— no la ve.
Idempotencia: `idem_key = act-<tipo>-<id>`. Reintentar el guardado devuelve el MISMO id (los POST ya son
idempotentes por su propia clave), así que el turno choca contra el índice único y queda 1.

Lo que NO hace (diferido por planificación, con motivo): no le manda signal al ConversationWorkflow; el
turno es visual y el agente alcanza el dato por sus tools."""
from __future__ import annotations

import logging
from typing import Callable

from pydantic_core import to_jsonable_python

from log_estructurado import log_error

KIND = "actividad_registrada"
TIPOS = ("gasto", "cobro", "factura", "presupuesto", "cliente")
SESSION_ID_MAX = 200    # mismo orden que los channel_ref del chat; un body con 10 kB de session_id es basura

_log = logging.getLogger(__name__)

Publicar = Callable[[str, "str | None", str, object, dict], None]


def _plata(v) -> str:
    """`"12000.50"` → `$12.000,50`; `"12000.00"` → `$12.000`. Mismo formato que las frases del chat."""
    try:
        entero, _, dec = f"{float(v):.2f}".partition(".")
    except (TypeError, ValueError):  # monto ilegible: se muestra tal cual antes que inventar un número
        return f"${v}"
    entero = f"{int(entero):,}".replace(",", ".")
    return f"${entero}" if dec == "00" else f"${entero},{dec}"


def frase(tipo: str, resumen: dict) -> str:
    """El texto del turno, por CÓDIGO (determinista). Dice lo que quedó guardado, con los mismos campos que
    viajan en `resumen`, y nada que el guardado no haya confirmado."""
    if tipo == "gasto":
        detalle = resumen.get("proveedor") or resumen.get("descripcion") or resumen.get("categoria")
        return f"Anoté un gasto de {_plata(resumen.get('monto'))}" + (f" ({detalle})." if detalle else ".")
    if tipo == "cobro":
        ing = resumen.get("ingreso") or {}
        quien = ing.get("cliente_nombre")
        texto = f"Anoté un cobro de {_plata(ing.get('monto'))}" + (f" de {quien}." if quien else ".")
        falta = [{"cliente": "de quién", "medio": "cómo te pagaron", "concepto": "por qué"}[f]
                 for f in ing.get("falta") or [] if f in ("cliente", "medio", "concepto")]
        if falta:
            texto += " Si querés, después completás " + " y ".join(falta) + "."
        return texto
    if tipo == "presupuesto":
        p = resumen.get("presupuesto") or {}
        a_quien = (p.get("receptor") or {}).get("nombre")
        num = f" N° {p['numero']}" if p.get("numero") else ""
        return (f"Guardé el presupuesto{num} por {_plata(p.get('total'))}"
                + (f" para {a_quien}." if a_quien else "."))
    if tipo == "cliente":
        return f"Agregué a {resumen.get('nombre') or 'el cliente'} a tus clientes."
    if tipo == "factura":
        # 🔴 «mandé a emitir», NUNCA «emitida»: `confirmar` devuelve que el workflow ACEPTÓ la orden; el CAE
        # llega después y puede fallar. Decir «emitida» acá es afirmar algo que el guardado no confirmó.
        return "Mandé a emitir la factura. Te aviso acá cuando ARCA la autorice."
    raise ValueError(f"tipo de actividad desconocido: {tipo!r}")


def make_publicar_actividad(reply_sink: Callable) -> Publicar:
    """`publicar(cliente_id, session_id, tipo, id, resumen)`. No-op si `session_id` viene vacío (la app vieja,
    o un guardado hecho fuera del chat). Nunca levanta: el guardado YA está hecho y es la fuente de verdad;
    un turno que no se pudo escribir se loguea con fingerprint, pero no convierte un 201 en un 500 que haría
    reintentar algo que salió bien."""
    def publicar(cliente_id: str, session_id: str | None, tipo: str, id_, resumen: dict) -> None:
        if not session_id:
            return
        if tipo not in TIPOS:
            raise ValueError(f"tipo de actividad desconocido: {tipo!r}")   # error de programación: que se vea
        # El MISMO serializador (pydantic-core) con el que FastAPI escribe la respuesta: `resumen` queda igual
        # a lo que vio la app — `jsonable_encoder` daba `+00:00` donde la respuesta dice `Z` (medido en el
        # test de integración). Además el `datetime` del presupuesto no pasa por el `json.dumps` del sink.
        resumen = to_jsonable_python(resumen)
        card = {"kind": KIND, "tipo": tipo, "id": id_, "resumen": resumen}
        try:
            reply_sink(cliente_id, session_id, frase(tipo, resumen), None, card,
                       idem_key=f"act-{tipo}-{id_}")
        except Exception as exc:  # noqa: BLE001 — el guardado ya existe; perder el turno no lo deshace
            log_error(exc, workflow="actividad_al_hilo", cliente_id=cliente_id,
                      extra={"tipo": tipo, "id": str(id_)})
            _log.warning("turno de actividad %s/%s no escrito (cliente=%s): %s", tipo, id_, cliente_id, exc)
    return publicar
