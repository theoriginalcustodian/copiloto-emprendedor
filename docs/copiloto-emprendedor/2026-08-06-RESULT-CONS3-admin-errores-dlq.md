# RESULT — CONS3 · `/admin/errores` (A5 Errores/DLQ), read-only

**Backend · 2026-08-06.** Disparador `CONS1` ✅ cumplido (PR #294, `copiloto_auditoria`). Sigue el
mismo patrón que CONS2 (A1/A3): endpoint sobre `admin_web.py`, capacidad primero, reutiliza
`copiloto_consola` (BYPASSRLS, SELECT-only, ya provisionado en CONS0a y extendido en CONS1).

## §0 Reutilización — nada se reimplementa

| Capacidad | Ya existía en | Qué agregó CONS3 |
|---|---|---|
| DLQ con máquina de estados, dedupe por `(cliente_id, fingerprint)` | [trauma_store.py](../../apps/copiloto/trauma_store.py) | nada — se lee tal cual |
| Selección de "un representante por bug" cross-tenant | `TraumaStore.tomar_un_bug_distinto` (`DISTINCT ON (fingerprint) ORDER BY dedupe_count DESC`, trauma_store.py:205) | el MISMO patrón SQL, reutilizado de lectura (sin `FOR UPDATE`, sin filtrar a `pendiente`) |
| Nota del último intento de autosanación | `autosanacion_activities.marcar_trauma` escribe `contexto->>'ultima_nota'` (motivo de gate/auditor/tests, o URL del PR) | se expone tal cual — es exactamente "qué intentó y en qué terminó" que pide la spec §5 A5 |
| Rol cross-tenant de sólo lectura | `copiloto_consola` (CONS0a, extendido CONS1) — ya tenía grant en `copiloto_traumas` | ninguno — cero cambios de rol/grant necesarios |

**Lo único nuevo:** `apps/copiloto/admin_errores.py` (una función, `resumen_errores`) y el endpoint
`GET /admin/errores` en `admin_web.py`.

## El hallazgo de boundary (por qué esto no es un simple `SELECT *`)

`copiloto_traumas.contexto` es una columna compartida por dos escritores con intención MUY distinta:

1. **Las costuras de captura** (`handler_errores_web.py`, `interceptor_errores.py`) escriben ahí
   `{categoria, origen}` — shape, no contenido, coherente con la promesa de SPECS §2.
2. **`soporte_feedback_activities.py:93`** escribe además `sintoma_no_tecnico`: el texto libre que
   el emprendedor tipeó describiendo su problema. Eso es "contenido de las conversaciones" —
   **explícitamente fuera** del boundary de la consola (§2 de las specs: A4 lo clasifica, no lo
   expone).

Un `SELECT contexto` ingenuo habría filtrado ese texto a través de la consola de administración. La
implementación selecciona únicamente `contexto ->> 'ultima_nota'` — la clave que escribe la
autosanación sobre su propio intento — nunca la columna completa. Documentado en el docstring del
módulo y verificado con un test dedicado
(`test_resumen_errores_NO_expone_contexto_completo_ni_sintoma_no_tecnico`).

## Diseño

```
GET /admin/errores?estado=pendiente&limite=50
→ {"errores": [{fingerprint, workflow, error_type, costura, estado, ultima_nota,
                dedupe_count, intentos, created_at, updated_at, tenants_afectados}, ...]}
```

- Agrupado por `fingerprint`, representante = mayor `dedupe_count` (mismo criterio que
  `tomar_un_bug_distinto`: "se repara primero lo que más duele").
- `tenants_afectados` = `count(*) OVER (PARTITION BY fingerprint)` antes del `DISTINCT ON` — cuántos
  tenants comparten el mismo bug, sin listar sus `cliente_id` (A5 es sobre el BUG, no sobre a quién
  le pegó — a diferencia de A3, que sí es por tenant).
- 503 si `consola_conn_factory` no está cableado (mismo contrato que A1/A3).

## Fuera de alcance (v1 de CONS3, por diseño)

**La acción "reintentar" NO se implementa acá.** Es una de las 3 acciones que MUTAN (SPECS §6, ítem
3) — capa `ambas`, con contrato de planificación pendiente (`CONS7` en la cola). CONS3 es
estrictamente lectura, como dice el propio nombre del hito en `PLAN.md`.

## Evidencia

Suite completa VPS: ver `avance_` al buzón (adjunta el conteo passed/skipped de esta corrida).
Tests nuevos: `test_admin_errores.py` — agrupación cross-tenant, boundary de `sintoma_no_tecnico`,
exposición de `ultima_nota`, filtro por `estado`, y adversarial (conexión de tenant normal no ve
cross-tenant).
