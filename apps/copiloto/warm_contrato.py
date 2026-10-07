"""Claves declaradas de POST /warm (MECLAVESRESTO, lado Python).

Espejo de `CLAVES_DECLARADAS` en `apps/copiloto-web/src/lib/api/warm.contrato.ts`. El test de
paridad TS (`warm.contrato.paridad.test.ts`) LEE este archivo como texto y compara los dos sets: si
cambia el set de claves de cualquiera de los 3 `return` de `web.py:warm`
(`{"warmed": False}` ×2 + `{"warmed": bool(warm_fn(cliente_id))}`), cambiá este set y el TS en el
mismo PR, o el test sale rojo.

Los 3 `return` del handler comparten la misma forma (verificado leyendo las 3 líneas, no sólo una).

Formato: una clave por línea, entre comillas dobles. No armar el set en tiempo de ejecución: el lector
es un regex sobre el texto del archivo.
"""

CLAVES_WARM = frozenset({
    "warmed",
})
