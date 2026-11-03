"""`GET /contabilidad/resumen` (capa CLIENTE, multi-tenant). Contrato:
`contrato_planificacion-a-backend_hito-C-GET-contabilidad-resumen.md`.

Sólo lectura -- agrega lo que `CobroStore`, `GastoStore` y `AfipComprobanteStore` ya persisten por su
cuenta. **`caja` y `facturado` son dos preguntas separadas y NUNCA se suman** (contrato §1): `caja`
sale de ingresos − gastos (`copiloto_cobros` − `copiloto_gastos`, sin tocar AFIP); `facturado` sale de
comprobantes AFIP emitidos, estén cobrados o no (sin tocar `copiloto_cobros`). Sumarlas contaría la
misma plata dos veces -- se factura, y después se cobra lo mismo.
"""
from __future__ import annotations

import asyncio
import datetime
from decimal import Decimal
from typing import Callable

from fastapi import Depends, FastAPI, HTTPException

from escala_monotributo import ConfigEscala, cargar as cargar_escala, medidor
from gasto_store import dos_decimales, hoy_del_negocio


def create_contabilidad_app(*, require_tenant: Callable, cobro_store_factory: Callable,
                            gasto_store_factory: Callable,
                            afip_comprobante_store_factory: Callable,
                            categoria_monotributo_factory: Callable | None = None,
                            escala: ConfigEscala | None = None,
                            hoy_fn: Callable = hoy_del_negocio) -> FastAPI:
    """`categoria_monotributo_factory(cliente_id) -> 'A'..'K' | None` (SM-N36). Sin ella, o sin escala
    vigente, `facturado.tope` sigue siendo `null`: el fail-soft es el estado por defecto."""
    app = FastAPI(title="Copiloto Contabilidad")
    escala = escala if escala is not None else cargar_escala()

    @app.get("/contabilidad/resumen")
    async def resumen(periodo: str | None = None,
                      cliente_id: str = Depends(require_tenant)) -> dict:
        if periodo:
            try:
                datetime.date.fromisoformat(f"{periodo}-01")
            except (ValueError, TypeError):
                raise HTTPException(status_code=400,
                                    detail=f"periodo inválido: {periodo!r} (se espera YYYY-MM)") from None

        cobro_store = cobro_store_factory(cliente_id)
        gasto_store = gasto_store_factory(cliente_id)
        afip_store = afip_comprobante_store_factory(cliente_id)

        ingresos, gastos, facturado, clientes = await asyncio.gather(
            asyncio.to_thread(cobro_store.total_periodo, periodo),
            asyncio.to_thread(gasto_store.resumen, periodo),
            asyncio.to_thread(afip_store.total_periodo, periodo),
            asyncio.to_thread(cobro_store.top_clientes, periodo),
        )

        categoria = (await asyncio.to_thread(categoria_monotributo_factory, cliente_id)
                     if categoria_monotributo_factory else None)
        entro, salio = Decimal(ingresos["total"]), Decimal(gastos["total"])
        entro_ant = Decimal(ingresos["mes_anterior"]) if ingresos["mes_anterior"] is not None else None
        salio_ant = Decimal(gastos["mes_anterior"]) if gastos["mes_anterior"] is not None else None
        # `None` sólo si NINGUNO de los dos lados tiene una fila el mes anterior (negocio recién
        # arrancado). Si un solo lado tiene datos, el otro entra en 0 -- "gastó pero no cobró nada el
        # mes pasado" es un estado real, no un vacío que haya que esconder.
        if entro_ant is None and salio_ant is None:
            mes_anterior = None
        else:
            ea = entro_ant if entro_ant is not None else Decimal(0)
            sa = salio_ant if salio_ant is not None else Decimal(0)
            mes_anterior = {"entro": dos_decimales(ea), "salio": dos_decimales(sa),
                            "queda": dos_decimales(ea - sa)}

        return {
            "periodo": ingresos["periodo"],
            "caja": {"entro": dos_decimales(entro), "salio": dos_decimales(salio),
                     "queda": dos_decimales(entro - salio), "mes_anterior": mes_anterior},
            "gastos": {"por_categoria": gastos["por_categoria"]},
            "facturado": {"periodo": facturado["periodo"], "doce_meses": facturado["doce_meses"],
                         # SM-N36: `null` salvo que haya categoria Y una escala VIGENTE HOY (contrato
                         # master §4.3). Escala vencida => null, nunca el tope viejo: un tope viejo
                         # mostrado como vigente es peor que no mostrar ninguno. La escala es config
                         # versionada (`escala_monotributo.json`, `vigencia_desde`/`vigencia_hasta`), con
                         # dueño de actualización escrito ahí mismo -- no código.
                         "tope": medidor(escala, categoria, Decimal(facturado["doce_meses"]), hoy_fn())},
            "clientes": clientes,
        }

    return app
