"""Claves declaradas de GET /me (MECLAVESCORE, lado Python).

Espejo de `CLAVES_DECLARADAS` en `packages/core/src/api/me.contrato.ts`. El test de paridad TS
(`me.contrato.paridad.test.ts`) LEE este archivo como texto y compara los dos sets: si agregás o quitás
una clave de la respuesta de /me, cambiá este set y el TS en el mismo PR, o el test sale rojo.

Formato: una clave por línea, entre comillas dobles. No armar el set en tiempo de ejecución: el lector
es un regex sobre el texto del archivo.
"""

CLAVES_ME = frozenset({
    "cliente_id",
    "email",
    "cuenta_google",
    "onboarding_completado",
    "mp_connected",
    "composio_connected",
    "es_admin",
    "legal_aceptado",
    "legal_version_aceptada",
})
