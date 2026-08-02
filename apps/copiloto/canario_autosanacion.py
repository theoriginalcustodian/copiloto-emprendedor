"""El canario del manejo de errores — la prueba de vida del camino detección → DLQ → ciclo.

## Por qué existe

Si la app está bien construida, la superficie de error tiende a cero y el desenlace normal del ciclo
nocturno es `{"estado": "sin_traumas"}`. Eso es **exactamente lo mismo** que devuelve un ciclo cuyo
cable de detección está cortado. El silencio no distingue "no falla nada" de "no entra nada", y como
en régimen sano el silencio es el 99% de los desenlaces, deja de significar algo.

No es hipotético: el 2026-08-01 se descubrió que la costura HTTP **nunca había depositado un solo
error** en producción — leía el tenant de un `request.state` que nadie escribe. Cuatro días sin
síntoma, con la suite en verde, porque un cable cortado hacia el "no" no protesta
([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]). El canario es el control positivo que faltaba.

## Qué prueba, y qué NO

**Sí:** que un error no manejado, entrando por el borde real (ruta autenticada, tenant declarado por
`require_tenant`), es capturado por la costura y **queda depositado en la DLQ**. Eso cubre de punta a
punta las capas 2 y 3, que son las que pueden romperse en silencio.

**No:** que el ciclo repare bien. Eso lo miden el banco de pruebas y el gate de reproducción. El
canario responde una sola pregunta —*¿el cable sigue conectado?*— y responderla bien vale más que
responder muchas a medias.

## Por qué NO lo repara el ciclo

Su error es **deliberado**: no hay bug que arreglar. Sin exclusión explícita, el forjador le
escribiría un parche a un `raise` puesto a propósito y abriría un PR basura por cada prueba de vida
— y un guard que genera ruido en el caso normal se termina desarmando
([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]). La exclusión vive en
`autosanacion_gates.puede_reparar`, que es donde ya viven todas las demás.

## Cómo se usa

    POST /salud/canario     (con el Bearer de un usuario real — el trauma queda en SU tenant)

Devuelve 500 con su `codigo`, como cualquier otro error: **el canario no es un caso especial del
camino, es un caso normal disparado a propósito**. Si fuera especial no probaría el camino real.
Después, `deploy/copiloto/verificar-autosanacion.py` lo lee de la DLQ como prueba de vida.
"""
from __future__ import annotations

import os

#: Marca que el gate del ciclo busca en la ruta del trauma para excluirlo de la reparación.
#: Va en la RUTA y no en el tipo de excepción porque `puede_reparar` decide con `(ruta, categoría)` —
#: cambiar su firma para esto sería mover el contrato de todos los llamadores por un solo caso.
MARCA = "canario"

#: Ruta del canario. Contiene `MARCA` a propósito: es lo que hace que el gate lo reconozca.
RUTA = "/salud/canario"

#: Apagado del canario, sin desplegar. Default **encendido**: un mecanismo de vigilancia que arranca
#: apagado no vigila nada, y nadie se entera de que no vigila — el mismo default silencioso que este
#: frente ya pagó. Se apaga explícitamente si alguna vez molesta.
ENV_APAGADO = "COPILOTO_CANARIO_OFF"


class ErrorDeCanario(RuntimeError):
    """El error deliberado de la prueba de vida.

    Tipo propio y no un `RuntimeError` pelado para que se lea distinto en la DLQ y en el log: quien
    mire la tabla tiene que poder separar de un vistazo el canario de un fallo real. Hereda de
    `RuntimeError` para que la taxonomía lo clasifique por su base sin necesitar una entrada nueva.
    """


def apagado() -> bool:
    """Se lee en cada disparo, nunca al importar.

    ⚠️ Bajo systemd el entorno se fija al arrancar el proceso: cambiar el env **exige reiniciar el
    servicio** para que surta efecto — la misma trampa ya medida en `autosanacion_gates.apagado`.
    """
    return os.environ.get(ENV_APAGADO, "").strip().lower() in ("1", "true", "yes")


def disparar(cliente_id: str) -> None:
    """Lanza el error del canario. **Siempre lanza** (salvo apagado): ese es su trabajo.

    Recibe `cliente_id` sólo para dejarlo en el mensaje — el depósito lo resuelve la costura leyendo
    el ContextVar, igual que con cualquier otro error. Si esta función depositara por su cuenta,
    probaría su propio camino en vez del de producción, que es el error clásico del control que se
    verifica a sí mismo.
    """
    if apagado():
        return
    raise ErrorDeCanario(
        f"prueba de vida del manejo de errores (tenant {cliente_id}). "
        "Este error es DELIBERADO: si lo ves en la DLQ, el cable detección→depósito está sano.")
