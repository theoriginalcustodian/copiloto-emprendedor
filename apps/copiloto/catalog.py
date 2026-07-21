"""Catálogo de servicios del Copiloto (Task 5, handoff §7.7) — capa PURA (sin imports de temporal/fastmcp/
fastapi) para que sea testeable aislado. `web.py` (front-door, NO tocar acá) cablea `GET /catalog` invocando
`build_catalog(...)` con:
  - `valid_toolkits`: los toolkits Composio soportados por ESTA instancia, derivados de la MISMA fuente que
    valida `/composio/connect` (`_composio_valid_toolkits()` en `web.py` = `{**CALENDAR_POLICY, **services.merged_policy()}`
    — nunca una lista literal aparte que pueda driftear).
  - `mp_connected` / `composio_connected`: el mismo shape que ya devuelve `/me`.

Metadata de presentación (`display_name`, `work_label`, `category`, `description`, `capabilities`) vive en
`_PRESENTATION` — un mapa DECLARATIVO, no código. Sumar un servicio Composio nuevo en `services/<svc>.py`
(discovery automático, ver `services/__init__.py`) lo hace aparecer en `/catalog` SIN tocar este módulo: si
el toolkit no está en `_PRESENTATION`, `_default_presentation` arma una entrada razonable a partir del slug
(fail-open a "aparece con defaults", nunca fail-closed a "se omite" — regla dura del prompt: "NO romper, NO
omitir"). Editar `_PRESENTATION` es solo una mejora de copy, no un requisito para que el servicio funcione.

MercadoPago (`kind="payments"`) es el único servicio que NO es Composio -- no vive en `valid_toolkits` (ese
conjunto es puramente Composio, ver `_composio_valid_toolkits()`); se agrega siempre, aparte, con su propio
flag `mp_connected`."""
from __future__ import annotations

MERCADOPAGO_KEY = "mercadopago"

# Metadata de presentación es-AR por servicio (clave = slug real: el mismo que emite `/composio/connect?service=`
# o, para MP, la clave literal 'mercadopago'). NO es la fuente de verdad de "qué servicios existen" -- eso lo
# decide `valid_toolkits` (derivado de la policy real); este mapa SOLO mejora el copy de los que ya existen.
_PRESENTATION: dict[str, dict] = {
    MERCADOPAGO_KEY: {
        "display_name": "Mercado Pago",
        "work_label": "Cobrar",
        "category": "Pagos",
        "description": "Generá links de cobro y cobrá desde el chat.",
        "capabilities": ["Generar link de cobro"],
    },
    "gmail": {
        "display_name": "Gmail",
        "work_label": "Mail",
        "category": "Comunicación",
        "description": "Enviá y buscá mails desde el chat.",
        "capabilities": ["Leer mails", "Enviar mails", "Buscar"],
    },
    "googlecalendar": {
        "display_name": "Google Calendar",
        "work_label": "Agenda",
        "category": "Agenda",
        "description": "Agendá reuniones y turnos en tu Google Calendar.",
        "capabilities": ["Agendar reuniones", "Buscar turnos"],
    },
    "hubspot": {
        "display_name": "HubSpot",
        "work_label": "Clientes",
        "category": "Clientes (CRM)",
        "description": "Guardá y buscá tus clientes en el CRM.",
        "capabilities": ["Guardar un cliente", "Buscar un cliente"],
    },
    "googledrive": {
        "display_name": "Google Drive",
        "work_label": "Archivos",
        "category": "Archivos",
        "description": "Creá y buscá archivos en tu Google Drive.",
        "capabilities": ["Crear archivo", "Buscar archivo"],
    },
    "googledocs": {
        "display_name": "Google Docs",
        "work_label": "Archivos",
        "category": "Archivos",
        "description": "Creá y leé documentos en Google Docs.",
        "capabilities": ["Crear documento", "Leer documento"],
    },
    "googlesheets": {
        "display_name": "Google Sheets",
        "work_label": "Archivos",
        "category": "Archivos",
        "description": "Agregá y leé datos en tus planillas de Google Sheets.",
        "capabilities": ["Agregar fila", "Actualizar datos", "Leer planilla"],
    },
    "instagram": {
        "display_name": "Instagram",
        "work_label": "Instagram",
        "category": "Redes",
        "description": "Mirá tu cuenta y publicá fotos en Instagram.",
        "capabilities": ["Ver cuenta", "Ver publicaciones", "Publicar foto"],
    },
}

_DEFAULT_CATEGORY = "Otros"
_DEFAULT_DESCRIPTION = "Servicio conectado vía Composio."


def _default_presentation(toolkit: str) -> dict:
    """Fallback para un toolkit Composio que existe en `valid_toolkits` pero todavía no tiene copy dedicado
    en `_PRESENTATION` (recién sumado en `services/<svc>.py`). Nunca se omite -- requisito duro del catálogo."""
    display_name = toolkit.replace("_", " ").title()
    return {
        "display_name": display_name,
        "work_label": display_name,
        "category": _DEFAULT_CATEGORY,
        "description": _DEFAULT_DESCRIPTION,
        "capabilities": [],
    }


def _entry(key: str, *, kind: str, connected: bool) -> dict:
    presentation = _PRESENTATION.get(key) or _default_presentation(key)
    es_pago = kind == "payments"
    connect_path = "/mp/connect" if es_pago else f"/composio/connect?service={key}"
    # `disconnect_path` viaja igual que `connect_path` y por la misma razón: la regla "MercadoPago va
    # por un lado y Composio por otro" tiene UN dueño, y no es el cliente. Reconstruirla en la app
    # desde la `key` se rompe justo en MP, que no es Composio. El cliente lo usa TAL CUAL.
    disconnect_path = "/mp/connection" if es_pago else f"/composio/connection?service={key}"
    return {
        "key": key,
        "display_name": presentation["display_name"],
        "work_label": presentation["work_label"],
        "category": presentation["category"],
        "kind": kind,
        "description": presentation["description"],
        "capabilities": list(presentation["capabilities"]),
        "connected": connected,
        "connect_path": connect_path,
        "disconnect_path": disconnect_path,
    }


def build_catalog(*, valid_toolkits, mp_connected: bool, composio_connected) -> list[dict]:
    """Catálogo completo (MercadoPago + todos los toolkits Composio soportados), en el shape del contrato
    `GET /catalog` (handoff §7.7). `valid_toolkits`: iterable de slugs Composio (derivado por el caller de la
    MISMA fuente que valida `/composio/connect`, NUNCA hardcodeado acá). `composio_connected`: iterable de
    slugs conectados (mismo shape que `/me`). Orden determinístico (sorted) -- ni `valid_toolkits` (puede ser
    un frozenset/dict) ni `composio_connected` garantizan orden estable entre corridas."""
    connected_set = set(composio_connected or ())
    services = [_entry(MERCADOPAGO_KEY, kind="payments", connected=bool(mp_connected))]
    for toolkit in sorted(valid_toolkits or ()):
        services.append(_entry(toolkit, kind="composio", connected=toolkit in connected_set))
    return services
