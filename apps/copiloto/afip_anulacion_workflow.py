"""`AnulacionWorkflow` — anula una factura emitiendo la nota de crédito que la neutraliza.

**"Anular" es una palabra peligrosa acá.** Fiscalmente una factura autorizada por AFIP no se borra ni
se cancela: se neutraliza emitiendo OTRO comprobante —una nota de crédito— asociado al original. El
competidor le dice al usuario "cancelala", que sugiere una reversibilidad que no existe. La UI tiene
que decir que se va a emitir una nota de crédito, porque eso es lo que va a pasar.

Mismo gate HITL que la emisión: anular es tan irreversible como facturar.
"""
from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from afip_rules import armar_payload_nota_credito, validar_anulacion

TIMEOUT_EMISION = timedelta(minutes=3)
TIMEOUT_CORTO = timedelta(seconds=60)
REINTENTO_EMISION = RetryPolicy(maximum_attempts=3,
                                non_retryable_error_types=["RechazoAfip", "SinCertificado"])
REINTENTO_LECTURA = RetryPolicy(maximum_attempts=3)


@workflow.defn
class AnulacionWorkflow:
    def __init__(self) -> None:
        self._paso = "iniciado"
        self._original: dict | None = None
        self._errores: list[dict] = []
        self._confirmado = False
        self._cancelado = False
        self._resultado: dict | None = None
        self._motivo: str | None = None
        self._marcada = False

    @workflow.query
    def estado(self) -> dict:
        return {
            "paso": self._paso,
            "original": self._original,
            "errores": list(self._errores),
            "resultado": self._resultado,
            "motivo": self._motivo,
            "terminado": self._paso in ("anulada", "fallida", "cancelada"),
            # ¿La factura original quedó marcada en NUESTRO libro? Es información distinta de "se
            # anuló": la anulación la define el CAE de la nota de crédito ante AFIP, no nuestra base.
            # Se expone para que la UI —y mañana el agente de sanación— puedan ver la inconsistencia
            # en vez de descubrirla cuando el listado muestre como vigente una factura ya neutralizada.
            "marcada": self._marcada,
        }

    @workflow.signal
    def confirmar(self) -> None:
        if self._paso == "esperando_confirmacion":
            self._confirmado = True

    @workflow.update(name="confirmar")
    async def confirmar_ahora(self) -> dict:
        """La misma confirmación, devolviendo si se tomó. Mismo motivo que en `FacturaWorkflow`:
        el signal contestaba `200 {"ok": true}` incluso cuando el workflow no estaba en el gate —
        por ejemplo si la validación ya lo había dejado en `fallida`— y el cliente creía haber
        autorizado una anulación que nunca iba a ocurrir."""
        if self._confirmado:
            return {"aceptado": True, "motivo": None, "motivo_codigo": None}
        self.confirmar()
        if self._confirmado:
            return {"aceptado": True, "motivo": None, "motivo_codigo": None}
        return {"aceptado": False,
                "motivo": self._motivo or f"la anulación ya no está esperando confirmación ({self._paso})",
                "motivo_codigo": "fuera_de_gate"}

    @workflow.signal
    def cancelar(self) -> None:
        self._cancelado = True

    @workflow.run
    async def run(self, cliente_id: str, cuit: str, tipo_cbte: int, punto_venta: int,
                  nro: int, idem_key: str) -> dict:
        self._original = await workflow.execute_activity(
            "buscar_comprobante", args=[cliente_id, cuit, tipo_cbte, punto_venta, nro],
            start_to_close_timeout=TIMEOUT_CORTO, retry_policy=REINTENTO_LECTURA)

        errores = validar_anulacion(self._original)
        if errores:
            self._errores = [{"codigo": e.codigo, "campo": e.campo, "mensaje": e.mensaje}
                             for e in errores]
            self._paso = "fallida"
            self._motivo = errores[0].mensaje
            return self.estado()

        self._paso = "esperando_confirmacion"
        await workflow.wait_condition(lambda: self._confirmado or self._cancelado)
        if self._cancelado:
            self._paso = "cancelada"
            return self.estado()

        self._paso = "emitiendo_nota_credito"
        hoy = workflow.now().date()
        payload = armar_payload_nota_credito(self._original, hoy=hoy)

        try:
            nc = await workflow.execute_activity(
                "emitir_comprobante",
                args=[cliente_id, cuit, payload, idem_key, workflow.info().workflow_id],
                start_to_close_timeout=TIMEOUT_EMISION, retry_policy=REINTENTO_EMISION)
        except Exception as exc:  # noqa: BLE001
            self._paso = "fallida"
            self._motivo = str(exc)
            return self.estado()

        self._resultado = nc

        # La factura original queda marcada como anulada, con el puntero a la NC que la neutralizó.
        # Se hace DESPUÉS de que la NC tenga CAE: marcarla antes dejaría una factura "anulada" sin
        # nota de crédito que la respalde si la emisión fallara.
        #
        # ⚠️ Y va dentro de un `try` porque a esta altura la anulación YA OCURRIÓ: hay una nota de
        # crédito con CAE ante AFIP. Sin el `try`, agotar los reintentos de este marcado —una base
        # momentáneamente caída alcanza— hacía fallar el workflow con `_paso` todavía en
        # `emitiendo_nota_credito`, que no es terminal: el cliente quedaba poleando para siempre una
        # operación que había terminado bien. Reportar `fallida` sería peor todavía, porque negaría
        # un efecto fiscal irreversible que ya existe. Se reporta lo que es cierto —`anulada`, con la
        # NC— y se deja visible que el libro propio quedó desalineado.
        try:
            await workflow.execute_activity(
                "marcar_comprobante_anulado",
                args=[cliente_id, cuit, tipo_cbte, punto_venta, nro, int(nc["nro"])],
                start_to_close_timeout=TIMEOUT_CORTO, retry_policy=REINTENTO_LECTURA)
            self._marcada = True
        except Exception as exc:  # noqa: BLE001
            workflow.logger.error("la NC %s se emitió pero la factura %s-%s no quedó marcada: %s",
                                  nc.get("nro"), punto_venta, nro, exc)
            self._motivo = (
                f"La nota de crédito N° {nc.get('nro')} se emitió correctamente, pero no pudimos "
                f"actualizar el estado de la factura original. La anulación ante AFIP es válida.")

        # ⚠️ DEUDA GESTIONADA (2026-07-21): la nota de crédito NO genera su PDF. Es un comprobante
        # fiscal con CAE igual que la factura, así que quien anula debería poder descargarla — hoy no
        # puede. Verificado sobre 6 anulaciones reales: ninguna tiene `pdf_url`.
        # No es una regresión (nunca existió) y no bloquea el sprint, pero es un hueco visible desde
        # la primera anulación de un usuario real.
        # Pago: una `generar_pdf_comprobante` acá con el template de NC, replicando el criterio de
        # `FacturaWorkflow` — el fallo del PDF NO puede tumbar la anulación, la NC ya tiene CAE.
        # Propietario: operador. Condición: antes de habilitar producción.
        self._paso = "anulada"
        return self.estado()
