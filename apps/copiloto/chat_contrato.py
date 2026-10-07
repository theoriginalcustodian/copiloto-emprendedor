"""Claves declaradas de POST /chat (MECLAVESRESTO, lado Python).

Espejo de `CLAVES_DECLARADAS` en `apps/copiloto-web/src/lib/api/chat.contrato.ts`. El test de paridad
TS (`chat.contrato.paridad.test.ts`) LEE este archivo como texto y compara los dos sets: si cambia el
set de claves que `web.py:chat` devuelve (`return {"wf_id": wf_id, "accepted": wf_id is not None}`),
cambiá este set y el TS en el mismo PR, o el test sale rojo.

⚠️ El handler recibe un payload mucho más grande (session_id, text, kind, engine_mode,
idle_timeout_seconds, memory) para armar el `raw_update`/`extra_config` que manda al workflow — ESO
es lo que `/chat` ENVÍA, no lo que devuelve. Este set es sólo el `return`.

Formato: una clave por línea, entre comillas dobles. No armar el set en tiempo de ejecución: el lector
es un regex sobre el texto del archivo.
"""

CLAVES_CHAT = frozenset({
    "wf_id",
    "accepted",
})
