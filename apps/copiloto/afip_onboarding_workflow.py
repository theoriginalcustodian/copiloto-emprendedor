"""`AfipOnboardingWorkflow` — alta durable de un emprendedor ante ARCA (capa CLIENTE).

El alta tarda minutos: AfipSDK entra al portal de ARCA por RPA, genera el certificado y lo vincula al
web service. El competidor resuelve esa espera con tres mensajes de texto sin ETA, y cuando el usuario
pregunta "¿qué hago ahora?" le repite el mismo mensaje (benchmark Facturitas §7). Acá el progreso es
**estado real consultable**: la UI pregunta por query y muestra en qué paso está, sobreviviendo a que se
caiga el worker, se cierre la app o se corte la red.

**Determinismo:** el workflow no hace I/O, no mira el reloj del sistema ni genera aleatoriedad. Todo lo
que toca el mundo vive en activities.

🔴 **La clave fiscal no entra acá.** El workflow recibe un `handle` opaco; la activity lo resuelve
contra la tabla de claim-check. Los argumentos del workflow quedan en claro en el event history para
siempre, así que un secreto pasado como argumento estaría persistido aunque no lo guardáramos en
ninguna tabla.
"""
from __future__ import annotations

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

# El RPA de AfipSDK hace polling interno (hasta ~2 min por llamada) y el alta son DOS llamadas
# encadenadas. 10 minutos deja margen sin quedarse colgado para siempre.
TIMEOUT_ALTA = timedelta(minutes=10)
TIMEOUT_CORTO = timedelta(seconds=60)

# El alta NO se reintenta: consume un secreto one-shot. Si falla, el usuario reingresa la clave — es
# preferible a mantener vivo un secreto fiscal en la base esperando un reintento automático.
SIN_REINTENTO = RetryPolicy(maximum_attempts=1)
# La verificación sí es idempotente y sólo lee.
REINTENTO_LECTURA = RetryPolicy(maximum_attempts=3)

PASOS = ("iniciado", "dando_de_alta", "verificando", "habilitado", "fallido")


@workflow.defn
class AfipOnboardingWorkflow:
    def __init__(self) -> None:
        self._paso = "iniciado"
        self._motivo: str | None = None
        self._ws_autorizados: list[str] = []

    @workflow.query
    def progreso(self) -> dict:
        """Lo que la UI muestra mientras espera. Es estado real, no un mensaje decorativo."""
        return {
            "paso": self._paso,
            "motivo": self._motivo,
            "ws_autorizados": list(self._ws_autorizados),
            "terminado": self._paso in ("habilitado", "fallido"),
            "ok": self._paso == "habilitado",
        }

    @workflow.run
    async def run(self, cliente_id: str, cuit: str, handle: str) -> dict:
        self._paso = "dando_de_alta"
        alta = await workflow.execute_activity(
            "dar_de_alta_afip",
            args=[cliente_id, cuit, handle],
            start_to_close_timeout=TIMEOUT_ALTA,
            retry_policy=SIN_REINTENTO,
        )

        if not alta.get("ok"):
            self._paso = "fallido"
            self._motivo = alta.get("motivo") or "alta_fallida"
            return self.progreso()

        self._ws_autorizados = alta.get("ws_autorizados") or []

        # No alcanza con que el alta haya dicho "ok": se verifica contra el sistema que el tenant quedó
        # realmente en condiciones de facturar. Declarar habilitado sin comprobarlo es exactamente el
        # tipo de afirmación que después falla en la primera factura real del usuario.
        self._paso = "verificando"
        verificacion = await workflow.execute_activity(
            "verificar_habilitacion_afip",
            args=[cliente_id, cuit],
            start_to_close_timeout=TIMEOUT_CORTO,
            retry_policy=REINTENTO_LECTURA,
        )

        if verificacion.get("habilitado"):
            self._paso = "habilitado"
            self._motivo = None
        else:
            self._paso = "fallido"
            self._motivo = verificacion.get("motivo") or "verificacion_fallida"

        return self.progreso()
