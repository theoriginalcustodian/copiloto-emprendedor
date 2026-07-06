---
name: copiloto-servicios-composio-plugin
description: "Copiloto B — 7 servicios Composio usables por el agente vía patrón módulo-plug-in (1 archivo/servicio). LEER al agregar/tocar un servicio del copiloto o al replicar el patrón en otro agente conversacional."
metadata:
  node_type: memory
  type: project
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

**Copiloto del Emprendedor — servicios Composio implementados (PR #104, merge `c7a07db`, 2026-07-02).**

**7 servicios usables por el agente, cada uno E2E REAL** (contra la cuenta del operador, `COPILOTO_COMPOSIO_USER_ID`): **calendar** (agendar), **gmail** (enviar/buscar), **drive** (crear/buscar archivo), **docs** (crear/leer), **hubspot**=CRM (crear/buscar contacto), **sheets** (escribir/leer), **instagram** (ver cuenta/posts). Suite `apps/copiloto/tests` = **47 passed** + QA selección **8/8=100%**.

**Patrón módulo-plug-in (cero fricción = 1 archivo/servicio):** `apps/copiloto/services/<svc>.py` expone `TOOLKIT` + `POLICY` (allowlist MÍNIMA 2-5 slugs) + `PROMPT_FRAGMENT` + `build(op, entities, *, now_iso) -> Proposal|Read|None`. Discovery automático (`services/__init__.py`, tolerante a módulo roto). El **core** (`dispatcher_emprendedor.py`) aporta: **confirm-gate genérico HITL** (write se propone → botón → `confirmed=True`, doble candado con `ComposioGateway` fail-closed; reads directos) + **chain 2-pasos** (`pending['then']`, ej Instagram crear-contenedor→publicar) + compone system prompt (`base + services.prompt_fragments()`) y policy (`{**CALENDAR_POLICY, **services.merged_policy()}`). **Agregar servicio = soltar 1 archivo**; NO se toca dispatcher/prompt/registro.

**Strangler-fig:** Calendar conserva su verbo `book` (path #97 intacto, regresión 0); servicios nuevos usan `action="tool_action"` + `entities{service, op}` (`tool_action` agregado a `types.ACTIONS` del arquetipo, aditivo).

**Runbook agregar servicio:** (1) `validate_toolkit.py <tk>` → versión+slugs; (2) dump `input_parameters` de los slugs read/write; (3) escribir `services/<svc>.py`; (4) `tests/test_<svc>.py` (plantilla: 3 unit spy + 1 real create→read-back+cleanup); (5) `pytest` en el VPS.

**📲 Telegram = CANAL, NO tool (decisión de scope 2026-07-02, NO es gap):** el agente conversa por el canal Telegram (`reference/clients/agent/channels/telegram.py`, Bot API directo con `TELEGRAM_BOT_TOKEN`, sin Composio) — es LA interfaz del copiloto (el usuario controla los 7 servicios hablándole al bot). La conexión Composio `telegram → ACTIVE` (del login del operador) quedó **dormida a propósito**: NO hay `services/telegram.py` → el agente NO puede invocarla (fail-closed sin policy = inofensiva). Telegram-tool (agente→terceros: mandar a grupos/chats ajenos) NO se cablea porque el operador solo quiere controlar SU ecosistema. Si se quisiera: toolkit `telegram` v`20260615_00`, 18 slugs (`SEND_MESSAGE`/`SEND_PHOTO`/`FORWARD_MESSAGE`/`GET_CHAT_HISTORY`…), auth ya ACTIVE → solo falta el módulo plug-in. NO re-proponer sin caso de uso nuevo.

**⚠️ Instagram publish = DECISIÓN DEL OPERADOR pendiente:** cuenta Business (publicar posible) PERO la API **no tiene delete-post** (post permanente) + requiere image_url pública. Publish queda **cableado+unit+chain**, NO se dispara real. Read (cuenta/posts) sí validado real. Deuda viva: multi-tenancy runtime (1 worker/cliente hoy).

**🔧 Sheets endurecido (PR #105, 2026-07-02) — deuda de append SALDADA + core con pre-paso `resolve`:** 3 ops → `append_row` (`SPREADSHEETS_VALUES_APPEND`, append real, Google resuelve la fila) · `update_range` (`BATCH_UPDATE` con `first_cell_location` de entities, cambio puntual ej "B3") · `read_range`. **2 bugs reales cazados por E2E (no por razonamiento):** (1) el append pisaba desde A1; (2) la pestaña estaba hardcodeada "Sheet1" pero la cuenta real (locale es) usa **"Hoja 1"** → hardcodear cualquier nombre = codificar la esperanza. Fix del (2): **mecanismo `resolve` nuevo en el core** (`Proposal.resolve={slug,arguments,path,into}`, simétrico a `then`): el confirm-gate ejecuta un read, extrae `_dig(res,path)` (serializable) y lo inyecta antes del write; Sheets resuelve la 1ra pestaña real vía `GET_SHEET_NAMES`. ⚠️ **casing DIFIERE entre slugs**: VALUES_APPEND=camelCase (`spreadsheetId`/`valueInputOption`), BATCH_UPDATE=snake_case — el gateway pasa `arguments` tal cual. `test_sheets` 7/7 + suite 50/50, cero regresión al tocar el core.

**Deploy:** `worker_b.py` levanta los 7 por discovery (cero config). Deploy = scp + restart worker (no hay worker vivo; chat web diferido). Código en `/opt/uc-copiloto-stage`, venv `/opt/uc-copiloto-venv` (composio 0.17.1 + temporalio). [[composio-gateway-ladrillo]] [[tool-overload-routing-agente]] [[copiloto-emprendedor-roadmap]] [[tests-se-corren-en-vps]]
