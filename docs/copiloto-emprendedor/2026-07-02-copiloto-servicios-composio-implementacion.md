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
| **Sheets** | append fila · update celda/rango · leer | `SPREADSHEETS_VALUES_APPEND` + `BATCH_UPDATE` / `BATCH_GET` (+`GET_SHEET_NAMES` para resolver pestaña) | ✅ siembra 2 filas + append tras el seed (no pisa) + update B1 + read-back + cleanup |
| **Instagram** | ver cuenta/posts · publicar | `GET_USER_INFO`,`GET_IG_USER_MEDIA` / `POST_IG_USER_MEDIA`+`PUBLISH` | ✅ **read real**; publish cableado+unit (ver §5) |

**Evidencia:** `apps/copiloto/tests` → **50 passed** (unit + E2E reales + 2 circuitos durables) · **QA de selección gpt-4o-mini 8/8 = 100%**. *(Addenda 2026-07-02: Sheets endurecido — ver §8.)*

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
- **Pre-resolve** (`pending['resolve']`, simétrico a `then`) para tools que necesitan resolver un valor **antes** del write: ejecuta un read, extrae un valor por un `path` serializable y lo inyecta en `arguments[into]` (ej. Sheets resuelve el nombre real de la 1ra pestaña — ver §8). Fail-closed: si no resuelve, no escribe.
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
- ~~**Sheets append.** `append_row` escribe desde `first_cell_location` (A1 por default)…~~ **SALDADO (2026-07-02, ver §8):** `append_row` usa `SPREADSHEETS_VALUES_APPEND` (append real) y `update_range` (nuevo) hace el update puntual; la pestaña se resuelve en runtime (locale-agnóstico).
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

---

## 8. Addenda 2026-07-02 — Sheets endurecido (deuda de §5 SALDADA)

**Disparador:** el operador preguntó si, con una planilla poblada, el agente escribiría siempre en A1. Sí — y peor: el único write estaba **mal nombrado** ("append_row" con `BATCH_UPDATE` clavado en A1), incapaz de appendear bien **ni** de actualizar una celda puntual. Se completó la capacidad de escritura de Sheets.

**Dos bugs reales resueltos (ambos cazados por E2E contra el territorio, no por razonamiento):**
1. **Append pisaba desde A1.** `append_row` → `GOOGLESHEETS_SPREADSHEETS_VALUES_APPEND`: Google resuelve la próxima fila vacía del lado servidor (atómico, sin contar filas ni carrera). Nueva op `update_range` → `BATCH_UPDATE` con `first_cell_location` **tomado de las entities** (ej "B3") para cambiar datos puntuales.
2. **Nombre de pestaña hardcodeado.** El E2E reveló que la planilla real no tiene "Sheet1" sino **"Hoja 1"** (locale de la cuenta). Hardcodear cualquier nombre es codificar la esperanza. Fix: pre-paso **`resolve`** (nuevo, genérico en el core) que ejecuta `GET_SHEET_NAMES` y usa la 1ra pestaña real cuando el usuario no la nombra. `BATCH_UPDATE` resultó lenient (escribe en la 1ra hoja aunque el nombre no exista); no se confía en eso — se resuelve explícito.

**Detalle de casing (V-EXT, confirmado por introspección real):** `VALUES_APPEND` usa **camelCase** (`spreadsheetId`, `valueInputOption`, `range`) y `BATCH_UPDATE` usa **snake_case** (`spreadsheet_id`, `sheet_name`, `first_cell_location`). El gateway pasa `arguments` tal cual → cada op arma su propio casing.

**Mecanismo `resolve` (reusable):** `Proposal.resolve = {slug, arguments, path, into}`. El confirm-gate, antes del write, ejecuta el read `slug`, extrae `_dig(res, path)` (claves str / índices int, serializable → apto para state durable) y lo inyecta en `arguments[into]`. Simétrico al `then` post-ejecución. Cualquier servicio futuro que deba resolver un contenedor antes de escribir (folder, tabla, canal) lo reutiliza.

**Evidencia:** `test_sheets.py` 7/7 verde en el VPS (6 unit + 1 E2E real vía dispatcher: siembra → append tras el seed sin pisar → update B1 → read-back). Suite completa **50 passed, 2 skipped**, cero regresión pese a tocar el core (`base.py` + dispatcher). Rama `fix/copiloto-sheets-append-update` (PR #105).
