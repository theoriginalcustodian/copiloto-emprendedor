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
# Latido de las activities LARGAS (item #12). 60 s de umbral con latido cada 20 s deja margen para dos
# latidos perdidos antes de que el server declare muerta la activity. Sólo va donde la activity
# REALMENTE late (`con_latido`): ponerlo sin latido la mataría a los 60 s, que es peor que no tenerlo.
HEARTBEAT_TIMEOUT = timedelta(seconds=60)
TIMEOUT_CORTO = timedelta(seconds=60)

# El alta NO se reintenta: consume un secreto one-shot. Si falla, el usuario reingresa la clave — es
# preferible a mantener vivo un secreto fiscal en la base esperando un reintento automático.
SIN_REINTENTO = RetryPolicy(maximum_attempts=1)
# La verificación sí es idempotente y sólo lee.
REINTENTO_LECTURA = RetryPolicy(maximum_attempts=3)

PASOS = ("iniciado", "dando_de_alta", "verificando", "habilitado", "fallido")

# Causa del fallo (SM-K3). La app necesita saber CUÁL de las dos es para decirle al emprendedor qué
# hacer: si es un DATO que cargó mal, corrige y reintenta; si es el SERVICIO (ARCA o nosotros), no hay
# nada que corregir de su lado. Dos causas con el mismo mensaje hacen que se diagnostique la equivocada.
CAUSA_DATO = "dato"
CAUSA_SERVICIO = "servicio"
CAUSA_DESCONOCIDA = "desconocida"

# Lo que ARCA responde ↔ lo que el usuario necesita leer + de quién es el problema. El orden importa:
# se toma el primero que matchea.
_MOTIVOS_CONOCIDOS = (
    ("clave o usuario incorrecto", CAUSA_DATO,
     "La clave fiscal o el usuario no son correctos. Revisalos y probá de nuevo."),
    ("usuario incorrecto", CAUSA_DATO, "El usuario de ARCA no es correcto."),
    ("clave incorrecta", CAUSA_DATO, "La clave fiscal no es correcta."),
    ("bloquead", CAUSA_DATO,
     "Tu clave fiscal está bloqueada en ARCA. Tenés que desbloquearla desde el sitio de ARCA antes "
     "de reintentar."),
    ("handle_invalido_o_vencido", CAUSA_DATO,
     "La sesión de vinculación venció. Volvé a ingresar tu clave fiscal."),
    # El certificado YA existe en ARCA y ya está guardado acá: lo único que faltó fue habilitar el
    # web service. Decirlo importa porque cambia lo que el usuario tiene que hacer — reintentar SIN
    # volver a gastar una clave fiscal, que es one-shot.
    ("certificado_ok_falta_autorizar_wsfe", CAUSA_SERVICIO,
     "Tu certificado quedó creado, pero no llegamos a habilitar la facturación electrónica. Probá de "
     "nuevo en unos minutos: no hace falta que vuelvas a ingresar tu clave fiscal."),
    ("alias", CAUSA_SERVICIO,
     "El certificado no se pudo crear por un problema de configuración nuestro. Ya estamos al tanto."),
    ("timeout", CAUSA_SERVICIO, "ARCA tardó demasiado en responder. Probá de nuevo en unos minutos."),
    # Códigos de la verificación post-alta (`verificar_habilitacion_afip`). Iban CRUDOS a la pantalla
    # —incluido `ws_inaccesible: <texto de la excepción>`, que puede arrastrar detalle interno—.
    ("sin_certificado", CAUSA_SERVICIO,
     "No encontramos tu certificado después del alta. Probá de nuevo en unos minutos."),
    ("wsfe_no_autorizado", CAUSA_SERVICIO,
     "El certificado se creó, pero ARCA todavía no habilita la facturación electrónica. Probá de "
     "nuevo en unos minutos: no hace falta que vuelvas a ingresar tu clave fiscal."),
    ("ws_inaccesible", CAUSA_SERVICIO, "No pudimos comunicarnos con ARCA. Probá de nuevo en unos minutos."),
    ("ws_degradado", CAUSA_SERVICIO, "ARCA está respondiendo con problemas. Probá de nuevo en unos minutos."),
)

_MOTIVO_GENERICO = ("No pudimos vincular tu cuenta con ARCA. Probá de nuevo; si sigue fallando, "
                    "escribinos.")


def _clasificar(codigo: str) -> tuple[str, str]:
    """(causa, texto para el usuario) de un código/excepción de fallo. Ante lo no reconocido la causa
    es `desconocida`, NO `servicio`: degradar «ante la duda» al caso benigno es afirmar lo que no se
    midió, y la app dejaría de ofrecer corregir un dato que quizá sí estaba mal."""
    texto = codigo.lower()
    for patron, causa, copy in _MOTIVOS_CONOCIDOS:
        if patron in texto:
            return causa, copy
    return CAUSA_DESCONOCIDA, _MOTIVO_GENERICO


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
    return _clasificar(codigo)[1]


def _causa_de_codigo(codigo: str) -> str:
    return _clasificar(codigo)[0]


@workflow.defn
class AfipOnboardingWorkflow:
    def __init__(self) -> None:
        self._paso = "iniciado"
        self._motivo: str | None = None
        self._causa: str | None = None
        self._ws_autorizados: list[str] = []
        self._ambiente = "dev"

    @workflow.query
    def progreso(self) -> dict:
        """Lo que la UI muestra mientras espera. Es estado real, no un mensaje decorativo."""
        return {
            "paso": self._paso,
            "motivo": self._motivo,
            "causa": self._causa,
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
                # La más larga del repo: el RPA de AfipSDK puede irse a 10 min. Sin latido, una caída
                # del worker recién se detecta al vencer esos 10 minutos — y como acá `SIN_REINTENTO`
                # no reintenta, ese tiempo es puro silencio para el emprendedor que está dando de alta
                # su CUIT. Con latido, la activity se declara muerta en ~60 s. Item #12.
                heartbeat_timeout=HEARTBEAT_TIMEOUT,
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
            self._causa = _causa_de_codigo(str(exc))
            return self.progreso()

        if not alta.get("ok"):
            self._paso = "fallido"
            # Traducido, no crudo: `motivo` es texto para el usuario por contrato (lo pinta la
            # pantalla de Ajustes tal cual). Sin esto, un alta fallida mostraba literalmente
            # `handle_invalido_o_vencido` sobre la cara del emprendedor.
            codigo = alta.get("motivo") or "alta_fallida"
            self._motivo = _motivo_de_codigo(codigo)
            self._causa = _causa_de_codigo(codigo)
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
            self._causa = None
        else:
            self._paso = "fallido"
            # Traducido como el resto: `motivo` es texto para el usuario, no el código de máquina.
            codigo = verificacion.get("motivo") or "verificacion_fallida"
            self._motivo = _motivo_de_codigo(codigo)
            self._causa = _causa_de_codigo(codigo)

        return self.progreso()
