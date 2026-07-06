---
name: durabilidad-cross-corte-validada
description: F6 Task 1 (durabilidad cross-corte de Temporal) DESPEJADO empíricamente el 2026-06-19 vía spike E2E en la vía DeepSeek — ya no es supuesto sin evidencia.
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**F6 Task 1 — durabilidad cross-corte de Temporal: VALIDADO E2E (2026-06-19).** Era el supuesto raíz sin evidencia que bloqueaba "production-grade" y que toda la apuesta vs frameworks efímeros sostenía solo por diseño. Ahora es evidencia empírica.

Spike en `spikes/durability-cross-corte/` (`PLAN.md` diseño + `RESULT.md` evidencia + código throwaway). Worker dedicado systemd (`uc-durability-spike-worker`, task-queue `durability-spike`) en el VPS, **sin tocar el worker productivo** (`unreal-copilot-deepseek-worker` quedó `active` todo el tiempo). Limpiado al terminar. 2 escenarios, ambos PASS:

- **Escenario 1 (corte durante timer):** workflow sobrevivió **92 s sin worker** (status `RUNNING` en 6/6 mediciones del gap), el server (Postgres) sostuvo el state, las activities completadas **NO se re-ejecutaron** (probado por el PID del worker en el resultado: marks viejos conservan PID-A), reanudó a **+2 s** del reinicio. El `TIMER_FIRED` ocurrió con el worker muerto (lo dispara el server, no el worker).
- **Escenario 2 (corte con activity en vuelo):** `mark_slow` (con `heartbeat`, `heartbeat_timeout=10s`) interrumpida a mitad se reintentó **desde cero** al volver el worker (`MARK_SLOW START` ×2 con PID distinto), completó limpio. ⇒ confirma que las activities deben ser **idempotentes** (`infer`/`run_tests` lo son).

**Alcance:** valida el MECANISMO de durabilidad ante muerte del worker, **agnóstico a la causa del corte** → transferible a la vía Kaggle sin re-probar. NO cubre (catalogado): reconstrucción del worker Kaggle tras corte de jornada, ni corte del Temporal server (Postgres) mismo.

**Hallazgo de proceso:** el smoke previo al corte cazó un bug — el helper `inspect.py` shadoweaba el módulo stdlib `inspect` → el worker no levantaba. Spike-first dentro del spike. Diseño validado contra la skill `temporal-developer` (heartbeat obligatorio para el retry de activity en vuelo).

Corrige el estado de [[plataforma-agentica-estado]] y [[loop-deepseek-operativo]]: el claim "F6 cross-corte E2E sin validar = bloqueante" ya no aplica al mecanismo en la vía DeepSeek. Pendiente de reflejar en el CLAUDE.md (sección 5 Estado + pendientes F6).
