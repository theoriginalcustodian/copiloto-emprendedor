# Pasada 2 — Robustez · HALLAZGOS

> **2026-08-12, sesión auditoría (read-only).** Contra `origin/main @ ce855054` (worktree `audit/pasadas-1-2`).
> Método: barrido de greps dirigidos + 1 sub-agente Temporal (durabilidad). Estado de partida tomado de
> `2026-08-12-reverificacion-beta.md` — no re-verificado, sólo instrumentado a nivel de clase.

**Resumen:** 7 hallazgos. 0 P0 · 4 P1 · 3 P2. El **moat de durabilidad Temporal está bien construido**
(evidencia, no relleno, al final). Los P1 son de escala/idempotencia/observabilidad, no rompen la beta
cerrada pero entran en el primer sprint. F-C8 confirmado como clase cerrada (solo 1 instancia).

---

### H-1 · C1 — capa de persistencia sin pool, patrón propagado · P1
Dónde: 8 `psycopg2.connect` directos (prod: `serve.py:103`, `serve.py:234`, `worker_b.py:149`,
`worker_b.py:384`, `worker_soporte.py:140`) + **~60 `conn = self._conn_factory()` sin `with`** repartidos
en 10 stores (`afip_comprobante_store.py` 10 sitios, `afip_credential_store.py` 12, `soporte_store.py` 7,
`trauma_store.py` 8, `presupuesto_store.py` 6, `mp_credential_store.py` 5, `mp_payment_store.py` 3,
`mp_dedup_store.py` 2, `auditoria_store.py` 2, `perfil_negocio_store.py` 2).
Falla: `git grep "ConnectionPool|psycopg_pool|pgbouncer"` → **0**. Cada request/activity abre una conexión
nueva; los ~60 sitios `conn = ...()` sin context manager dependen de un `close()` en `finally` para no
filtrar. Con el polling de `/reply` cada 1.5s multiplicando el churn, al crecer se choca el techo de
`max_connections` del Postgres compartido → cliff.
Clase: `grep -rn "conn = self\._conn_factory()" apps/copiloto` → ~60 sitios / 10 archivos; `grep psycopg2.connect` → 8.
Dueño sugerido: backend (infra + código). Fix de raíz: pool detrás de `conn_factory` (1 lugar) + PgBouncer.

### H-2 · C2 — ruta de cobro MP destapada al retry at-least-once · P1
Dónde: `dispatcher_emprendedor.py:102` — `ext_ref = f"copiloto-{secrets.token_hex(4)}"` + `create_payment_link`
directo, **sin** pasar por `MpLinkDedupStore`.
Falla: la ruta gemela `tool_catalog.py:600` **sí** quedó protegida por `mp_dedup_store` (commit `add3874f`),
pero `dispatcher_emprendedor` no. Un retry at-least-once de Temporal por esta ruta genera un **segundo link
de pago** con `ext_ref` aleatorio irreconciliable. `make_dispatcher` está cableado en prod (`worker_b.py:266`),
no es código muerto.
Clase: `grep -rn "token_hex" apps/copiloto` → 2 sitios; solo 1 (tool_catalog) usa `mp_dedup`. Además
`composio_gateway.execute` (`composio_gateway.py:111`) no recibe `idem_key` → gmail/docs/drive/sheets/calendar
sin dedup alguno.
Dueño sugerido: backend + motor. Fix: extender `mp_dedup` a la ruta dispatcher + propagar `idem_key` a `gateway.execute`.

### H-3 · D-A — 4 errores tragados sin log/DLQ; 1 es blind spot del autohealing · P1
Dónde: `tool_catalog.py:1599`, `services/__init__.py:26`, `mercadopago_gateway.py:119` (motor),
`inteligencia_chat.py:144` y `:168`.
Falla: los 4 `except Exception` no llaman `log_error`/`depositar()`/`fingerprint`. El crítico es
`tool_catalog.py:1599` (catch-all del executor ReAct): un fallo de un módulo de servicio (Gmail/Drive/HubSpot)
durante una tool **nunca llega a la DLQ `copiloto_traumas`** ni al autohealing — contradice el objetivo del
frente de errores justo en la ruta más caliente. Los otros 3: firma-atacante y bug interno colapsan en el
mismo `False`/`"no sé"` mudo.
Clase: 4 sitios / 4 archivos (barrido cerrado). El frente de errores agregó comentarios que **justifican** el
mutismo, sin engancharlo.
Dueño sugerido: backend + motor. Fix: `log_error` + `depositar()` en los 4 puntos.

### H-4 · F-C8 — señal `signal_anulacion` descarta el `payload` (clase CERRADA: 1 instancia) · P1
Dónde: `web.py:443` — `await handle.signal(nombre)`; gemela sana `web.py:366` (`signal_factura`) usa
`handle.signal(nombre, payload) if payload is not None else ...`.
Falla: cualquier caller futuro que pase un `payload` (ej. `cancelar_con_motivo`, `{"motivo": ...}`) lo pierde
en silencio en una señal Temporal. Hoy sin síntoma (el único caller, `afip_web.py:549`, pasa `None`).
Clase: `git grep -n "handle\.signal("` → **exactamente 2 sitios**; solo `signal_anulacion` descarta. Barrido
de clase completo: no hay otras señales que tiren argumentos. **Ya está en contrato a backend.**
Dueño sugerido: backend. Fix: 1 línea (alinear con la gemela). Confirmado también por el sub-agente Temporal.

### H-5 · C7 — Composio síncrono sin cache, golpeado por request · P2
Dónde: `web.py:870`, `web.py:879`, `web.py:914`, `web.py:984` (`list_connections`) + `afip_web.py:173`
(`connection_status`).
Falla: `git grep "TTLCache|lru_cache|cachetools"` → **0**. Cada apertura de `/me`, `/catalog`, `/afip/estado`
golpea el SDK Composio síncrono sin TTL. Latencia acumulada + presión sobre la cuota del SDK al escalar.
Clase: 5 call-sites / 2 archivos.
Dueño sugerido: backend/motor. Fix: `TTLCache` 30-60s per-tenant, invalidado por connect/disconnect.

### H-6 · C3 — fallo del Doc de presupuesto se loguea pero no se deposita en DLQ · P2
Dónde: `presupuestos_web.py:244` y `:386` — `log_error(exc, workflow="crear_presupuesto"/"facturar_presupuesto", ...)`.
Falla: mejoró respecto del claim (ya no descarta el `motivo`: emite línea JSON con fingerprint), **pero es
log, no depósito reintentable**: no hay `trauma_store.depositar()` ni tabla conectada a este endpoint. El Doc
se genera fuera de Temporal (threadpool del request); si Google falla, queda registrado pero nadie lo reprocesa.
Clase: 2 sitios / 1 archivo.
Dueño sugerido: backend. Fix: `depositar()` a la DLQ, o mover a activity Temporal.

### H-7 · F3 — activities del loop ReAct sin `heartbeat_timeout` + `patched()` sin gate CI · P2
Dónde: `motor/backend/agent/conversation_workflow.py:544,603` (`call_llm_tools`/`execute_tool` con
`ACTIVITY_TIMEOUT=120s`, sin `heartbeat_timeout`) · disciplina de `patched()` sin `Replayer` en CI.
Falla: (a) si el worker muere a los 3s de arrancar una tool Composio lenta (Drive/Gmail), Temporal no lo
detecta hasta agotar los 120s → 2 min de "pensando…" en el path más usado (cada turno). Las activities AFIP
sí tienen heartbeat 60s — asimetría. (b) El replay-safety de las 47 ejecuciones abiertas depende de que cada
dev recuerde envolver cambios de orden/nombre de `execute_activity` en `patched()`; nada en CI corre
`Replayer.replay_workflow` contra el histórico.
Clase: 3 activities del loop sin heartbeat; 0 gates CI de replay.
Dueño sugerido: backend. Fix: `heartbeat_timeout` en las 3 activities del loop; check de replay en el gate.

---

## Evidencia de lo que está BIEN (no es relleno — es el control positivo)

- **Durabilidad Temporal (el moat): sólida.** Boundary determinismo/IO respetado al 100% en las 8 unidades
  (0 `datetime.now`/`random`/`uuid4`/IO en código de workflow — todo en activities). `workflow.now()` usado
  correctamente. `RetryPolicy` acotada en el 100% de las activity calls (nunca el default ilimitado) — corrige
  un incidente real (429 colgando turnos, 2026-07-04). `continue_as_new` con `MAX_TURNS_PER_RUN=200` +
  `_flush_memory` + `wait_condition(all_handlers_finished)` antes de cortar.
- **C2 parcialmente resuelto:** `mp_dedup_store` (índice único + `ON CONFLICT`) es el patrón correcto ya vivo
  en 1 de 2 rutas. El fix de H-2 es extenderlo, no inventarlo.

## Fuera de alcance (declarado)
- No se corrió el scan completo de `/claude-security` (Pasada 1). El mapa BOLA (objetivo nº1) se cubrió con
  agentes dirigidos por lote — más preciso y barato que el scan no determinista, dada la restricción de
  economía de tokens del contrato. Declarado, no silencioso ([[instrumentos-que-confirman-en-vez-de-verificar]]).
