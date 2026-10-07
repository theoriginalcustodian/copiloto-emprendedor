"""Claves declaradas de POST /auth/login (MECLAVESRESTO, lado Python).

Espejo de `CLAVES_DECLARADAS` en `packages/core/src/api/auth.contrato.ts`. El test de paridad TS
(`auth.contrato.paridad.test.ts`) LEE este archivo como texto y compara los dos sets: si cambia el
set de claves que GoTrue devuelve (`web.py:login` reenvía `gotrue.password_grant(...)` tal cual, sin
spreads), cambiá este set y el TS en el mismo PR, o el test sale rojo.

Formato: una clave por línea, entre comillas dobles. No armar el set en tiempo de ejecución: el lector
es un regex sobre el texto del archivo.
"""

CLAVES_LOGIN = frozenset({
    "access_token",
    "token_type",
    "expires_in",
    "refresh_token",
    "user",
})
