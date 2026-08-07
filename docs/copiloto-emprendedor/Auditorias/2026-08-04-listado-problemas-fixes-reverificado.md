# Listado de problemas y fixes de raíz — re-verificado contra código pusheado

> **2026-08-04, sesión de auditoría.** Re-verificación de los 11 hallazgos de la auditoría del
> 2026-07-23 (Fable v1 + mapa de clases + Fable v2) contra `origin/main` HEAD `~5057ee74`, tras ~198
> commits. Método: 5 sub-agentes paralelos, cada instancia verificada `git show origin/main:<path>` /
> `git grep` (NO working tree). Estado: **RESUELTO / PARCIAL / VIVO**.
>
> **Titular:** el frente de **manejo de errores está genuinamente construido y en prod** (núcleo
> completo). De los 11 problemas, **2 resueltos, 3 parciales, 6 vivos**. Ninguno de los 6 vivos
> requiere invención — el repo ya tiene los patrones correctos; falta propagarlos a los puntos exactos.

---

## Tabla maestra

| # | Problema | Estado hoy | Fix de raíz pendiente |
|---|---|---|---|
| C9 | Secretos/PII en el árbol | ✅ **RESUELTO** | — (gitignore commiteado; `tok.json`/`gastos_antes` ya no existen) |
| C4.2 | `/auth/*` sin rate-limit | ✅ **RESUELTO** | — (#229: middleware 60req/60s por IP, tapa también la ceguera de GoTrue) |
| D-E | Logging / fingerprint / DLQ / autohealing | ✅ **NÚCLEO RESUELTO en prod** | 2 restos: print PHI + 0 traumas reales (abajo) |
| C4.1 | `/auth/signup` abierto | ⚠️ **PARCIAL** | Gate real backend (invite-token) — **decisión operador #3** |
| C5 | Acoplamiento por string (no FK) | ⚠️ **PARCIAL** | Canario cubre 2/5 sitios; FK real es **MAYOR** (escalar) |
| C3 | Doc de presupuesto fuera de Temporal | ⚠️ **PARCIAL** | El fallo queda fuera de la DLQ; loguear+depositar el `motivo` |
| C1 | Postgres sin pool / N+1 | 🔴 **VIVO** (empeoró en superficie) | Pool en 2 raíces o PgBouncer |
| C2 | Writes externos no idempotentes | 🔴 **VIVO** | Propagar patrón `cobro_store` a Composio/MP + ext_ref derivado |
| C6 | Chat/listas sin cota (frontend) | 🔴 **VIVO** (M-WEB duplicó) | Cap `slice(-N)` + FlatList |
| C7 | Composio síncrono sin cache | 🔴 **VIVO** | TTL-cache 30-60s per-tenant |
| C8 | Firma que ignora `payload` | 🔴 **VIVO** | 1 línea (copiar de la gemela) |
| D-A | Errores tragados sin log | 🔴 **1/5 resuelto, 4 vivos** | Loguear/depositar en 4 puntos (abajo) |
| D-B | Timeout Composio | 🟢 VIVO / BAJO | SDK ya trae 60s; tunear explícito o documentar |

---

## Detalle por problema

### ✅ RESUELTOS

**C9 — Secretos/PII.** `.gitignore` con `Factura/`/`_evidencia/`/`code/` commiteado en origin/main; `tok.json`/`gastos_antes.json` ya no existen ni se commitearon nunca.

**C4.2 — Rate-limit.** PR #229: `rate_limit.py`, middleware ASGI sliding-window por IP (60/60s, env-parametrizable), instalado antes del ruteo → envuelve `/auth/*` y todo el front-door. Con tests reales contra `create_web_app`. Además resuelve la "ceguera del rate-limit de GoTrue" (ahora se aplica en el borde por IP real).

**D-E — Manejo de errores (NÚCLEO).** Arquitectura completa y verificada por efecto en el VPS:
- `fingerprint.py` (djb2, portado de ARCA) — 17 usos.
- `log_estructurado.py` — JSON con fingerprint/categoría/origen; `error_message` excluido a propósito (PII).
- DLQ `copiloto_traumas` con rol dedicado `copiloto_autosanacion` (`BYPASSRLS`+`NOSUPERUSER`, GRANT a 1 tabla).
- 2 costuras: C2 HTTP (`web.py:594`), C3 activities (`worker_b.py:402`, interceptor Temporal).
- Autohealing: 1 Schedule global (5 disparos/noche), agrupa cross-tenant por fingerprint, **abre PR (nunca mergea)** y **abre issue GitHub** cuando no puede reparar (issue ANTES de descartar — invariante verificado). Zero-Mutation con test hostil (PR #209).
- Bug real cazado y arreglado en el propio frente: la costura HTTP leía un `state` que nadie escribía → 0 errores llegaban a la DLQ hasta corregirlo al `ContextVar` de tenant.

### ⚠️ PARCIALES

**C4.1 — `/auth/signup` abierto.** El wizard #219 gatea **solo en el frontend** (`?signup=1`, cosmético). `web.py:890` sigue público: cualquiera hace `POST /auth/signup` por HTTP y crea un tenant facturable. El commit lo documenta: falta **decisión operador #3 (invite-token)**. Mitigado por el rate-limit genérico, no cerrado. **Fix:** invite-token de env fail-closed (o deshabilitar signup password dejando OAuth).

**C5 — Acoplamiento por string.** Mismos 5 sitios/3 archivos (`web.py:220`, `presupuesto_store.py:104`+`:141`, `trabajo_store.py:116`+`:130`), sin FK. Ganó un **test-canario** que ata `web.py`↔`presupuesto_store.py` — pero **no cubre los 2 sitios de `trabajo_store.py`** (romperían en silencio). **Fix:** extender el canario a los 2 sitios (barato) — y la FK real es **MAYOR** (contradice "§5 no se refactoriza `afip_comprobantes`"), escalar aparte.

**C3 — Doc de presupuesto fuera de Temporal.** `_generar_doc` (`serve.py:174`) corre en el threadpool del request `POST /presupuestos`, best-effort. El frente de errores construyó 2 costuras→DLQ, **pero el fallo del Doc queda fuera**: el endpoint lo captura con su propio `try/except` (y `generar_doc` nunca lanza, devuelve `motivo`) antes de que la costura lo vea. El `motivo` se descarta. **Fix:** loguear+`depositar()` el `motivo` cuando `doc_id is None` (o mover a activity Temporal). *La ironía: son las mismas 2 rutas que motivaron la costura y que la costura no puede reforzar.*

### 🔴 VIVOS

**C1 — Postgres sin pool.** Las 2 raíces (`serve.py:95`, `worker_b.py:381`) siguen con `psycopg2.connect` directo. El patrón se **propagó a stores nuevos** (metering, feedback, grafo_sync, mi_dia, concepto) en vez de consolidarse. Única mejora: higiene (algunos usan `with`, cierran bien; varios viejos siguen bare). N+1 de `margen_por_trabajo` intacto (~1+3N conexiones/carga). El polling de `/reply` cada 1.5s es el amplificador. **Fix:** pool `ThreadedConnectionPool`/`psycopg_pool` detrás del `conn_factory` (1 lugar, cero refactor de 27 stores) **o** PgBouncer (cero código) — **decisión A/B del operador**.

**C2 — Writes externos no idempotentes.** El patrón correcto YA existe (`cobro_store.py`: índice único `(tenant, idem_key)` + catch 23505) pero **solo para Postgres interno**. No llega a la capa externa: `idem_key` no se propaga a `gateway.execute` (Composio); gmail/docs/drive/sheets/calendar sin dedup; `ext_ref` de MP **aleatorio** (`token_hex`, 2 sitios); `mp_charge` con TOCTOU (impacto acotado: link duplicado, no doble cobro). **Fix:** propagar el patrón existente — `idem_key` hasta `gateway.execute` + tabla dedup genérica por `(user_id, idem_key)` + `ext_ref` derivado del idem_key.

**C6 — Chat/listas sin cota (frontend).** `chatMachine.ts` reducer sin cota + `seenIds` sin cota; `useChat` serializa historial completo por evento (**y M-WEB agregó una 2ª copia web** en vez de corregirlo); `ListaMensajes` y 4 pantallas de listado con `.map` en ScrollView; `EscritorioFunciones` setState por frame. **Fix:** cap `slice(-N)` en reducer+persistencia (podar `messages` y `seenIds` juntos) + FlatList.

**C7 — Composio sin cache.** `/me`, `/catalog`, `/afip/estado` + un 4º sitio (`web.py:865`) golpean el SDK síncrono sin TTL, ni en endpoint ni en gateway. **Fix:** `TTLCache` 30-60s per-tenant, invalidado por connect/disconnect.

**C8 — Firma que miente.** `signal_anulacion` (`web.py:429`) ignora `payload`; gemela sana en `web.py:352`. El PR de errores #95410793 tocó la sección adyacente sin arreglarlo. **Fix:** 1 línea.

**D-A — Errores tragados.** 1/5 resuelto: `consultar_factura`/`anulacion` ahora distingue NOT_FOUND (404) de fallo de Temporal (503+log). **4 siguen mudos:**
- `tool_catalog.py:1599` — catch-all del executor ReAct sin log/fingerprint/depósito → **blind spot real de la DLQ**: un bug de un módulo de servicio (Gmail/Drive/HubSpot) durante una tool nunca llega al autohealing. Contradice el objetivo del frente en esta ruta.
- `services/__init__.py:26` — módulo roto se saltea sin rastro (idéntico).
- `mercadopago_gateway.py:119` — firma-atacante y bug interno colapsan en el mismo `False` mudo.
- `inteligencia_chat.py:144/168` — todo fallo LLM/grafo = "no sé" sin log.

**Nota D-A:** el censo subió 42→72 `except Exception`, pero NO es regresión — son los archivos nuevos del propio frente que declaran "nunca lanza" a propósito y documentan por qué.

### 🟢 BAJO

**D-B — Timeout Composio.** `Composio()` sin timeout explícito (`composio_gateway.py:94`), pero el SDK trae default 60s (verificado por spike). Sin urgencia. **Fix:** tunear explícito o documentar como deuda gestionada.

---

## Restos del manejo de errores (D-E), concretos

1. **`agent_activities.py:114`** — `print(STT_TRANSCRIPT ...)` con la transcripción de voz completa (PHI) a stdout **sin gate**. Intacto. Es el ítem D-E más accionable que sobrevivió.
2. **`DEUDA-AUTOSAN-1`** (documentada, §7 del maestro): ningún trauma REAL pasó todavía por el ciclo completo (DLQ vacía, 0 usuarios reales) — el camino `arreglo_demostrado=True` en prod no se ejercitó contra un bug real, solo contra el banco sintético (6/6). Deuda gestionada, con condición de pago (primer trauma real).

---

## Decisiones del operador (RESUELTAS 2026-08-04)

1. **C4.1 — `/auth/signup`** → ✅ **Dos puertas, AMBAS con allow-list:** (a) **Google OAuth** con **allow-list de emails del lado de la app** en `/auth/oauth/ensure-tenant` (comparar el email del token Google contra lista de env; fuera de la lista → rechaza). **NO usar "Test users" de Google Console** — verificado contra doc oficial (2026-08-06): modo Testing expira los refresh tokens a **7 días** (rompe la sesión durable) y topa en 100 users; la allow-list app-side lo evita y deja la app en Production. (b) **email/password gateado con invite-token de env (fail-closed)**. Ambas bajo el rate-limit #229. Mismo mecanismo conceptual (lista de autorizados en env) para las dos puertas.
2. **C1 — pool** → ✅ **Las dos cosas.** PgBouncer delante de Postgres (destraba el techo de conexiones, cero código) **+** pool en código tras `conn_factory` (fix de raíz app-side; requiere normalizar antes ~5 conexiones bare).
3. **C5 — vínculo** → ✅ **Alternativa liviana.** Extender el test-canario a los 2 sitios de `trabajo_store.py`. NO se escala la FK (se difiere; el riesgo real es menor de lo estimado). Sin tocar la tabla productiva.

## Orden de ejecución (con decisiones resueltas)

Contratos en orden de riesgo de escala, ya sin bloqueos:
**C1** (PgBouncer + pool app-side) → **C4.1** (invite-token) → **C2** (propagar dedup a Composio/MP + ext_ref derivado) → **C6** (cap chat + FlatList) → **C7** (TTL-cache Composio) → **D-A** (log/DLQ en los 4 puntos mudos) + **print PHI** (`agent_activities.py:114`) → **C3** (enganchar el fallo del Doc a la DLQ) → **C8** (1 línea) → **C5-canario** (extender a trabajo_store) → **D-B** (documentar/tunear timeout).

> **Coordinación:** la emisión de estos `contrato_` al buzón la secuencia PLANIFICACIÓN (dueña del buzón); backend/frontend están mid-sprint M-WEB. No volcar por cuenta propia.
