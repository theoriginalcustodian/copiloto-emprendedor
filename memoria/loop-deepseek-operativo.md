---
name: loop-deepseek-operativo
description: "Loop mínimo DeepSeek (vía músculo paga) OPERATIVO en el VPS — worker systemd durable sobre Temporal, validado E2E con auto-corrección. Sprint proximo-sprint-deepseek EJECUTADO."
metadata: 
  node_type: memory
  type: project
  originSessionId: 22f9be26-6dc0-477b-b7b3-0d6b7afc3ac6
---

# Loop mínimo DeepSeek — OPERATIVO (2026-06-17)

El sprint DeepSeek se EJECUTÓ. La vía DeepSeek (músculo pago, **aditiva** — Kaggle intacto, [[variante-deepseek-aditiva]]) corre como **loop durable en Temporal**, validada E2E en el VPS. Diseño = ADR-016 + spec `docs/superpowers/specs/2026-06-17-deepseek-loop-temporal-design.md`; plan `docs/superpowers/plans/2026-06-17-deepseek-loop-minimo.md`.

## Qué está corriendo (VPS unreal-copilot)
- **Worker systemd `unreal-copilot-deepseek-worker.service` ACTIVE** en task-queue **`coding-agents-deepseek`**, venv `/opt/uc-worker-venv` (`temporalio==1.28.0`), conecta a Temporal en **`localhost:7233` SIN túnel** (a diferencia de Kaggle). Código en `/opt/unreal-copilot/` (sync por tar/rsync desde el repo).
- **Key:** `/etc/unreal-copilot/deepseek-worker.env` (modo 600, `OPENROUTER_API_KEY`) — fuera del repo. 🔐 **es la comprometida en chat → pendiente rotar** (también en `~/.claude/secrets/openrouter.env`).
- **Imagen gate:** `unreal-copilot-sandbox:1` (`python:3.12-slim` + `pytest==8.3.4`).

## Arquitectura (6 decisiones, todas opción A)
- **Cerebro durable = `shared/loop_core.py`** → `IterativeCodeWorkflow` reusado del kernel Kaggle, **agnóstico al provider**. Activities por **nombre string** (`"infer"`/`"run_tests"`) para no romper el sandbox de determinismo de temporalio ni crear ciclo. Loop: `implement→test→diagnose→fix→…` hasta verde o `max_iters`; al agotar COMPLETA con veredicto (no falla).
- **`infer` (dispatcher)** `deploy/worker/activities.py`: `provider="openrouter"` → HTTP a OpenRouter con **urllib (stdlib, sin httpx)**, `max_tokens` alto (coder 1500 / reasoner 4000), pin `quantizations:["fp8"]`, `reasoning:{effort:"high"}` solo para reasoner. Return uniforme `{text,usage{...,cost},provider,finish_reason,model}`. Deja el hueco `provider="ollama"` para el follow-up Kaggle.
- **`run_tests` (gate)** → **Docker efímero hardened** (cierra ADR-015): `--network none --read-only --tmpfs /work:exec --user 65534 --cap-drop ALL --security-opt no-new-privileges --memory 512m --cpus 1 --pids-limit 128 --rm`, mount `-v tmpdir:/src:ro`. El worker NUNCA ejecuta el código de IA (corre en la jaula).
- **Durabilidad/estado:** event history de Temporal; retry **finito** + backoff (5 intentos), timeouts `infer`120s/`run_tests`90s. Sin el andamiaje cross-corte de Kaggle.
- **Steps:** flash (`deepseek-v4-flash`)=implement/fix · pro (`deepseek-v4-pro`)=diagnose; `diagnose` con feedback localizado ([[localizacion-estructurada-feedback-agentes]]). Prompt cacheable `[SYSTEM][TASK]`, slot Graphity vacío (diferido).
- **Contrato reusable** (ladrillo para nuevos desarrollos): `IterativeCodeWorkflow({task,tests,max_iters,steps?,provider_config,dep_files?})→{passed,iters,code,history,usage}`. Provider pluggable detrás de `infer`; cero acoplamiento al caso de prueba. **`dep_files?` (SP4, 2026-06-20):** code resuelto de deps cross-unit; `run_tests` lo monta en `/work/.deps` — importable vía un **conftest controlado** (NO `PYTHONPATH`, que dispararía el auto-import de `site` → gate corruption) y **no colectable** por pytest (dot-dir). Opcional → 1-unidad byte-idéntico. Validado E2E multi-unidad → [[casa-fabrica-features-diseno]].

## Evidencia E2E (`deploy/worker/tests/RESULT.md`)
- `roman(n)` simple → `COMPLETED passed:true iters:0` (happy-path).
- `parse_roman` validación canónica estricta → `COMPLETED passed:true **iters:1**`: flash falla iter 0 → pro diagnostica → flash corrige → gate verde. **Auto-corrección real demostrada** (no happy-path).
- Spikes Fase 0 (gate, `spikes/{docker-sandbox,vps-worker}/RESULT.md`): sandbox aísla red (`Network unreachable`) + host (`Read-only FS`), overhead 0.48s; worker temporalio E2E.

## Hallazgos caros (NO reintroducir)
1. **`--user 65534` no lee tmpdir root-owned 700** → `run_tests` hace `chmod` (dir 755, archivos 644) antes del `docker run`. Sin esto el gate falla con `cp: Permission denied`.
2. **flash devuelve código con errores** (p.ej. `defadd` sin espacio) → confirma empíricamente que el gate de tests reales es necesario; el test de `infer` valida el boundary HTTP, NO la calidad (eso la dicta el gate en el E2E).
3. **CRLF de Windows rompe `deploy.sh`** (`set: pipefail: invalid option name`) al sincronizar desde el working copy → `.gitattributes` con `eol=lf` (raíz). El repo ya estaba LF (autocrlf); el problema era el working copy.

## PRs (todos mergeados a main)
#6 diseño/spec/ADR-016 · #7 plan · #8 spikes Fase 0 · #9 código Fases 1-3 · #10 E2E + `.gitattributes`.

## Pendiente (hardening diferido — spec §9, NO en el loop mínimo)
✅ **usage de DeepSeek instrumentado** (PR #15, SP6 inicial): el resultado del workflow trae `usage` (tokens/cost/provider/model) por `infer`. Costo MEDIDO = **$0.0028/feature** (flash $0.00107 + pro $0.00174); `cached=0` → prompt caching sin aprovechar (oportunidad). Resto: 🔐 rotar key · Kaggle vendorea `loop_core` (cierra duplicación) · held-out tests · invariants-log · sanitización del feedback (regla 6) · Graphity en slot `[NÚCLEO]` · deps-por-proyecto · pool de contenedores · gVisor por métrica · dual-generation. Cada uno entra por métrica/fase sin tocar el boundary. El techo lo fija el verificador, no el motor ([[macro-loop-diseno-candidato]]).
