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

# PROTO4DEPS §2 (contrato 2026-10-13): qué límite lleva cada capacidad que la hoja «Conectar X» le
# promete al usuario. ENUM CERRADO -- agregar un valor exige enmendar el contrato (la app trata uno
# desconocido como `ninguna`, así que un valor nuevo sin declarar se vuelve invisible). El backend
# emite SEMÁNTICA; la etiqueta («Solo lectura», «Nunca sin tu OK») la pinta la app.
CONDICION_SOLO_LECTURA = "solo_lectura"   # la capacidad sólo lee: no cambia nada del lado del servicio
CONDICION_REQUIERE_OK = "requiere_ok"     # escribe, y NUNCA sin que el usuario confirme (confirm-gate)
CONDICION_NINGUNA = "ninguna"             # sin calificador que mostrar
CONDICIONES = (CONDICION_SOLO_LECTURA, CONDICION_REQUIERE_OK, CONDICION_NINGUNA)


def _cap(texto: str, condicion: str) -> dict:
    return {"texto": texto, "condicion": condicion}

# Metadata de presentación es-AR por servicio (clave = slug real: el mismo que emite `/composio/connect?service=`
# o, para MP, la clave literal 'mercadopago'). NO es la fuente de verdad de "qué servicios existen" -- eso lo
# decide `valid_toolkits` (derivado de la policy real); este mapa SOLO mejora el copy de los que ya existen.
_PRESENTATION: dict[str, dict] = {
    MERCADOPAGO_KEY: {
        "display_name": "Mercado Pago",
        "work_label": "Cobrar",
        "category": "Pagos",
        "description": "Generá links de cobro y cobrá desde el chat.",
        # «movimientos» NO: lo que Copiloto lee de MP son los PAGOS que entran (webhook ->
        # `mp_payments`), no el extracto de la cuenta. Prometer «movimientos» sería decir de más.
        "alcance": [_cap("Leer tus cobros", CONDICION_SOLO_LECTURA),
                    _cap("Armar links de cobro cuando vos confirmás", CONDICION_REQUIERE_OK)],
    },
    "gmail": {
        "display_name": "Gmail",
        "work_label": "Mail",
        "category": "Comunicación",
        "description": "Enviá y buscá mails desde el chat.",
        "alcance": [_cap("Leer mails", CONDICION_SOLO_LECTURA),
                    _cap("Enviar mails", CONDICION_REQUIERE_OK),
                    _cap("Buscar", CONDICION_SOLO_LECTURA)],
    },
    "googlecalendar": {
        "display_name": "Google Calendar",
        "work_label": "Agenda",
        "category": "Agenda",
        "description": "Agendá reuniones y turnos en tu Google Calendar.",
        "alcance": [_cap("Agendar reuniones", CONDICION_REQUIERE_OK),
                    _cap("Buscar turnos", CONDICION_SOLO_LECTURA)],
    },
    "googledrive": {
        "display_name": "Google Drive",
        "work_label": "Archivos",
        "category": "Archivos",
        "description": "Creá y buscá archivos en tu Google Drive.",
        "alcance": [_cap("Crear archivo", CONDICION_REQUIERE_OK),
                    _cap("Buscar archivo", CONDICION_SOLO_LECTURA)],
    },
    "googledocs": {
        "display_name": "Google Docs",
        "work_label": "Archivos",
        "category": "Archivos",
        "description": "Creá y leé documentos en Google Docs.",
        "alcance": [_cap("Crear documento", CONDICION_REQUIERE_OK),
                    _cap("Leer documento", CONDICION_SOLO_LECTURA)],
    },
    "googlesheets": {
        "display_name": "Google Sheets",
        "work_label": "Archivos",
        "category": "Archivos",
        "description": "Agregá filas a tus planillas de Google Sheets.",
        "alcance": [_cap("Agregar fila", CONDICION_REQUIERE_OK)],
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
        "alcance": [],
    }


def _entry(key: str, *, kind: str, connected: bool, status: str | None = None) -> dict:
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
        # `capabilities` (list[str]) se CONSERVA tal cual: la web lo tipa como `string[]` y renderiza cada
        # elemento como hijo de React; un objeto ahí rompería el sheet sin avisar. Sale de la MISMA lista
        # que `alcance_items`, así que no pueden driftear. Baja de `capabilities` cuando web y mobile lean
        # `alcance_items` (fecha a fijar por planificación).
        "capabilities": [c["texto"] for c in presentation["alcance"]],
        "alcance_items": [dict(c) for c in presentation["alcance"]],
        # K-09: `status` distingue «caido» (hubo conexión y ya no sirve) de «nunca_conectado».
        # `connected` se conserva para clientes viejos y es siempre `status == "conectado"`.
        "connected": connected,
        "status": status or ("conectado" if connected else "nunca_conectado"),
        "connect_path": connect_path,
        "disconnect_path": disconnect_path,
    }


KIND_REQUIERE_CONEXION = "requiere_conexion"


def pendiente_de_cobro(arguments: dict | None) -> str | None:
    """`pendiente.texto` del gate de MercadoPago: lo que el usuario estaba pidiendo cuando se disparó la
    card, sacado de los ARGUMENTOS de `mp_charge` (el mismo dato que se va a ejecutar al conectar), nunca
    redactado por un LLM ni inferido del texto del turno. Con monto válido lo dice; sin él, igual es
    verdad («armar el link de cobro»)."""
    monto = (arguments or {}).get("amount")
    try:
        monto = float(monto)
    except (TypeError, ValueError):
        # Degradar acá es correcto, no un tragado: un monto no numérico deja al `pendiente` sin cifra,
        # y «armar el link de cobro» sigue siendo verdad. Esta card sólo describe; no valida el cobro.
        return "armar el link de cobro"
    if not monto > 0 or monto != monto or monto == float("inf"):
        return "armar el link de cobro"
    entero = f"{monto:,.0f}" if monto == int(monto) else f"{monto:,.2f}"
    return f"armar el link de cobro de ${entero}".replace(",", "X").replace(".", ",").replace("X", ".")


def requiere_conexion_card(service: str, label: str, *, pendiente: str | None = None) -> dict:
    """`card` del reply cuando un turno cae en `ConnectionRequired` (K-11, BL-J8): el sheet «conectá X»
    que la app pinta en contexto. `alcance` y `connect_path` salen de `_entry`, la MISMA fuente que
    `GET /catalog` (cero copy duplicado: una segunda lista de permisos driftearía). `label` lo pone quien
    llama para que coincida con el texto del reply.

    `bloquea: True` (A2/K-07-B): esta card nunca la pisa una `gate_card` posterior que no bloquea —
    la prioridad viaja EN la card porque `conversation_workflow` es domain-blind y no puede decidir por
    `kind` (contrato K-07-B §2). Ver `conversation_workflow._react_loop`."""
    key = (service or "").lower()
    entry = _entry(key, kind="payments" if key == MERCADOPAGO_KEY else "composio", connected=False)
    card = {"kind": KIND_REQUIERE_CONEXION, "service": key, "label": label, "bloquea": True,
            "alcance": entry["capabilities"], "alcance_items": entry["alcance_items"],
            "connect_path": entry["connect_path"]}
    # `pendiente` va en la CARD (es del turno, no del servicio) y es OPCIONAL: un gate disparado por algo
    # que no se puede resumir en una frase es el caso normal, y entonces la clave está AUSENTE -- nunca
    # `null` ni un texto de relleno (la app tiene que verse bien sin él).
    if pendiente and pendiente.strip():
        card["pendiente"] = {"texto": pendiente.strip()}
    return card


# H5b (contrato 2026-10-13): el `tipo` del `destino` de una tarjeta. ENUM CERRADO: hoy un solo valor, y
# agregar otro exige enmendar el contrato (la app trata un `tipo` desconocido como «ir a Ajustes»).
# Coincide a propósito con el `entidad_tipo` de la tarjeta `conexion_caida`.
TIPO_DESTINO_CONEXION = "conexion"


def destino_conexion(service: str) -> dict:
    """`destino` de la tarjeta crítica `conexion_caida` (H5b): a qué conexión puntual lleva «Reconectar».

    El backend emite SEMÁNTICA (`tipo` + `id`); el ruteo a una pantalla es de la app. El `connect_path`
    sale de `_entry`, la MISMA fuente que `GET /catalog` y `requiere_conexion_card`, y se copia TAL CUAL:
    MercadoPago va por `/mp/connect` y Composio por `/composio/connect?service=<key>`; armarlo desde la
    `key` en otro lado se rompe justo en el servicio que cobra (`catalogo.test.ts:111-114` lo declara).
    `id` es el `service` recibido, o sea el mismo valor que el `entidad_id` de la tarjeta."""
    key = (service or "").lower()
    entry = _entry(key, kind="payments" if key == MERCADOPAGO_KEY else "composio", connected=False)
    return {"tipo": TIPO_DESTINO_CONEXION, "id": service, "connect_path": entry["connect_path"]}


KIND_SUGERENCIA_ARMAR_FACTURA = "sugerencia_armar_factura"


def sugerencia_armar_factura_card(presupuesto_id: int, texto: str) -> dict:
    """`card` del reply al APROBAR un presupuesto (K-07-B, BL-J9): el chip «¿Te armo la factura?».
    NO es un gate (no pausa el turno ni pide confirmación): informa y ofrece. El cliente decide por
    `kind`, nunca por `texto`. Viaja por el mismo camino que `requiere_conexion_card` (`gate_card`).

    `bloquea: False` explícito (A2): si el mismo turno también deja una card que bloquea (p. ej.
    `requiere_conexion_card`), ésta no la pisa — ver `conversation_workflow._react_loop`."""
    return {"kind": KIND_SUGERENCIA_ARMAR_FACTURA, "presupuesto_id": presupuesto_id, "texto": texto,
            "bloquea": False}


def build_catalog(*, valid_toolkits, mp_connected: bool, composio_connected,
                  mp_status: str | None = None, composio_caidos=(),
                  acciones_por_toolkit=None) -> list[dict]:
    """Catálogo completo (MercadoPago + todos los toolkits Composio soportados), en el shape del contrato
    `GET /catalog` (handoff §7.7). `valid_toolkits`: iterable de slugs Composio (derivado por el caller de la
    MISMA fuente que valida `/composio/connect`, NUNCA hardcodeado acá). `composio_connected`: iterable de
    slugs conectados (mismo shape que `/me`). Orden determinístico (sorted) -- ni `valid_toolkits` (puede ser
    un frozenset/dict) ni `composio_connected` garantizan orden estable entre corridas.
    `acciones_por_toolkit` (`services.acciones_por_toolkit()`, derivado de `TOOLS`): cada entrada Composio
    declara QUÉ acciones tiene, para que la UI no prometa lo que el conector no hace (A8)."""
    connected_set = set(composio_connected or ())
    caidos = set(composio_caidos or ())
    acciones = acciones_por_toolkit or {}
    # `mp_connected` decide `connected` (una sola decisión: web.py `_mp_connected`). `mp_status` sólo
    # describe el campo `status`; no lo re-deriva (MPCATALOGDESCARTA, auditoría 2026-10-06).
    services =[_entry(MERCADOPAGO_KEY, kind="payments", connected=bool(mp_connected), status=mp_status)]
    for toolkit in sorted(valid_toolkits or ()):
        conectado = toolkit in connected_set
        entrada = _entry(toolkit, kind="composio", connected=conectado,
                         status="conectado" if conectado else
                         ("caido" if toolkit in caidos else "nunca_conectado"))
        entrada["acciones"] = list(acciones.get(toolkit, ()))
        services.append(entrada)
    return services
