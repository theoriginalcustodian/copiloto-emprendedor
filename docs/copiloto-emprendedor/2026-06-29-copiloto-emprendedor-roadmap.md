# Roadmap — Copiloto del Emprendedor

> **Tipo:** documento de visión + arquitectura + roadmap (NO plan de implementación — no se construye nada todavía).
> **Fecha:** 2026-06-29 · **Estado:** visión consolidada y revisada; evidencia de spikes adjunta.
> **Posición en la fábrica:** **SIGUIENTE IMPLEMENTACIÓN** — iniciativa de producto nueva sobre la fábrica (follow-up priorizado). Arranca por Fase 0 (spike de custom auth de Google).
> **Origen:** estudio de mercado (`docs/Ideas a explorar/me gustaria hacer un estudio de mercado completo s.md`) + sesión de brainstorming/review + 2 spikes Wizard-of-Oz validados E2E.
> **Decisión de scope (operador, 2026-06-29):** el primer build será **solo el agente personal**. La visión completa (todos los módulos) queda como **secuencia** de este roadmap, no como alcance inmediato.

---

## 0. Estado de ejecución — actualizado 2026-07-05 ⚠️ (supera el "no se construye nada todavía" del encabezado)

Este doc nació como **visión** (2026-06-29). Desde entonces el copiloto **se construyó y está VIVO en el VPS**. Este §0 reconcilia *plan* vs *realidad*; el resto (§1–§12) sigue siendo la visión/arquitectura de referencia (no está superada, ordena hacia dónde va). **Fuente de verdad operativa viva:** `docs/ESTADO-FRENTES-ABIERTOS.md` (tablero WIP) + master `docs/ROADMAP.md` (hitos 2026-07-03/04) + memoria del proyecto.

**🟢 Vivo en prod (multitenant real):**
- **Agente personal durable desplegado** — 2 servicios systemd (`uc-copiloto-web` uvicorn + `uc-copiloto-worker` Temporal) tras Caddy, **auth Supabase JWT + onboarding admin-mediado + identidad de tenant per-request**, **aislamiento cross-tenant [VERIFIED]** (8 tests adversariales). Reusa `ConversationWorkflow`. Cubre la base **B1/B2/B4/B6** + el motor de Fase 1. `docs/Implementaciones terminadas/2026-07-03-copiloto-deploy-multitenant_reporte.md`; memoria `copiloto-deploy-multitenant-vivo`.
- **Frontend fino (PWA)** — chat + apps + conexiones, servida mismo-origen; **voz por nota de audio** (Groq STT, `/chat/audio`); UX móvil (gestos/chrome). No es el dashboard de BI de §4.5 todavía (ese es Fase 4). Memoria `copiloto-frontend-movil-ux-estado`.
- **7 servicios Composio plug-in** (Gmail, Calendar, Docs, Drive, Sheets, …) tras lista cerrada + **confirm-gate HITL** (PR #104). Módulos Comms+Agenda (+ parte de CRM) de la Capa A. Memoria `copiloto-servicios-composio-plugin`.
- **MercadoPago — E2E ✅** (gateway propio: OAuth Auth-Code, **connect del vendedor + cobro real + webhook x-signature HMAC** + refresh durable) — 2º boundary de pagos, elegido en vez del conector Composio de pagos; **implementado y probado E2E por el operador (2026-07-04)**. Cubre la ingesta de flujo de caja de la Fase 3. Memoria `mercadopago-gateway-impl-followup`.
- **Memoria conversacional de largo plazo (Graphity) — cross-sesión OPERATIVA** (`MemoryProvider`, `recall` vía graph-search, opt-in, replay-safe, aislamiento cross-emprendedor [VERIFIED]) + **warm dirigido por el front** (perceived latency: `POST /warm` al abrir la app/pestaña) + **robustez del loop** (chat no cuelga ante fallo de tool). PR #113/#114 (2026-07-04). Cadena completa cableada en prod (warm + recall semántico por turno + remember batcheado) — detalle en §4.8. Memorias `copiloto-memoria-provider-ladrillo`, `agente-loop-tool-failure-retry-infinito`.
- **Recall temporal — "qué hice ayer / esta semana / del 1 al 5 de julio" (PR #125, 2026-07-05).** Sobre la memoria de largo plazo, el emprendedor consulta su actividad por **rango de fecha LIBRE** (no presets) con análisis **exhaustivo** del rango (episodios completos de Graphity, no top-K semántico): acción `consultar_actividad` → resolución **determinista** del rango (es-AR, `now` inyectado → replay-safe) → `MemoryProvider.recall_range` → resumen LLM con **umbral adaptativo** (directo si entra en contexto, map-reduce si es grande). Sin tocar el motor single-shot (verbo nuevo enchufado como `book`/`mp_charge`). Endurecido por **review adversarial en 2 pasadas (14 fixes de raíz, 16 tests de regresión)** que cazó lo que 28 tests verdes no veían — el crítico: la acción sin registrar en la whitelist del motor (`types.ACTIONS`) la degradaba a `clarify` y la mataba en prod. Deployado (scp+restart, worker `active`) + mergeado (squash). Detalle en §4.8; memoria `copiloto-recall-temporal`; evidencia `spikes/recall-por-fecha/RESULT.md`.

**🟡 Pendiente (el diferencial + lo no validado):**
- **Capa B — Inteligencia de Negocio (Fase 4, EL DIFERENCIAL):** ingesta AFIP consulta multi-tenant + almacén normalizado **B8** + análisis (rentabilidad/Pareto/flujo de caja) + **dashboard dinámico** (§4.5) + proactividad schedulada. **NO empezado** — sigue siendo "la verdadera veta".
- **Redes/contenido (Fase 5)** · spikes `[PENDIENTE VALIDAR]`: **consulta AFIP multi-tenant** (solo se testeó emisión en ARCA) · conectores de redes.
- **Login de usuarios reales** — el email-login de GoTrue de fusion sigue como blocker MAYOR del operador (`GOTRUE_EXTERNAL_EMAIL_ENABLED`).
- **Automatizaciones/tareas recurrentes durables** — candidato post-v1 (memoria `copiloto-automatizaciones-recurrentes-candidato`).

**Lectura de fases:** Fase 0 (de-risking) y el **motor de Fase 1** están cubiertos; partes de Fase 2 (CRM/Contacts vía Composio) y Fase 3 (pagos, gateway MP) **en curso**; **Fase 4 (BI, el diferencial) es el próximo gran frente de producto** una vez cerrado el hardening/onboarding.

---

## 1. Resumen ejecutivo

El Copiloto del Emprendedor tiene **dos capas**:

- **Capa A — Ejecución (resuelta).** Un **agente de IA conversacional durable** (motor `conversational_agent` sobre Temporal) que, vía **Composio**, opera el ecosistema de servicios del emprendedor (Gmail, Calendar, Contacts, pagos, redes…). El emprendedor le habla por chat (Telegram/WhatsApp) y el agente ejecuta acciones reales. Validada por spikes.
- **Capa B — Inteligencia de negocio (el diferencial / "la verdadera veta").** Una vez que la info del negocio es **accesible**, dársela a un agente para que la **analice y proponga** es lo que el estudio de mercado marca como el hueco real: diagnosticar, mostrar métricas accionables y **sugerir proactivamente**. El cuello de B **no es el análisis** (es fácil) sino la **ingesta de datos financieros** — resuelta apoyándose en **AFIP** (ventaja de la suite ARCA).

**Tesis de producto:** los servicios externos se integran vía Composio → la app **no necesita un frontend de gestión** (cada servicio ya tiene su web). Lo propio es la **capa de inteligencia de negocio** expuesta en un **dashboard dinámico read-only** + **mensajes proactivos** por chat.

**Encaje con la identidad de la fábrica:** automatización + agentes-IA durables (moat = orquestación durable Temporal), con frontend **fino**. La inteligencia vive en los **datos + el agente**, no en un frontend pesado; un SaaS-dashboard pesado sería anti-fit y queda fuera.

---

## 2. Visión de producto (amplitud completa)

El copiloto es, en su forma completa, el asistente operativo único del emprendedor sobre **cinco dominios de ejecución** (Capa A):

1. **Comunicaciones** — triage y redacción de mail (Gmail), luego mensajería (WhatsApp/Telegram) y redes como bandeja unificada.
2. **Agenda** — gestión de turnos/eventos (Calendar): crear, mover, cancelar, disponibilidad (free/busy), recordatorios.
3. **Cobros** — facturación y seguimiento de pagos/morosidad (reutiliza `billing-system` + `dunning` + conector de pagos).
4. **CRM** — contactos y relación con clientes (reutiliza `mini-crm` + Google Contacts).
5. **Contenido / Redes** — publicación y programación en LinkedIn / Facebook / Instagram (módulo aparte).

**Sobre los cinco, la Capa B — Inteligencia de Negocio:** ingiere los datos del negocio (financieros vía **AFIP** + cobros vía pasarela + actividad vía agenda/mail), los **analiza** (rentabilidad, Pareto, flujo de caja, tendencias) y los devuelve como (a) **dashboard dinámico** que el agente arma a pedido y (b) **sugerencias proactivas** por chat. Es lo que convierte al producto de "manos" (ejecuta) en "manos + cerebro" (dirige).

La amplitud es **ilimitada** (cualquier conector de Composio es candidato). Lo que el roadmap ordena es el **orden de construcción**, no un techo de alcance.

---

## 3. Dos agentes separados por superficie de confianza (invariante de diseño)

| | **Agente personal** (este build) | **Bot público de atención** (futuro) |
|---|---|---|
| Habla con | El **dueño** (input **confiable**) | Sus **clientes** (input **NO confiable**) |
| Hace | Comms, agenda, cobros, CRM, contenido/redes + inteligencia de negocio | Agenda turnos, recordatorios, info |
| Allowlist Composio | Amplia (es el dueño) | **Mínima**; jamás el MCP universal |
| Estado | **Primer build** | Solapa con la clínica ya hecha → posterior |

Esta separación es el corazón de la seguridad. La *lethal trifecta* (datos privados + input no confiable + acción externa) solo se cierra si el agente de cara al público **nunca** toca una allowlist amplia ni el `COMPOSIO_REMOTE_BASH_TOOL`. El agente personal tiene input confiable (el dueño), pero igual opera tras lista cerrada. **Nota:** los datos financieros (AFIP, cobros) son sensibles → viven en la Capa B del **agente personal** (confiable), nunca expuestos al bot público.

---

## 4. Arquitectura técnica

### 4.1 Motor conversacional (reutilizado)
Arquetipo `conversational_agent` de la fábrica: `ConversationWorkflow` durable sobre Temporal, dispatcher de **lista cerrada**, adapters de canal (Telegram ya; WhatsApp vía Evolution API ya operativo para Hermes), HITL por botones/choices, `LlmProvider` con failover operacional. **Sobrevive cortes** (durabilidad Temporal) — el moat. La proactividad de la Capa B se apoya en **workflows Temporal schedulados** (ver §4.7).

### 4.2 Integración Composio (validada)
- Cada capacidad = **módulo plug-in** = conjunto de intents + tools de **lista cerrada** (allowlist).
- Ejecución **brokered**: el token del usuario **nunca** llega al LLM ni al payload. Validado E2E.
- Multi-tenant: **un entity (`user_id`) por cliente**. Credenciales por cliente, aisladas.
- **Versión por-toolkit** (hallazgo del spike): cada toolkit pinea su propia versión (`gmail`≠`googlecalendar`); `"latest"` no se acepta en ejecución manual.
- **Custom auth config propio** (OAuth client de Google de la marca) — **prerequisito** para: branding del consentimiento, scopes mínimos, y habilitar **Contacts** (que no tiene managed auth en Composio). NO resuelto aún → spike de Fase 0.

### 4.3 LLM (encuadre cerrado)
- **LLM por API**, modelo **barato y pluggable** (candidatos: DeepSeek/Qwen chino, o `gpt-4o-mini`) — la elección concreta es **táctica y reversible** vía `LlmProvider`.
- Control de costo: **modelo barato adecuado a la tarea** (un agente conversacional no quema tokens como la generación de código) + **cuotas/rate-limit por tenant** (cota dura) + cascade de la fábrica.
- **BYOK opcional** (cliente trae su propia API key de plataforma) para power users → tu costo $0 para ellos. Ojo: requiere cuenta de **API** con saldo, ≠ suscripción ChatGPT Plus.
- **Diferido — NO en el camino crítico:** "Sign in with ChatGPT / user plan" de OpenAI (corre la inferencia bajo la suscripción del usuario). Es real pero inmaduro, acopla a un solo proveedor, y parece diseñado para apps que viven *dentro* de ChatGPT (incompatible con nuestro canal propio). Re-evaluar cuando sea GA.

### 4.4 Datos y backend
- **Servicios externos = source-of-truth de su dominio** (Calendar para agenda, Gmail para mail) — accedidos read/write vía Composio. Elimina gran parte del mantenimiento de schema.
- **DB propia (Supabase `uc_factory`, multi-tenant por `cliente_id`, RLS)** para lo que los servicios externos no cubren: metering/cuotas, estado que no viva en Temporal, y — clave para la Capa B — **el almacén normalizado de datos de negocio** (ingresos/egresos/cobros por cliente·período·categoría) que alimenta análisis y dashboard.
- **Bidireccionalidad con Calendar = SOLO LECTURA para mostrar/BI** (decisión del operador). Traer info del Calendar a la app está **validado E2E**. La app **no** importa eventos externos como turnos de negocio (eso reintroduciría reconciliación de dos fuentes de escritura). El comportamiento de un evento creado a mano (mostrar / bloquear disponibilidad / ignorar) se define al construir el módulo; no es bloqueante.
- **Patrón a futuro si entra el bot público transaccional:** DB como source-of-truth de turnos + push one-way a Calendar + read de Calendar como capa de "ocupado" (asimétrico). No es necesario para el agente personal.

#### 4.4.1 Fuentes de datos financieros (ingesta de la Capa B)
**Principio:** para la BI **solo hace falta LEER** datos que ya existen — **no** construir un sistema contable ni un facturador (eso sería frontend/SaaS pesado = anti-fit). Emitir facturas es otra cosa: capacidad de *ejecución* (módulo Cobros), no de BI.

| Fuente | Qué da | Acceso | Estado |
|---|---|---|---|
| **AFIP** (comprobantes emitidos/recibidos) | Ingresos y egresos **facturados** por cliente/período/tipo | SDK AFIP + **delegación de clave fiscal** por cliente | 🟢 Ventaja **ARCA** (ya opera AFIP multi-cliente). **A VALIDAR** (ver abajo). |
| **Pasarelas de pago** (MercadoPago/Stripe) | **Cobros reales** / flujo de caja efectivo | OAuth vía Composio (patrón Gmail) | 🟡 Conector no validado |
| **Mail / manual** | Gastos sin factura, comprobantes sueltos | Gmail (el agente ya lo lee) | 🟢 Disponible |
| **Bancos** (open banking) | Flujo de caja completo | APIs bancarias | 🔴 Inmaduro en AR — diferir |

- **Gap conceptual a respetar — facturado ≠ cobrado.** AFIP da lo **facturado** (excelente para rentabilidad/Pareto por cliente·servicio). Una factura emitida **no** es plata cobrada; el **flujo de caja real** requiere la pasarela. **Nunca presentar lo facturado como si fuera flujo de caja** en el dashboard.
- **Supuesto crítico a validar (NO ahora — spike futuro):** lo que ARCA testeó fue **EMITIR** (wsfe). **Leer** los comprobantes de un cliente es otro web service (consulta) y otro modelo de **acceso multi-tenant** (cada cliente delega el servicio en su clave fiscal). Antes de diseñar la ingesta AFIP: (a) **recon de ARCA** — qué capacidad ya existe (reutilizar); (b) **spike de consulta AFIP multi-tenant** — qué datos/granularidad devuelve realmente.

### 4.5 Frontend — dashboard de inteligencia de negocio
- **Sin frontend de gestión.** El frontend propio es el **dashboard de BI, read-only**, alimentado por **queries reales** (nunca números inventados por el LLM).
- **Dinámico:** el agente arma/rellena vistas a pedido sobre un **template de UI** (p. ej. "mostrame rentabilidad por cliente últimos 3 meses") que se renderiza. Los **datos salen de queries reales**; el agente decide *qué mostrar*, no *qué número es*.
- **Invariante anti-fit:** la inteligencia vive en los **datos + el agente**, no en el frontend. El dashboard es la **vidriera**, no el motor. Si se infla a SaaS-dashboard pesado de gestión, es anti-fit.

### 4.6 Seguridad (invariantes)
- Separación de superficie de confianza (§3) — no negociable. Datos financieros solo en el agente personal (confiable).
- Toda acción externa/irreversible pasa por **lista cerrada** + **HITL** (confirmación del dueño).
- Allowlist mínima por módulo; **nunca** exponer el MCP universal / `COMPOSIO_REMOTE_BASH_TOOL`.
- Onboarding OAuth multi-tenant con consentimiento explícito, scopes mínimos y **revocación**. AFIP: delegación fiscal con el mismo principio de mínimo privilegio.
- Secretos fuera del repo; credenciales brokered por Composio. Datos financieros = PHI-equivalente: cifrado en reposo, sin PII en logs.

### 4.7 Capa de Inteligencia de Negocio (el diferencial)
Cadena de cuatro pasos; el riesgo y el trabajo están en los tres primeros (ingesta), **no** en el análisis:

1. **Ingesta** — AFIP + pasarela + mail + agenda → datos crudos del negocio (§4.4.1).
2. **Normalización** — a un modelo de negocio en `uc_factory` (ingresos/egresos/cobros por cliente·período·categoría).
3. **Análisis** — el agente evalúa el dataset completo: rentabilidad por cliente/servicio, **Pareto** (20% que da el 80%), flujo de caja, tendencias.
4. **Salida** — (a) **dashboard dinámico** read-only (§4.5); (b) **proactividad**: un **workflow Temporal schedulado** (p. ej. semanal) lee la info, el agente la evalúa y **manda sugerencias** por WhatsApp/Telegram. Temporal hace esto durable y natural — el moat aplicado a B.

**Conexión con los 3 pilares del estudio de mercado — AFIP los alimenta desde un solo origen:**
- **Pilar 1 (diagnóstico por etapa):** el "examen clínico" **no** es un formulario largo; se **deriva de AFIP** (volumen/ingresos reales) → clasifica etapa y mapa de pains casi sin preguntar.
- **Pilar 2 (copiloto estratégico):** la salida proactiva (paso 4) = objetivos/sugerencias semanales por impacto.
- **Pilar 3 (orquestación):** ya resuelto por la Capa A (Composio). La BI decide *qué automatizar* sobre datos reales.

### 4.8 Memoria de largo plazo y recall temporal (CABLEADO en prod — verificado 2026-07-05)
La memoria conversacional del copiloto sobre Graphity (`MemoryProvider`, capacidad **opt-in de la plantilla `conversational_agent`** vía `config['memory']=True` que solo el copiloto pasa en `web.py`, **replay-safe** para sesiones en vuelo) está **cableada end-to-end en producción** — no es un ladrillo suelto: verificado por código y por el log del worker (`AGENT_B memoria: ON (Graphity)`). Cuatro operaciones:

- **`warm`** — al abrir el `ConversationWorkflow` (+ `POST /warm` dirigido por el front al montar el chat / volver la pestaña a visible, throttle 5 min): precalienta el user graph del emprendedor (page-cache Neo4j + índices HNSW) → el 1er turno pasa de cache-miss a cache-hit.
- **`recall` semántico por turno** — la activity `call_llm` antepone al system prompt el **Context Block** de facts relevantes al mensaje actual (`POST /graph/search` sobre el user graph, con el mensaje del turno como query → trae los facts aunque el thread sea nuevo → memoria cross-sesión real).
- **`remember` batcheado** — cada ≥20 mensajes + flush al cerrar la sesión: persiste el turno al user graph (dispara la extracción LLM server-side de Graphity). El buffer de 20 recientes vive en el workflow state, no en el provider.
- **`recall_range` (recall temporal, PR #125)** — la actividad **EXHAUSTIVA** de un rango de fecha libre para "qué hice ayer/esta semana" (§0). Independiente del gate `config['memory']`: el dispatcher la invoca vía `ctx.memory_provider` cuando el intent es `consultar_actividad`.

**Invariantes de diseño (todos verificados / endurecidos por review adversarial):**
- **Determinismo Temporal:** todo I/O de memoria (warm/recall/remember/recall_range/resumen LLM) va en **activities**, nunca en el workflow; la resolución del rango de fecha es determinista (`now` inyectado, sin leer el reloj).
- **Best-effort duro:** cualquier falla de Graphity degrada sin colgar el turno (recall→`""`, recall_range→`[]`), con `retry_policy(max_attempts=1)` + `try/except` en cada activity de memoria — una excepción escapada mataría el `ConversationWorkflow` durable (finding crítico ya fixeado, memoria `agente-loop-tool-failure-retry-infinito`).
- **Anti prompt-injection:** el contenido de Graphity es **NO confiable** (texto de mails/mensajes extraído por LLM) → se envuelve rotulado "datos NO instrucciones" + delimitador neutralizado, tanto en el recall semántico (`_wrap_context`) como en el resumen del recall temporal (`[ACTIVIDAD]`).
- **Aislamiento cross-emprendedor [VERIFIED]:** `user_id = copiloto-{cliente_id}` (UUID v4 → no-adivinable) + namespacing físico del server `{tenant}__user_{user_id}` (ADR-040); una key global, la separación es por user_id.
- **Modelo multi-grafo:** hoy se usa el **user graph** (chat/general del emprendedor); los group graphs de función (BI, catálogo) son plug-in futuro sin refactor (`MemoryProvider.function_graph_id`), alineado con la Capa B (§4.7).

**Deuda visible (gestionada):** `recall_range` trae los últimos ≤500 episodios; un rango con >500 episodios más viejos podría truncarse → paginar por `uuid_cursor` cuando un tenant supere ~500 (hoy: decenas). Documentada en el código + memoria.

---

## 5. Evidencia de spikes (validado empíricamente — no es supuesto)

| Qué se validó | Cómo | Estado |
|---|---|---|
| Composio multi-tenant brokered (read+write, token nunca en payload) | `spikes/composio-sdk-multitenant/` | ✅ E2E |
| Onboarding (authorize → connect link → cuenta conectada) | idem | ✅ E2E |
| Allowlist real (vía `tools.get(toolkits=[...])`, **nunca** `session.tools()` cruda) | idem | ✅ E2E |
| Aislamiento de credencial (**MCP key ≠ SDK key**) | idem | ✅ confirmado |
| Google Calendar como backend de turnos (crear/free-busy/listar/reprogramar/cancelar) | `spikes/composio-gcal-backend/` | ✅ E2E (con caveats) |
| **Leer del Calendar para BI** (`EVENTS_LIST` + `FIND_FREE_SLOTS`, datos reales) | idem | ✅ E2E |
| **Recall temporal por rango de fecha** (listado exhaustivo existe · `valid_at`=cuándo pasó vs `created_at`=ingesta · filtro client-side discrimina el rango · el search date-filter es top-K → solo complementa) | `spikes/recall-por-fecha/RESULT.md` (Graphity vivo) | ✅ E2E |

**NO validado aún (supuestos, requieren spike — ver §7):** consulta AFIP multi-tenant (solo se testeó **emisión** en ARCA) · conectores Composio de pagos y redes.

**Caveats documentados** (en los `RESULT.md`): versión por-toolkit · Contacts sin managed auth (requiere custom auth) · anti-doble-booking **no transaccional** en Calendar (riesgo ∝ volumen — solo importa si llega el bot público multi-profesional) · `CREATE_EVENT` agrega Google Meet por default (desactivar para presenciales) · rate limits no probados bajo carga.

---

## 6. Capa base (prerequisitos transversales — antes de cualquier módulo)

Estos elementos habilitan a **todos** los módulos; se construyen una vez:

- **B1 — Motor agente personal:** adaptar `conversational_agent` (system_prompt + dispatcher + context_factory) al perfil "asistente del dueño, input confiable". Canal Telegram primero.
- **B2 — Capa Composio tras lista cerrada:** wrapper de `execute` brokered + registro de allowlist por módulo + pinning de versión por-toolkit.
- **B3 — Custom auth config de Google (OAuth propio):** branding + scopes mínimos + habilita Contacts. *(Spike pendiente — Fase 0.)*
- **B4 — Multi-tenancy + onboarding:** entity por cliente, flujo OAuth de conexión, gestión/revocación de conexiones. *(Spike de escala pendiente.)*
- **B5 — LlmProvider + metering:** proveedor pluggable + cuotas/rate-limit por tenant + (opcional) BYOK.
- **B6 — HITL:** confirmación del dueño para acciones externas/irreversibles (ya en el arquetipo; parametrizar).
- **B7 — Dashboard BI base:** shell read-only que consume queries reales (se vuelve dinámico en la Fase de Inteligencia de Negocio).
- **B8 — Almacén normalizado de datos de negocio:** schema en `uc_factory` (ingresos/egresos/cobros) + pipeline de ingesta/normalización — base de la Capa B.

---

## 7. Roadmap por fases

Cada fase cierra con un **gate verificable** (doctrina del proyecto: *done por test/gate*, no por auto-revisión).

### Fase 0 — Cerrar el cimiento (de-risking)
**Objetivo:** eliminar los supuestos críticos que quedan antes de diseñar la implementación.
- Spike **B3 — custom auth config de Google** (¿branding + scopes mínimos + Contacts funcionan con OAuth propio?).
- Spike **B4 — onboarding multi-tenant a escala** (consentimiento, scopes, revocación, varios entities).
- **Recon de ARCA + spike de consulta AFIP multi-tenant** (qué capacidad ya existe; qué datos/granularidad devuelve la *consulta* — no la emisión). *De-risking de la Capa B.*
- (Ya hechos: Composio E2E ✅, Calendar E2E ✅.)
**Gate:** los spikes con `RESULT.md` y evidencia; sin supuestos críticos abiertos.

### Fase 1 — Motor + módulo Comms+Agenda (MVP del agente personal)
**Objetivo:** agente personal que opera Gmail + Calendar por chat, con dashboard BI mínimo que cruza ambos.
- Capa base B1, B2, B5, B6 + B7 (mínimo).
- Conectores: **Gmail** (triage, redacción, responder) + **Calendar** (crear/mover/cancelar, free/busy, recordatorios) — ambos **ya validados**.
- Dashboard BI: "agenda de la semana + mails que requieren acción".
**Gate:** flujo E2E en el VPS — el dueño pide por chat acciones reales en su Gmail/Calendar, con HITL, y el dashboard refleja datos reales.

### Fase 2 — CRM + Contacts
**Objetivo:** sumar gestión de contactos/clientes.
- Requiere **B3** (Contacts necesita custom auth).
- Reutiliza `mini-crm` de la fábrica + Google Contacts.
**Gate:** alta/consulta/actualización de contactos E2E; cruce CRM↔agenda en el dashboard.

### Fase 3 — Cobros + ingesta de flujo de caja
**Objetivo:** facturación, seguimiento de morosidad, y captura de **cobros reales** (alimenta la Capa B con flujo de caja).
- Reutiliza `billing-system` + `dunning`.
- **Requiere spike** del conector de pagos en Composio (Stripe / MercadoPago) — `[PENDIENTE VALIDAR]`, no asumido.
**Gate:** generar cobro + seguimiento de estado E2E; morosidad y cobros en el almacén de negocio (B8).

### Fase 4 — Capa de Inteligencia de Negocio (EL DIFERENCIAL)
**Objetivo:** materializar la Capa B (§4.7) — ingesta financiera + análisis + dashboard dinámico + proactividad.
- **Ingesta AFIP** (consulta multi-tenant vía delegación; reutiliza ARCA) → almacén normalizado **B8**.
- **Análisis:** rentabilidad por cliente/servicio, Pareto, flujo de caja (cruzando AFIP=facturado con pagos=cobrado), tendencias.
- **Dashboard dinámico:** el agente arma vistas a pedido sobre template de UI, con datos de queries reales.
- **Proactividad:** workflow Temporal schedulado → agente evalúa info completa → sugerencias por chat.
- **Diagnóstico (Pilar 1)** derivado de AFIP (etapa + mapa de pains), sin formulario largo.
- *Versión mínima de BI (agenda+mail) ya existe desde Fase 1; acá se vuelve el diferencial pleno.*
**Gate:** E2E — con datos financieros reales de un cliente, el dashboard muestra rentabilidad/Pareto correctos (sin números inventados) **y** el agente emite una sugerencia proactiva accionable por chat.

### Fase 5 — Contenido / Redes
**Objetivo:** publicación/programación en redes (módulo aparte, como acordó el operador).
- **Requiere spike** de conectores LinkedIn / Facebook / Instagram en Composio — `[PENDIENTE VALIDAR]`.
**Gate:** publicar/programar un post E2E con HITL.

> **Bot público de turnos:** queda fuera de la secuencia del agente personal. Si se retoma, su backend se decide **por volumen** (Calendar directo para unipersonal de bajo volumen; transaccional `booking`+s5 o híbrido asimétrico para multi-profesional). Solapa con la clínica ya hecha.

---

## 8. Decisiones tomadas

1. **Primer build = solo agente personal** (input confiable). Bot público después.
2. **Identidad = ejecución (Capa A, resuelta) + inteligencia de negocio (Capa B, el diferencial).** B es "la verdadera veta"; A es la base que la habilita.
3. **LLM por API**, barato, pluggable (`LlmProvider`), con cuotas por tenant + BYOK opcional. *User plan* de OpenAI diferido.
4. **Servicios externos = source-of-truth** de su dominio (vía Composio); DB propia para metering + **almacén normalizado de datos de negocio** (Capa B).
5. **Datos financieros = LEER, no construir contabilidad.** AFIP (ventaja ARCA) como fuente principal de ingresos facturados; pasarela para flujo de caja. Respetar **facturado ≠ cobrado**.
6. **Bidireccional con Calendar = solo lectura** para mostrar/BI; no se importan eventos como turnos.
7. **Frontend = dashboard de BI read-only y dinámico**; la inteligencia vive en datos+agente, no en frontend de gestión.
8. **Seguridad por separación de superficie de confianza** + lista cerrada + HITL; nunca MCP universal. Datos financieros solo en el agente personal.

## 9. Decisiones abiertas / diferidas

- **Qué pregunta de negocio prioriza la BI primero** — "¿qué/quién es rentable?" (fuente = AFIP, ya cerca) vs. "¿cómo está mi flujo de caja?" (fuente = pasarela, conector nuevo). Define qué reconocer/spikear primero.
- **Modelo de cobro de la app** (suscripción con cuota incluida vs. pago por uso) — **MAYOR, del operador**; no bloquea el diseño técnico.
- **Modelo de LLM concreto** (DeepSeek/Qwen vs. gpt-4o-mini) — táctico, se cierra al implementar Fase 1.
- **Comportamiento de eventos creados a mano en Calendar** (mostrar / bloquear / ignorar) — se define en el módulo Agenda.
- **Acceso AFIP multi-tenant** — modelo de delegación de clave fiscal por cliente; `[PENDIENTE VALIDAR]` (recon ARCA + spike consulta).
- **Conectores Composio de pagos y redes** — `[PENDIENTE VALIDAR]` con spike antes de Fase 3 (pagos) y Fase 5 (redes).
- **Higiene de cierre de spikes** (desconectar entities, borrar `apikey composio.txt`, rotar keys) — **diferida** por decisión del operador a "finalizar todo el desarrollo"; registrada como deuda gestionada.

## 10. Riesgos / failure map

| Riesgo | Mitigación adoptada |
|---|---|
| Lethal trifecta (datos + input no confiable + acción) | Separación de superficie de confianza + allowlist mínima + nunca MCP universal |
| Costo de tokens por cliente | Modelo barato + cuotas/rate-limit por tenant + BYOK opcional |
| Fricción/seguridad del onboarding OAuth multi-tenant | Spike B4 (consentimiento, scopes mínimos, revocación) en Fase 0 |
| Dependencia de Composio (single point) | Conectores tras boundary (lista cerrada); `LlmProvider` ya desacoplado |
| Inflado del dashboard a SaaS pesado (anti-fit) | Invariante "read-only, inteligencia en datos+agente"; el dashboard es vidriera, no motor |
| **Acceso AFIP consulta multi-tenant no validado** (solo se testeó emisión) | Recon ARCA + spike de consulta en Fase 0 antes de diseñar la ingesta |
| **Confundir facturado con cobrado** en el dashboard | Modelar ambos por separado; AFIP=facturado, pasarela=cobrado; nunca presentar uno como el otro |
| Datos financieros sensibles | Cifrado en reposo, sin PII en logs, solo en el agente personal (confiable) |
| Conectores de pagos/redes no validados | Spike obligatorio antes de Fase 3 (pagos) y Fase 5 (redes); marcado `[PENDIENTE VALIDAR]` |
| Anti-doble-booking no transaccional en Calendar | Solo relevante si vuelve el bot público multi-profesional → backend por volumen |

## 11. Activos reutilizables de la fábrica

`conversational_agent` (motor) · `appointment` (reschedule, RICO) · `booking` (anti-doble-booking + UNIQUE) · motor de disponibilidad (spike s5) · `mini-crm` · `dunning` · `billing-system` · STT voz (Groq whisper) para notas de voz por canal · **suite ARCA + SDK AFIP** (facturación electrónica testeada — base para la ingesta financiera de la Capa B, con la salvedad consulta vs. emisión).

## 12. Referencias

- Estudio de mercado: `docs/Ideas a explorar/me gustaria hacer un estudio de mercado completo s.md`
- Spikes: `spikes/composio-sdk-multitenant/RESULT.md` · `spikes/composio-gcal-backend/RESULT.md`
- Arquetipo: `deploy/skeleton_kit/archetypes/conversational_agent/README.md`
- Catálogo de activos: `docs/CATALOGO-apps-biblioteca.md`
- Identidad de producto: memoria `factory-identidad-automatizacion-ia`
- Suite ARCA / AFIP: workspace `Agencia_IA_HyC/` (fuente del SDK AFIP a reconocer/reutilizar)
