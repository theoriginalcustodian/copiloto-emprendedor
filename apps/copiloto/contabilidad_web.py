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

from gasto_store import dos_decimales


def create_contabilidad_app(*, require_tenant: Callable, cobro_store_factory: Callable,
                            gasto_store_factory: Callable,
                            afip_comprobante_store_factory: Callable) -> FastAPI:
    app = FastAPI(title="Copiloto Contabilidad")

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
                         # Sin escala de monotributo vigente configurada -> null, deliberado
                         # (contrato master §4.3): las escalas se actualizan por inflación varias
                         # veces al año, y hardcodearlas es deuda con vencimiento garantizado -- un
                         # tope viejo mostrado como vigente es peor que no mostrar ninguno. Deuda
                         # declarada: propietario BACKEND, condición de pago = cada publicación
                         # oficial de ARCA (config versionada con vigencia_desde, no código).
                         "tope": None},
            "clientes": clientes,
        }

    return app
