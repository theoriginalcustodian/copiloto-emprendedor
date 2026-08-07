# RESULT — CONS7a/7b · las 2 primeras acciones que MUTAN

**Backend · 2026-08-07.** Contrato `CONS7-las-3-acciones-que-mutan-y-la-que-no-tiene-sustrato`.
7c (cambiar tier) queda fuera de v1 — sin sustrato, escalado al operador por el propio contrato.

## CONS7a — Suspender / reactivar tenant

**El punto de aplicación real vive en `auth.py::make_require_tenant`, no en el endpoint.**
`resolve_cliente_id_y_estado` (nueva, no reemplaza `resolve_cliente_id` — otros llamadores como
`onboarding.py` sólo necesitan el id) trae también `status`; `require_tenant` responde 403
`"tenant suspended"` si no es `'active'`. El guard va en el borde para que no exista una ruta N+1
que se olvide de chequearlo — exactamente lo que el contrato pedía.

`POST /admin/tenants/{cliente_id}/estado` (`admin_tenants.py`) sólo escribe la columna y audita.
Idempotente: repetir el mismo estado igual audita (el intento es el hecho auditable).

## CONS7b — Reintentar un trauma

`POST /admin/errores/{trauma_id}/reintentar`. El gate reusa `autosanacion_gates.dominio_prohibido`
— la MISMA función que usa el ciclo automático, sin catálogo nuevo (`admin_errores.motivo_prohibido`,
chequea `workflow`/`costura`/`contexto.origen.archivo`: el ciclo automático sólo mira el archivo,
pero un reintento manual puede aplicar a un trauma sin `origen`). Trauma prohibido → 409 (código
`trauma_dominio_prohibido` vía `errores_web.conflicto`, no un `HTTPException` a mano — el guard del
repo lo exige) y **no cambia de estado**; trauma permitido → `TraumaStore.reabrir()` (nueva,
incondicional a diferencia de `depositar()`) lo vuelve a `pendiente`. Los dos casos, auditados.

## Hallazgos en el camino

1. **`copiloto_auditoria` es append-only NI PARA LOS TESTS** — el trigger de CONS1 bloquea el
   `DELETE` incluso desde la limpieza de un fixture. No es un bug: es el sistema haciendo lo que
   tiene que hacer. Los fixtures de este PR no intentan borrar auditoría.
2. **`admin_user_id`/`composio_user_id` son columnas tipadas** (`uuid`, `NOT NULL`) — dos de mis
   propios tests fallaron contra Postgres real por usar valores de prueba no conformes (`"admin-1"`
   en vez de un UUID, `tenants` sin `composio_user_id`). Corregido antes de este commit — ejemplo
   de por qué el test corre contra Postgres real y no un mock: el mock no habría cazado ninguno de
   los dos.
3. **`HTTPException(409, ...)` a mano está prohibido por un guard del repo** (`test_errores_web.py`)
   — se agregó el código `trauma_dominio_prohibido` al catálogo de `errores_web.py` en vez de
   escribir el 409 directo.

## Evidencia

Suite completa VPS (stage aislado): **1744 passed, 22 skipped, 0 fallos**.

Tests nuevos: `test_require_tenant_suspendido_da_403_y_activo_da_200_MISMO_TEST` (fake, rápido),
`test_admin_tenants.py` (HTTP end-to-end contra Postgres real, control positivo+negativo en el mismo
test), `test_admin_errores_reintentar.py` (los dos casos —prohibido y permitido— en la misma corrida,
+ adversarial 403 + 404).
