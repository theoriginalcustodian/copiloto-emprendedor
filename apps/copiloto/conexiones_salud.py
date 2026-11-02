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
    tool acá (medido 2026-11-02: dos cuentas `instagram` EXPIRED); avisar de ellos manda al usuario a
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


def conexiones_caidas(mp_store, composio_conexiones: Callable[[], Iterable[dict]] | None = None) -> list[str]:
    """Claves de los servicios caídos de ESTE tenant: `mercadopago` primero, luego toolkits Composio.
    `composio_conexiones` es opcional; si Composio falla, MP sigue valiendo: un aviso de MP no se pierde
    porque otro proveedor no contestó."""
    caidos = [MERCADOPAGO] if mp_store.salud() == "caido" else []
    if composio_conexiones is not None:
        try:
            caidos += composio_caidos(composio_conexiones())
        except Exception:  # noqa: BLE001 -- degradación: el tablero no puede caerse por esto
            pass
    return caidos
