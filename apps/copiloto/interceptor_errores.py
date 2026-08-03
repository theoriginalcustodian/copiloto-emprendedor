"""Costura C3 — la captura de errores de TODAS las activities, en un solo lugar.

**Por qué existe.** Antes de esto, la captura estaba cableada a mano: `log_error` aparecía en **2** de
las **80** rutas del backend, las dos en `presupuestos_web.py`. Con ese diseño el default era **cero
cobertura** y cada feature nueva era cableado nuevo — y olvidarse no da ningún síntoma. Acá la
dirección se invierte: una activity nueva **nace cubierta**, sin que nadie se acuerde de nada.

Diseño y medición que lo motivan: `docs/copiloto-emprendedor/Manejo de errores/04-DISENO-costuras-y-autohealing.md` §2.

**Validado antes de escribirlo** (spike S1, `spikes/RESULT.md`): contra el Temporal real del VPS, el
interceptor entrega las tres cosas que la Fase 2 necesita — la excepción, el **nombre de la activity**
y el **`cliente_id`** que viaja en el payload.

---

## Las tres reglas duras de este módulo

1. **Nunca cambia el comportamiento del sistema.** Registra y **re-lanza la excepción original**, tal
   cual, sin envolverla. Un observador que altera lo observado deja de ser observador: cambiaría los
   reintentos de Temporal, que dependen del tipo de la excepción.

2. **Nunca lanza por su cuenta.** Todo el cuerpo va dentro de un `except` amplio. Es la misma decisión
   que ya tomó `log_estructurado.log_error`, y acá pesa más: este código corre en **todas** las
   activities, así que un bug propio sería un bug global. *"Fallar registrando"* jamás puede costar más
   que el error que se estaba registrando.

3. **Un error sin categoría se registra igual, marcado.** `taxonomia_errores.categoria_de` **levanta**
   `ErrorSinCategoria` a propósito: no adivinar por descarte es correcto en el llamador, que puede
   decidir. Pero en una costura global, dejar que esa excepción se propague significaría que **el
   primer error de un tipo nuevo se pierde entero** — justo el que más importa ver. Se registra con
   `categoria="SIN_CATEGORIA"`, que es ruidoso y accionable, y no bloquea nada.
"""
from __future__ import annotations

import inspect
from typing import Any, Callable, Sequence

from temporalio import activity
from temporalio.worker import (
    ActivityInboundInterceptor,
    ExecuteActivityInput,
    Interceptor,
)

from contexto_tenant import tenant
from deposito_traumas import FabricaDeTraumas, depositar
from log_estructurado import log_error, origen_en_el_codigo
from taxonomia_errores import ErrorSinCategoria, categoria_de

#: Claves del payload donde puede venir el tenant, en orden de preferencia. Es una lista y no un
#: `payload["conv"]["cliente_id"]` fijo porque las activities no comparten un shape único: las del
#: motor ReAct anidan el contexto en `conv`, y las del dominio (AFIP, MP) lo reciben plano.
_RUTAS_CLIENTE_ID = (("conv", "cliente_id"), ("cliente_id",), ("ctx", "cliente_id"))


def _cliente_id_de(payload: Any) -> str | None:
    """Extrae el tenant del payload sin asumir un shape. Devuelve None si no lo encuentra.

    Sólo cubre el caso dict (motor ReAct, `conv`/`ctx` anidados). El caso de payload PLANO —una
    activity de dominio cuyo primer argumento es directamente el string del tenant, sin envoltorio—
    lo resuelve `_cliente_id_de_activity`, que necesita la FIRMA de la activity y no sólo su primer
    argumento (ver el docstring de esa función para el porqué)."""
    if not isinstance(payload, dict):
        return None
    for ruta in _RUTAS_CLIENTE_ID:
        cursor: Any = payload
        for clave in ruta:
            if not isinstance(cursor, dict) or clave not in cursor:
                cursor = None
                break
            cursor = cursor[clave]
        if isinstance(cursor, str) and cursor:
            return cursor
    return None


#: Nombre del parámetro que, si es el PRIMERO de la firma de la activity, autoriza a leer el tenant
#: de `args[0]` sin envoltorio. Un solo nombre, exacto: aceptar "cualquier string suelto" como si
#: fuera el tenant declararía un tenant FALSO para la primera activity que reciba, por ejemplo, un
#: `workflow_id` como primer argumento — sería peor que no declarar ninguno.
_PARAM_TENANT_PLANO = "cliente_id"


def _cliente_id_de_activity(payload: Any, fn: Callable | None, args: Sequence[Any]) -> str | None:
    """El extractor completo: primero el shape dict de siempre; si no hay nada, mira si la propia
    FIRMA de la activity declara que su primer parámetro es el tenant.

    **Por qué hace falta la firma y no alcanza con "el primer argumento es un string".** `_ACTIVITIES`
    (el motor ReAct) también recibe activities con un string como único argumento que NO es un
    tenant — y `interceptor_errores.py:51` documenta la razón de fondo: *"las activities no comparten
    un shape único"*. Mirar el NOMBRE del parámetro, no su posición ni su tipo, es lo que distingue
    `dar_de_alta_afip(cliente_id: str, cuit: str, ...)` de una activity cuyo primer argumento es, por
    ejemplo, un `workflow_id`.

    Hallazgo que motiva esto ([#204]): ~13 activities de dominio (facturación AFIP,
    `refresh_credential` de MercadoPago) reciben `cliente_id` como primer argumento PLANO. El
    interceptor las declaraba con `tenant(None)`, y con RLS `FORCE` eso son lecturas vacías y —el
    caso peor— un `UPDATE` de refresh de MP que afecta 0 filas sin ningún error visible.
    """
    encontrado = _cliente_id_de(payload)
    if encontrado is not None:
        return encontrado
    if fn is None or not args:
        return None
    try:
        parametros = list(inspect.signature(fn).parameters)
    except (TypeError, ValueError):
        # Una firma que no se puede inspeccionar (builtin, C-extension) degrada a "sin tenant",
        # nunca a adivinar por posición.
        return None
    if not parametros or parametros[0] != _PARAM_TENANT_PLANO:
        return None
    primero = args[0]
    return primero if isinstance(primero, str) and primero else None


class _CapturaInbound(ActivityInboundInterceptor):
    def __init__(self, next: ActivityInboundInterceptor,  # noqa: A002
                 traumas: FabricaDeTraumas | None = None) -> None:
        super().__init__(next)
        self._traumas = traumas

    async def execute_activity(self, input: ExecuteActivityInput) -> Any:
        # El interceptor es el BORDE de la activity, y un borde hace dos cosas: declara de quién es la
        # operación (para que la base pueda aplicar RLS — `contexto_tenant.py`) y registra lo que
        # falla. Es el mismo `cliente_id` que ya se extraía para el log: no hay una segunda fuente de
        # verdad del tenant, que es justo lo que haría falsificable el aislamiento.
        payload = input.args[0] if input.args else None
        # `getattr` y no `input.fn` directo: dobles de test más viejos (o de otro repo que reutilice
        # esta costura) pueden no tener el atributo — el objeto REAL de Temporal siempre lo trae.
        fn = getattr(input, "fn", None)
        with tenant(_cliente_id_de_activity(payload, fn, input.args)):
            try:
                return await self.next.execute_activity(input)
            except Exception as exc:
                # Regla 2: registrar NUNCA puede costar más que el error que se registra.
                try:
                    self._registrar(exc, input)
                except Exception:  # noqa: BLE001
                    pass
                raise  # Regla 1: la excepción original sigue su curso, intacta.

    def _registrar(self, exc: BaseException, input: ExecuteActivityInput) -> None:  # noqa: A002
        payload = input.args[0] if input.args else None
        cliente_id = _cliente_id_de_activity(payload, getattr(input, "fn", None), input.args)
        try:
            categoria = categoria_de(exc)
        except ErrorSinCategoria:
            # Regla 3: visible y accionable, no silencioso ni adivinado.
            categoria = "SIN_CATEGORIA"

        info = activity.info()
        fingerprint = log_error(
            exc,
            workflow=info.activity_type,
            cliente_id=cliente_id,
            extra={
                "categoria": categoria,
                "costura": "activity_interceptor",
                "attempt": info.attempt,
                "workflow_id": info.workflow_id,
                # El nombre de la tool, cuando la activity es `execute_tool`. Sin esto, todos los
                # fallos de tools se ven como el mismo error y el fingerprint no discrimina.
                "tool": (payload or {}).get("name") if isinstance(payload, dict) else None,
            },
        )
        # Depositar va después del log: si la DLQ falla, el error ya quedó registrado igual.
        # `depositar` no lanza (`deposito_traumas`), y además todo `_registrar` corre dentro del
        # `try/except` de `execute_activity` — dos redes, porque acá abajo está el turno del usuario.
        depositar(self._traumas, fingerprint=fingerprint, workflow=info.activity_type,
                  error_type=type(exc).__name__, cliente_id=cliente_id,
                  costura="activity_interceptor",
                  contexto={"categoria": categoria, "workflow_id": info.workflow_id,
                            "attempt": info.attempt,
                            # Sin archivo:línea el trauma es contable pero no reparable — el ciclo de
                            # la Fase 3 lee de la DLQ, no del journal donde vive el traceback.
                            "origen": origen_en_el_codigo(exc)})


class CapturaDeErroresInterceptor(Interceptor):
    """Registralo en el `Worker(...)` con `interceptors=[CapturaDeErroresInterceptor(...)]`.

    `traumas` es opcional: sin DLQ la costura captura y loguea igual (ver `deposito_traumas`).
    """

    def __init__(self, traumas: FabricaDeTraumas | None = None) -> None:
        self._traumas = traumas

    def intercept_activity(
        self, next: ActivityInboundInterceptor
    ) -> ActivityInboundInterceptor:
        return _CapturaInbound(next, self._traumas)
