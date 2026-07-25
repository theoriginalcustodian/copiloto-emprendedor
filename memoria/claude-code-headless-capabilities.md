---
name: claude-code-headless-capabilities
description: "Qué soporta `claude -p` headless (el arquitecto de la fábrica FeatureWorkflow) — effort levels, /goal, sub-agentes ✅; ultracode ⚠️. Verificado empírico contra el CLI real."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 2482606c-a89b-44ac-a311-eae9c7d7e344
---

Verificado empíricamente el 2026-06-20 contra el CLI real (`claude --help` + spikes en dir de juguete), **versión 2.1.138**. Relevante porque el `FeatureWorkflow` de la casa usa `claude -p` headless como arquitecto E2E ().

**Qué soporta el modo headless (`claude -p`):**
- **Effort levels** `low/medium/high/xhigh/max` vía `--effort` ✅ (literal del `--help`).
- **`/goal`** ✅ — spike: condición NO cumplida → el goal-loop creó el archivo y salió `success` (3 turns). También funciona con condición pre-cumplida (la verifica). Corrige la duda inicial "¿anda en headless?": sí. **NO es exclusivo del headless:** `/goal` también existe en la sesión **interactiva** del IDE (Antigravity/code-server) — fija un Stop hook session-scoped que bloquea el cierre hasta cumplir la condición (operador lo confirmó 2026-06-21; yo había inferido mal que era solo headless).
- **Sub-agentes** ✅ — `--agents <json>` (define inline), `--agent <x>`, subcomando `agents`, y el tool `Agent` (ex `Task`) auto-aprobable con `--allowedTools`.
- **ultracode** ⚠️ — `--settings '{"ultracode":true}'` se **acepta** (exit 0) pero su **activación NO es comprobable** por medios mínimos: CC ignora keys de settings desconocidos en silencio (un key falso pasa igual), el evento `init` no expone effort/ultracode, y `--debug api` no emite en `-p`. Además el headless corrió en **`claude-opus-4-7[1m]`** (no 4.8); la doc decía que ultracode requiere Opus **4.8+** → posiblemente **inerte** en este setup. Confirmar exigiría tarea sustantiva + observar orquestación, no-mínimo.

**Caveats de costo/diseño (clave para la fábrica):**
- Cada `claude -p` = **sesión fresca aislada** (sin memoria cross-call salvo `--resume`/`--session-id`), output **buffereado** (sin streaming), sin interactividad mid-flight (no `AskUserQuestion`).
- ⚠️ **CORRECCIÓN 2026-07-25:** la línea original decía *"headless tira de un pool de tokens
  separado, a tarifa API"* como si fuera propiedad **inherente** de `-p`. Es falso en general —
  **`claude -p` usa la MISMA auth OAuth/Max de la sesión por default**; sólo `--bare` fuerza
  API-key-only (`claude --help` lo confirma: *"OAuth and keychain are never read"* con `--bare`,
  implícitamente sí se leen sin él). Los **~$0.27–0.44/invocación** medidos acá fueron con el
  arquitecto de `unreal-copilot` corriendo **con API key a propósito**, para aislar costo de un
  pipeline autónomo — una decisión de diseño de ESE sistema, no un costo de `-p` en sí. Ver
  [[subagentes-van-headless-no-inline-en-la-terminal]] para el reverificado y el comando sin `--bare`.
- Como Claude ya **domina el costo de la fábrica (~335×** vs DeepSeek), habilitar `/goal` o fanout de sub-agentes en el arquitecto headless **con API key** multiplica ese costo → palanca de diseño con precio SI se elige `--bare`/API key; con OAuth por default, no aplica el mismo freno.

Flags headless útiles confirmados en el `--help`: `--output-format json|stream-json`, `--json-schema`, `--max-budget-usd` (cap de gasto), `--fallback-model`, `--allowedTools`, `--permission-mode`, `--resume`/`--session-id`. (`--bare` rompería la auth Max — usa solo API key.)
