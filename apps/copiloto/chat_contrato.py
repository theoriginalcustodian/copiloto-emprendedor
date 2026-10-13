"""Claves declaradas de la familia de endpoints de CHAT (MECLAVESRESTO + CONTRATO4, lado Python).

Cada set espeja un `CLAVES_DECLARADAS` TS en `apps/copiloto-web/src/lib/api/*.contrato.ts`. Los tests de
paridad TS (`*.contrato.paridad.test.ts`) LEEN este archivo como texto y comparan los dos sets: si cambia
el set de claves que devuelve un handler de `web.py`, cambiá el set de acá y el espejo TS en el mismo PR,
o el test sale rojo. Y desde #1069 / CONTRATO4 cada set se mide además contra el `return` REAL del handler
(`tests/test_chat_contrato_return_real.py` y `tests/test_chat_familia_contrato_return_real.py`), porque la
paridad sola compara dos DECLARACIONES y puede estar mal en las dos a la vez (así nació el drift de
`session_id` en `/chat`).

| set                          | endpoint                  | `return` de `web.py`                                  |
|------------------------------|---------------------------|-------------------------------------------------------|
| `CLAVES_CHAT`                | `POST /chat`              | `{wf_id, accepted, session_id}`                       |
| `CLAVES_CHAT_AUDIO`          | `POST /chat/audio`        | `{wf_id, accepted, transcript}`                       |
| `CLAVES_CHAT_FOTO`           | `POST /chat/foto`         | `{wf_id, accepted}`                                   |
| `CLAVES_SOPORTE_CHAT`        | `POST /soporte/chat`      | `{wf_id, accepted, session_id}`                       |
| `CLAVES_SOPORTE_CHAT_AUDIO`  | `POST /soporte/chat/audio`| `{wf_id, accepted, session_id, transcript}`           |

⚠️ Los handlers reciben payloads mucho más grandes (session_id, text, kind, funcion, audio, imagen...) —
ESO es lo que cada endpoint ENVÍA, no lo que devuelve. Estos sets son sólo el `return`.

Formato: una clave por línea, entre comillas dobles. No armar los sets en tiempo de ejecución: el lector
es un regex sobre el texto del archivo.
"""

# POST /chat.
# `session_id` es el id EFECTIVO del turno: para un chat normal es el mismo que se mandó; para
# `kind="dictado:<destino>"` el backend lo namespacea (`dictado:<destino>:<sid>`, #1050) y es el que
# hay que pollear en `/reply`. Lo devolvía desde #1050 sin declararlo: el smoke contra prod lo cazó
# (`sobra_no_declaradas=['session_id']`) porque este set describía el return viejo.
CLAVES_CHAT = frozenset({
    "wf_id",
    "accepted",
    "session_id",
})

# POST /chat/audio.
# `wf_id` es el id del workflow de Temporal (igual que `/chat`); `transcript` es lo que entendió el STT.
# 🔎 Por qué NO devuelve `session_id` y `/chat` sí (asimetría DECLARADA a propósito, no un olvido): el
# `session_id` entró al `return` de `/chat` en #1050 porque ahí el id EFECTIVO puede DIFERIR del enviado
# (el `kind="dictado:<destino>"` lo namespacea y el cliente tiene que adoptarlo para pollear `/reply`).
# `/chat/audio` no recibe `kind`, así que nunca abre un namespace: usa el `session_id` que mandó el
# cliente tal cual (y rechaza con 422 uno reservado para dictado). Efectivo == enviado => no hay nada
# que devolver. Si algún día el audio tiene que dictar por este endpoint, el efectivo pasa a diferir y
# esto es un `pedido_` aparte (agregar la clave acá, en el return y en el espejo TS), no un fix de oficio.
CLAVES_CHAT_AUDIO = frozenset({
    "wf_id",
    "accepted",
    "transcript",
})

# POST /chat/foto (OCR de tickets, Gastos Fase 2).
# ⚠️ DOS RAREZAS DECLARADAS (hallazgos de planificación, 2026-10-13; este contrato DECLARA lo que hay, no
# lo cambia -- cambiar un campo de respuesta con consumidor vivo es otro `pedido_`):
#   1. `accepted` es SIEMPRE `true` en el 200 (literal en `web.py`, no computado): en este camino no
#      existe el valor `false`. La señal de falla NO es el campo sino el STATUS HTTP: 413 imagen grande,
#      415 formato/firma, 422 sin ticket reconocible, 502 error del OCR, 503 OCR no configurado. Un
#      cliente que ramifique por `accepted` no aprende nada: tiene que ramificar por `r.ok`.
#   2. `wf_id` NO es un id de workflow. Este camino no pasa por Temporal (`route_inbound`): lleva el
#      `idem_key` (`foto:<uuid4>`) con el que se escribió la card por `adapter.send`. Se llama `wf_id`
#      sólo por paridad de forma con los otros endpoints. Riesgo latente, no bug vivo: ningún consumidor
#      lo usa para pollear (el polling va por `/reply` con `session_id`). NO usarlo para consultar a
#      Temporal.
CLAVES_CHAT_FOTO = frozenset({
    "wf_id",
    "accepted",
})

# POST /soporte/chat.
# `session_id` es el `channel_ref` que el SERVIDOR calculó (`soporte:<funcion>:<sid>`, idempotente), NO
# un eco del enviado: el cliente tiene que adoptarlo para los turnos siguientes y para pollear `/reply`.
CLAVES_SOPORTE_CHAT = frozenset({
    "wf_id",
    "accepted",
    "session_id",
})

# POST /soporte/chat/audio (ODOBI8 §C1): fusiona `/chat/audio` (transcript) con `/soporte/chat`
# (session_id efectivo namespaceado por `funcion`). Por eso devuelve las dos claves que a `/chat/audio`
# le faltan y a `/soporte/chat` le sobran.
CLAVES_SOPORTE_CHAT_AUDIO = frozenset({
    "wf_id",
    "accepted",
    "session_id",
    "transcript",
})
