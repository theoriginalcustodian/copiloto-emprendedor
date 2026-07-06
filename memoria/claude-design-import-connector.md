---
name: claude-design-import-connector
description: Habilitar el import de Claude Design en Claude Code local = agregar el connector MCP claude-design (no es /design-login suelto)
metadata: 
  node_type: memory
  type: reference
  originSessionId: 53c58a53-271e-474c-9267-f7720a2c6820
---

Para que el flujo **"Send to local coding agent"** de Claude Design funcione (importar un `.dc.html` sin descargar zip), Claude Code de escritorio necesita el **connector MCP `claude_design`**, que NO viene por default.

**Solución verificada (2026-07-04):**
```
claude mcp add --scope user --transport http claude-design https://api.anthropic.com/v1/design/mcp
```
→ queda `✔ Connected` (se auto-autentica con el login claude.ai/Max ya presente; no pidió OAuth extra).

**Por qué fallaba antes:**
- `/design-login` **no existe suelto** en el CLI (v2.1.138 ni la última 2.1.201; el changelog oficial no menciona design en ninguna versión). Ese comando lo aporta el connector → sin connector daba `Unknown command: /design-login`.
- El tool **DesignSync** (harness/Agent SDK) es OTRA cosa (push/sync de design-SYSTEMS); su error "needs design-system authorization, /design-login requires an interactive terminal" mandaba por una pista equivocada.
- El checkbox **"Download zip instead"** de la UI es el fallback explícito *"for agents without the Claude Design connector"*.
- `WebFetch` de `claude.ai/design/p/...` da **403** (privado). El import de Vercel exige URL **pública**.

**Caveats operativos:**
- Las tools MCP se cargan al **inicio de sesión** → tras agregar el connector hay que **REINICIAR** la sesión (Reload Window en Antigravity / reabrir el panel) para que aparezcan `mcp__claude-design__*`.
- Corre en **Antigravity** (fork de VSCode) vía Agent SDK; la sesión embebida es **no-interactiva** (no puede correr el OAuth de navegador por sí sola), pero el connector se auto-autentica con el login claude.ai existente.
- Config **compartida**: `~/.claude.json` (scope user); `CLAUDE_CONFIG_DIR` no seteado → terminal y extensión leen el mismo archivo, credenciales en `~/.claude/.credentials.json`.

**Issue relacionado:** [#69246](https://github.com/anthropics/claude-code/issues/69246) (18-jun-2026, OPEN) reportaba "connector cannot install" → quedó **desactualizado**: el endpoint ya existe y conecta.

**ACTUALIZACIÓN — VERIFICADO E2E (2026-07-04, sin reiniciar):** una vez concedido el scope (al agregar el connector), el tool **`DesignSync`** (harness, NO depende del connector cargado ni de reiniciar) accede a los canvases directo: `list_projects` + `get_project` + `list_files` respondieron los 3 **sin pedir auth**. Y funcionan sobre canvases normales (`type: PROJECT_TYPE_PROJECT`), no solo design-systems — corrige la creencia previa. **Método fijo para traer un diseño al repo sin zip:** `DesignSync get_file {projectId, path}` (cap 256 KiB/archivo) → escribir al repo. El connector `claude-design` cargado solo hace falta para el prompt literal "Send to local coding agent"; para que el agente traiga archivos, DesignSync alcanza. projectId de ejemplo (canvas Copiloto): `1c759375-0d71-427e-b951-eacc4a81faee`.

El design que se estaba importando es el frontend del Copiloto Web. [[copiloto-emprendedor-roadmap]]
