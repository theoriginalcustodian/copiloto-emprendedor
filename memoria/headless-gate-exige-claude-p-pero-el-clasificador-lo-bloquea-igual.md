---
name: headless-gate-exige-claude-p-pero-el-clasificador-lo-bloquea-igual
description: "El double-block headless (el proyecto exige `claude -p`, el clasificador lo bloquea) tiene causa raíz identificada el 2026-08-12: la extensión de VS Code ignora `permissions.defaultMode` y arranca todo en modo `auto`, donde un clasificador LLM juzga cada tool call contra la regla built-in 'Create Unsafe Agents'"
metadata:
  node_type: memory
  type: project
  originSessionId: 8f54fd09-ae88-47d9-812e-a0bb31aae0af
  modified: 2026-08-13T14:00:19.549Z
---

Diagnosticado a fondo el 2026-08-12 (barrido de 3.240 transcripts, 2,2 GB). La cadena causal
completa, verificada:

1. **La extensión de VS Code ignora `permissions.defaultMode`.** Está en la doc oficial:
   *"In a session the VS Code extension started, a settings-file `defaultMode` doesn't set the
   starting mode."* `~/.claude/settings.json` declara `bypassPermissions` desde hace meses y
   **nunca se aplicó**: las sesiones arrancan en `auto`. El setting que sí manda en la extensión
   es `claudeCode.initialPermissionMode`, en el `settings.json` de VS Code, más el toggle
   *"Allow dangerously skip permissions"*.
2. **En modo `auto` corre un clasificador LLM** (Sonnet 4.6) que juzga cada tool call. Su etapa 1
   está *"tuned to err on the side of blocking"* — por eso el bloqueo es **intermitente**: el mismo
   comando pasa o no según el contexto. No es una regla determinista y no tiene sentido buscarle
   el flag culpable.
3. **La regla que pega es `Create Unsafe Agents`** (soft_deny built-in, se lee con
   `claude auto-mode defaults`): *"Creating new autonomous agent loops that can execute arbitrary
   actions … without human approval (e.g. `--dangerously-skip-permissions`, `--no-sandbox`,
   disabling approval gates)"*. El patrón que el headless-gate prescribe **es literalmente esa
   regla**. Secundaria: `Auto-Mode Bypass (iii)`.
4. **El clasificador nunca se entera de que el hook lo pidió.** Recibe un transcript despojado:
   sólo mensajes del operador y tool calls — sin razonamiento del agente y **sin tool results**.
   El deny del hook es un tool result. Le habla al agente, no al clasificador.

**La magnitud real es mucho mayor que el headless:** 266 bloqueos del clasificador en agosto sólo
en este proyecto (229 Bash, 20 Edit, 5 Write, MCP). `claude -p` es 9 de esos. El headless era el
síntoma más visible, no el problema.

**Por qué rinde.** Corrige lo que esta misma nota afirmaba antes ("no hay combinación de reglas
propias que resuelva esto") — sí la hay, y es configuración soportada, no un truco: el bloque
`autoMode` en `~/.claude/settings.json` (`environment` para declarar la infraestructura propia,
`allow` con `"$defaults"` para las excepciones), y el modo de arranque vía
`claudeCode.initialPermissionMode`. Sin esto, cada sesión redescubre el bloqueo y lo racionaliza
como "hago la tarea a mano", pagando el contexto que el headless existía para ahorrar.
El 2026-08-14 `auto` pasa a ser el modo por defecto en Pro/Max/Team: sin configurar, empeora.

**Eran DOS capas independientes, y arreglar el modo NO arregla el hook** (cerrado 2026-08-13).
Los hooks **corren en todos los modos**: un `permissionDecision: "deny"` de hook bloquea igual en
`bypassPermissions`. Con el clasificador ya apagado, el gate seguía matando delegación por un bug
propio: la regla 5 leía `toolInput.run_in_background === true`, comparación estricta, así que la
llamada que **omite** el parámetro caía en el deny duro. Y omitirlo es el caso normal — el harness
dice *"Subagents run in the background by default"*, o sea el modelo no pasa un parámetro cuyo
default ya es el que quiere. Corregido a `!== false`: sólo el `false` explícito es inline.
Verificado 6/6 con banco de pruebas que corre el hook como subproceso, control positivo incluido
(inline sigue dando `ask`).

**Un `ask` en sesión autónoma es un `deny` con otro nombre.** Las reglas 1-4 del mismo hook
(modelo por tarea, scope exclusivo, output file) devolvían `ask`: con el operador presente es un
clic, en una corrida de horas es la sesión colgada esperando a nadie. Degradadas a advertencia por
stderr **cuando la llamada corre en background**; inline conservan el `ask`. Criterio general para
cualquier hook: sólo lo que evita un daño real —borrado, secreto expuesto, push destructivo— puede
frenar autónomo; lo de costo/estilo/convención informa, no bloquea.

**Auditoría de los ~30 hooks, 2026-08-13: hoy NADA activo cuelga una sesión autónoma.** Los tres
mecanismos no son equivalentes y confundirlos lleva a apagar lo que no molesta: sólo
`permissionDecision:"ask"` espera a un humano; `deny` rechaza la call y el agente se autocorrige en
el mismo turno; `{"decision":"block"}` de un hook `Stop` hace lo **opuesto** a colgar (fuerza a
seguir trabajando). Con `bypassPermissions`, los hooks son la única superficie que todavía puede
abrir un prompt. **El riesgo vivo son los 10 hooks `PreToolUse` DORMIDOS** desde el rollback de
emergencia del 2026-08-11 (nota en `settings.json:419`): todos usan `ask` real y **ninguno tiene
killswitch** — su única llave es seguir fuera de la clave `hooks`. El que causó el apagón,
`empirical_gate.mjs`, había estado en no-op toda su vida por un bug de schema; arreglado el 10-ago,
disparó ~10/día. Si se reactivan, de a uno y agregándoles sentinel+env var ANTES. De ~30
condiciones auditadas **una sola es seguridad real**: RLS faltante en
`supabase_migration_validator.mjs` (fuga entre tenants) — separarla de la regla G6 del mismo
archivo. Informe completo en `scratchpad/auditoria_hooks.md`.

**Botón de pánico del gate, verificado 3/3 el 2026-08-13** (con control negativo y restauración
del estado): si en medio de una corrida el headless-gate traba algo, hay dos vías de escape, las
dos funcionando — crear el archivo vacío `~/.claude/state/headless_gate_off`, o exportar
`HEADLESS_GATE_BLOCK=0`. Cualquiera de las dos desactiva la regla 5 entera. Tercera vía, más
quirúrgica, para los 3 casos legítimos de agente inline: agregar al prompt
`HEADLESS_EXCEPTION: interactividad` (o `workflow` / `calibrar`).

**Cómo aplicar.** (1) El detalle operativo y el contenido exacto de los 3 cambios está en
[[el-clasificador-no-lee-tool-results-como-consentimiento]] — leelo antes de tocar nada.
(2) Frente a un bloqueo del clasificador, la respuesta correcta es la que la propia denegación
indica: parar y explicarle al operador qué se intentaba y por qué hace falta. Reintentar por otra
vía es `Auto-Mode Bypass (ii)` — "taking a denial in bad faith and tunneling the same action
through a different path" — y está bien que esté bloqueado. (3) `/permissions` → pestaña
**Recently denied** muestra lo denegado y permite reintentar con `r`.
