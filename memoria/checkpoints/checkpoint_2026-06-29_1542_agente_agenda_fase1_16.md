---
name: checkpoint-agente-agenda-fase1-16-2026-06-29-15-42
description: Snapshot ejecutivo. Agente de agenda durable de la clínica (Fase 1 + 1.5 + 1.6) live + cosechado. Estado + próximos pasos + contexto crítico.
metadata: 
  node_type: memory
  type: checkpoint
  session_id: 12059cb1-332d-4821-a3ba-e04ea45ababe
  project_root: c:\Proyectos\Claude\Claude code\unreal-copilot
  originSessionId: 12059cb1-332d-4821-a3ba-e04ea45ababe
---

# Checkpoint — Agente de agenda conversacional durable (clínica)

> **Cómo retomar:** invocar `/resume-work` en la próxima sesión. Leer este archivo + la memoria `clinic-agenda-agent-fase1`. Todo está commiteado, verde y desplegado LIVE — no hay trabajo a medio hacer.

## 🎯 Objetivo de la sesión / sprint

Construir el **agente de IA conversacional de agenda** para la app de la clínica (`clinic-management`), por **Telegram texto**, **durable** (Temporal), dejándolo **listo para usar/probar** — con la **clonabilidad como prioridad #1** (motor agnóstico cosechable a la fábrica). Refinado en vivo a UX natural/humana.

## ✅ Hecho (todo commiteado + gate verde + LIVE)

- **Fase 1** — agente conversacional durable Telegram texto. Motor `ConversationWorkflow` AGNÓSTICO + dominio clínica (closed-list, HITL, identidad). LLM = DeepSeek Flash + Pro failover operativo. Migración `002` (additive+RLS) aplicada a fusion. Gate E2E verde. → `clinic-management` commit `5eff23d` (PR #5).
- **Fase 1.5** — confirmación por **botón** (inline keyboard determinístico) + **robustez de texto** (bypass `collecting=confirm`, unifica botón+texto). Bug en vivo: Flash rompía el JSON/devolvía otra action en confirmaciones coloquiales. → commit `61cabc0`.
- **Fase 1.6** — disponibilidad **natural + humanizada**: `resolve_datetime` resuelve **franjas** (`period` morning/afternoon/evening); el dispatcher filtra a la franja y **ofrece una lista de horarios clickeable** (3-4 + ver más + otro día), **tocar uno = agenda directo**; sin lugar → alternativas (cancel ya no es dead-end). **Tono humanizado** (system prompt + replies). → commit `95a3cee`.
- **Cosecha (clonabilidad)** — motor agnóstico → arquetipo **`conversational_agent`** del `skeleton_kit` (`reference/` 9 archivos + README receta + `domain_stub` + `test_stub`), sincronizado con 1.5 y 1.6. → `unreal-copilot` commits `d941f07`, `0fe4dd2`, `acebac0` (PR #92).
- **Verificación**: 31 tests unit + **gate E2E `1 passed` (5 escenarios)** contra fusion+Temporal reales (botón confirm · nuevo paciente · "si dale" robusto · franja→lista→tap · emergencia HITL). Corre EN EL VPS.
- **Deploy LIVE**: `clinic-worker.service` active (0 restarts) polleando **@Turnos_Clinica_Pruebas_bot**, tenant demo.
- **Docs/memoria**: ROADMAP §3 + CLAUDE §5 actualizados; memoria topic `clinic-agenda-agent-fase1` (Fase 1/1.5/1.6); `.gitignore` de unreal-copilot protege secretos sueltos.

## 🔄 En curso

**Nada a medio hacer.** Todo lo construido está commiteado, verde y desplegado. Los 2 PRs están **OPEN, esperando decisión de merge del operador** (ver bloqueos). El deploy live es **pre-merge** (ver contexto crítico).

## ⏭️ Próximos pasos concretos

1. **Operador valida en vivo** el bot (@Turnos_Clinica_Pruebas_bot): flujo de franja→lista→tap + tono. Si OK → mergear.
2. **Mergear PR #5** (`clinic-management`, agente) y **PR #92** (`unreal-copilot`, arquetipo) — decisión MAYOR del operador.
3. **Post-merge (volver el deploy a canónico)** en el VPS:
   - `cd /opt/clinic-management && git pull` (trae el código del agente a la rama `main`).
   - `rm /etc/systemd/system/clinic-worker.service.d/override.conf && systemctl daemon-reload` (quita el drop-in pre-merge).
   - `bash deploy/deploy_agent.sh` (reinstala el unit apuntando a `/opt/clinic-management`, idempotente).
   - Verificar: `systemctl is-active clinic-worker.service` + texteo al bot.
4. **Decidir sobre los spikes untracked** (`spikes/clinic-agent-{s4-stt-voicenote,s5-availability}/` en unreal-copilot): commitear los `RESULT.md`+`.sql` a #92 (evidencia Fase 2) y gitignorear/excluir los binarios `.oga/.wav` (~2MB). Son evidencia mía de Fase 0.
5. **Fase 2 — voz**: integrar **Groq STT** para notas de voz de Telegram (el adapter ya marca `kind="needs_stt"`; el spike `s4-stt-voicenote` ya validó STT) + **Voxtral** realtime. NO está implementado.
6. **`reschedule`/`cancel` reales** (hoy escalan a HITL — "deuda gestionada Fase 1.5" marcada en `clinic_conversation.py`).
7. **WhatsApp inbound** (adapter nuevo, mismo motor) + **recordatorios con loop de confirmación**.
8. **Rotar secretos pre-prod** (deuda registrada → memoria `deuda-secretos-rotar`).

## ⚠️ Bloqueos / decisiones pendientes del operador

- **Merge de PR #5 y #92** — MAYOR (afecta `main`). El operador decide. Hasta entonces el deploy vive en el worktree (pre-merge).
- **🔴 Secretos sueltos en `unreal-copilot/`**: `Apikey Grok.txt` y `Mistral Apikeys.txt` en la raíz (gitignored, NO commiteados, pero en texto plano en disco). El operador debe moverlos fuera del repo / a un gestor.
- **Spikes untracked** (`s4-stt-voicenote`, `s5-availability`): decidir si se commitean (ver próximo paso 4). Origen: míos, esta sesión.

## 📚 Contexto crítico para retomar

- **Repos / branches / PRs:**
  - `clinic-management` → branch `feat/agenda-agent-fase1` (limpio, pusheado), **PR #5 OPEN**. Código: `backend/agent/` (motor agnóstico) · `clients/agent/` (ports/llm/canal/datetime) · `clients/clinic_*.py` · `clinic_conversation.py` (dominio) · `clinic_worker.py` (entrypoint) · `migrations/002_conversation_agent.sql` · `test_conversation_e2e.py` (gate).
  - `unreal-copilot` → branch `feat/cosechar-conversational-agent` (pusheado), **PR #92 OPEN**. Arquetipo: `deploy/skeleton_kit/archetypes/conversational_agent/`. Untracked: `spikes/clinic-agent-{s4-stt-voicenote,s5-availability}/`, `Apikey Grok.txt`, `Mistral Apikeys.txt` (no commitear), `.claude/settings.json`, `Loops/...`.
  - **Git identity en clinic-management**: seteada local `The Original Custodian <theoriginalcustodian@gmail.com>`.
- **VPS `unreal-copilot`** (alias SSH `unreal-copilot`, 178.105.191.1):
  - `clinic-worker.service` **active, 0 restarts**, polleando **@Turnos_Clinica_Pruebas_bot** (token en `/etc/unreal-copilot/clinic-agent.env` + `CLINIC_TENANT_ID` + `PGSCHEMA`). Drop-in `…/clinic-worker.service.d/override.conf` → `WorkingDirectory=/opt/clinic-agent-build` (PRE-MERGE).
  - **Tenant demo**: `0a1d0000-0000-4000-8000-0000000000d0` — profesionales cardiología (id 26) + clínica (id 27), horarios 7 días 09:00-18:00. Migración 002 aplicada a fusion.
  - Worktree `/opt/clinic-agent-build` (branch `feat/agenda-agent-fase1`) = donde corre el worker + los tests. Temporal `127.0.0.1:7233` UP.
  - **Tests SOLO en el VPS** (la PC no tiene temporalio/supabase): `cd /opt/clinic-agent-build && set -a; . /etc/unreal-copilot/fusion-supabase.env; . /etc/unreal-copilot/fusion-pg.env; set +a; /opt/uc-val-venv/bin/python -m pytest <archivo> -q`. Flujo: editar local → `scp` al worktree → pytest en el VPS → restart worker.
- **Sub-agents bg activos:** ninguno. **Cronjobs:** ninguno.
- **Memoria del proyecto:** topic `clinic-agenda-agent-fase1.md` (con Fase 1/1.5/1.6). `MEMORY.md` lo posee una sesión paralela → editar solo archivos topic individuales, NO el índice.

## 🧠 Modelo mental / supuestos

- **LLM = DeepSeek Flash (primario) + Pro (failover OPERATIVO, no cognitivo)** vía OpenRouter — NO Claude. Flash es **poco confiable en confirmaciones coloquiales cortas** (rompe el JSON o devuelve otra action aunque entienda) → por eso botones (decisión determinística) + robustez de texto.
- **El gate con LLM scripted valida la ORQUESTACIÓN, NO el tono ni la (in)fiabilidad del LLM real** → los refinamientos 1.5 y 1.6 salieron de **pruebas en vivo del operador**, no del gate. Para Fase 2: probar el comportamiento real en vivo, no asumir.
- **Deploy pre-merge vía drop-in**: el worker corre del worktree, no de `main`. NO es el estado canónico hasta el merge + `deploy_agent.sh`.
- **Arquitectura plantilla/cliente**: el motor (`backend/agent/` + `clients/agent/`) es 100% agnóstico; clonar a otra vertical = registrar otro dominio (`agent_runtime.register_domain`). El arquetipo del kit es la fuente para clones futuros.
- **No se tocó el core `clinic_system`** (endurecido por Fugu); el booking reusa `create_composite_booking` existente.

## 📊 Estimación de progreso

- **Objetivo "agente Telegram TEXTO listo para usar + clonable": ~100% hecho** (Fase 1 + 1.5 + 1.6 verdes + live + cosechado). Falta solo el **merge** (decisión del operador) y volver el deploy a canónico.
- **Fase 2+ (voz Groq/Voxtral · WhatsApp · reschedule/cancel reales · recordatorios): ~0%** (definido, spike de STT hecho en `s4-stt-voicenote`, no implementado).
- **Tiempo restante para cerrar Fase 1.x**: ~minutos (merge + 3 comandos de deploy canónico). Fase 2: sprint nuevo.
