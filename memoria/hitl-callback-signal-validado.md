---
name: hitl-callback-signal-validado
description: "El último supuesto técnico del HITL de agentes (callback de Telegram → signal a workflow por wf_id) validado E2E el 2026-06-19, con clics reales del operador (approve + reject)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**HITL de agentes — supuesto técnico callback→signal VALIDADO E2E (2026-06-19).** Cierra el último pendiente técnico del HITL. El resto del diseño ya estaba: 3 reglas (autoridad / signal durable / gate duro) en [[macro-loop-diseno-candidato]], canal Telegram en [[canal-whatsapp-hermes]], durabilidad del signal en [[durabilidad-cross-corte-validada]].

Spike `spikes/hitl-callback-signal/`. Worker + listener dedicados (task-queue `hitl-spike`), reusando el bot de `wa-sender` con **`wa-sender` PARADO temporalmente** (1 `getUpdates` por bot) y re-levantado al terminar. Probado con clics **reales** del operador en Telegram:
- **Approve:** workflow suspendido en `wait_condition` → operador clickea ✅ → listener `callback → handle(wf_id).signal("decide", True)` → workflow despierta → ejecuta la acción → COMPLETED `approved/executed=True`.
- **Reject:** clic ❌ → signal `approved=False` → COMPLETED `rejected/executed=False`; la acción NO se ejecuta (`DO_ACTION` no corre).

El delta validado: `wa-sender` hace callback→**START**; esto es callback→**SIGNAL** a un workflow YA esperando. El `wf_id` viaja en el `callback_data` (`approve:{wf_id}`, ≤64 bytes) → más robusto que el `PENDING` en memoria del `wa-sender` (sobrevive reinicios del listener).

**Bug cazado (lección portable):** `workflow.wait_condition()` devuelve **`None`** (no un bool) y lanza **`asyncio.TimeoutError`** si expira → NO usar `if not got`, usar `try/except`. El código original daba `decision="timeout"` aunque el signal llegara (el workflow despertaba en ~1 min, no en los 15 del timeout — eso delató el bug, no el concepto).

**Para el `ApprovalGate` de producción queda:** (1) la **lista del gate duro** (decisión de producto: qué acciones gatillan HITL siempre) · ~~(2) materializar el `ApprovalGate` reusable en el `FeatureWorkflow`~~ · ~~(3) montar el **2º bot de Telegram dedicado**~~. El patrón signal-based + el cableado callback→signal ya están probados.

**✅ 2026-06-20 — guard anti-stale del listener VALIDADO (durante el E2E de SP5).** Cuando un clic llega DESPUÉS de que el gate ya se resolvió, el listener consulta el `state` del workflow y descarta el clic con `STALE clic ignorado` (→ Telegram "Ese pedido ya no está activo (ya se resolvió o venció)") en vez de re-signalar un workflow cerrado. Confirmado en `feature-sp5e2e3`: los gates se resolvieron por **signal programático** (no clic) y el workflow cerró (`COMPLETED rejected_gate2`) **antes** de que el operador clickeara → los clics tardíos se ignoraron limpio (`state={gate1:True, gate2:False, pending_gate:None}`). **Lección reusable:** el `decide` programático (cliente Temporal) y el del listener (callback) son **intercambiables** (mismo signal durable) → para E2Es de validación conviene **dirigir los gates por señal programática** y NO gastar clics del operador (el HITL por Telegram ya quedó probado con clics reales). Launcher auto-dirigido = `spikes/sp5-claude-fill/e2e_feature.py` (pre-envía gate1=approve + gate2=reject; los signals son durables, el workflow los consume al llegar a cada gate, como `_run_happy`/`_run_reject_gate2` en los unit tests).

**✅ 2026-06-19 — (2) y (3) CERRADOS en producción (PR #27, [[casa-fabrica-features-diseno]]).** El `FeatureWorkflow` lleva los 2 gates HITL signal-based (`decide(payload={request_id,approved})`, dispatch por `request_id` para descartar signals stale entre gate1/gate2; query `state` expone `pending_gate`). Listener de prod `deploy/hitl/listener.py` + `uc-hitl-listener.service` (env `/etc/unreal-copilot/hitl-listener.env`) con **bot dedicado `Unreal_Copilot_HITL_bot`** corriendo **en paralelo a `wa-sender` sin pausar nada** (la raíz, no el parche del spike). `notify_approval` (activity en el worker, `deploy/worker/hitl_activities.py`) manda botones con `callback_data={act}:{gate}:{wf_id}` — el **gate viaja en el callback** (fix cross-wiring: un clic en un botón viejo de gate1 NO resuelve el gate2). El bug `wait_condition`→`None`/`TimeoutError` quedó bien resuelto (try/except). Validado E2E con clics reales (approve gate1 + reject gate2 → `rejected_gate2`). **Resta solo (1)** la lista del gate duro (producto). (Token del bot dedicado: operador decidió **NO rotar** el 2026-06-19 — riesgo aceptado, uso personal, nunca tocó el repo.)
