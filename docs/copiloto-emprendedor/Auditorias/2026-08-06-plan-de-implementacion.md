# Plan de implementación — backlog de la auditoría (accionable)

> **2026-08-06.** Detalle accionable de los 11 ítems a implementar, derivados de la re-verificación
> ([`2026-08-04-listado-problemas-fixes-reverificado.md`](2026-08-04-listado-problemas-fixes-reverificado.md))
> contra código pusheado. Orden = riesgo de escala. Cada ítem: qué, por qué, fix de raíz, ubicación, esfuerzo.
> Las 3 decisiones del operador (signup, pool, vínculo) + la allow-list de Google están incorporadas.
>
> **Re-verificado 2026-08-12** → [`2026-08-12-reverificacion-beta.md`](2026-08-12-reverificacion-beta.md):
> el sprint de beta no cerró ningún ítem; C2 y C3 pasaron a PARCIAL. C4.1 es bloqueante de beta.
>
> **Ya en prod, NO re-implementar:** secretos/PII (gitignore), rate-limit `/auth/*` (#229), núcleo de
> manejo de errores (fingerprint + log JSON + DLQ `copiloto_traumas` + 2 costuras + autohealing).

| # | Ítem | Sev | Frente | Esfuerzo |
|---|---|---|---|---|
| 1 | Pool de conexiones (PgBouncer + pool app-side) | 🔴 | infra + backend | ~1 día |
| 2 | Cerrar registro (invite-token + allow-list Google) | 🔴 | backend | horas |
| 3 | Idempotencia de writes externos | 🔴 | backend + motor | ~1 día |
| 4 | Chat/listas sin tope | 🔴 | frontend | horas |
| 5 | Cache de Composio | 🔴 | backend/motor | horas |
| 6 | 4 errores tragados sin log | 🔴 | backend + motor | horas |
| 7 | Print de transcripción de voz (PHI) | 🔴 | motor | minutos |
| 8 | Doc de presupuesto que se pierde | ⚠️ | backend | horas |
| 9 | Firma que ignora `payload` | 🔴 | backend | minutos |
| 10 | Test-canario del wf_id | ⚠️ | backend (test) | minutos-horas |
| 11 | Timeout de Composio | 🟢 | motor | minutos |

---

## 1 · Pool de conexiones a Postgres
- **Qué:** 84 sitios abren conexión nueva; 2 raíces `serve.py:95`, `worker_b.py:381`. Polling `/reply` cada 1,5s multiplica el churn.
- **Por qué:** techo de `max_connections` del Postgres compartido → cliff al crecer.
- **Fix (decisión: LAS DOS):** (a) **PgBouncer** delante de Postgres (infra, cero código); (b) **`ThreadedConnectionPool`** detrás del `conn_factory` existente (1 lugar, cero refactor de 27 stores). **Antes:** normalizar ~5 conexiones bare (`mp_dedup`, `reply_store`, `mp_credential`…) que no usan `with`.

## 2 · Cerrar el registro (C4.1)
- **Qué:** `/auth/signup` (`web.py:890`) público crea tenant facturable sin barrera.
- **Fix (dos puertas, ambas con allow-list de env):**
  - **email/password:** invite-token de env, fail-closed.
  - **Google:** allow-list de emails en `/auth/oauth/ensure-tenant` (email del token vs lista de env). **NO** usar "Test users" de Google Console — verificado 2026-08-06: modo Testing expira refresh tokens a **7 días** (rompe sesión durable) + tope 100. La allow-list app-side lo evita y deja la app en Production.

## 3 · Idempotencia de writes externos
- **Qué:** retry at-least-once repite el efecto: mail 5×, evento 2×, link MP con `ext_ref` aleatorio irreconciliable. Gmail/Drive/Docs/Sheets/Calendar sin dedup.
- **Por qué:** el patrón correcto ya existe (`cobro_store`: índice único `(tenant, idem_key)` + catch 23505) pero solo para Postgres interno.
- **Fix:** propagar `idem_key` hasta `gateway.execute` (`composio_gateway.py`) + tabla dedup genérica `(user_id, idem_key)→resultado` + derivar `ext_ref` de MP del idem_key (hoy `token_hex` en `tool_catalog.py:600` y `dispatcher_emprendedor.py:102`).

## 4 · Chat/listas sin tope (frontend)
- **Qué:** reducer + `seenIds` sin cota (`chatMachine.ts`), re-serialización O(N) por evento (`useChat.ts` mobile Y web), `.map` en ScrollView sin virtualizar (`ListaMensajes.tsx` + 4 pantallas de listado), setState por frame (`EscritorioFunciones.tsx:266`).
- **Fix:** `slice(-N)` en reducer y persistencia (podar `messages` y `seenIds` JUNTOS) + `FlatList`.

## 5 · Cache de Composio
- **Qué:** `/me`, `/catalog`, `/afip/estado` golpean el SDK síncrono sin cache en cada apertura.
- **Fix:** `TTLCache` 30-60s per-tenant en `composio_gateway.py`, invalidado por connect/disconnect.

## 6 · 4 errores tragados sin log
- **Qué:** 4 `except` sin rastro. El peor: `tool_catalog.py:1599` (executor ReAct) no llega al autohealing existente.
- **Fix:** enganchar log + `depositar()` a la DLQ en `tool_catalog.py:1599`, `services/__init__.py:26`, `mercadopago_gateway.py:119`, `inteligencia_chat.py:144/168`.

## 7 · Print de transcripción de voz (PHI)
- **Qué:** `agent_activities.py:114` vuelca el dictado completo a stdout sin gate.
- **Fix:** gatear por env o pasar a log estructurado con el texto excluido.

## 8 · Doc de presupuesto que se pierde
- **Qué:** el Doc se genera fuera de Temporal (`serve.py:174` → `presupuestos_web.py:232`); si Google falla, el `motivo` se descarta y no llega a la DLQ.
- **Fix:** loguear + `depositar()` el `motivo` cuando `doc_id is None`, o mover a activity Temporal.

## 9 · Firma que ignora `payload`
- **Qué:** `signal_anulacion` (`web.py:429`) acepta `payload` y lo ignora; se perdería con el primer uso real.
- **Fix:** 1 línea — copiar el patrón condicional de la gemela `signal_factura` (`web.py:352`).

## 10 · Test-canario del wf_id (C5)
- **Qué:** formato `factura-...` en 5 sitios; el canario ata 2, los 2 de `trabajo_store.py:116,130` quedan sueltos.
- **Fix (decisión: liviano, NO FK):** extender el canario en `test_presupuesto_derivados.py` a los 2 sitios de `trabajo_store`. Sin tocar la tabla productiva.

## 11 · Timeout de Composio
- **Qué:** `Composio()` sin timeout explícito (`composio_gateway.py:94`); el SDK trae 60s default.
- **Fix:** tunear explícito o documentar como deuda gestionada. Bajo.

---

## Deuda gestionada (seguimiento, no implementación)
- **DEUDA-AUTOSAN-1:** ningún trauma real pasó aún por el ciclo de autohealing (DLQ vacía, 0 usuarios). Se paga con el primer trauma real.

## Estado de ejecución
Ningún ítem arrancado al 2026-08-12 (re-verificado). **Orden:** C4.1 (bloqueante beta) → 1 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11.
Los `contrato_` se emiten al buzón secuenciados por PLANIFICACIÓN (dueña del buzón).
