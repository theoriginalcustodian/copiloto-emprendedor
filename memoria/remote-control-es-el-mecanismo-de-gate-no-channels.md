---
name: remote-control-es-el-mecanismo-de-gate-no-channels
description: "Remote Control (nativo, no Telegram) es el mecanismo verificado para \"avisame cuando la sesión necesite una decisión y dejame responder desde el teléfono\" (desde 2026-09-21 NO arranca solo: se activa por sesión con /remote-control)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 296d4a41-3521-4088-abf8-5d3913a0eb9d
  modified: 2026-09-21T12:21:20.000Z
---

**Contexto:** el pedido original era "cuando una sesión larga llegue a un punto de decisión
crítica, avisame por Telegram con botones tipo unreal-copilot y que mi respuesta la continúe".
Se investigaron 3 caminos — ver [[telegram-composio-canal-operador]] para el primero (Composio,
fire-and-forget, ya operativo vía skill `avisar-telegram`).

**Hallazgo clave (2026-08-18):** el mecanismo nativo **Remote Control** de Claude Code resuelve
el caso de uso real mejor que replicar el patrón de unreal-copilot con Telegram:

- `AskUserQuestion` y permission prompts quedan abiertos y se reenvían automático al teléfono
  (app Claude / claude.ai/code) — no hace falta construir nada, es comportamiento nativo.
- **Verificado end-to-end en esta sesión**: el operador respondió literalmente desde el teléfono
  y el mensaje llegó a la MISMA sesión (continuidad real confirmada, no una sesión nueva).
- Setup: `/remote-control` en el chat (no es una tool invocable por el agente, sólo el operador
  puede tipearlo) + `/config agentPushNotifEnabled=true inputNeededNotifEnabled=true` (activa
  "Push when Claude decides" y "Push when actions required" — en este harness `/config` sin
  argumentos NO abre menú interactivo, hay que pasar `key=value` directo).

**Gotcha de verificación — el gate de presencia hizo parecer roto algo que andaba bien:**
`PushNotification` devuelve `"Not sent — this terminal is active..."` mientras la ventana de
Claude Code/Antigravity esté **enfocada y con tipeo activo** en la PC — NO mientras "la ventana
siga abierta en pantalla". Doc oficial (`code.claude.com/docs/en/remote-control`, sección Mobile
push notifications): *"skips mobile push notifications while you are typing in or focused on the
connected terminal... `CLAUDE_CLIENT_PRESENCE_FILE` extiende esto a 'incluso en otra ventana'"* —
la mención explícita de "even in another window" como extensión OPCIONAL confirma que el default
NO bloquea sólo por dejar la ventana abierta sin foco. Caso real: dejar una sesión larga corriendo
y alejarse (perder el foco de esa ventana) es exactamente la condición donde el push está pensado
para dispararse, no para frenarse. Sólo se frena si en el instante del push el operador está
literalmente tipeando/enfocado ahí. Confirmado empíricamente: el único intento que devolvió
`"Mobile push requested"` (no "not sent") fue cuando el operador dejó de tener foco en la PC al
pasar a responder desde el celular.

**Por qué Channels (plugin oficial de Telegram) NO sirve en este harness:** verificado leyendo
el proceso vivo (`claude.exe --output-format stream-json ... --permission-mode auto`, sin
`--channels`) — la extensión de Antigravity/VSCode lanza `claude.exe` con un set de flags fijo
que NO expone `--channels`, y no hay ninguna de las 14 settings `claudeCode.*` de la extensión
que lo permita. `--channels plugin:telegram@claude-plugins-official` sólo puede activarse en una
terminal `claude` pura, fuera de la integración de la IDE — sesión distinta a las de trabajo
diario en Antigravity. El plugin quedó instalado y pareado (`access.json` con
`allowFrom: ["<chat_id del operador>"]`) pero sin uso práctico salvo que el operador abra esa terminal aparte
a propósito.

**Conclusión operativa:** para el caso "avisame y dejame decidir desde el teléfono", usar
Remote Control (ya confirmado). Para "avisame aunque no pueda responder ahí" (fire-and-forget),
usar la skill `avisar-telegram` (Composio, [[telegram-composio-canal-operador]]). Channels/Telegram
nativo queda documentado pero no es el camino recomendado dentro de Antigravity.

**Arquitectura final decidida (2026-08-19):** combinar los dos mecanismos, no elegir uno solo —
`avisar-telegram` (Composio) para el AVISO ("revisá la sesión"), Remote Control para la RESPUESTA/
decisión desde el teléfono. Motivo: el push nativo de Remote Control nunca se confirmó
visualmente en el banner del celular (sólo el lado tool-side "Mobile push requested"), mientras que
Telegram round-trip de salida (bot Composio → chat del operador) se re-verificó `ok:true` recién
(`message_id: 11`) y es 100% confiable como aviso. Telegram NO reemplaza a Remote Control para
responder: se intentó contestar por Telegram al plugin Channels (`mcp__plugin_telegram_telegram__reply`)
y el mensaji de vuelta nunca llegó a esta sesión — ver hallazgo de Channels abajo.

**Hallazgo nuevo (2026-08-19) — por qué Channels no sirve ni para el caso simple:** el plugin
Telegram nativo (`plugin:telegram:telegram`, tools `mcp__plugin_telegram_telegram__*`) puede estar
"disponible" (tools listadas, `reply` funciona de salida) sin que el canal esté realmente atado a
la sesión — se verificó con 4 procesos `bun` corriendo el plugin (huérfanos, `bot.pid` no coincidía
con ninguno) pero la sesión activa (`claude.exe`, sin `--channels`) nunca recibió la respuesta del
operador al mensaje de prueba. El puente Channels se ata a la sesión SÓLO al arrancarla con
`--channels`; no hay forma de engancharlo después a una sesión ya corriendo. Refuerza por qué
`avisar-telegram` (Composio, HTTP directo, sin dependencia de sesión) es la vía sólida para avisos.

**Actualización 2026-09-21 — Remote Control ya NO arranca solo (pedido del operador).**
`remoteControlAtStartup` pasó a `false` **explícito** en `~/.claude/settings.json`. Consecuencia
operativa: el gate "decidí desde el teléfono" descrito arriba **ya no está encendido por default en
cada sesión** — hay que activarlo a mano con `/remote-control` (sólo lo puede tipear el operador) en
las sesiones largas donde se lo quiera. No asumir que una sesión nueva tiene el puente activo: si el
plan depende de la respuesta desde el teléfono, verificarlo o pedírselo al operador.
- **Por qué `false` y no borrar la clave:** con la clave ausente decide un default de org/GrowthBook
  (`A3e()`, hoy `false` pero remoto: puede cambiar) y la extensión suma su propio gate
  `tengu_ide_rc_auto_enable` (prendido en esta cuenta). Sólo el `false` explícito es determinista.
- **Verificado** con `~/.claude/scripts/probe_rc_autoenable.py <versión-de-la-extensión>`: antes `true`,
  después `false` en 2.1.273 y 2.1.278. Ese script responde "¿la IDE arranca Remote Control acá?" sin
  abrir una sesión. Detalle: `~/.claude/HARNESS.md` §8, entrada 2026-09-21.
- **Reactivar:** `true` en esa clave, o `/config` → "Enable Remote Control for all sessions".
