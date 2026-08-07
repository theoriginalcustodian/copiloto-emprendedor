---
name: reverificacion-auditoria-fable-2026-08-04
description: Re-verificación (2026-08-04) de los 11 hallazgos de la auditoría Fable del 2026-07-23 contra código pusheado tras ~198 commits — qué se resolvió, qué queda, y las 3 decisiones del operador
metadata:
  type: project
---

Re-verificación de la auditoría [[loop-auditoria-fable-analisis-opus-contratos-e2e]] (2026-07-23:
Fable v1 + mapa de clases + Fable v2) contra `origin/main` HEAD `~5057ee74`, tras ~198 commits.
Método: 5 sub-agentes paralelos, cada instancia verificada `git show origin/main` (NO working tree,
NO memoria). Entregable: `docs/copiloto-emprendedor/Auditorias/2026-08-04-listado-problemas-fixes-reverificado.md`.

## Estado de los 11 (2 resueltos, 3 parciales, 6 vivos)
- ✅ **C9** secretos (gitignore commiteado), **C4.2** rate-limit (#229), **D-E manejo de errores NÚCLEO**
  (fingerprint + log JSON + DLQ `copiloto_traumas` rol dedicado + 2 costuras + autohealing que abre
  PR/issue, verificado en VPS). El frente de errores está **genuinamente en prod** — no era autoevaluación.
- ⚠️ **C4.1** signup (gate solo frontend, endpoint sigue público), **C5** acoplamiento string (canario
  ata 2/5 sitios), **C3** Doc de presupuesto (queda FUERA de la DLQ por captura propia del endpoint).
- 🔴 **C1** pool (VIVO, empeoró: propagado a stores nuevos), **C2** idempotencia (patrón existe en
  `cobro_store` pero NO llega a Composio/MP; ext_ref MP aleatorio), **C6** chat sin cota (M-WEB duplicó
  el patrón en web), **C7** cache Composio, **C8** firma que ignora payload (1 línea), **D-A** 1/5
  resuelto — 4 puntos mudos siguen (`tool_catalog.py:1599` blind-spot DLQ, `services/__init__.py:26`,
  `mercadopago_gateway.py:119`, `inteligencia_chat.py:144/168`), **D-B** timeout bajo.

## Restos concretos del manejo de errores
- `agent_activities.py:114` — `print(STT_TRANSCRIPT ...)` vuelca transcripción de voz (PHI) a stdout SIN GATE. Intacto.
- Blind-spot: errores dentro de tools del ReAct (`tool_catalog.py:1599`) no llegan al autohealing (se capturan antes de la costura C3).
- DEUDA-AUTOSAN-1: 0 traumas reales pasaron por el ciclo completo (DLQ vacía). Deuda gestionada.

## Decisiones del operador (2026-08-04)
1. **C4.1** → DOS puertas: Google OAuth self-service abierto (`/auth/oauth/ensure-tenant`, ya existe) + email/password gateado con invite-token de env fail-closed. Matiz visible: Google abierto deja el costo-por-abuso parcialmente vivo (mitigado por rate-limit); palancas futuras: allow-list dominios / cuota free / verificación.
2. **C1** → LAS DOS: PgBouncer (infra, cero código) + pool app-side tras `conn_factory`.
3. **C5** → alternativa liviana (extender canario a los 2 sitios de `trabajo_store.py`); NO escalar FK.

## Orden de contratos (sin bloqueos)
C1 → C4.1 → C2 → C6 → C7 → D-A(4 mudos)+print PHI → C3 → C8 → C5-canario → D-B.
Emisión al buzón la secuencia PLANIFICACIÓN (backend/frontend mid-sprint M-WEB). Ninguno requiere
invención: el repo ya tiene los patrones (`cobro_store` para idempotencia, las 2 costuras para DLQ) —
falta propagarlos a los puntos exactos.
