# ADR-002 — Idempotencia (`idem_key`) para escrituras vía `ComposioGateway.execute`

**Estado:** PROPOSED (spike — entrega este documento, no código; la decisión de implementar y CÓMO es
un paso MAYOR aparte, para el operador o planificación).
**Fecha:** 2026-08-12 · **Dueño:** backend.
**Disparador:** `coordinacion/cerrado/.../2026-08-12_decision_planificacion-a-backend_C1-composio-idem-key-es-P1-propio-con-spike-NO-diferido.md`
— P1 propio, disparador "cierre de lote C" (cumplido: C1-C4 cerrados y desplegados, PR #415).

> **Nota de numeración:** `ADR-001` (CI propio, `scripts/gate.sh`) existe en `origin/main`
> (`2026-08-06_ADR-001_ci-propio-...md`). No lo vi en mi primer chequeo porque corrió contra el
> checkout compartido de la PC —desactualizado 354 commits respecto de `main`—, no contra la rama
> real; corregido al re-verificar desde un worktree anclado a `origin/main`. `ADR-002` es el número
> correcto, sin colisión.

## Contexto

`ComposioGateway.execute()` (`motor/clients/agent/providers/composio_gateway.py:111`) es el único
punto de escritura hacia servicios externos (Gmail, Calendar, Sheets, Drive, Docs — HubSpot/Instagram
en roadmap, sin policy live todavía). Se invoca desde una Temporal activity (`execute_tool`,
`motor/backend/agent/agent_activities.py`) bajo `LOOP_RETRY = RetryPolicy(maximum_attempts=5,
non_retryable_error_types=["NonRetryableError"])` (`conversation_workflow.py:71`). Ninguna de las
llamadas a `gateway.execute` para escrituras Composio tiene hoy protección de idempotencia — a
diferencia de MercadoPago (`mp_dedup_store.py`) y AFIP (`emitir_comprobante(..., idem_key=...)`,
`afip_factura_activities.py:179`), que ya la tienen.

## 1. ¿Hubo reintentos reales en prod? — bloqueado, no evaluable ahora mismo

**Esta pregunta iba primero porque cambia todo lo demás** (evidencia de incidente real → urgencia
alta y concreta; cero evidencia → sigue siendo importante pero como prevención, no reacción). No pude
contestarla: el sub-agente que iba a inspeccionar el history real de Temporal en el VPS (`docker exec
temporal-admin-tools temporal workflow show ...`) fue **bloqueado por el clasificador de seguridad**
del harness — motivo textual: *"an investigative read pulling live production/customer data into the
transcript... not named by any explicit user instruction (fully autonomous segment with no user
messages)"*. Es un guardarraíl correcto y lo respeto: el history de `execute_tool` incluye los
`arguments` reales de cada tool call (cuerpo de mails enviados, contenido de eventos de calendario,
filas de planillas) — traer eso a un transcript, y potencialmente a este documento que vive en un
**repo público**, sin autorización explícita de un humano para ESTA lectura investigativa puntual, es
exactamente el tipo de exposición que la regla de oro 6 ("secreto pegado en el chat = comprometido",
extendida acá a dato de cliente real) viene a prevenir.

**No busqué un atajo** (ej. leer `trauma_store`/DLQ directamente) porque el problema no es el canal
(SSH vs. DB), es la naturaleza del dato: seguiría siendo una lectura investigativa de producción sin
autorización explícita, sólo por otra puerta.

**Lo que SÍ sabemos sin necesitar esa lectura:** el mecanismo de reintento **existe por diseño**
(`maximum_attempts=5`) independientemente de si alguna vez disparó sobre una escritura — Temporal
reintenta automáticamente cualquier fallo transitorio de `execute_tool` (timeout de red, 5xx del lado
de Composio/Google, etc.) que no sea `NonRetryableError`. La ausencia de evidencia empírica de que ya
ocurrió **no es evidencia de que no vaya a ocurrir**; es sólo una pregunta que quedó sin contestar.

**Recomendación de esta ADR sobre este punto:** no bloquear la decisión de implementar en la
confirmación empírica. Si más adelante un humano quiere esa lectura puntual (con el criterio de qué
hacer si aparecen `arguments` con PII en la evidencia — no pegarlos en ningún doc, sólo IDs/conteos),
que la autorice explícitamente y se re-lance el mismo sub-agente con esa autorización nombrada.

## 2. Los 3 patrones de call-site (paths exactos)

Verificado leyendo el código real, no por inferencia. Dos motores distintos implementan el MISMO
contrato de `Proposal` (`resolve`/`slug`/`then`) por separado — no hay una única función a extender,
hay dos:

| Patrón | Motor legacy `dispatch` (`dispatcher_emprendedor.py`) | Motor `react` (`tool_catalog.py`, `_execute_proposal`) |
|---|---|---|
| **Directo** (1 write, sin pre-paso) | L260 | L537, L568, L1583 |
| **`resolve`** (pre-paso read → inyectar, ej. nombre real de hoja) | L135 | L531 (**live**: `services/sheets.py:87,100` lo usa condicionalmente cuando el user no especificó hoja) |
| **`then`** (2do write encadenado, ej. Instagram create→publish) | L142+L155 | L539-L549 (**sólo en tests** — `tests/test_execute_tool.py:67`, ningún toolkit live lo usa hoy) |

Además, fuera de ambos motores: escrituras **directas** en `afip_drive.py:84,88,109,124`
(archivado automático de facturas, activity separada `archivar_factura_en_drive`,
`afip_factura_activities.py:251`) y `presupuesto_doc.py:105`.

**Dato clave para el diseño:** `idem_key` **ya llega** al call-site de `_execute_proposal`
(`tool_catalog.py:1591`, usado en la misma función como `tool_call_id=idem_key` en el `ToolResult` de
la línea siguiente) — no hace falta enhebrar un parámetro nuevo por 10 capas, sólo pasarlo a
`_execute_proposal` y a su gemelo en `dispatcher_emprendedor.py` (que también lo tiene disponible,
mismo patrón que `_run_mp_charge` ya usa en la línea 575 del mismo archivo).

## 3. Trade-off del `then` — resume vs. redo (mostrado, no resuelto)

Hoy, `_execute_proposal` corre el `resolve` + write principal + `then` **síncronamente dentro de una
sola invocación de `execute_tool`**. Temporal no ve los 3 sub-pasos — su unidad de reintento es la
activity completa. Si el write principal (paso 1) tiene éxito pero el `then` (paso 2) falla, y
Temporal reintenta la activity entera:

- **Opción A — redo completo (comportamiento actual, sin cambios).** El reintento re-ejecuta TODO:
  vuelve a crear el recurso del paso 1 (ej. un segundo container de Instagram) y recién ahí reintenta
  el paso 2 sobre ESE nuevo recurso. El primer recurso del paso 1 queda huérfano. Si el paso 1 es
  visible para el usuario (no un container interno sino, ej., un evento de calendario real), el
  resultado es una duplicación visible — la misma clase de bug de raíz que C4 previno para RLS, acá a
  nivel de negocio.
  - Costo: cero implementación.
  - Riesgo: duplicación silenciosa en cualquier toolkit futuro que use `then` (hoy ninguno vivo).

- **Opción B — resume desde el sub-paso que falló (requiere idem_key POR sub-paso).** Antes de
  re-ejecutar el paso 1, chequear si ya existe un resultado guardado para `f"{idem_key}-resolve"` /
  `f"{idem_key}-write"` — si existe, reusar el id ya obtenido y saltar directo a reintentar sólo el
  `then` con ese id.
  - Costo: la tabla de dedup deja de ser "1 fila por turno" (como `mp_link_dedup` hoy) y pasa a
    necesitar "N filas por turno" (una por sub-paso), un esquema más ancho que el de MP/AFIP.
  - Beneficio: cero duplicación, cubre exactamente el caso que A no cubre.

- **Opción C — partir `then` en una 2da activity de Temporal separada**, así el propio Activity
  History de Temporal trackea cada sub-paso como unidad de reintento independiente, sin tabla de dedup
  propia para este caso.
  - Costo: cambia la forma del workflow (hoy "1 activity genérica por tool call" para CUALQUIER tool,
    sea `resolve`+`then` o no) — el cambio toca `motor/` (capa PLANTILLA, no sólo el copiloto), impacto
    más amplio que A o B.

No resuelvo cuál — el contrato del spike pide mostrarlo, no decidirlo. Dato relevante para quien
decida: **`then` no está live hoy** (ver §2), así que este trade-off específico es preventivo, no
urgente — el caso urgente hoy es el write directo/`resolve` (Gmail, Calendar, Sheets, Drive), que es
más simple: ahí no hay sub-pasos, "resume vs redo" colapsa a "¿ya hice este write o no", exactamente
lo que `mp_dedup_store.py` ya resuelve para MP.

## 4. Idempotencia nativa por proveedor — investigado contra documentación real

Investigado por sub-agente vía búsqueda directa en la documentación vigente de Composio y de cada API
de Google (no por memoria de entrenamiento sin verificar — incluye una hipótesis explícitamente
refutada, ver Gmail).

| Operación | ¿Idempotencia nativa? | Detalle |
|---|---|---|
| **Composio SDK/gateway** (`tools.execute`, cualquier slug) | **NO** | Ni el SDK Python ni `POST /api/v3.1/tools/execute/{tool_slug}` documentan `idempotency_key` ni header equivalente. Composio no resuelve nada gratis para ningún proveedor. |
| `GMAIL_SEND_EMAIL` | **NO** | Sin idempotencia documentada. Hipótesis "Message-ID dedupe el envío" **refutada**: Gmail no lo usa para bloquear un 2do envío (sólo threading de mensajes *recibidos*), y hay evidencia consistente de que la API **sobreescribe** el Message-ID que el cliente intenta fijar al enviar. |
| `GOOGLECALENDAR_CREATE_EVENT` | **SÍ, parcial** | `events.insert` acepta un `id` propio determinístico; reenviar con el mismo `id` da **HTTP 409 "duplicate"** en vez de crear un 2do evento. Caveat textual de Google: *"cannot guarantee that ID collisions will be detected at event creation time"* — best-effort, no garantía dura. Usable como **complemento**, no como único guard. |
| `GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND` | **NO** | Sin `requestId`/idempotency key. Reenviar duplica filas siempre. |
| `GOOGLESHEETS_BATCH_UPDATE` | **NO** | Sin `requestId`/`writeControl`. Reenviar reaplica el efecto. |
| `GOOGLEDRIVE_CREATE_FILE_FROM_TEXT` | **NO** | Sin idempotency key. Drive permite nombres duplicados sin conflicto — reenviar crea un 2do archivo con `id` distinto. |

**Conclusión de esta sección:** de 5 escrituras live, sólo Calendar tiene protección nativa parcial.
Las otras 4 dependen enteramente de una capa propia si se quiere evitar duplicación bajo reintento.

## Reuso — lo que ya existe y se puede extender (regla 3 del canon)

- **`mp_dedup_store.py`** (`apps/copiloto/`): `idem_key = f"{workflow_id}-{turn_ix}-{step}"`
  (determinístico, sobrevive `continue-as-new`), `SELECT` antes de `INSERT ... ON CONFLICT (cliente_id,
  idem_key) DO NOTHING`. Validado con spike propio (Spike C, 2026-07-04: "MP `/checkout/preferences` NO
  deduplica ni por `external_reference` ni por `X-Idempotency-Key`"). Éste es el patrón más directo a
  clonar para Composio: mismo shape de key, misma mecánica SELECT-then-INSERT, tabla nueva
  (`uc_factory.composio_write_dedup` o similar — **no la creo acá, fuera de scope del spike**).
- **`afip_factura_activities.emitir_comprobante(..., idem_key: str, workflow_id: str, ...)`**: ya
  recibe `idem_key` como parámetro de activity — confirma que el patrón "activity recibe idem_key
  explícito" ya es una convención establecida en este código, no una idea nueva.
- **`idem_key` ya fluye hasta el call-site de `_execute_proposal`** (§2) — el enhebrado que falta es
  mínimo, no arquitectura nueva.

## Fuera de scope (explícito, por contrato del spike)

No se crea tabla, no se toca schema, no se agrega el parámetro `idem_key` a `ComposioGateway.execute`
ni a `_execute_proposal`/`dispatcher_emprendedor`. Este documento es el entregable; la implementación
es una tarea futura separada (con su propio PR, tests adversariales de "reintento no duplica" contra
Postgres real — mismo estándar que C4).
