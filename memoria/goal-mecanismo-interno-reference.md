---
name: goal-mecanismo-interno-reference
description: Funcionamiento interno COMPLETO del comando /goal de Claude Code (reverse-engineered del binario) + los 5 tipos de hook.
metadata: 
  node_type: memory
  type: reference
  originSessionId: 0666035b-9107-4ea7-8a8f-e93aafdec06e
---

**`/goal` de Claude Code = un Stop hook tipo `prompt` (session-scoped) cuyo `prompt` ES la condición.** Reverse-engineered de `claude.exe` **2.1.138** (binario Bun, JS legible). **Reporte COMPLETO de punta a punta** (código real + prompts textuales + tabla de símbolos minificados + canibalización): **`docs/research/2026-06-21-goal-mecanismo-completo-reverse-engineering.md`**.

**Mecanismo en 6 puntos:**
1. `/goal <cond>` → `WrH()` registra sessionHook `{event:"Stop", type:"prompt", prompt:cond}` + `setActiveGoal({condition, iterations:0, setAt})` + inyecta mensaje-directiva + arranca turno. Estado `activeGoal={condition, iterations, setAt, lastReason}`. Límite **4000 chars**. Aliases de clear: `clear/stop/off/reset/none/cancel`. Detrás del feature flag **`tengu_maple_tide`** (default false en 2.1.138 → explica el "requiere 2.1.139+").
2. **Tras cada turno**, el handler `k0_` evalúa: arma `[transcript_truncado, userPrompt]`, modelo = `hook.model ?? small fast model (Haiku)`, timeout 30s, **`tools:[]`, `thinkingConfig:disabled`, `outputFormat:json_schema {ok:bool, reason:string}`** (salida estructurada forzada).
3. User prompt (Stop): *"Based on the conversation transcript above, has the following stopping condition been satisfied? Answer based on transcript evidence only. Condition: {cond}"*. System prompt: *"You are evaluating a stop-condition hook… judge whether the condition is satisfied… JSON {ok:true,reason:<quote evidence>} | {ok:false,reason:<what's missing>}… ante duda {ok:false,'insufficient evidence in transcript'}"* (anclado a evidencia, conservador).
4. **`ok:false` → `blockingError` con `preventContinuation:!isStop` (=false para Stop) → el agente SIGUE otro turno** con `reason` como guía; `iterations++`, `lastReason` guardado. **`ok:true` → remove hook + `setActiveGoal(undefined)` → PARA**, telemetría `tengu_goal_achieved`.
5. **Anti-loop**: NO hay contador máx; converge cuando el evaluador dice `ok:true`. Acotar = meter `… or stop after N turns` en la condición (lo juzga el evaluador). Errores del evaluador (API/JSON/schema) = `non_blocking_error` (no frena, fail-open). Resume restaura la condición pero resetea iterations/timer.

**Los 5 tipos de hook** (`discriminatedUnion("type")`): `command` (shell; tiene **`asyncRewake`+exit2** = despierta al agente), **`prompt`** (LLM juzga transcript→`{ok,reason}`, lo que usa /goal), **`agent`** (sub-agente CON tools que EJECUTA y verifica — ej "Verify that unit tests ran and passed", llama un tool `{ok,reason}` al final), `http` (POST), `mcp_tool`.

Relacionado: [[claude-code-headless-capabilities]].
