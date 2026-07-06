---
name: kaggle-temporal-overlay-spike
description: Spike VALIDADO (2026-06-15) — Kaggle como worker durable de Temporal vía túnel SSH (NO tailscale). Aprendizajes caros del via crucis de diagnóstico.
metadata: 
  node_type: memory
  type: project
  originSessionId: 4d6a1ae4-a666-4949-a0f8-50562fb65826
---

# Kaggle ↔ VPS Temporal — worker durable gratis (spike PASS 2026-06-15)

## ✅ UPDATE 2026-06-16 (II) — IterativeCodeWorkflow (loop auto-corregido) VALIDADO E2E + 2 bugs de raíz cerrados
- **Spike `IterativeCodeWorkflow` PASS** (`spike-loop-3`, kernel **v26**): loop `implement→run_tests(pytest REAL en Kaggle)→diagnose→fix` hasta verde o `max_iters`. **`passed:true, iters:1`** encolado desde el VPS → el loop generó código buggy, lo testeó, diagnosticó, corrigió y pasó 6/6. Genera el util `extract_code`. Piezas nuevas en `agents_kernel.py`: workflow `IterativeCodeWorkflow` + activity `run_tests` + `_LOOP_STEPS` (prompts ricos parametrizables system+user por paso, override por trabajo via `req["steps"]`). Spike + evidencia (las 3 corridas): `kaggle/spike-diag/iterative/` (`RESULT.md`).
- **BUG 1 cerrado — `_strip_fences` truncaba código que contiene ` ``` ` interno.** El regex `` ```[^\n]*\n(.*?)``` `` tomaba los backticks DENTRO del código generado (ej. un fence-parser con `re.findall(r'```...```')`) como fence de cierre → truncaba a mitad de string → `SyntaxError` ×4 (Run 1). **Fix: anclar fences a inicio de línea** `(?ms)^[ \t]*```...```[ \t]*$` (los ` ``` ` internos van mid-línea). Regresión en `test_strip_fences.py` (5/5 local).
- **BUG 2 cerrado (IMPORTANTE — afecta TODO el pipeline, no solo el spike) — `infer` perdía el output de deepseek-r1.** La activity solo leía `message.content`; deepseek-r1 (modelo de razonamiento) deja `content` **VACÍO** y pone todo en `message.thinking`. Medido en la Temporal history: **content_len=0, thinking_len=6006, done=`length` AUN a num_predict=1500** → agota el budget razonando y nunca emite content. Sin esto el `diagnose` devolvía `""` → el loop NO convergía (Run 2, fix idéntico ×4). **Fix decisivo: `text = content or thinking`** (+ strip `<think>...</think>` inline + diag `content_len`/`thinking_len`/`done_reason` + num_predict diagnose 600→1500). ⚠️ El bump de tokens SOLO no alcanzaba (volvía a `done=length`); el fallback al thinking fue lo que rescató. **Esto RESUELVE el "abierto" del `plan.text` vacío del `planner`** (mismo reasoner). ✅ **VERIFICADO 2026-06-16** (`cw-verify-planner-1`, COMPLETED): el planner tenía el MISMO bug (content_len=0, done=length) y el fix lo rescató — `plan.text`=2833 chars (plan numerado real vía thinking), code correcto + review LGTM. ↳ APLICADO 2026-06-16 (commit `b86fffa`, kernel **v28**): `_STEP_DEFAULTS` planner+reviewer (AMBOS reasoner, cero deuda) num_predict 600→1500. ⚠️ Da MÁS razonamiento antes del corte, pero NO garantiza `done=stop` — deepseek-r1 puede pensar >1500 tok (el diagnose lo hizo en spike-loop-2: 6006 chars/done=length aun a 1500). La robustez la da el FALLBACK al thinking, no el budget. ✅ **VERIFICADO LIVE en v28** (`cw-verify-planner-2`, merge_intervals, COMPLETED): con 1500 el planner ahora termina `done=stop` con **content_len=2641** (plan limpio en CONTENT, ya NO fallback) · reviewer `done=stop` content_len=385. El bump logró el plan polido; el caveat "puede pensar >1500" sigue siendo cierto en general pero no disparó acá.
- Repo: rama `feat/spike-iterative-loop` **mergeada a `main` (FF, commit `dbccd47`) + pusheada a origin**. Kernel productivo en Kaggle = **v26**.

## ⚠️ UPDATE 2026-06-16 — autossh MATA Kaggle; fix = ssh simple; ROUNDTRIP E2E CERRADO contra el agentic
- **CAUSA RAÍZ del exit 137 que impedía el E2E contra el VPS agentic = `autossh`.** Kaggle lo detecta (anti-abuse) y mata la sesión ~30-40s tras abrir el túnel, durante el setup, sin importar la fase. Probado: aislamiento SIN túnel sobrevivió >223s + selftest OK; fix con ssh simple sobrevivió + roundtrip COMPLETED. NO era throttle (solo 2 corridas), NO era el permitopen.
- **FIX aplicado a `agents_kernel.py`: `autossh` → `ssh` simple** en `_start_tunnel`. Se pierde el reconnect intra-sesión, pero la durabilidad cross-corte la da Temporal, no el túnel. Spikes de diagnóstico desechables: `kaggle/spike-diag/` (`isolation_kernel.py` + `ssh_simple_kernel.py`).
- **ROUNDTRIP E2E CERRADO** (lo que figuraba "pendiente/throttleado"): `vps-roundtrip-1` encolado DESDE EL VPS → worker Kaggle (ssh simple) → `CodeTaskWorkflow` Planner→Impl→Review → **COMPLETED (2m4s)**, código correcto devuelto. tok/s: coder 20.1 · reasoner 15 / 12.9. Luego el **notebook PRODUCTIVO `multiagent-coder-temporal` v14** (ya con ssh simple) validado igual E2E: `vps-prod-roundtrip-1` COMPLETED desde el VPS. ⚠️ El push por API NO aplica GPU/Internet (UI-only) → al correr el productivo hay que activar GPU T4×2 + Internet ON + Secret en la UI.
- **permitopen del VPS vivo estaba OK** (`127.0.0.1:7233`); el "drift al fiscal" era solo el DEFAULT del script `setup-ssh-tunnel-user.sh` (corregido a `127.0.0.1:7233`).
- **El "PASS 2026-06-15" de abajo fue el spike FISCAL (ssh simple); contra el AGENTIC el kernel v2 (autossh) NUNCA había pasado el setup** hasta este fix.
- ✅ RESUELTO 2026-06-16 (ver UPDATE II arriba): `deepseek-r1` devolvía `plan.text`/`diag` vacío (todo el razonamiento en el canal `thinking`, `content` vacío) → fix en `infer`: `text = content or thinking`. ✅ Planner VERIFICADO 2026-06-16 (`cw-verify-planner-1` COMPLETED: tenía el mismo bug, el fix lo rescató).
- **Cache de reload (dataset) — seed INTEGRADO pero NO validado:** `_seed_from_dataset()` (glob `/kaggle/input/*/ollama_models` → symlink blobs/manifests) está en `agents_kernel.py` (notebook v15+). En la corrida del productivo dio **`==> sin cache attacheado -> pull normal`**: el output del builder `ollama-cache-builder` NO expone `ollama_models` en esa ruta (posible truncado por el límite de output de Kaggle ~20GB, o ruta de montaje distinta). **OPCIONAL — no afecta el E2E** (el productivo arranca con pull normal, `models_ready` ~176s). A afinar otro día: verificar el path real del Input + ajustar el glob, o usar 2 datasets de ~9GB / copia a working. Builder: `kaggle/spike-diag/kernel/ollama_cache_builder.py`.
- **InferWorkflow** (notebook **v18**): workflow nuevo en el kernel para **prompt directo a UN LLM** (coder|reasoner) con `{role, prompt, system?, temperature?, num_predict?}`, sin el flujo plan→code→review. Devuelve el dict de `infer`. Se encola por CLI (`temporal workflow start --type InferWorkflow --input '{...}'`); el MCP `start_code_task` sigue siendo solo para `CodeTaskWorkflow`. Requiere re-run del worker para registrarse.
- **`CodeTaskWorkflow` configurable** (notebook **v20**, commit `4fbe319`): `run(req)` admite `str` (defaults, backward-compat) o `dict {"task", "steps":{planner|implementer|reviewer:{role?,system?,temperature?,num_predict?}}}`. Flujo plan→code→review fijo; configurable role/system/params por paso.
- **Paralelismo:** 1 tarea por GPU = paralelo real. Para 2× throughput, encolar 2 `InferWorkflow` (uno coder + uno reasoner) a la vez. Mismo rol → se serializa. `CodeTaskWorkflow` es secuencial.
- **📖 Manual de inferencia: `docs/kaggle/MANUAL_INFERENCIA.md`** (commit `a78f665`) — los 3 modos, params, paralelismo, monitoreo, gotchas, recetario. LEER para usar los LLMs.
- **Repo: PR #2 MERGEADO a `main`** (merge `172e557`, rama borrada): fix autossh→ssh simple · seed · builder · `InferWorkflow` · `CodeTaskWorkflow` configurable · manual de inferencia. Sin cabos de repo abiertos.

**Objetivo del operador:** correr LLMs open (Qwen2.5-Coder 14B, DeepSeek-R1-Distill) en Kaggle (2×T4 gratis, 2 cuentas) como workers de Temporal para tareas de codificación largas. Soberanía, cero dependencia de APIs de pago. Decisión MAYOR del operador — Kaggle es el substrato elegido (rechazó serverless GPU pagas).

## Es la BASE REUSABLE de todo cuaderno Kaggle (plantilla vs cliente)
- **Plantilla (fija en todos):** túnel SSH (`VPS_SSH_KEY`) + worker Temporal conectado al VPS.
- **Cliente (variable por cuaderno):** qué LLM levanta (`llama.cpp`), en qué `task-queue` pollea, qué activities expone.
- Cada cuenta/cuaderno = misma plantilla + su modelo + su queue. El VPS Temporal orquesta a todos.
- Doc canónica: `docs/kaggle/` (README + SETUP_NEW_WORKER + TROUBLESHOOTING) + ADR-011.

## Arquitectura validada (la que FUNCIONA)
Worker en Kaggle **disca OUTBOUND por túnel SSH** al VPS y conecta a `localhost:7233 → 10.10.0.2:7233` (frontend Temporal privado). El worker pollea la task-queue; los workflows se disparan desde el VPS. Patrón pull canónico de la industria (control-plane always-on + worker efímero).

- VPS user `kaggle-tunnel` con key ed25519 BLOQUEADA: `restrict,port-forwarding,permitopen="10.10.0.2:7233"` (sin shell, solo ese forward). Setup idempotente: `kaggle/spike/setup-ssh-tunnel-user.sh`.
- Kernel: `kaggle/spike/kernel/spike_kernel.py` (lee key del Kaggle Secret `VPS_SSH_KEY` en base64, abre `ssh -N -L`, corre worker Python). Estructura sandbox-safe (defs al top, imperativo en `__main__`, import-guard de temporalio).
- Params no-secretos en `.claude/settings.local.json` env (VPS_TEMPORAL_HOST, etc.). La private key vive SOLO en el Kaggle Secret (el classifier bloquea escribirla a disco/dataset/kernel — correcto).

## Aprendizajes caros (NO repetir el via crucis)
1. **Kaggle MATA tailscale (~31s, exit 137 CANCEL).** Probado por eliminación: baseline CPU y GPU+internet sobreviven 4min; solo la VPN dispara la muerte. NO usar tailscale/VPN-mesh en Kaggle. Usar SSH outbound (conexión normal, no la mata). headscale quedó montado en el VPS (ADR pendiente: desmontar o dejar inerte — ver cleanup).
2. **Kaggle Secrets son UI-only.** No se crean/attachean por API. Las corridas **pusheadas por API NO llevan el Secret** → siempre fallan en `get_secret`. La corrida que necesita el Secret se dispara desde el UI (**Save & Run All**). Yo entrego el código por API push; el operador hace el run UI.
3. **El Secret debe estar ATTACHEADO (toggle ON) al notebook**, no solo creado. Error si no: `BackendError: No user secrets exist for kernel id ... and label X`.
4. **Workflow-sandbox de Temporal re-importa el módulo** → defs deterministas al top-level, TODO lo imperativo (pip, secret, ssh) bajo `if __name__=="__main__"`. Si no: `RestrictedWorkflowAccessError`.
5. **Batch "Save & Run All" NO idle-killea**; corre hasta 9h. Las cancelaciones tempranas eran tailscale, no batch. Heartbeat de stdout igual recomendado (liveness + defensa).
6. **AUP de Kaggle prohíbe "server farming"** → OK en desarrollo/experimentación; para producción 24/7 del negocio es riesgo de ban (revisar el día de prod, no antes).

## Cómo observar (sin depender del log de Kaggle, que no committea en cancel)
Desde el VPS: `docker exec temporal-admin-tools temporal task-queue describe --task-queue spike-kaggle ...` (poller fresco = worker vivo) + `temporal workflow execute ...` para disparar.

## Spike de modelos — PASS 2026-06-15 (runtime = OLLAMA, no llama.cpp)
`spike-models/kernel/coder_spike_kernel.py` + notebook Kaggle `theoriginalcustodian/spike-coder-temporal`. E2E PASS: túnel → worker → activity `call_coder` → Ollama (Qwen2.5-Coder 14B Q4 en GPU) → código correcto vía Temporal. Resultado: **gen 7.85 tok/s** (puro), load 39s, VRAM 7.8GB×2.
Aprendizajes caros (Ollama + Kaggle):
1. **llama.cpp from-source NO compila en Kaggle** (CMake 3.22 no halla `CUDA::cuda_driver`/stub). → usar **Ollama** (trae libs CUDA, cero compile, ES llama.cpp adentro, API OpenAI-compat + nativa).
2. **NO setear `CUDA_VISIBLE_DEVICES`** en `ollama serve`: en Kaggle rompe la detección de GPU → corre en CPU (~1 tok/s, VRAM 0). Sin CDV usa ambas T4 (pero split sin NVLink = lento).
3. El install nuevo de Ollama requiere **`zstd`** (apt). El warning "Unable to detect NVIDIA GPU / lspci" es cosmético (igual usa GPU).
4. **GGUF de HF está sharded** → `ollama pull hf.co/...` falla (issue #5245). Usar la **registry de Ollama** (`qwen2.5-coder:14b`, `deepseek-r1:14b`).
5. **Medir tok/s con la API nativa** (`/api/chat` → `eval_count`/`eval_duration`), NO con wall-time: el cold-load (~40s) contamina la métrica OpenAI-compat.
6. **`id_reuse_policy=TERMINATE_IF_RUNNING`** en el BootstrapWorkflow para re-runs (si no: `WorkflowExecutionAlreadyStartedFailure`).
7. **BootstrapWorkflow** (signals por fase + query `status`) = observabilidad del arranque desde el VPS, durable aunque Kaggle cancele. Patrón canónico de la plantilla.
8. Push del kernel por API con `mcp__kaggle__save_notebook` (slug=`owner/slug`, QuickSave). El Secret sigue UI-only; el accelerator se resetea (re-elegir T4×2 en UI).

## Sistema multi-agente — PASS 2026-06-15 (2 LLMs, 1 por GPU)
`system/kernel/agents_kernel.py` + notebook Kaggle `theoriginalcustodian/multiagent-coder-temporal`. PASS E2E: 2 instancias Ollama pineadas, workflow `CodeTaskWorkflow` Planner(reasoner)→Implementer(coder)→Reviewer(reasoner) corrió completo.
- **Pinning resuelto**: 2 instancias `ollama serve` en puertos distintos (coder :11434 GPU0, reasoner :11435 GPU1), cada una con `CUDA_VISIBLE_DEVICES=<UUID>` (de `nvidia-smi --query-gpu=uuid`). **El índice numérico manda a CPU; el UUID funciona** (cada instancia ve su GPU como CUDA0). Mismo `OLLAMA_MODELS`. `num_ctx=8192` acota el KV para que entre en 1 T4.
- **tok/s 1-por-GPU**: coder 19.97 · planner(reasoner) 15.14 · reviewer 17.9. VRAM 10GB+10GB (sin split, vs 7.85 split). load ~37-39s por modelo (1ra inferencia).
- Modelos: `qwen2.5-coder:14b` + `deepseek-r1:14b` (Q4_K_M, registry Ollama).
- **Re-apuntado (F2) al Temporal AISLADO de la plataforma agéntica [[plataforma-agentica-estado]]**: kernel `agents_kernel.py` → VPS `unreal-copilot` (178.105.191.1), task-queue **`coding-agents`** (ya NO el VPS fiscal). El **roundtrip contra el VPS agentic CERRÓ el 2026-06-16** (fix autossh→ssh simple — ver UPDATE arriba). El bloqueante no era throttle: era `autossh`.

## Bloque 1 — durabilidad de jornada HECHO 2026-06-15 (PR #20 en main, kernel v2)
Operación 6h/día L-V. En `agents_kernel.py`: **ssh simple** (autossh REMOVIDO 2026-06-16: mataba Kaggle con exit 137 — ver UPDATE arriba) · activities `infer` con `schedule_to_close=18h` + retry ilimitado → **el workflow cruza el corte de jornada** (worker muere → la activity la retoma el worker del día siguiente; Temporal guarda estado) · jornada auto-cerrada (`JORNADA_HORAS=5.8`, graceful shutdown + libera sesión) · guard L-V (`WEEKDAY_GUARD`). Env overridables: JORNADA_HORAS/WEEKDAY_GUARD/RUN_SELFTEST.
- **Arranque automático = scheduler NATIVO de Kaggle** (UI, lleva el Secret; los runs por API NO llevan Secret). Control desde VPS = CLI/MCP (encolar/monitorear/cancelar). Encender on-demand desde VPS requeriría key en dataset privado (pendiente, solo si se necesita). Decisión del operador: híbrido (scheduler nativo + control VPS), key segura en Secret.
- **Resume tras corte: garantía nativa Temporal — VALIDAR en el 1er corte real** (no afirmado aún).
- Doc: `docs/kaggle/MULTIAGENT_SYSTEM.md` §8.

## Operación de jornadas (cómo se enciende/controla — estado real)
- **Arranque diario L-V = scheduler NATIVO de Kaggle** (UI → Schedule, daily). Es el único modo que lleva el Secret `VPS_SSH_KEY` (los runs por API push NO lo llevan). Falta: el operador agenda el notebook una vez en la UI (handoff abierto).
- **Control desde el VPS = CLI/MCP de Kaggle** (encolar tareas / monitorear / cancelar). Falta opcional: instalar Kaggle CLI/MCP en el VPS (necesita `kaggle.json` del operador).
- **Encender on-demand desde el VPS NO está implementado** — requeriría la key en un dataset privado; diferido (solo si se necesita). Decisión del operador: híbrido scheduler-nativo + control VPS, key segura en Secret.
- Guard L-V salta findes UTC; para probar en finde correr con env `WEEKDAY_GUARD=0`.

## Pendiente / próximo (bloques siguientes)
- Bloque 3: workflow real `ImplementFeatureWorkflow` (plan JSON multi-step + loop Reviewer→Implementer + RunTests + branch Git + PR).
- Bloque 4: contexto + auditoría (Graphity/Context7) + persistencia de artefactos.
- Bloque 5: 3er modelo (Tester 7B) en 2da cuenta Kaggle.
- **VALIDAR resume tras corte en el 1er corte real de jornada** (garantía nativa Temporal — implementada en kernel v2 pero NO validada empíricamente aún). Test dedicado posible: encolar tarea con worker apagado → confirmar que la toma al arrancar.
- Tests del propio `agents_kernel.py` (PoC sin tests).
- Handoff operador: agendar notebook en scheduler nativo Kaggle + (opcional) Kaggle CLI/MCP en VPS.
- Cleanup: rotar secrets expuestos en chat (headscale preauth viejo, SSH key base64). Decidir desmonte de headscale/tailscale del VPS (firewall 443, subnet router, relay socat 100.64.0.1:7233).
- Código del spike (`spike/kernel/`) es DESECHABLE — reescribir con tests al promover. (autossh fue REMOVIDO del kernel v2 el 2026-06-16: mataba Kaggle — fix = ssh simple.)
