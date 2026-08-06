# RESULT — CONS0b: de dónde sale el claim de administrador

**Fecha:** 2026-08-06. **Autor:** Backend. **Contrato:** `.../CONS0b-spike-de-donde-sale-el-claim-de-administrador.md`.

## Dónde vive el claim: `app_metadata.copiloto_admin` — verificado, no asumido

Spike ejecutado contra **GoTrue real** (`fusion`, self-host v2.186.0), con 2 usuarios throwaway
(creados y eliminados por el propio spike). El shape final, decodificado de un JWT REAL emitido
por GoTrue tras el re-login:

```json
{
  "sub": "f976a596-59de-4853-ad49-a9dba3951769",
  "aud": "authenticated",
  "app_metadata": {"cliente_id": "sonda-cliente-id", "copiloto_admin": true, "provider": "email", "providers": ["email"]},
  "user_metadata": {}
}
```

### Los 6 supuestos, cada uno probado por separado

| # | Supuesto | Resultado medido |
|---|---|---|
| 1 | Usuario nuevo NO nace con el claim | ✔ `app_metadata` inicial = `{provider, providers}` (sólo lo que GoTrue agrega solo) |
| 2 | El PUT admin **mergea** `app_metadata`, no lo reemplaza | ✔ tras setear `cliente_id` y después `copiloto_admin` por separado, los DOS sobrevivieron juntos |
| 3 | Un login **fresco** (no el token viejo) trae el claim en el JWT | ✔ `password_grant` tras el PUT admin → JWT decodificado con `copiloto_admin: true` |
| 4 | Intentos de auto-escalada vía self-update (`PUT /auth/v1/user`, el token del propio usuario) | `app_metadata` top-level → **403** · `data.copiloto_admin` → 200 pero no llega a `app_metadata` · `data.app_metadata.copiloto_admin` anidado → 200 pero tampoco llega |
| 5 | Confirmación: un usuario que NUNCA pasó por el admin, tras los 3 intentos de escalada, sigue sin el claim en un login fresco | ✔ `app_metadata` = sólo `{provider, providers}` |
| 6 | Control positivo del mecanismo de self-update: el usuario SÍ puede editar su propio `user_metadata` | ✔ status 200 — así el resultado del punto 5 es significativo (el self-update no está simplemente roto) |

**Conclusión de seguridad:** `user_metadata` es auto-editable (confirmado, punto 6) y por eso
**nunca** puede ser el lugar del claim — sería auto-otorgable. `app_metadata` sólo se escribe con
`service_role_key` (Admin API) y ningún camino de self-update logró tocarlo, en 3 formas de
payload distintas.

## Mecanismo de asignación — reutilizado, no reinventado

`apps/copiloto/onboarding.py::GoTrueAdmin` ya es el adaptador canónico de la Admin API (usado por
el onboarding real). Se agregaron 2 métodos:

- `find_user_by_email(email)` — envoltorio público sobre el lookup privado ya existente.
- `admin_grant_operador(user_id)` — mismo patrón que `admin_set_claim` (que ya setea
  `cliente_id`), aplicado a `copiloto_admin`.

`deploy/copiloto/asignar-claim-admin.sh` — idempotente (el merge del servidor lo garantiza),
verifica al final que los claims previos del usuario **sobrevivieron** (no sólo que el nuevo se
seteó). No se corrió contra un email real: asignar el claim a una persona concreta es una
decisión del operador (specs §10: "hoy hay un solo administrador"), no parte de este spike.

## `auth.py` no rompe `require_tenant` — nueva fábrica, cero cambios a las 2 existentes

`make_require_admin(secret, issuer)`: mismo patrón de fábrica que `require_tenant`/
`require_claims` (fail-closed en construcción si falta el secreto), **sync** (no toca Postgres/
`ContextVar`, a diferencia de `require_tenant` que por eso es `async`). Lee
`claims["app_metadata"]["copiloto_admin"]`, exige `is True` exacto (no truthy) — 403 si falta o
es `false`.

**No exige fila de tenant** (a diferencia de `require_tenant`): el operador es un actor de la app,
no de un tenant (specs §2).

## Endpoint sujeto de prueba: `GET /admin/salud`

`apps/copiloto/admin_web.py` — mínimo, `{"ok": true}` gateado por `require_admin`. No implementa
A1-A6 de las specs; existe para tener algo real contra qué correr los 3 tests del DoD.

## Test adversarial obligatorio — dónde vive

- `apps/copiloto/tests/test_auth.py` — 8 tests de `make_require_admin` (con claim, sin claim →403,
  claim en `false` →403, claim en `user_metadata` →403, sin header →401, issuer incorrecto →401,
  secreto vacío →ValueError).
- `apps/copiloto/tests/test_admin_web.py` — los 3 exigidos por el DoD contra el endpoint real:
  `test_admin_con_el_claim_entra` (control positivo), `test_usuario_normal_403` (adversarial),
  `test_no_puede_autoasignarse_via_user_metadata` (escalada).
- `apps/copiloto/tests/test_onboarding.py` — 3 tests nuevos de `GoTrueAdmin.admin_grant_operador`/
  `find_user_by_email` (transporte mockeado, sin red real — mismo patrón que `admin_create_user`).

**1629 tests verdes** (suite completa, con Postgres real + roles `copiloto_consola`/
`copiloto_autosanacion`), 22 skipped (sólo los que necesitan LLM/APIs externas), 0 fallos.

## Qué falta (fuera de este spike)

Endpoints reales `/admin/*` para A1-A6 (esto sólo dio `/admin/salud`). El sprint de la Consola
puede empezar: los 2 supuestos bloqueantes (S1 en CONS0a, S2 acá) están resueltos con evidencia.
