"""Salud por conexión del tenant (K-09, BL-J4): qué servicios «se cayeron» (hubo conexión y ya no sirve).

Una sola definición para las caras que la muestran -- `/catalog` (`status`), la regla del detector de
Mi día y `caja.incompleta` de la portada -- para que no puedan discrepar.

MercadoPago: `MpCredentialStore.salud()` (marca `reauth_desde` del refresh). Composio: la conexión existe
pero su estado es `EXPIRED` y no hay otra `ACTIVE` del mismo toolkit. Un `INITIATED`/`INITIALIZING` es un
intento a medias, no una caída.
"""
from __future__ import annotations

from typing import Callable, Iterable

MERCADOPAGO = "mercadopago"
ESTADOS_CAIDOS_COMPOSIO = frozenset({"EXPIRED"})


def toolkits_conectables() -> frozenset[str]:
    """Toolkits Composio que ESTA app ofrece conectar: `CALENDAR_POLICY` más los módulos de `services/`
    con acciones. Es la ÚNICA definición de «servicio soportado» (SM-N18): `/composio/connect`, `/catalog`
    y el aviso de conexión caída la comparten, así que no pueden discrepar. Una lista paralela diverge."""
    import services
    from calendar_policy import CALENDAR_POLICY
    return frozenset(CALENDAR_POLICY) | frozenset(services.connectable_policy())


def composio_caidos(conexiones: Iterable[dict], soportados: frozenset[str] | None = None) -> list[str]:
    """Toolkits Composio caídos: alguna cuenta en `EXPIRED` y ninguna `ACTIVE` del mismo toolkit.

    SM-N18: sólo los que la app SOPORTA (`toolkits_conectables()` salvo que se inyecte `soportados`).
    Composio lista TODO lo que el usuario autorizó alguna vez en su cuenta, también toolkits sin una sola
    tool acá (medido 2026-11-02: dos cuentas de un toolkit sin tool EXPIRED); avisar de ellos manda al usuario a
    «Reconectar» algo que la app no puede usar ni reconectar."""
    soportados = toolkits_conectables() if soportados is None else soportados
    activos, caidos = set(), set()
    for c in conexiones or ():
        toolkit = (c.get("toolkit") or "").lower()
        estado = (c.get("status") or "").upper()
        if not toolkit or toolkit not in soportados:
            continue
        if estado == "ACTIVE":
            activos.add(toolkit)
        elif estado in ESTADOS_CAIDOS_COMPOSIO:
            caidos.add(toolkit)
    return sorted(caidos - activos)


def diagnostico_conexiones(mp_store, composio_conexiones: Callable[[], Iterable[dict]] | None = None,
                           cliente_id: str | None = None) -> tuple[list[str], bool]:
    """`(caidos, composio_mirado)`. Distingue «sano» de «no pude mirar»: `caidos == []` sólo significa
    «sano» cuando `composio_mirado` es True.

    `composio_mirado` es False si no se inyectó la fuente (el schedule diario de Mi día no la tiene) o si
    Composio lanzó. Un consumidor que CIERRA por ausencia (el reconciliador de Mi día) no puede leer esa
    lista vacía como «ya no está caído»: afirmaría «lo resolviste» sobre una conexión que sigue vencida.
    """
    caidos = [MERCADOPAGO] if mp_store.salud() == "caido" else []
    mirado = False
    if composio_conexiones is not None:
        try:
            caidos += composio_caidos(composio_conexiones())
            mirado = True
        except Exception as exc:  # noqa: BLE001 -- el tablero no puede caerse por esto, pero tampoco callar
            from log_estructurado import log_error
            # SM-N56: con el tenant. Un rastro sin `cliente_id` en un sistema multi-tenant no se atribuye.
            log_error(exc, workflow="conexiones_salud", cliente_id=cliente_id,
                      extra={"costura": "composio_list_connections"})
    return caidos, mirado


def conexiones_caidas(mp_store, composio_conexiones: Callable[[], Iterable[dict]] | None = None) -> list[str]:
    """Claves de los servicios caídos de ESTE tenant: `mercadopago` primero, luego toolkits Composio.
    Si Composio falla, MP sigue valiendo: un aviso de MP no se pierde porque otro proveedor no contestó.
    Quien necesite saber si Composio llegó a mirarse usa `diagnostico_conexiones`."""
    return diagnostico_conexiones(mp_store, composio_conexiones)[0]
