# RESULT — CONS4 · `/admin/soporte` (A4 Soporte), read-only

**Backend · 2026-08-07.** Disparador `CONS1` ✅ cumplido. Mismo patrón que CONS2/CONS3.

## §0 Reutilización

| Capacidad | Ya existía en | Qué agregó CONS4 |
|---|---|---|
| Tickets de feedback (texto/voz) | [feedback_store.py](../../apps/copiloto/feedback_store.py) — sólo tiene `crear`, sin `listar` | consulta directa por SQL (mismo estilo que `admin_uso.py` con `copiloto_metering`) |
| Clasificación → derivación a autosanación | `soporte_feedback_activities.clasificar_y_encolar_feedback` deposita el trauma con `fingerprint=f"feedback:{fid}"` | `LEFT JOIN` reconstruye esa convención — sin FK nueva, sin tabla nueva |
| Rol cross-tenant de sólo lectura | `copiloto_consola` ya tenía `SELECT` en `copiloto_feedback` (provisionado junto con `copiloto_traumas` desde CONS0a) | ninguno |

## El espejo exacto de CONS3, del lado contrario del boundary

CONS3 (A5, DLQ) tuvo que **ocultar** `sintoma_no_tecnico` — el texto libre del emprendedor que
`clasificar_y_encolar_feedback` guarda en `copiloto_traumas.contexto`. CONS4 (A4) es precisamente el
lugar donde ese mismo texto **sí** se muestra: SPECS §2 declara "Feedback y su clasificación" DENTRO
del boundary. Mismo dato, dos endpoints, un solo criterio de exposición consistente en los dos.

## Límite conocido, heredado y no resuelto acá (por diseño, no descuido)

Un ticket que la clasificación resolvió como `necesita_humano` no deja rastro durable: el propio
`soporte_feedback_activities.py` (docstring, "Por qué NO hay tabla de estado nueva") declara que la
clasificación es efímera — vive sólo en el retorno de la activity, no en una columna. `/admin/soporte`
puede decir "no derivó en autosanación (todavía, o nunca)" vía la ausencia del `LEFT JOIN`, pero no
puede distinguir "esperando reprocesarse" de "el clasificador dijo que no" sin ese estado. Construir
esa columna ahora sería sobreingeniería para v1 (spec §6, "no se construye hasta que el volumen lo
pida") — se hereda el mismo TODO visible que ya declaraba el módulo de origen, no se agrega uno nuevo.

## Diseño

```
GET /admin/soporte?limite=50
→ {"tickets": [{id, cliente_id, tipo, texto, created_at,
                derivo_en_autosanacion, estado_reparacion, origen, ultima_nota, dedupe_count}, ...]}
```

- 503 si `consola_conn_factory` no está cableado (mismo contrato que A1/A3/A5).

## Evidencia

Suite completa VPS: ver `avance_`/`cierre_` al buzón. Tests nuevos: `test_admin_soporte.py` — texto
expuesto, derivación por convención de fingerprint con `origen` estructurado, adversarial (conexión
de tenant no ve cross-tenant).
