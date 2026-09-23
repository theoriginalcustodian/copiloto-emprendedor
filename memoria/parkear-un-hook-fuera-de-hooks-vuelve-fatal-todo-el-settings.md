---
name: parkear-un-hook-fuera-de-hooks-vuelve-fatal-todo-el-settings
description: "Desde Claude Code 2.1.263 una estructura con forma de hook declarada fuera de la clave hooks del settings.json es error FATAL y descarta el archivo ENTERO (permissions, model, env, mcpServers); el prefijo _disabled_ no exime"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8b5cec24-e927-4e15-a1ea-972f46bd715e
  modified: 2026-09-08T13:06:22.835Z
---

Detectado el 2026-09-08 investigando el banner *"PreToolUse/PermissionRequest hooks are declared
outside \"hooks\""* de `~/.claude/settings.json`.

**El mecanismo.** Claude Code 2.1.263 (extensión de Antigravity, instalada 2026-09-07) estrenó un
validador *fail-closed*: recorre **todas** las claves del settings hasta profundidad 3 y marca
`severity:"fatal"` si encuentra un objeto con `hooks: [...]` no vacío o con `matcher` **fuera** de la
clave `hooks`. El nombre de la clave **no importa** — un prefijo `_disabled_` no exime (sólo se saltea
una whitelist: `mcpServers`, `env`, `pluginConfigs`, `skillOverrides`, `lspServers`, `enabledPlugins`,
`extraKnownMarketplaces`, `managedMcpServers`, `modelSettings`). Y `fatal` no descarta la clave
ofensora: descarta el **archivo entero** (`settings: null`).

**Por qué importa más de lo que dice el banner.** Lo que quedó sin aplicar ~24 h no fueron "los
hooks": fueron los 12 `permissions.deny` (force-push ×5 formas + `.env` del repo público — repuestos
justamente porque en `bypassPermissions` sólo sobrevive `deny`,
[[en-bypasspermissions-solo-sobrevive-permissions-deny]]), el headless gate `Agent|Task` en `deny`,
`autoMode`, `model`, `statusLine`, `env` y `mcpServers`. Un guardarraíl silenciosamente apagado por
una clave inerte que llevaba 4 semanas ahí sin molestar.

**El patrón general, más allá de este bug.** Parkear config muerta *dentro* del archivo vivo, con un
prefijo como marca de "esto no cuenta", asume que el consumidor comparte tu convención. No la
comparte: para él sigue siendo una clave del archivo. El parking lot va a un **archivo aparte**.
Corolario del mismo día: el binario de la extensión puede adelantarse al standalone de `~/.local/bin`
(2.1.235, sin el check) — un settings válido para uno puede ser fatal para el otro, así que el
diagnóstico se hace con **el binario que la sesión realmente corre**.

**Why:** un archivo de config rechazado entero no avisa qué protecciones se cayeron; el banner nombra
los hooks y calla que también se fueron los `deny`. Y el fallo lo introduce un update del binario, no
un cambio propio: el settings "que venía andando" se rompe solo.

**How to apply:**
- En `settings.json` nunca parkear algo con forma de hook (objeto con `hooks:[...]` o `matcher`) fuera
  de `hooks`, ni con prefijo `_disabled_`. Sidecar: `~/.claude/hooks-disabled-pending-audit.json`.
- `claude doctor` es el instrumento: reporta `Invalid settings` con el path exacto y no necesita
  sesión. Correrlo tras cualquier edición del settings global y tras cada update del binario.
- Para aislar la clave culpable: copiar el settings a variantes en un dir temporal y correr
  `CLAUDE_CONFIG_DIR=<variante> claude doctor` sacando una clave por vez. Leer el JSON "a ojo" no
  distingue cuál de dos claves parecidas dispara (acá `_disabled_UserPromptSubmit_hooks` **no**
  disparaba, y es la que usa `toggle_suggesters.py`).
- Detalle completo del incidente: `~/.claude/HARNESS.md` §8, entrada 2026-09-08.
