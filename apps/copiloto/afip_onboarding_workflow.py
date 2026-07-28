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

# Lo que ARCA responde ↔ lo que el usuario necesita leer. El orden importa: se toma el primero que
# matchea.
_MOTIVOS_CONOCIDOS = (
    ("clave o usuario incorrecto", "La clave fiscal o el usuario no son correctos. Revisalos y "
                                   "probá de nuevo."),
    ("usuario incorrecto", "El usuario de ARCA no es correcto."),
    ("clave incorrecta", "La clave fiscal no es correcta."),
    ("bloquead", "Tu clave fiscal está bloqueada en ARCA. Tenés que desbloquearla desde el sitio "
                 "de AFIP antes de reintentar."),
    ("handle_invalido_o_vencido", "La sesión de vinculación venció. Volvé a ingresar tu clave "
                                  "fiscal."),
    # El certificado YA existe en ARCA y ya está guardado acá: lo único que faltó fue habilitar el
    # web service. Decirlo importa porque cambia lo que el usuario tiene que hacer — reintentar SIN
    # volver a gastar una clave fiscal, que es one-shot.
    ("certificado_ok_falta_autorizar_wsfe",
     "Tu certificado quedó creado, pero no llegamos a habilitar la facturación electrónica. Probá de "
     "nuevo en unos minutos: no hace falta que vuelvas a ingresar tu clave fiscal."),
    ("alias", "El certificado no se pudo crear por un problema de configuración nuestro. Ya estamos "
              "al tanto."),
    ("timeout", "ARCA tardó demasiado en responder. Probá de nuevo en unos minutos."),
)

_MOTIVO_GENERICO = ("No pudimos vincular tu cuenta con ARCA. Probá de nuevo; si sigue fallando, "
                    "escribinos.")


def _motivo_legible(exc: Exception) -> str:
    """Traduce el fallo a algo que el usuario pueda accionar, SIN volcar el error crudo.

    Dos razones para no exponer el texto original: (1) puede arrastrar el cuerpo HTTP de AfipSDK, que
    en el peor caso refleja lo que se le mandó —incluida la clave—; (2) un stack trace en pantalla no
    le dice a nadie qué hacer. El detalle completo queda en el log de la activity, que es donde sirve.
    """
    return _motivo_de_codigo(str(exc))


def _motivo_de_codigo(codigo: str) -> str:
    """La misma traducción, para el CÓDIGO que devuelve una activity en vez de una excepción.

    Una activity que falla de forma prevista no lanza: devuelve `{"ok": False, "motivo": "<código>"}`.
    Ese código se estaba copiando tal cual a `progreso()["motivo"]`, que la pantalla de Ajustes pinta
    tal cual — así que el emprendedor leía literalmente `handle_invalido_o_vencido`. Un código de
    máquina en la cara del usuario no le dice qué hacer, que es lo único que un motivo tiene que
    hacer.
    """
    texto = codigo.lower()
    for patron, copy in _MOTIVOS_CONOCIDOS:
        if patron in texto:
            return copy
    return _MOTIVO_GENERICO


@workflow.defn
class AfipOnboardingWorkflow:
    def __init__(self) -> None:
        self._paso = "iniciado"
        self._motivo: str | None = None
        self._ws_autorizados: list[str] = []
        self._ambiente = "dev"

    @workflow.query
    def progreso(self) -> dict:
        """Lo que la UI muestra mientras espera. Es estado real, no un mensaje decorativo."""
        return {
            "paso": self._paso,
            "motivo": self._motivo,
            "ambiente": self._ambiente,
            "ws_autorizados": list(self._ws_autorizados),
            "terminado": self._paso in ("habilitado", "fallido"),
            "ok": self._paso == "habilitado",
        }

    @workflow.run
    async def run(self, cliente_id: str, cuit: str, handle: str, ambiente: str = "dev") -> dict:
        """`ambiente` con default para no romper el replay de las ejecuciones que arrancaron con 3
        argumentos (el history las reproduce tal cual quedaron grabadas)."""
        self._ambiente = ambiente
        self._paso = "dando_de_alta"
        try:
            alta = await workflow.execute_activity(
                "dar_de_alta_afip",
                args=[cliente_id, cuit, handle, ambiente],
                start_to_close_timeout=TIMEOUT_ALTA,
                retry_policy=SIN_REINTENTO,
            )
        except Exception as exc:  # noqa: BLE001
            # Una activity que LANZA (en vez de devolver {"ok": False}) mataba el workflow por
            # ActivityError antes de llegar a la rama de abajo: el objeto quedaba congelado en
            # "dando_de_alta" con `terminado: False`, y la query lo servía así PARA SIEMPRE. El
            # 2026-07-21 el operador tipeó mal su clave fiscal y esperó cinco minutos frente a una
            # pantalla que decía "puede demorar unos minutos" sobre un workflow muerto en 5 segundos.
            #
            # Un fallo del alta es un RESULTADO del negocio, no una excepción a propagar: acá termina
            # el workflow, no revienta.
            self._paso = "fallido"
            self._motivo = _motivo_legible(exc)
            return self.progreso()

        if not alta.get("ok"):
            self._paso = "fallido"
            # Traducido, no crudo: `motivo` es texto para el usuario por contrato (lo pinta la
            # pantalla de Ajustes tal cual). Sin esto, un alta fallida mostraba literalmente
            # `handle_invalido_o_vencido` sobre la cara del emprendedor.
            self._motivo = _motivo_de_codigo(alta.get("motivo") or "alta_fallida")
            return self.progreso()

        self._ws_autorizados = alta.get("ws_autorizados") or []

        # No alcanza con que el alta haya dicho "ok": se verifica contra el sistema que el tenant quedó
        # realmente en condiciones de facturar. Declarar habilitado sin comprobarlo es exactamente el
        # tipo de afirmación que después falla en la primera factura real del usuario.
        self._paso = "verificando"
        verificacion = await workflow.execute_activity(
            "verificar_habilitacion_afip",
            args=[cliente_id, cuit, ambiente],
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
