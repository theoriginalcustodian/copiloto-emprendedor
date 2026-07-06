---
name: claude-headless-401-vps
description: "BLOQUEO — Claude headless (Max) en el VPS devuelve 401, la fábrica queda sin arquitecto hasta re-login OAuth"
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**✅ RESUELTO 2026-06-21** (el operador re-autenticó; causa del deslogueo DESCONOCIDA → puede recurrir, por eso se conserva esta nota). `HOME=/root claude -p 'OK'` volvió a responder `OK` y el E2E vivo de [[plan-verifier]] se completó.

**El incidente (2026-06-21).** `claude -p` en el VPS `unreal-copilot` devolvía `Failed to authenticate. API Error: 401 Invalid authentication credentials`, incluso directo (`HOME=/root claude -p`). La credencial `/root/.claude/.credentials.json` existe (421 B, mod. 2026-06-21 13:10) pero el token OAuth de la **suscripción Max** está inválido/expirado. No hay `ANTHROPIC_API_KEY` de fallback en `/etc/unreal-copilot/*.env` (la fábrica corre con Max, no API key — decisión ADR casa).

**Impacto:** la fábrica queda **sin su arquitecto** — los 3 pasos Claude headless (`plan_feature`, `materialize_scaffold`, `claude_fill_unit` nivel 3 SP5) fallan. Cualquier `FeatureWorkflow` muere en el paso PLAN. Hace fallar 2 tests `test_claude_fill.py` (auth, no regresión de código). Bloqueó el E2E vivo full de [[plan-verifier]] (#3).

**Fix:** re-login OAuth de Max en el VPS (flujo interactivo `claude` — device-code/browser), NO completable headless por un agente. Verificar después con `HOME=/root claude -p 'OK' --max-turns 1`. Posiblemente relacionado con la deuda de rotación de secretos pendiente. **Por qué importa:** la economía de la casa depende de Claude bajo Max ($0 marginal); sin auth, no hay plan/scaffold/fill → la fábrica no construye nada.
