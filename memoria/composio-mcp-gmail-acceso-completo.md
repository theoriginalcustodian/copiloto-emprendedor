---
name: composio-mcp-gmail-acceso-completo
description: MCP composio (scope user) da acceso dinámico universal incl. borrado permanente del Gmail del operador — no heredar a agentes autónomos sin supervisión
metadata: 
  node_type: memory
  type: project
  originSessionId: 0d6fe44c-59bc-4ad4-ae16-42ac8fad5f6a
---

MCP **`composio`** registrado en **scope user** (`~/.claude.json`, disponible en TODOS los proyectos), agregado 2026-06-18.

- Endpoint **universal** `https://connect.composio.dev/mcp`, auth = header **`Authorization: Bearer ck_...`** (NO `x-api-key` → ese da 401; validado empíricamente).
- Expone **meta-tools de acceso dinámico**, no un allowlist: `COMPOSIO_MULTI_EXECUTE_TOOL`, `COMPOSIO_SEARCH_TOOLS`, `COMPOSIO_REMOTE_BASH_TOOL`, `COMPOSIO_REMOTE_WORKBENCH`, `COMPOSIO_MANAGE_CONNECTIONS`, `COMPOSIO_GET_TOOL_SCHEMAS`, `COMPOSIO_WAIT_FOR_CONNECTIONS`. Cualquier agente con este MCP puede descubrir y ejecutar TODO el catálogo de TODOS los toolkits conectados.
- **Gmail conectado con scope OAuth completo** (`https://mail.google.com/`) → tools de borrado PERMANENTE al alcance: `GMAIL_BATCH_DELETE_MESSAGES`, `GMAIL_DELETE_THREAD`, `GMAIL_DELETE_DRAFT`, además de `GMAIL_MOVE_TO_TRASH` (reversible) y lectura completa.
- **Decisión consciente del operador (2026-06-18):** acceso completo, uso personal/supervisado. Contrapunto de seguridad presentado y aceptado.

**Why:** es exactamente la *lethal trifecta* (datos privados + acción destructiva irreversible + exposición a contenido no confiable vía cuerpo de email = prompt injection). El riesgo NO requiere otro humano: un email con instrucciones inyectadas puede desviar a un agente con la tool de delete.

**How to apply:** NO incluir el MCP `composio` en el HOME de ningún agente autónomo no supervisado de la fábrica (Hermes, Claude Code headless del `FeatureWorkflow`). Como está en scope user, podría filtrarse al entorno de esos agentes — verificar el HOME dedicado de la fábrica ( ya contempla HOME aislado). Si la fábrica necesitara Gmail, crear un server Composio con allowlist restringido (`GMAIL_FETCH_*`), no el endpoint universal. La API key de Composio es secreto de máxima criticidad (da acceso a borrar el correo). Relacionado: (Hermes como agente que podría heredar el scope).
