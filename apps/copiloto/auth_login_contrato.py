"""Claves declaradas de POST /auth/login (MECLAVESRESTO, lado Python).

Espejo de `CLAVES_DECLARADAS` en `packages/core/src/api/auth.contrato.ts` y
`apps/copiloto-web/src/lib/api/auth.contrato.ts`. El test de paridad TS (`auth.contrato.paridad.test.ts`,
en los DOS árboles) LEE este archivo como texto y compara los sets: si cambia el set de claves que
GoTrue devuelve (`web.py:login` reenvía `gotrue.password_grant(...)` tal cual, sin spreads), cambiá
este set y los dos TS en el mismo PR, o el test sale rojo.

`expires_at` y `weak_password` se agregaron 2026-10-07 (hallazgo `MECLAVESRESTO`, backend): el set
original (PR #909/910) venía de leer el docstring de `onboarding.py`, lectura ESTÁTICA que no puede
ver lo que GoTrue agrega en el response real. Reconciliado contra el productor real (GoTrue v2.186.0
de test, `test_auth_login_gotrue_real.py`, backend): el payload trae **7** claves siempre, no 5 —
`weak_password` aparece también con password fuerte (confirmado con dos casos, no es ruido del dato
de prueba). Mismo criterio que `MECLAVESCORE`/`CLAVES_ME`: el contrato declara lo que el productor
real manda, no lo que un docstring interno predice.

Formato: una clave por línea, entre comillas dobles. No armar el set en tiempo de ejecución: el lector
es un regex sobre el texto del archivo.
"""

CLAVES_LOGIN = frozenset({
    "access_token",
    "token_type",
    "expires_in",
    "expires_at",
    "refresh_token",
    "user",
    "weak_password",
})
