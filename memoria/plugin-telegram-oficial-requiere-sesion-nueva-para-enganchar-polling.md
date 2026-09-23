---
name: plugin-telegram-oficial-requiere-sesion-nueva-para-enganchar-polling
description: "el plugin oficial telegram de Claude Code no consume mensajes entrantes si el MCP server no fue enganchado como tool activa desde el arranque de la sesión — verificar con getUpdates directo, no con `claude mcp get`"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 6d98c0f9-8ec9-4e7f-ab3c-9612d4de8445
  modified: 2026-08-18T18:27:38.623Z
---

**Qué pasó (2026-08-18):** el operador mandó 4 mensajes de prueba al bot
`@Claude_Code_David_Composio_bot` desde Telegram. `claude mcp get plugin:telegram:telegram`
reportaba `✔ Connected`, pero los 4 mensajes seguían apareciendo como no consumidos en
`getUpdates` de la API real de Telegram — ninguno llegó a la sesión.

**Causa raíz:** el servidor del plugin (`~/.claude/plugins/cache/claude-plugins-official/telegram/<ver>/server.ts`)
usa `StdioServerTransport` — el proceso `bun server.ts` vive atado al stdin de la sesión que lo
carga como MCP server, y su loop de polling (`bot.start()`) corre *dentro* de ese mismo proceso.
`claude mcp get`/`list` sólo hace un handshake puntual (abre, verifica el protocolo MCP, listo);
no prueba que el proceso siga vivo ni que su `bot.start()` haya arrancado. El proceso escribe
`~/.claude/channels/telegram/bot.pid` como primera acción real — si ese archivo no existe, el
polling nunca arrancó, sin importar lo que diga `mcp get`.

**Cómo se verificó (no autoevaluación):**
1. `curl https://api.telegram.org/bot<token>/getUpdates` — mensajes seguían en la cola.
2. `cat ~/.claude/channels/telegram/bot.pid` — no existe.
3. Lanzar `bun server.ts` suelto en background — muere en <1s ("shutting down"), porque sin un
   cliente MCP real alimentando stdin, Node ve EOF inmediato y dispara el handler
   `process.stdin.on('end', shutdown)`.
4. `ToolSearch` por las tools del plugin (`reply`, `react`, `download_attachment`, `edit_message`)
   — no aparecían cargadas en la sesión activa, confirmando que el server nunca quedó enganchado
   al toolset real, sólo listado en config.

**Cómo aplicar:** para verificar si el plugin oficial de Telegram está realmente escuchando, NO
confiar en `claude mcp get`/`list` (falso positivo). Verificar con:
- `getUpdates` directo contra la API de Telegram (¿la cola se vacía?)
- existencia y freshness de `~/.claude/channels/telegram/bot.pid`
- si las tools del server (`reply`, `react`, etc.) aparecen vía `ToolSearch` en la sesión activa

El fix esperado es simplemente **abrir una sesión nueva de Claude Code con el plugin `telegram`
habilitado** — el arranque normal del harness debería enganchar el MCP con stdin real desde el
principio, a diferencia de un `claude mcp get` puntual o un lanzamiento manual del script.

**Relacionado:** [[telegram-composio-canal-operador]] (el mecanismo alternativo vía Composio SÍ
es fire-and-forget por tool call, no depende de un proceso long-polling propio — no tiene este
problema). `access.json` del plugin oficial ya quedó correcto en
`~/.claude/channels/telegram/access.json` con `chat_id` del operador (valor fuera del repo) en `allowFrom` — el gap es
sólo el arranque del proceso, no la configuración de acceso.
