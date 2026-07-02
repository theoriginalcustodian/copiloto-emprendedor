# Copiloto del Emprendedor — Implementación de los servicios Composio (sprint 2026-07-02)

> **Estado:** COMPLETO y verde E2E. Sprint autónomo (Claude, clone-and-own sobre el Copiloto B).
> **Rama:** `feat/copiloto-servicios-composio` · **Base:** main post-#103.
> **Objetivo (/goal):** los servicios restantes del Copiloto **usables por el agente conversacional**, con llamado de tools **impecable**, **probados E2E reales**, y estructura **preparada para agregar tools con cero fricción**.

---

## 1. Resultado

El agente conversacional del Copiloto opera **7 servicios** vía Composio, cada uno con **E2E real verde** contra la cuenta conectada (`COPILOTO_COMPOSIO_USER_ID` = cuenta del operador):

| Servicio | Ops | Slugs (policy mínima) | E2E real |
|---|---|---|---|
| **Calendar** | agendar | `GOOGLECALENDAR_CREATE_EVENT` / `FIND_EVENT` | ✅ crea evento + read-back (previo #97, reconfirmado) |
| **Gmail** | enviar · buscar | `GMAIL_SEND_EMAIL` / `FETCH_EMAILS` | ✅ envía mail real + read-back |
| **Drive** | crear archivo · buscar | `CREATE_FILE_FROM_TEXT` / `FIND_FILE` | ✅ crea archivo + find + cleanup |
| **Docs** | crear doc · leer | `CREATE_DOCUMENT_MARKDOWN` / `GET_DOCUMENT_PLAINTEXT` | ✅ crea doc + lee contenido |
| **HubSpot** (CRM) | crear contacto · buscar | `CREATE_CONTACT` / `SEARCH_CONTACTS_BY_CRITERIA` | ✅ crea contacto + search + archive |
| **Sheets** | escribir fila · leer | `BATCH_UPDATE` / `BATCH_GET` | ✅ crea planilla scratch + escribe + lee + cleanup |
| **Instagram** | ver cuenta/posts · publicar | `GET_USER_INFO`,`GET_IG_USER_MEDIA` / `POST_IG_USER_MEDIA`+`PUBLISH` | ✅ **read real**; publish cableado+unit (ver §5) |

**Evidencia:** `apps/copiloto/tests` → **47 passed** (unit + E2E reales + 2 circuitos durables) · **QA de selección gpt-4o-mini 8/8 = 100%**.

---

## 2. Arquitectura — patrón "módulo de servicio" plug-in (cero fricción)

**Agregar un servicio = soltar UN archivo** `apps/copiloto/services/<svc>.py`. Discovery automático (`services/__init__.py`, `pkgutil.iter_modules`), sin tocar dispatcher, prompt ni registro central.

Cada módulo expone (contrato en `services/base.py`):
- `TOOLKIT` — slug del toolkit Composio.
- `POLICY` — `ToolkitPolicy` con la **allowlist mínima** (2-5 slugs, NO los 60-245 del toolkit).
- `PROMPT_FRAGMENT` — instrucciones en texto para el LLM (qué ops emitir).
- `build(op, entities, *, now_iso) -> Proposal | Read | None` — arma el call; NO ejecuta.

El **core** (`dispatcher_emprendedor.py`) aporta lo compartido:
- **Confirm-gate genérico (HITL)**: un write se **propone** (botón Confirmar) y solo se ejecuta tras confirmación, con `confirmed=True` (doble candado con el `ComposioGateway` fail-closed). Reads se ejecutan directo.
- **Chain de 2 pasos** (`pending['then']`) para tools multi-paso (ej. Instagram: crear contenedor → publicar).
- Composición del system prompt: base del dominio + `services.prompt_fragments()`.
- Composición de la policy del gateway: `{**CALENDAR_POLICY, **services.merged_policy()}`.

**Estrategia de migración: strangler-fig.** Calendar conserva su verbo `book` (path probado E2E #97, **intacto** → regresión cero); los servicios nuevos usan `action="tool_action"` + `entities{service, op}`. Se agregó `"tool_action"` al verbo-set del arquetipo (`types.ACTIONS`, aditivo — no afecta a la clínica).

Discovery **tolerante a fallos**: un módulo roto se saltea (try/except), no tumba al agente ni a los demás.

---

## 3. Reencuadre del "tool overload" (hallazgo verificado)

**El agente NO usa function-calling.** `LlmProvider._call_openrouter` arma `{model, messages, max_tokens}` — **sin `tools=[...]`**. El LLM recibe el system prompt (texto) y devuelve JSON `{action, entities}`.

Consecuencia (verificado, no asumido):
- El SOTA de tool-overload (55k tokens de tool-defs, precisión 78%→13.6%) es para **function-calling nativo** → **no aplica** acá.
- Agregar un servicio pesa solo su `PROMPT_FRAGMENT` (~70 tokens). 7 servicios ≈ 500 tokens. Trivial.
- **No se construyó "gating por tool-defs"** (no corresponde). El riesgo real es **precisión de instrucción**, medido con la QA: **gpt-4o-mini 8/8 = 100%**. La policy mínima + fragmentos compactos bastan.

→ Actualiza la memoria `tool-overload-routing-agente`: para ESTE agente, el orden de defensas colapsa a "policy mínima + prompt claro"; el gating/RAG/sub-agentes no hacen falta al escalar servicios porque no hay tool-defs en contexto.

---

## 4. Cómo agregar un servicio nuevo (runbook, cero fricción)

1. `deploy/skeleton_kit/archetypes/conversational_agent/tools/validate_toolkit.py <toolkit>` → versión + slugs reales.
2. Dump del shape (`input_parameters`) de los slugs read/write elegidos (script de descubrimiento).
3. Crear `apps/copiloto/services/<svc>.py`: `TOOLKIT`, `POLICY` (mínima), `PROMPT_FRAGMENT`, `build(...)`.
4. Crear `apps/copiloto/tests/test_<svc>.py` (plantilla: 3 unit con spy + 1 real create→read-back + cleanup).
5. Correr en el VPS: `pytest apps/copiloto/tests/test_<svc>.py`. Discovery lo levanta solo.

No se edita el dispatcher, ni el prompt, ni el registro. **Un archivo.**

---

## 5. Deuda gestionada + decisiones pendientes

- **⚠️ Instagram publish real — DECISIÓN DEL OPERADOR.** La cuenta conectada es **Business** (publicar es técnicamente posible), pero: (a) la API **no tiene delete-post** (solo `DELETE_COMMENT`) → un post es **PERMANENTE** (borrado manual desde la app); (b) requiere una **image_url pública**. Por eso el E2E **no dispara** un publish real sobre la cuenta de marca. El publish queda **cableado + unit-testeado + chain 2-pasos validado**, listo para activar cuando el operador lo decida (pasar image_url + aceptar permanencia). *Propietario: operador.*
- **Sheets append.** `append_row` escribe desde `first_cell_location` (A1 por default) vía `BATCH_UPDATE`; para APPEND real a la próxima fila vacía de una planilla poblada, migrar a `GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND`. Suficiente para el MVP (escribir/leer real). *Propietario: sprint copiloto; pago: cuando entre el caso poblado.*
- **`ig_user_id` en Instagram media/publish.** El agente lo obtiene con `op:"account"` primero; a futuro se puede auto-resolver en el módulo. *Menor.*
- **Multi-tenancy runtime.** Hoy `worker_b` toma 1 `cliente_id`/`composio_user_id` del env (1 worker = 1 cliente). Para N clientes: tenant por input del workflow + credenciales por tenant. Fuera del scope de este sprint (es la palanca de escala de usuarios, no de servicios). Ver roadmap.

---

## 6. Producción

- Fuente de verdad: rama mergeada a `main`. Runtime: `worker_b.py` levanta **todos** los servicios por discovery (cero config extra). Deploy = `scp` + restart del worker (no hay worker vivo hoy; el operador decidió no levantar el chat web aún).
- Secretos: `COMPOSIO_API_KEY`/`OPENAI_API_KEY`/`COPILOTO_*` en `/etc/unreal-copilot/copiloto.env` (fuera del repo). Connections Composio: 8 ACTIVE (`enable_services.py --check`).
- Seguridad: `ComposioGateway` fail-closed (allowlist por policy + denylist gana) + confirm-gate HITL en todo write. Coherente con la separación de superficie de confianza del roadmap.

---

## 7. Archivos

- **Core:** `apps/copiloto/{dispatcher_emprendedor,worker_b}.py` · `apps/copiloto/services/{__init__,base}.py` · `reference/backend/agent/types.py` (+`tool_action`).
- **Servicios:** `apps/copiloto/services/{gmail,drive,docs,hubspot,sheets,instagram}.py` (Calendar sigue en `calendar_policy.py` + verbo `book`).
- **Tests:** `apps/copiloto/tests/test_{gmail,drive,docs,hubspot,sheets,instagram,selection_qa,e2e_tool_action}.py` + los previos (`test_dispatcher`, `test_calendar_gateway`, `test_e2e`).
