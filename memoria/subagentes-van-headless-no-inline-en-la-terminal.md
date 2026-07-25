---
name: subagentes-van-headless-no-inline-en-la-terminal
description: Directiva del operador — el trabajo de sub-agentes (Agent tool) interfiere escribiendo en la terminal de la sesión; despachar headless (claude -p, sesión aislada) en vez de inline
metadata:
  type: feedback
---

**2026-07-25, instrucción directa del operador:** *«los subagentes toman control de la sesión y
empiezan a escribir en la terminal esta, y la verdad es que interfieren en el desarrollo… para todo
lo que sea sub agentes usaremos headless, no inline.»*

**Qué cambia:** el `Agent` tool (aun con `run_in_background: true`) corre **dentro de esta misma
sesión/terminal** — su actividad se renderiza inline y compite visualmente con el trabajo del
operador en esa misma ventana. La alternativa es despachar como **proceso headless separado**
(`claude -p`, sesión fresca aislada — ver [[claude-code-headless-capabilities]] para flags y
verificación empírica del CLI), que no toca la terminal interactiva.

**Por qué importa acá en particular:** este repo ya vive en régimen de **3 sesiones paralelas**
sobre el mismo checkout (`coordinacion-tres-sesiones-buzon`) — el operador mira/usa la terminal de
esta sesión mientras trabaja, y el ruido de sub-agentes inline es justo el tipo de fricción que ese
régimen ya intenta minimizar.

**⚠️ CORRECCIÓN 2026-07-25 — mi primera versión de esta entrada afirmaba "tarifa API aparte" como
freno. Es FALSO en el caso general, corregido por el operador y reverificado empíricamente:**

```
$ echo $ANTHROPIC_API_KEY          → (vacío, no seteada)
$ claude auth status
{ "loggedIn": true, "authMethod": "claude.ai", "apiProvider": "firstParty",
  "subscriptionType": "max" }
$ claude --help | grep -A6 -- --bare
--bare   Minimal mode: ... Anthropic auth is strictly ANTHROPIC_API_KEY or
         apiKeyHelper via --settings (OAuth and keychain are NEVER read)...
```

**`claude -p` headless usa la MISMA auth OAuth/Max de esta sesión por default.** Sólo `--bare` fuerza
API-key-only — y nada de lo que se especifica acá usa `--bare`. La entrada vieja
([[claude-code-headless-capabilities]]) midió tarifa API en un contexto distinto: el arquitecto
headless de la fábrica `unreal-copilot`, que **elegía API key a propósito** para aislar costo de un
pipeline autónomo — una decisión de diseño de ESE sistema, no una propiedad inherente de `-p`.
Confundir "esa fábrica usa API key" con "headless cuesta API key" fue el error. Corregido: sin freno
de costo conocido para este caso.

**Sin verificar todavía (no asumir en ninguna dirección):** si el consumo de `claude -p` bajo OAuth
comparte el mismo pool de cuota semanal que la sesión interactiva, o es un balde aparte.

## Cómo aplicarlo — el comando concreto

Reemplaza `Agent(...)` por `Bash` con `run_in_background: true` (misma notificación async, sin
sleep-loop, sin renderizar inline):

```bash
claude -p "<prompt self-contenido, igual que a un Agent>" \
  --model haiku \                          # o sonnet/opus — misma regla de elección por tarea
  --output-format json \                   # parseable; --json-schema si necesitás schema forzado
  --allowedTools "Read,Grep,Glob" \         # el equivalente headless del glob exclusivo
  --permission-mode bypassPermissions \     # -p no tiene AskUserQuestion mid-flight — sin esto, cuelga
  --add-dir "<scope>" \
  > /path/al/output.json 2>&1
```

Mismo contrato que siempre: prompt self-contenido (no hereda el contexto del parent), scope
declarado (`--allowedTools`/`--add-dir` en vez de "glob exclusivo" en el prompt), output a archivo.

**Asentado en 4 lugares** (instrucción del operador: *«rotundamente inevitable ejecutarlo en todos
los repositorios»*) — detalle completo en [[gates-mecanicos-de-eficiencia-script-first-y-modelo-por-tarea]]:
`pretooluse_validate_agent.mjs` (regla 5, dispara SIEMPRE, no condicional) · `HARNESS.md` §1.3 (smoke
7/7) · `CLAUDE.md` global §"Sub-agentes van HEADLESS, no inline" (el `Agent` tool pasa de default a
excepción documentada — interactividad mid-flight, `Workflow` tool, o calibrar un prompt nuevo) ·
`ejecutar-con-eficiencia.md` Pilar 0 (no Pilar 2 — es el canal que reemplaza a 1-5, no uno más de la
lista).
