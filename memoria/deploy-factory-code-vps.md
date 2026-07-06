---
name: deploy-factory-code-vps
description: "Cómo desplegar un cambio de CÓDIGO de la fábrica al VPS: /opt/unreal-copilot NO es git (sync manual) → scp los .py + restart unreal-copilot-deepseek-worker"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 12059cb1-332d-4821-a3ba-e04ea45ababe
---

**Desplegar un cambio de CÓDIGO de la fábrica al VPS** (`shared/*.py`, `deploy/worker/*.py` — ej. `factory_kit`, `plan_verifier`, activities). Verificado 2026-06-25 (deploy del seam-verifier).

`/opt/unreal-copilot` en el VPS **NO es un git checkout** (rsync/manual, sin script de sync ni auto-deploy). **Un merge a `main` NO llega solo al worker.** Pasos:
1. `scp <archivo>.py unreal-copilot:/opt/unreal-copilot/<ruta>` (+ `sed -i 's/\r$//'` por si la copia local es CRLF; python tolera CRLF igual, pero conviene normalizar).
2. Restart del worker que importa el módulo: **`systemctl restart unreal-copilot-deepseek-worker.service`** — es el worker que corre las 3 task-queues (coding-agents-deepseek + feature-dev → `feature_activities`→`plan_verifier` + el músculo). Restart **Temporal-safe** (las activities en vuelo se reanudan; por eso Temporal es la columna).
3. Verificar: `systemctl is-active` + import sanity con `/opt/uc-worker-venv/bin/python -c "import plan_verifier; ..."`.

Otros servicios systemd: `uc-hitl-listener` (gates HITL) · `unreal-copilot-wa-sender` (WhatsApp). El cluster Temporal corre en Docker (`/opt/agentic`). Los tests PUROS (factory_kit/plan_verifier — sin temporalio/supabase) corren en la PC; el resto solo en el VPS. [[tests-se-corren-en-vps]] [[plataforma-agentica-estado]]
