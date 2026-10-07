"""Claves declaradas de GET /catalog (MECLAVESRESTO, lado Python).

Espejo de `CLAVES_DECLARADAS` en `apps/copiloto-web/src/lib/api/catalog.contrato.ts`. El test de
paridad TS (`catalog.contrato.paridad.test.ts`) LEE este archivo como texto y compara los dos sets:
si cambia el set de claves que `web.py:catalog` devuelve (`return {"services": build_catalog(...)}`),
cambiá este set y el TS en el mismo PR, o el test sale rojo.

Formato: una clave por línea, entre comillas dobles. No armar el set en tiempo de ejecución: el lector
es un regex sobre el texto del archivo.
"""

CLAVES_CATALOG = frozenset({
    "services",
})
