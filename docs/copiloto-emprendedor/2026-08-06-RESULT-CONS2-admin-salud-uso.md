# CONS2 — `/admin/salud` (A1) y `/admin/uso` (A3)

**De:** Backend · **2026-08-06.** Disparador `CONS1` ✅ (registro de auditoria). Read-only, ambos.

## §0 Reutilización

- A3 reusa `queries/metering_dashboard.sql` (BETA-1b) sin reescribir las 3 queries -- ese archivo
  documentaba "correr esto a mano desde Supabase Studio (superuser)"; con `copiloto_consola`
  (CONS0a, `BYPASSRLS` SELECT-only) la MISMA query corre por HTTP con un radio de daño acotado.
- A1 reusa el patrón `_conn_dlq_factory` de `worker_b.py` (DSN opcional -> `None` si no está
  provisionado, en vez de romper el arranque).

## Spike Temporal — verificado contra el SDK real, no la doc de la skill

La skill `temporal-developer` no documenta `list_schedules`/`describe_task_queue` para NINGÚN
lenguaje. Verificado en vivo contra el VPS (`Client.connect('localhost:7233')` real):

- `client.list_schedules()` es una corrutina que devuelve un iterador -- `async for s in await
  client.list_schedules():`, no `async for s in client.list_schedules():` (el segundo compila y
  tira `TypeError` en runtime).
- `describe_task_queue` NO vive en `Client` (alto nivel) -- vive en el stub gRPC crudo
  (`client.workflow_service.describe_task_queue(...)`, con `report_pollers=True`).
- El namespace `default` es COMPARTIDO con otras apps del VPS: `documed-drenaje-grafo` apareció en
  `list_schedules()` real. `admin_salud.py` filtra por los 4 prefijos reales de
  `deploy/worker/ensure_*_schedules.py` (`autosanacion-global` exacto, `grafo-sync-`, `mi-dia-`,
  `soporte-feedback-` como prefijos) -- sin esto, la salud de OTRA app se reportaría como nuestra.

## Qué se entrega

- `apps/copiloto/admin_salud.py` -- `estado_salud()`: pollers de la task queue + schedules propios
  (total/pausados/sin-próxima-corrida). Un schedule ACTIVO sin próxima corrida es la señal real de
  rotura; pausado deliberado no cuenta como roto.
- `apps/copiloto/admin_uso.py` -- `resumen_uso()`: las 3 queries de `metering_dashboard.sql` vía
  `copiloto_consola`.
- `admin_web.py` -- `GET /admin/salud` y `GET /admin/uso?horas=N`, ambos gateados por
  `require_admin` (CONS0b). 503 (no 500/200 falso) si Temporal/`copiloto_consola` no están
  cableados en el proceso -- explícito, no silencioso.
- `serve.py` -- cablea `temporal_client` (ya existía en el composition root) y un
  `_consola_conn_factory` nuevo (mismo patrón que autosanación) al `admin_app`.

## Tests

`test_admin_salud.py` (Temporal mockeado, 6 casos incl. schedule ajeno y pausado-no-es-roto) +
`test_admin_uso.py` (Postgres real, agregado cross-tenant + adversarial de aislamiento) +
`test_admin_web.py` actualizado (CONS0b esperaba `200/{"ok":true}` de un placeholder; ahora
`/admin/salud` sin Temporal cableado da 503 -- el test de control positivo verifica que se pasa el
GATE, no el contenido de A1).

Suite completa VPS: **1719 passed, 22 skipped, 0 fallos**.

## Pendiente, fuera de este PR

CONS3 (A5 Errores/DLQ) y CONS4 (A4 Soporte) — mismo disparador `CONS1`, siguen en el mapa.
