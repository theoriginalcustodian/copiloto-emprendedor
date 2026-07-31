"""Costura C2 — la captura de errores de TODAS las rutas HTTP, en un solo lugar.

**Por qué existe.** Medición del 2026-07-31: el backend tiene **80 rutas** en 9 módulos y `log_error`
estaba cableado a mano en **2** — las dos en `presupuestos_web.py`. Las otras 78 fallaban en silencio:
el usuario veía un 500 y del lado del servidor no quedaba nada que mirar. Cablear a mano tiene el peor
default posible, **cero cobertura**, y olvidarse no da ningún síntoma.

Las 9 apps se pliegan al front-door con `include_router` (verificado: el único `app.mount()` es el de
los assets estáticos), así que **un** handler en el front-door cubre todas las rutas.

---

## Qué atrapa, y qué NO — la distinción que hace que el registro signifique algo

**Sí:** las excepciones **no manejadas** — el bug, el `KeyError`, la DB caída. Eso es un fallo del
sistema y tiene que quedar registrado.

**No:** los `HTTPException` — el 404 de "no existe", el 409 de "ya está facturado", el 400 de dato
inválido. **Son respuestas de negocio correctas, no fallos**, y Starlette las resuelve por su propio
camino antes de llegar acá. Si se registraran, el log se llenaría de operación normal y en dos semanas
nadie lo miraría: *un guard que grita en el caso normal se desarma solo*
([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]). El test de control lo fija.

## Qué ve el usuario

Un 500 con el **fingerprint** y nada más. No el mensaje de la excepción: puede llevar PII, datos
fiscales o estructura interna. El fingerprint le sirve para citarlo si vuelve a escribir, y a nosotros
para encontrar la línea exacta — es el mismo identificador que la Fase 2 usa como clave del depósito.
"""
from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from deposito_traumas import FabricaDeTraumas, depositar
from log_estructurado import log_error, origen_en_el_codigo
from taxonomia_errores import ErrorSinCategoria, categoria_de, es_reintentable


def registrar_captura_global(app: FastAPI, *, traumas: FabricaDeTraumas | None = None) -> None:
    """Instala la costura C2 en `app`. Idempotente: registrar dos veces reemplaza, no duplica.

    `traumas` es opcional a propósito: sin DLQ la costura sigue **capturando y logueando** igual. El
    depósito es una mejora del registro, no una condición para registrar — ver `deposito_traumas`.
    """

    @app.exception_handler(Exception)
    async def _capturar(request: Request, exc: Exception) -> JSONResponse:  # noqa: ANN202
        try:
            categoria = categoria_de(exc)
        except ErrorSinCategoria:
            # Igual que en la costura de activities: un tipo nuevo se marca, no se pierde ni se
            # adivina. Es el error que más importa ver, justamente porque nadie lo clasificó todavía.
            categoria = "SIN_CATEGORIA"

        # El `cliente_id` lo deja el middleware de auth en `request.state` cuando la ruta está
        # autenticada. `getattr` con default porque las rutas públicas (health, webhooks) no lo tienen
        # — y un fallo ahí no puede impedir que el error se registre.
        cliente_id = getattr(request.state, "cliente_id", None)

        workflow = f"{request.method} {request.scope.get('route_path') or request.url.path}"
        fingerprint = log_error(
            exc,
            workflow=workflow,
            cliente_id=cliente_id,
            extra={"categoria": categoria, "costura": "http_handler"},
        )
        # El depósito va DESPUÉS del log y nunca antes: si la DLQ estuviera caída, el error igual
        # quedó registrado. `depositar` no lanza (ver `deposito_traumas`); devuelve si depositó.
        # El `origen` viaja también al trauma, no sólo al log: el ciclo de auto-reparación lee la
        # DLQ, y sin archivo:línea un trauma no es reparable — sólo contable.
        deposito_ok = depositar(traumas, fingerprint=fingerprint, workflow=workflow,
                                error_type=type(exc).__name__, cliente_id=cliente_id,
                                costura="http_handler",
                                contexto={"categoria": categoria,
                                          "origen": origen_en_el_codigo(exc)})
        # `diferido` es la respuesta a "¿esto se reintenta solo?", y son DOS condiciones, no una:
        # la categoría tiene que ser reintentable **y** el trauma tiene que haber quedado depositado.
        # Con sólo la primera estaríamos afirmando la intención en vez del hecho — un `infra_error`
        # cuyo depósito falló no lo va a reintentar nadie, y decirle al usuario que sí es la mentira
        # cara: no reintenta a mano algo que cree en curso, y el error queda muerto.
        # `es_reintentable("SIN_CATEGORIA")` da False, así que un tipo nuevo cae del lado seguro.
        diferido = deposito_ok and es_reintentable(categoria)
        return JSONResponse(
            # Sigue siendo 500, no 202: la operación NO se aceptó, falló y hay un plan. Un 202 le
            # diría al frontend "salió bien" y si el reintento no prospera nadie vuelve a mirar.
            status_code=500,
            content={
                "detail": "error interno del servidor",
                # Sin el mensaje de la excepción: PII / datos fiscales / estructura interna.
                "codigo": fingerprint,
                # Campo opcional: un cliente que no lo lee se comporta exactamente como hoy.
                "diferido": diferido,
            },
        )
