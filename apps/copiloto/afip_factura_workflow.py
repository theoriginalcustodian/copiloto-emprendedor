"""`FacturaWorkflow` — máquina de estados durable de UNA factura (capa CLIENTE).

**El LLM no interviene acá.** Los slots llegan por signals con payload tipado, un validador puro los
acepta o los rechaza, y recién entonces cambia el estado. No hay ninguna rama que dependa de texto
interpretado. Cuando llegue el camino conversacional, el agente va a proponer valores para estos
mismos signals — no va a tener una vía alternativa para emitir.

**Por qué durable:** el borrador sobrevive a que se cierre la app, se corte el 4G o se caiga el worker.
La espera de confirmación no tiene límite de tiempo. Y el `workflow_id` determinístico hace que dos
toques del botón no emitan dos facturas: Temporal rechaza el duplicado por construcción.

**Determinismo:** sin I/O, sin `date.today()` (se usa `workflow.now()`), sin aleatoriedad. Todo lo que
toca el mundo está en activities.
"""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    # Puro: sin red, sin DB, sin reloj. Pasa el sandbox sin riesgo de no-determinismo.
    from afip_rules import (
        BorradorFactura,
        Concepto,
        CondicionEmisor,
        CondicionIVA,
        DatosVenta,
        EstadoFactura,
        Item,
        PerfilFiscal,
        Receptor,
        TipoDoc,
        armar_params_pdf,
        armar_payload_wsfe,
        calcular_totales,
        determinar_tipo_comprobante,
        puede_emitir,
        siguiente_estado,
        validar_factura_completa,
    )

TIMEOUT_EMISION = timedelta(minutes=3)
TIMEOUT_CORTO = timedelta(seconds=60)

# Reintentos acotados. Un rechazo de negocio llega como ApplicationError no-retryable desde la
# activity, así que no entra en este contador.
REINTENTO_EMISION = RetryPolicy(maximum_attempts=3,
                                non_retryable_error_types=["RechazoAfip", "SinCertificado"])
REINTENTO_LECTURA = RetryPolicy(maximum_attempts=3)

TEMPLATE_POR_TIPO = {11: "invoice-c", 6: "invoice-b", 1: "invoice-a"}


@workflow.defn
class FacturaWorkflow:
    def __init__(self) -> None:
        self._cliente_id = ""
        self._cuit = ""
        self._perfil: PerfilFiscal | None = None
        self._borrador = BorradorFactura()
        self._estado = EstadoFactura.BORRADOR
        self._errores: list[dict] = []
        self._cancelado = False
        self._confirmado = False
        self._resultado: dict | None = None
        self._pdf: dict | None = None
        self._motivo: str | None = None
        # Código ESTABLE que acompaña a `motivo`. La frase es para leer; el código es para ramificar.
        # Mezclar ambos vocabularios en un solo campo —como estaba— obliga al cliente a comparar contra
        # texto en español: cualquier retoque de copy rompe su `if` sin que ningún test lo note.
        # (Hallazgo de la sesión frontend, 2026-07-21.)
        self._motivo_codigo: str | None = None

    # -- consultas ----------------------------------------------------------

    @workflow.query
    def estado(self) -> dict:
        """Todo lo que la UI necesita pintar. El estado de la factura vive acá, no en el front."""
        return {
            "estado": self._estado.value,
            "faltantes": list(self._errores),
            "items": [self._item_dict(i) for i in self._borrador.items],
            "total": str(self._total()),
            "token_confirmacion": self._token() if self._estado is EstadoFactura.ESPERANDO_CONFIRMACION else None,
            "resultado": self._resultado,
            "pdf": self._pdf,
            "motivo": self._motivo,
            "motivo_codigo": self._motivo_codigo,
            "terminado": self._estado in (EstadoFactura.ENTREGADA, EstadoFactura.RECHAZADA,
                                          EstadoFactura.CANCELADA),
        }

    # -- signals ------------------------------------------------------------

    @workflow.signal
    def cargar_datos_venta(self, payload: dict) -> None:
        try:
            self._borrador.datos_venta = DatosVenta(
                fecha=self._fecha(payload["fecha"]),
                concepto=Concepto(int(payload.get("concepto", 1))),
                condicion_venta=str(payload.get("condicion_venta", "")),
                fecha_servicio_desde=self._fecha_opt(payload.get("fecha_servicio_desde")),
                fecha_servicio_hasta=self._fecha_opt(payload.get("fecha_servicio_hasta")),
                fecha_vto_pago=self._fecha_opt(payload.get("fecha_vto_pago")),
            )
        except (KeyError, ValueError, TypeError) as exc:
            self._motivo = f"datos de venta inválidos: {exc}"
            self._motivo_codigo = "datos_venta_invalidos"
        self._recalcular()

    @workflow.signal
    def agregar_item(self, payload: dict) -> None:
        try:
            self._borrador.items.append(Item(
                descripcion=str(payload.get("descripcion", "")),
                cantidad=Decimal(str(payload.get("cantidad", "1"))),
                precio_unitario=Decimal(str(payload.get("precio_unitario", "0"))),
                codigo=str(payload.get("codigo", "")),
            ))
        except (ValueError, TypeError) as exc:
            self._motivo = f"ítem inválido: {exc}"
            self._motivo_codigo = "item_invalido"
        self._recalcular()

    @workflow.signal
    def quitar_item(self, indice: int) -> None:
        if 0 <= indice < len(self._borrador.items):
            self._borrador.items.pop(indice)
        self._recalcular()

    @workflow.signal
    def cargar_cliente(self, payload: dict) -> None:
        try:
            self._borrador.receptor = Receptor(
                condicion_iva=CondicionIVA(int(payload.get("condicion_iva", 5))),
                tipo_doc=TipoDoc(int(payload.get("tipo_doc", 99))),
                nro_doc=str(payload.get("nro_doc", "0")),
                nombre=str(payload.get("nombre", "Consumidor Final")),
                domicilio=str(payload.get("domicilio", "-")),
            )
        except (ValueError, TypeError) as exc:
            self._motivo = f"datos del cliente inválidos: {exc}"
            self._motivo_codigo = "cliente_invalido"
        self._recalcular()

    @workflow.signal
    def confirmar(self, token: str) -> None:
        """Gate HITL. El token ata la confirmación al contenido EXACTO que se mostró en el resumen.

        Si el borrador cambió después de que se emitió la card, el token viejo no matchea y esto es un
        no-op: fail-closed. Sin eso, un botón viejo podría autorizar una factura distinta de la que el
        usuario efectivamente revisó. Mismo criterio que el gate del motor ReAct.
        """
        if not puede_emitir(self._estado):
            self._motivo = "todavía faltan datos para emitir"
            self._motivo_codigo = "faltan_datos"
            return
        if token != self._token():
            self._motivo = "la confirmación no corresponde a los datos actuales; revisá el resumen"
            self._motivo_codigo = "token_desactualizado"
            return
        self._confirmado = True

    @workflow.signal
    def cancelar(self) -> None:
        self._cancelado = True

    # -- ejecución ----------------------------------------------------------

    @workflow.run
    async def run(self, cliente_id: str, cuit: str, idem_key: str) -> dict:
        self._cliente_id, self._cuit = cliente_id, cuit

        contexto = await workflow.execute_activity(
            "cargar_contexto_factura", args=[cliente_id, cuit],
            start_to_close_timeout=TIMEOUT_CORTO, retry_policy=REINTENTO_LECTURA)

        if not contexto.get("tiene_certificado"):
            self._estado = EstadoFactura.RECHAZADA
            self._motivo = "todavía no vinculaste tu cuenta de ARCA"
            self._motivo_codigo = "sin_certificado_afip"
            return self.estado()

        self._perfil = self._perfil_desde(contexto.get("perfil"))
        self._recalcular()

        # Espera sin límite: el HITL puede tardar lo que el usuario tarde.
        await workflow.wait_condition(lambda: self._confirmado or self._cancelado)

        if self._cancelado:
            self._estado = EstadoFactura.CANCELADA
            return self.estado()

        self._estado = EstadoFactura.EMITIENDO
        hoy = workflow.now().date()
        payload = armar_payload_wsfe(self._perfil, self._borrador, hoy=hoy)

        try:
            emision = await workflow.execute_activity(
                "emitir_comprobante",
                args=[cliente_id, cuit, payload, idem_key, workflow.info().workflow_id],
                start_to_close_timeout=TIMEOUT_EMISION, retry_policy=REINTENTO_EMISION)
        except Exception as exc:  # noqa: BLE001 — un rechazo de AFIP es un final, no un error a propagar
            self._estado = EstadoFactura.RECHAZADA
            self._motivo = str(exc)
            self._motivo_codigo = "rechazo_afip"
            return self.estado()

        self._resultado = emision
        self._estado = EstadoFactura.EMITIDA

        # El PDF es el último paso y no puede tumbar la emisión: la factura YA tiene CAE y existe en
        # AFIP. Si falla el PDF, se informa y el comprobante sigue siendo válido.
        try:
            tipo_cbte = int(emision["tipo_cbte"])
            params = armar_params_pdf(
                self._perfil, self._borrador, numero=int(emision["nro"]), cae=str(emision["cae"]),
                cae_vto=self._fecha(emision["cae_vto"]) if emision.get("cae_vto") else hoy,
                fecha_emision=hoy)
            self._pdf = await workflow.execute_activity(
                "generar_pdf_comprobante",
                args=[cliente_id, cuit, TEMPLATE_POR_TIPO.get(tipo_cbte, "invoice-c"), params,
                      int(emision["nro"]), tipo_cbte, int(emision["punto_venta"])],
                start_to_close_timeout=TIMEOUT_CORTO, retry_policy=REINTENTO_LECTURA)
            self._estado = EstadoFactura.ENTREGADA
        except Exception as exc:  # noqa: BLE001
            # ⚠️ El comprobante EXISTE y tiene CAE: esto es un éxito con advertencia, no un fallo. Si la
            # UI lo mostrara como error, el usuario volvería a facturar y duplicaría un comprobante fiscal.
            self._motivo = (f"tu factura se emitió (CAE {emision.get('cae')}); "
                            f"el PDF no está disponible en este momento")
            self._motivo_codigo = "emitida_sin_pdf"

        return self.estado()

    # -- internos -----------------------------------------------------------

    def _recalcular(self) -> None:
        """El estado se DERIVA de los slots. Si el usuario borra un ítem, retrocede solo."""
        if self._estado in (EstadoFactura.EMITIENDO, EstadoFactura.EMITIDA,
                            EstadoFactura.ENTREGADA, EstadoFactura.RECHAZADA,
                            EstadoFactura.CANCELADA):
            return
        hoy = workflow.now().date()
        self._errores = [
            {"codigo": e.codigo, "campo": e.campo, "mensaje": e.mensaje}
            for e in validar_factura_completa(self._perfil, self._borrador, hoy=hoy)
        ]
        self._estado = siguiente_estado(
            self._estado, perfil=self._perfil, borrador=self._borrador, hoy=hoy)

    def _token(self) -> str:
        """Huella determinística del contenido confirmable. Cambia si cambia cualquier dato."""
        r = self._borrador.receptor
        partes = [str(len(self._borrador.items)), str(self._total()),
                  str(int(r.tipo_doc)) if r else "-", str(r.nro_doc) if r else "-"]
        if self._borrador.datos_venta:
            partes.append(self._borrador.datos_venta.fecha.isoformat())
        return ":".join(partes)

    def _total(self) -> Decimal:
        if not (self._borrador.items and self._perfil and self._borrador.receptor):
            return Decimal("0.00")
        tipo = determinar_tipo_comprobante(self._perfil, self._borrador.receptor)
        return calcular_totales(self._borrador.items, tipo=tipo).total

    @staticmethod
    def _item_dict(item: Item) -> dict:
        return {"descripcion": item.descripcion, "cantidad": str(item.cantidad),
                "precio_unitario": str(item.precio_unitario), "subtotal": str(item.subtotal)}

    @staticmethod
    def _perfil_desde(datos: dict | None) -> PerfilFiscal | None:
        if not datos:
            return None
        from datetime import date as _date

        inicio = datos["inicio_actividades"]
        return PerfilFiscal(
            cuit=str(datos["cuit"]), razon_social=str(datos["razon_social"]),
            domicilio_comercial=str(datos["domicilio_comercial"]),
            condicion_iva=CondicionEmisor(str(datos["condicion_iva"])),
            ingresos_brutos=str(datos["ingresos_brutos"]),
            inicio_actividades=inicio if isinstance(inicio, _date) else _date.fromisoformat(str(inicio)),
            punto_venta=int(datos["punto_venta"]))

    @staticmethod
    def _fecha(valor):
        from datetime import date as _date

        return valor if isinstance(valor, _date) else _date.fromisoformat(str(valor))

    @classmethod
    def _fecha_opt(cls, valor):
        return cls._fecha(valor) if valor else None
