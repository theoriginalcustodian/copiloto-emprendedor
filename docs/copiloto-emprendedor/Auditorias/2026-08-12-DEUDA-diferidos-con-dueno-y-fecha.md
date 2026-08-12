# Deuda diferida de la ronda de auditorías — dueño y fecha

**Abierto:** 2026-08-12 12:29 · **planificación** · **vivo hasta que las 8 filas estén cerradas.**

> **Por qué existe este archivo.** El DoD del ciclo (§G2/§G3) exige que **todo hallazgo termine en
> estado terminal**: resuelto y verificado, o **diferido con dueño y fecha**. Un P2 sin dueño y sin
> fecha no es una prioridad baja: es un hallazgo perdido. El canon lo dice más corto — *atajo = TODO +
> memoria + dueño + fecha, nada invisible ni impago*.
>
> Los contratos del buzón se archivan a los 90 minutos. Este archivo no.

---

## Contexto: qué NO está acá

Las pasadas 1 y 2 cerraron con **0 P0**. Lo que está en ejecución, y por lo tanto **no** es deuda:

| Frente | Dónde |
|---|---|
| C4.1 — `/auth/signup` abierto | contrato P0 a backend |
| Lote B — print PHI · D-A · C8 · canario C5 | contrato P1 a backend |
| Lote C — doble cobro · catch-all ReAct · tests adversariales · pool | contrato P1 a backend |
| C6 — cotas de chat y listas | frontend, cota **ya aplicada** en web y mobile |
| Pasada 3 — pulido y eficiencia | contrato a auditoría, en curso |

---

## Las 8 filas de deuda

Fecha por defecto: **primer sprint post-beta**. No es una fecha de calendario porque la beta todavía no
abrió; es un **disparador binario y verificable** — el sprint que arranca después del primer tester
externo. Cuando la beta abra, esa columna se convierte en fechas duras.

| # | Hallazgo | Origen | Dueño | Fecha | Por qué se difiere |
|---|---|---|---|---|---|
| D1 | **C7** — Composio síncrono sin cache, 5 call-sites. `TTLCache` 30-60s per-tenant | P2 H-5 | backend | 1er sprint post-beta | Costo y latencia por request; no rompe nada con pocos usuarios. **Ya está en la lista de continuación de backend** — puede adelantarse si sobra ciclo |
| D2 | **C3** — fallo del Doc de presupuesto se loguea pero no va a la DLQ (no reintentable) | P2 H-6 | backend | 1er sprint post-beta | Ya loguea el `motivo` con fingerprint: hay rastro, falta reintento. **También en la lista de continuación** |
| D3 | `heartbeat_timeout` ausente en las activities del loop ReAct (asimetría vs. AFIP, que sí lo tiene) | P2 H-7 | backend | 1er sprint post-beta | La `RetryPolicy` ya está acotada al 100%, así que no hay cuelgue infinito; el heartbeat mejora la detección, no la evita |
| D4 | `patched()` sin gate de replay en CI | P2 H-7 | backend | 1er sprint post-beta | Riesgo real sobre ejecuciones en vuelo, pero requiere diseñar el gate — no es un fix de línea |
| D5 | 8 endpoints AFIP/presupuestos con guard probado sólo a nivel helper/store, no por endpoint HTTP hostil | P1 H-2 | backend | tras el lote C | Es la **misma clase** que C3 del lote C. Al escribir esos tests, extender el patrón a estos 8 |
| D6 | 4 uploads sin validación de magic bytes | P1 H-5 | backend | 1er sprint post-beta | **Ya tienen cota de tamaño** (sin DoS) y nunca se persisten a disco — van en memoria a Groq/OpenAI. Sin RCE; peor caso 422/502 externo |
| D7 | `except: return False` en `mercadopago_gateway.py:119` — fail-silent | P1 H-4 | backend | junto con D-A del lote B | Auditoría lo clasificó bien: **blind-spot de observabilidad, no vulnerabilidad**. El webhook **no es forjable** (SDK oficial, fail-closed). Es de la misma familia que los `except` del lote B |
| D8 | `apps/copiloto-web/.../useChat.ts` (348 líneas) reimplementa `packages/core/src/chat/chatMachine.ts` en vez de consumirlo como hace mobile | C6(b) | frontend | **próximo ítem de frontend al cerrar C6(c)/(d)** | El defecto real de C6 (crecimiento sin techo) **ya está cerrado en las dos copias**. Lo que queda es duplicación, y converger 348 líneas del hook de chat de producción sin revisor en vivo tiene peor relación riesgo/beneficio que diferirlo |

---

## Lo que se descartó — no vuelve a auditarse

Confirmado **seguro** por la Pasada 1. Está acá para que nadie vuelva a gastar tokens en esto:

- **Path traversal del catch-all SPA** (`web.py:487`) — doble cerrojo `resolve().is_relative_to`.
- **Webhook de MercadoPago** — **no forjable**: SDK oficial, fail-closed.
- **DoS por upload** — los 4 endpoints ya tienen cota de tamaño.
- **BOLA** — 0 fail-open en los 33 endpoints con ID en ruta. El aislamiento multitenant es real y
  estructural, no incidental.

---

## Regla para cerrar una fila

Una fila sale de esta tabla con el mismo criterio que cualquier hallazgo: **§Fase D del DoD** —
desplegado, probado contra el sistema real, y con un test que **falla sin el fix**. No sale por estar
"considerada" ni por haber sido discutida.

**Si una fila llega a su fecha sin cerrarse**, no se re-difiere en silencio: se re-difiere **con motivo
escrito acá**. Una deuda que se corre de fecha sin dejar rastro es indistinguible de una abandonada.

Índice de la ronda: [README](README.md) ·
[DoD del ciclo](2026-08-12-DoD-cierre-auditorias-y-fixes.md) ·
[Pasada 1 — hallazgos](2026-08-12-pasada-1-seguridad-HALLAZGOS.md) ·
[Pasada 2 — hallazgos](2026-08-12-pasada-2-robustez-HALLAZGOS.md)
