---
name: copiloto-beta-sprint-cerrado
description: Sprint BETA (BETA-G0 a BETA-5) y sprint M-WEB cerrados 2026-08-05 — ambos gates de BETA-5 satisfechos y verificados independientemente; sólo falta acción del operador (invitar testers)
metadata:
  type: project
---

# 🟢 Sprint BETA + sprint M-WEB — CERRADOS 2026-08-05

**Los dos gates de BETA-5 (abrir el copiloto a 10-15 testers reales) están satisfechos.** No queda
ningún disparador de sesión pendiente — lo único que resta es que el operador mande las invitaciones,
acción fuera del scope de las tres sesiones (planificación/backend/frontend).

Mapa completo con DoD por hito, contratos y evidencia detallada: `coordinacion/PLAN.md` (bloque
COLA-VIVA + sección "Sprint BETA"). Este archivo es el resumen operativo, no la duplica.

## Gate 1 — Sprint M-WEB (paridad web/mobile)

**CERRADO 2026-08-05 ~00:20**, verificado independientemente por planificación (no autoevaluación de
frontend): `origin/main` en `e1598f05` (confirmado por `git log`), deploy real confirmado por `curl`
directo contra `https://copilotoemprendedor.duckdns.org/` (mismo hash de bundle que reportó frontend,
no cacheado). E2E Playwright contra el sitio real, sesión `e2e-device@copiloto.test`: 13 módulos con
datos reales del tenant, 0 errores de consola reales.

**Principio rector que decidió el alcance final (corrección del operador):** *"la web es la otra
interfaz, deben ser iguales"* — móvil y web son **espejos**, no dos productos con distinto alcance.
Esto reincorporó módulos que se habían descartado por conveniencia de UX (escritorio, recientes,
captura básica) y sumó uno no documentado en memoria (`ajustes`, detectado por grep). Total real: 13
módulos de negocio/UX, no los 8 originalmente estimados.

**Hallazgo que fijó el patrón de portado:** `@copiloto/core` nunca estaba wireado en `copiloto-web`
(el spike del módulo 1, `gastos`, lo destapó) — adapter de plataforma agregado una sola vez (`ADR-010`),
costo pagado por el primer módulo, los otros 12 lo reusaron gratis.

## Gate 2 — BETA-4b: Google Sign-In nativo (mobile)

**CERRADO 2026-08-05 ~12:05** por backend, verificado independientemente por planificación
(`origin/main` @ `630d91f3`, PR#261 mergeado — `gh pr view 261 --json state,mergedAt`). Mecanismo y
los 3 bugs reales encontrados en el camino: [[copiloto-google-signin-nativo-credential-manager]].

## El patrón de verificación que evitó aceptar un cierre por fe

En ambos gates, planificación **no aceptó el autoreporte de la sesión que cerró** — re-corrió el
comando de verificación por su cuenta (`git log origin/main -1`, `gh pr view`, `curl` contra el sitio
real) antes de marcar el gate en verde en `PLAN.md`. Es la aplicación directa de
[[no-codificar-la-esperanza-principio-raiz]] al rol de planificación: la sesión que cierra un hito y la
sesión que lo verifica no pueden ser la misma sin evidencia de tercero.

## Lo que queda, deliberadamente fuera de este cierre

- **Acción del operador:** mandar invitaciones a los 10-15 testers (alta vía Google auth existente).
  Autorización permanente ya dada — ver `coordinacion/abierto/`… `BETA5-autorizada-por-operador...md`.
- **Post-beta / producción completa**, diferido a propósito (no es scope silencioso — está documentado
  desde el mapa original del sprint): M1 Billing&Tiers completo, P2 (MFA/2FA, GDPR, status-page,
  analytics, impersonation). Se diseña con datos reales de uso de la beta, no antes. Detalle:
  `docs/copiloto-emprendedor/2026-08-03-plan-produccion-post-beta-cobro-y-p2.md`.
- **Decisión MAYOR del operador, sin resolver, independiente de este cierre:** worktree `_documed-wt`
  (producto clínico completo, ~4.600 líneas, sin mergear) — *"aún no sé, dejarlo como está"*
  (2026-08-03). No se toca hasta que el operador decida.
- `captura` (voz en el chat) se cerró **sin portar** a web por cobertura ya existente
  (`MicButton.tsx`/`RecordingOverlay.tsx` cumplen la misma función que el mobile) — no es deuda, es
  [[reutilizacion-es-regla-el-inventario-va-antes-del-diseno]] aplicado antes de escribir código nuevo.
