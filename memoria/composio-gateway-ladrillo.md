---
name: composio-gateway-ladrillo
description: Composio en la fábrica — referencia de arranque OBLIGATORIA. Leer SIEMPRE al desarrollar con Composio o AGREGAR UN SERVICIO/TOOLKIT nuevo. Boundary fail-closed (ComposioGateway, no reinventar) + runbook `validate_toolkit.py` (descubre/valida versions y slugs contra el catálogo real, genera la policy — mata el 'adivinar') + failure-map de mañas ya pagadas.
metadata: 
  node_type: memory
  type: project
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

**`ComposioGateway`** — boundary de seguridad **fail-closed** entre un agente (LLM no confiable) y los servicios externos vía Composio. Tercer provider agnóstico del arquetipo `conversational_agent`. **Reusalo tal cual — no reinventes el boundary** (una omisión = lethal trifecta).

**Dónde:** `deploy/skeleton_kit/archetypes/conversational_agent/reference/clients/agent/providers/composio_gateway.py`. Dep: `composio==0.17.1` (pinned).

**Contrato:** `ComposioGateway(policy)`, `policy = {toolkit: ToolkitPolicy(version, read={slugs}, write={slugs})}`. Policy = por-dominio; `user_id` (tenant) va por-call desde el `context_factory` del dominio. Dos planos: **ejecución** (`execute(slug, *, user_id, arguments, confirmed=False)` + `allowed_tools`) + **conexión** (`authorize`/`list_connections`/`connection_status`/`revoke`).

**Fail-closed en profundidad:** (1) sin policy no se construye; (2) denylist de meta-tools (`COMPOSIO_REMOTE_BASH_TOOL`/`MULTI_EXECUTE`) **gana sobre la policy**; (3) slug fuera de `read∪write` → `ToolNotAllowed`; (4) write sin `confirmed=True` → `ConfirmationRequired` → **doble candado** con el HITL del dispatcher. Token OAuth nunca toca el código/payload.

**Lecciones de EJECUCIÓN:** versión **pineada por-toolkit** (el SDK rechaza `"latest"`) **Y debe existir en `client.toolkits.get(tk).meta.available_versions`** — una inventada NO falla el de-risk del slug pero da **404 al EJECUTAR**. Validá la version contra el catálogo, no solo el slug · `CREATE_EVENT` necesita `start_datetime`+`end_datetime` **naive-local** + `timezone` IANA (UTC con offset corre +3h en el display) · **SDK key ≠ MCP key** (401 cruzado) · SDK lazy en el `client_factory` default → unit (mock) corren sin composio.

**4 bugs de CONEXIÓN que un fake (toolkit=string) NO cazó** (fake con contrato distinto al real → "verde" mentía): (1) `connection_status` comparaba **objeto `ItemToolkit` vs slug string** → `None` con conexión `ACTIVE`; fix `_slug_of`+case-insensitive. (2) `authorize()` usaba endpoint legacy `sdk.create().authorize()`, **retirado por Composio** → fix `connected_accounts.link(user_id, auth_config_id)`. (3) contenedor con `items==[]` (sin conexiones) → `TypeError`; fix `_unwrap_items` (distingue 'sin attr' de 'lista vacía'). (4) `json.dumps(ensure_ascii=True)` escapaba acentos → comparar summaries extraídos, no dump. **Moraleja: un fake que no reproduce la FORMA real del SDK da falsos verdes — el integration real es indispensable.**

**🧩 Runbook para agregar un toolkit:** `tools/validate_toolkit.py` (read-only: descubre `available_versions`+slugs vía `get_raw_composio_tools(limit=500)` — ⚠️ `limit` chico/None **trunca a 20 en silencio**; detecta `composio_managed_auth_schemes` vacío = custom OAuth; genera skeleton de `ToolkitPolicy`) + `COMO_AGREGAR_SERVICIO_COMPOSIO.md` (failure-map de 11 mañas). **Corré `validate_toolkit.py <toolkit>` ANTES de escribir CUALQUIER policy nueva.** Gotcha: emojis crashean stdout en cp1252 (Windows) → markers ASCII.

**🔗 `tools/enable_services.py`:** genera links de autorización para los **8 servicios** del Copiloto (gmail·googlecalendar·googlesheets·googledrive·googledocs·hubspot·telegram·instagram), idempotente. **Estado de conexión OBLIGA filtro server-side:** `connected_accounts.list(user_ids=[u], statuses=["ACTIVE"], toolkit_slugs=[...])`. ⚠️ cada `authorize` **CREA una connected_account nueva** → correrlo repetido acumula basura; limpieza con `cleanup_stale.py`. user_id = `COPILOTO_COMPOSIO_USER_ID=copiloto-e2e-test`.

**🔴 Bug CORREGIDO:** `list_connections`/`connection_status` **no paginaban ni filtraban server-side** → con >10 conexiones una `ACTIVE` quedaba **oculta**. Fix: `_iter_accounts` pagina por `next_cursor` + `connection_status` prioriza `ACTIVE`. **Instagram** = managed OAuth de Composio pero requiere crear el `auth_config` primero antes de que `authorize` genere link.

**Estado:** los **8 servicios ACTIVE**, 1 conexión por servicio. ⚠️ el VPS **no es git checkout** → merge a `main` necesita re-deploy manual del gateway.

[[copiloto-emprendedor-roadmap]] · caveats [[composio-mcp-gmail-acceso-completo]] · keys [[deuda-secretos-rotar]] · doctrina [[no-codificar-la-esperanza-principio-raiz]]
