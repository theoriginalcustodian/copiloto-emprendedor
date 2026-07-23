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
- Headless tira de un **pool de tokens separado** del interactivo, a **tarifa API**: los spikes triviales costaron **~$0.27–0.44 por invocación**.
- Como Claude ya **domina el costo de la fábrica (~335×** vs DeepSeek), habilitar `/goal` o fanout de sub-agentes en el arquitecto headless **multiplica** ese costo → palanca de diseño con precio, no feature para prender por default.

Flags headless útiles confirmados en el `--help`: `--output-format json|stream-json`, `--json-schema`, `--max-budget-usd` (cap de gasto), `--fallback-model`, `--allowedTools`, `--permission-mode`, `--resume`/`--session-id`. (`--bare` rompería la auth Max — usa solo API key.)
