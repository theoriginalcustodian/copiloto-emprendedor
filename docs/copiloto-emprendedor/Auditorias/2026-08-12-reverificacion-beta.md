# Re-verificación pre-beta — los 11 hallazgos vs `origin/main` HEAD `debe5623`

> **2026-08-12, sesión de auditoría.** Tras el sprint de cierre de funciones de beta (~325 commits
> desde el listado del 2026-08-04, HEAD previo `~5057ee74`). Método: 4 sub-agentes headless paralelos
> (`claude -p`, sonnet), cada instancia verificada con `git show origin/main:<path>` / `git grep origin/main`
> (NO working tree). Estado: **RESUELTO / PARCIAL / VIVO**.
>
> **Titular:** el sprint de beta **no cerró ningún ítem del backlog de auditoría**. Dos mejoraron a
> PARCIAL (**C2**, **C3**); el resto está idéntico — y en varios casos lo único nuevo es un **comentario
> que documenta y justifica el hueco**, no el fix. **C4.1 (`/auth/signup` abierto) es bloqueante de beta.**

---

## Tabla estado anterior → hoy

| Ítem | 2026-08-04 | **2026-08-12** | ¿Cambió? |
|---|---|---|---|
| **C4.1** — `/auth/signup` abierto | ⚠️ parcial | 🔴 **VIVO** | **NO — bloqueante de beta.** Sin gate server-side; decisión #3 nunca implementada |
| C1 — Postgres sin pool / N+1 | 🔴 vivo | 🔴 **VIVO** | No. Sin pooler; propagado a 5 stores nuevos; N+1 intacto |
| C6 — chat/listas sin cota (front) | 🔴 vivo | 🔴 **VIVO** | No (4/4). Web tiene reducer duplicado que nunca convergió al core |
| C7 — Composio sin cache | 🔴 vivo | 🔴 **VIVO** | No |
| C8 — firma ignora `payload` | 🔴 vivo | 🔴 **VIVO** | No (caller pasa `None` → sin efecto observable aún) |
| D-A — 4 errores tragados | 🔴 4 vivos | 🔴 **4 VIVOS** | No. + comentarios que justifican el mutismo |
| Print PHI (`agent_activities.py`) | 🔴 vivo | 🔴 **VIVO** | No |
| **C2** — writes no idempotentes | 🔴 vivo | ⚠️ **PARCIAL ↑** | **Mejoró.** `mp_dedup_store.py` tapa 1 de 2 rutas MP |
| **C3** — Doc de presupuesto | ⚠️ parcial | ⚠️ **PARCIAL ↑** | **Mejoró.** Ya loguea el `motivo` con fingerprint; falta DLQ real |
| C5 — acople por string | ⚠️ parcial | ⚠️ **PARCIAL** | No. Canario no cubre `trabajo_store.py` |
| D-B — timeout Composio | 🟢 bajo | 🟢 **bajo** | No |
| C4.2 — rate-limit `/auth/*` | ✅ resuelto | ✅ **RESUELTO** | — |
| C9 — secretos/PII | ✅ resuelto | ✅ **RESUELTO** | — |
| D-E — núcleo manejo de errores | ✅ resuelto | ✅ **RESUELTO** | — |

**Balance:** 3 resueltos · 3 parciales (2 de ellos mejoraron este sprint) · 6 vivos · 1 bajo.

---

## Detalle por ítem (evidencia contra `origin/main @ debe5623`)

### 🔴 C4.1 — `/auth/signup` abierto — **BLOQUEANTE DE BETA**
Sin gate server-side. `web.py:1009` `signup()` → `signup_and_provision()` (`onboarding.py:256`) usa
`gotrue.admin_create_user` (**admin API**, bypassa el `disable_signup:true` de GoTrue). `SignupIn`
(`web.py:543`) ni tiene campo de invite-token. `/auth/oauth/ensure-tenant` (`web.py:1061`) solo valida
que el `provider` sea OAuth externo — **no** compara el email contra ninguna allow-list. `git grep
INVITE_TOKEN|SIGNUP_TOKEN|ALLOWED_` sobre `origin/main` → **0 resultados**. El propio `App.tsx:12`
lo documenta: *"POST /auth/signup no tiene invite-gate, decisión operador #3 sin resolver"*.
**Consecuencia:** en un repo **público**, cualquiera con `curl` crea un tenant facturable, y cualquier
cuenta de Google se autoprovisiona. Incompatible con "un usuario de prueba canónico a fuego".
**Fix (decisión #3 ya tomada):** (a) email/password gateado con invite-token de env fail-closed;
(b) Google OAuth con allow-list de emails app-side en `ensure-tenant` (NO "Test users" de Google
Console — expira refresh tokens a 7 días).

### 🔴 C1 — Postgres sin pool / N+1
`git grep ConnectionPool|psycopg_pool|pgbouncer` en `apps/copiloto` → 0. Las 2 raíces siguen con
`psycopg2.connect` directo (`serve.py:96`, `worker_b.py:384`). El patrón se **propagó** a stores nuevos
(`concepto_store`, `feedback_store`, `grafo_sync_store`, `metering_store`). N+1 de `margen_por_trabajo`
(`inteligencia_queries.py:418`) intacto (~1+3N). Bare sin `with`: `mp_dedup_store`, `reply_store`,
`mp_credential_store`. **Fix:** PgBouncer + pool `ThreadedConnectionPool` tras `conn_factory`.

### 🔴 C6 — Chat/listas sin cota (frontend)
`chatMachine.ts` ahora vive en `packages/core/src/chat/chatMachine.ts:243` — reducer sin `slice(-N)`,
`seenIds` sin podar. **La web (`apps/copiloto-web/.../useChat.ts`) tiene su propio reducer duplicado**
que nunca convergió al core; ambas apps serializan el historial completo O(N) por evento. `.map` sin
virtualizar en `MessageList.tsx:107` (web) y `ListaMensajes.tsx:145` (mobile). `EscritorioFunciones.tsx:267`
`setState` por frame (`scrollEventThrottle=16`). **Fix:** cap `slice(-N)` (podar `messages`+`seenIds` juntos) + FlatList.

### 🔴 C7 — Composio síncrono sin cache
`git grep TTLCache|lru_cache|cachetools` en `apps/copiloto` → 0. `/me` (`web.py:869/882`), `/catalog`
(`web.py:906`), `/afip/estado` (`afip_web.py:557`) golpean el SDK sync por request. **Fix:** TTLCache 30-60s per-tenant.

### 🔴 C8 — Firma que ignora `payload`
`signal_anulacion` (`web.py:440`) acepta `payload` y no lo usa; la gemela sana `signal_factura`
(`web.py:363`) lo propaga condicional. El único caller (`afip_web.py:549`) hoy pasa `payload=None`,
así que el bug no tiene efecto observable **todavía**. **Fix:** 1 línea (copiar el patrón de la gemela).

### 🔴 D-A — 4 errores tragados sin log
Los 4 siguen mudos, sin `log_estructurado`/`fingerprint`/`depositar()`; se agregaron comentarios que
justifican el diseño "nunca lanza":
- `tool_catalog.py:1599` — catch-all del executor ReAct → blind spot de la DLQ.
- `services/__init__.py:26` — módulo roto se saltea sin rastro.
- `mercadopago_gateway.py:119` (motor) — firma-atacante y bug interno colapsan en `False` mudo.
- `inteligencia_chat.py:144/168` — todo fallo LLM/grafo = "no sé" sin log.

### 🔴 Print PHI
`agent_activities.py:114` — `print("STT_TRANSCRIPT" ...)` vuelca la transcripción de voz completa a
stdout **sin gate**. El comentario admite el riesgo pero no lo mitiga. **Fix:** gate por env / excluir el texto.

### ⚠️ C2 — Writes externos no idempotentes — **MEJORÓ**
Nuevo `mp_dedup_store.py` (`MpLinkDedupStore`, commit `add3874f`): dedup app-side por `(cliente_id,
idem_key)` con `INSERT ON CONFLICT DO NOTHING`. `tool_catalog._run_mp_charge` ya lo usa (retry de
Temporal no duplica el link). **Falta:** (a) 2ª ruta `dispatcher_emprendedor.py:102` (`ext_ref =
token_hex` sin dedup, cableada en prod vía `worker_b.py:266`); (b) `ComposioGateway.execute`
(`composio_gateway.py:111`) sin `idem_key` → gmail/docs/drive/sheets/calendar sin dedup.

### ⚠️ C3 — Doc de presupuesto fuera de Temporal — **MEJORÓ**
`presupuestos_web.py:232` ya no descarta el `motivo`: llama `log_error(exc, workflow="crear_presupuesto",
extra={"degradado":"sin_doc"})` → línea JSON con fingerprint. **Falta:** es log, no depósito reintentable;
no hay `TraumaStore`/tabla conectada a este endpoint (el propio comentario en `:385` lo llama "el material
de la DLQ de Fase 2"). **Fix:** `depositar()` a la DLQ o mover a activity Temporal.

### ⚠️ C5 — Acoplamiento por string (no FK)
Los 5 sitios siguen (`web.py:231`, `presupuesto_store.py:116/144`, `trabajo_store.py:116/130`). El
canario (`test_presupuesto_derivados.py:31`) ata `web`↔`presupuesto_store` pero **no cubre los 2 sitios
de `trabajo_store.py`** (no existe `test_trabajo_store.py`). **Fix (liviano, no FK):** extender el canario.

### 🟢 D-B — Timeout Composio
`Composio()` sin timeout explícito (`composio_gateway.py:94`); SDK trae 60s. **Fix:** documentar/tunear.

---

## Qué significa para la beta

- **C4.1 se cierra ANTES de abrir la beta.** No es opinable: repo público + signup abierto + tenants
  facturables = superficie de abuso inmediata, y rompe el modelo de usuario canónico.
- **C1 / C6 / C7** son de **escala**: no rompen con 1-5 usuarios de beta, sí al crecer. Se pueden diferir
  con la beta cerrada, pero entran en el primer sprint post-beta.
- **C8 / D-A / PHI / C5-canario** son baratos (higiene/seguridad/1 línea) — se pueden batchear.

## Orden de ejecución (revisado 2026-08-12)
Bloqueante primero, luego riesgo de escala:
**C4.1** (invite-token + allow-list Google) → **C1** (PgBouncer + pool app-side) → **C2** (cerrar 2ª ruta MP
+ Composio) → **C6** (cap chat + FlatList) → **C7** (TTL-cache) → **D-A** + **print PHI** → **C3** (DLQ del
Doc) → **C8** (1 línea) → **C5-canario** → **D-B**.

> Emisión de `contrato_` al buzón: la secuencia PLANIFICACIÓN (dueña del buzón).
