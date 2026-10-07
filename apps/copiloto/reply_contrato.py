"""Claves declaradas de GET /reply (MECLAVESRESTO, lado Python).

Espejo de `CLAVES_DECLARADAS` en `apps/copiloto-web/src/lib/api/reply.contrato.ts`. El test de
paridad TS (`reply.contrato.paridad.test.ts`) LEE este archivo como texto y compara los dos sets: si
cambia el set de claves que `web.py:reply` devuelve
(`return {"replies": rows, "next_id": next_id}`), cambiá este set y el TS en el mismo PR, o el test
sale rojo.

El ancla del lado TS es `RawReplyResponse` -el shape CRUDO que llega por la red- no `ReplyResponse`
(el shape normalizado que usa `useChat`, con `reply_text` ya mapeado a `text`). Comparar contra el
normalizado compararía una transformación del cliente, no la respuesta real del backend.

Formato: una clave por línea, entre comillas dobles. No armar el set en tiempo de ejecución: el lector
es un regex sobre el texto del archivo.
"""

CLAVES_REPLY = frozenset({
    "replies",
    "next_id",
})
