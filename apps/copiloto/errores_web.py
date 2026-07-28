"""Los conflictos (409) del backend, con un **código estable** que la app puede discriminar.

🔴 **Por qué existe este módulo.** Había nueve 409 con seis significados y tres formas de cuerpo
distintas. La app los distinguía por *la forma*: «¿trae `factura_id`? entonces ya se facturó»,
«¿el `detail` es un string? entonces falta el CUIT». Eso ya falló dos veces del lado del cliente, y
el modo de fallo es siempre el mismo: **un 409 nuevo aterriza en la rama de otro**, y el emprendedor
recibe el mensaje equivocado — lo mandaron a cargar un CUIT que ya tenía, por una factura que ya
existía.

Discriminar por forma es adivinar. **Un `codigo` explícito no se puede confundir con otro**, y un
conflicto nuevo que se olvide de declararlo no llega a producción: `test_errores_web.py` falla si
aparece un `status_code=409` fuera de acá.

Los códigos son **contrato con la app**: se agregan, no se renombran. Renombrar uno es romper el
cliente en silencio, que es exactamente lo que este módulo vino a terminar.
"""
from __future__ import annotations

from fastapi import HTTPException

# ── el catálogo. Un código por SIGNIFICADO, no por endpoint ──────────────────────────────────────
# `presupuesto_no_facturable` y `transicion_invalida` son dos códigos y no uno aunque hoy compartan
# la forma `{mensaje, estado}`: el primero dice «no puedo facturar ESTO», el segundo «no podés pasar
# de acá para allá». Con un solo código la app tendría que volver a mirar de qué endpoint vino —
# adivinar por contexto en vez de leer, que es el hábito que estamos sacando.
PRESUPUESTO_YA_FACTURADO = "presupuesto_ya_facturado"
FALTA_CUIT = "falta_cuit"
PRESUPUESTO_NO_FACTURABLE = "presupuesto_no_facturable"
TRANSICION_INVALIDA = "transicion_invalida"
CONCEPTO_DUPLICADO = "concepto_duplicado"
INGRESO_DUPLICADO_PROBABLE = "ingreso_duplicado_probable"
DOCUMENTO_DE_OTRO_CLIENTE = "documento_de_otro_cliente"

# Estos tres son de AFIP. Los dos primeros **ya venían con `codigo`** en `afip_web.py` antes de que
# existiera este módulo: se adoptan con el nombre que ya tenían, no se renombran. Un rename acá sería
# romper al cliente que ya los lee, justamente en el commit que viene a que eso no pase.
SIN_CERTIFICADO_AFIP = "sin_certificado_afip"
AMBIENTE_NO_VINCULADO = "ambiente_no_vinculado"
SIN_PERFIL_FISCAL = "sin_perfil_fiscal"

# Bloqueo TEMPORAL y gestionado, no una regla del producto. El modo automático espera a que se corrija
# el historial del motor: hoy el copiloto narra acciones que no ejecutó a partir del tercer turno, y
# en automático ese fallo es INVISIBLE —no hay card que falte, el copiloto dice «listo» y no hay nada
# que mirar—. En confirmación se ve. Ver `copiloto-narra-la-accion-sin-ejecutarla`.
# Dueño: backend. Se retira cuando la corrección del motor esté viva (decisión del operador, MAYOR).
MODO_AUTOMATICO_NO_DISPONIBLE = "modo_automatico_no_disponible"

# El gate HITL no tomó la confirmación (factura o anulación). Nació el 2026-07-28, cuando `confirmar`
# pasó de signal a Workflow Update: antes NO había 409 posible porque el backend contestaba
# `200 {"ok": true}` con el token vencido igual que con el válido, y el cliente sólo se enteraba
# releyendo el estado. El **por qué** puntual viaja en `motivo_codigo` (`token_desactualizado`,
# `faltan_datos`, `fuera_de_gate`): un código para "no se tomó" y un detalle para "por qué", en vez de
# un código nuevo por cada motivo del workflow — esos los define el workflow, no este catálogo.
CONFIRMACION_NO_TOMADA = "confirmacion_no_tomada"

CODIGOS = frozenset({PRESUPUESTO_YA_FACTURADO, FALTA_CUIT, PRESUPUESTO_NO_FACTURABLE,
                     TRANSICION_INVALIDA, CONCEPTO_DUPLICADO, INGRESO_DUPLICADO_PROBABLE,
                     DOCUMENTO_DE_OTRO_CLIENTE, SIN_CERTIFICADO_AFIP, AMBIENTE_NO_VINCULADO,
                     SIN_PERFIL_FISCAL, MODO_AUTOMATICO_NO_DISPONIBLE, CONFIRMACION_NO_TOMADA})


def conflicto(codigo: str, mensaje: str, **extra) -> HTTPException:
    """Un 409 con `codigo` + `mensaje` + lo que cada caso necesite.

    `mensaje` sigue viajando y sigue siendo el texto que el emprendedor puede leer: el código es
    para la app, no para la persona. Y los campos extra que ya existían (`factura_id`, `candidato`,
    `estado`…) no se tocan — este cambio es **aditivo**, así que un cliente que todavía discrimina
    por forma sigue funcionando mientras migra.
    """
    if codigo not in CODIGOS:
        # Fuerte y temprano: un código inventado en el momento reintroduce el problema entero, y lo
        # haría en silencio (un 409 con un código que la app no conoce cae en su rama por defecto).
        raise ValueError(f"código de conflicto desconocido: {codigo!r}")
    return HTTPException(status_code=409, detail={"codigo": codigo, "mensaje": mensaje, **extra})
