"""ACTIVIDAD RECIENTE (capa CLIENTE, multi-tenant). Contrato: `contrato_..._actividad-reciente-real`.

**Hito 1 = el punto de encuentro (§8): el endpoint vivo devolviendo `{"items": [], "cursor": null}`.**
La unión real de las tablas es el hito 2. Se despliega esto primero porque el problema de hoy no es
que falte la query: es que `GET /actividad` en producción devuelve **el HTML del SPA**, así que la app
no puede distinguir "no hay actividad" de "no existe la ruta" (ver
`catch-all-vuelve-no-desplegado-indistinguible-de-roto`).

El `cursor` es **keyset**, no offset (§3.1). Se valida acá desde el hito 1 aunque todavía no se use
para consultar: la forma del parámetro es parte del contrato con la app, y si la validación llega
recién con la query, la app cablea contra un endpoint que acepta cualquier cosa y después se rompe.
"""
from __future__ import annotations

import datetime
from typing import Callable

from fastapi import Depends, FastAPI, HTTPException

# `FUNCIONES` = las funciones válidas del filtro (fuente única en el store, que las deriva del mapeo
# funcion→tipo). Import de módulo seguro: `actividad_store` sólo importa `actividad_web` de forma LAZY
# (dentro de `listar`), así que no hay ciclo al cargar.
from actividad_store import FUNCIONES

LIMITE_DEFAULT = 20
LIMITE_MAX = 100

# Los tipos que puede devolver la unión (§3.2). Declarados desde el hito 1 para que la app tenga la
# lista cerrada contra la cual pintar íconos y colores, aunque todavía no llegue ninguno.
TIPOS = ("factura", "nota_credito", "presupuesto", "gasto", "ingreso", "cliente", "ticket_respuesta")
SIGNOS = ("entra", "sale", "neutro")


def parsear_cursor(crudo: str | None) -> tuple[datetime.datetime, str] | None:
    """`"<fecha ISO>|<tipo>:<id>"` → `(fecha, id)`. `None` si no vino.

    Un cursor mal formado es **400**, no un silencioso "empezá de nuevo": si la app manda basura y el
    backend la ignora, la paginación se reinicia sola y el usuario ve ítems repetidos sin ningún error
    — que es exactamente el fallo que el keyset existe para evitar.
    """
    if not crudo:
        return None
    fecha_txt, sep, item_id = crudo.partition("|")
    if not sep or not item_id:
        raise HTTPException(status_code=400,
                            detail="cursor inválido: se espera '<fecha ISO>|<tipo>:<id>'")
    tipo, sep2, resto = item_id.partition(":")
    if not sep2 or tipo not in TIPOS or not resto:
        raise HTTPException(status_code=400,
                            detail=f"cursor inválido: el id debe ser '<tipo>:<id>' con tipo en "
                                   f"{', '.join(TIPOS)}")
    fecha = _fecha_de_cursor(fecha_txt)
    if fecha is None:
        raise HTTPException(status_code=400,
                            detail=f"cursor inválido: {fecha_txt!r} no es una fecha ISO")
    return fecha, item_id


def _fecha_de_cursor(texto: str) -> datetime.datetime | None:
    """Parsea la fecha del cursor tolerando el `+` que la query string convierte en espacio.

    🔴 El cursor viaja en la URL y el offset ISO lleva `+00:00`. En una query string, `+` **significa
    espacio**: un cliente que pegue el cursor tal como se lo dimos manda `...14:30:00 00:00` y la fecha
    deja de parsear. No es hipotético — este mismo caso rompió el primer test que lo ejercitó, con el
    valor textual que el contrato usa de ejemplo.

    Se aceptan las dos formas en vez de exigir que el cliente codifique: un cursor es un token OPACO
    que el servidor emitió, así que la carga de que sobreviva al viaje es del servidor. (Y por eso se
    **emite** con `Z` en vez de `+00:00` — ver `formatear_cursor`: lo que no tiene `+` no se puede
    romper así.)
    """
    for candidato in (texto, texto[::-1].replace(" ", "+", 1)[::-1]):
        try:
            return datetime.datetime.fromisoformat(candidato)
        except (ValueError, TypeError):
            continue
    return None


def formatear_cursor(fecha: datetime.datetime, item_id: str) -> str:
    """El cursor que se DEVUELVE. En UTC y con `Z`, no con `+00:00`: así no contiene ningún carácter
    que una query string reinterprete. La tolerancia de `_fecha_de_cursor` es la red; esto es el
    arreglo."""
    utc = fecha.astimezone(datetime.timezone.utc).replace(tzinfo=None)
    return f"{utc.isoformat(timespec='seconds')}Z|{item_id}"


def create_actividad_app(*, require_tenant: Callable,
                         actividad_store_factory: Callable | None = None) -> FastAPI:
    """`actividad_store_factory` es opcional a propósito: sin él (hito 1) el endpoint devuelve la lista
    vacía con su forma final. Con él (hito 2) consulta de verdad. La app cablea contra la misma forma
    en los dos casos y no se entera del cambio."""
    app = FastAPI(title="Copiloto Actividad")

    import asyncio

    @app.get("/actividad")
    async def listar_actividad(limit: int = LIMITE_DEFAULT, cursor: str | None = None,
                               q: str = "", funcion: str = "",
                               cliente_id: str = Depends(require_tenant)) -> dict:
        # `limit` fuera de rango es 400 y NO se recorta en silencio: un cliente que pide 500 y recibe
        # 100 sin enterarse concluye que hay 100 ítems en total. El contrato dice máximo 100; decirlo
        # es más barato que el bug de interpretación.
        if limit < 1 or limit > LIMITE_MAX:
            raise HTTPException(status_code=400,
                                detail=f"limit tiene que estar entre 1 y {LIMITE_MAX}")
        # `funcion` inválida es 400 con la lista de válidas, NO un filtro que devuelve vacío en silencio:
        # un `funcion=facturas` (typo) que da 0 ítems se lee como «no hay facturas», no como «pediste mal».
        if funcion and funcion not in FUNCIONES:
            raise HTTPException(status_code=400,
                                detail=f"funcion tiene que ser una de: {', '.join(FUNCIONES)}")
        # `q` YA está implementada (contrato recientes/buscar): busca por `ILIKE` sobre título+detalle.
        # (Antes daba 400 «todavía no implementada»; ese candado se levanta al implementarla de verdad —
        # nunca aceptándola sin filtrar, que sería el falso verde que el 400 evitaba.)
        desde = parsear_cursor(cursor)
        if actividad_store_factory is None:
            return {"items": [], "cursor": None}
        return await asyncio.to_thread(
            lambda: actividad_store_factory(cliente_id).listar(
                limit=limit, desde=desde, funcion=(funcion or None), q=q))

    return app
