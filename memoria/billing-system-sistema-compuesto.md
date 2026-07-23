---
name: billing-system-sistema-compuesto
description: "1er sistema compuesto (billing, 10 units) E2E heal=0; 3 clases de fallo multi-app corregidas de raíz (J25-J29, J27 namespacing = regla viva). Lección MECANIZADA — provenance."
metadata: 
  node_type: memory
  type: project
  originSessionId: 12059cb1-332d-4821-a3ba-e04ea45ababe
---

**Billing & Tier Management — 1er SISTEMA COMPUESTO ✅ E2E + PR #2 MERGED (`heal_turns=0`), 2026-06-25.** Modular-monolith de 10 units (`theoriginalcustodian/billing-system`). Arquetipo nuevo **`recurring_charge`** (kit 14/14): cobro recurrente con dunning idempotente, reintento del **cobro** sin señal externa (distinto de `grace`/`dunning`). Pasarelas aisladas tras adapter A-1 **`PaymentGateway.charge(amount_cents, idempotency_key)→bool`** (stub; conectar Stripe/MP = reemplazar SOLO ese adapter; dinero en cents; idempotency key `(cliente_id:sub_id:cycle)`). Detalle CATALOGO §23.

**✅ LECCIONES MECANIZADAS** — el 1er compuesto destapó la clase "multi-app sobre recursos compartidos"; los fixes ya viven en la fábrica → el próximo sistema nace inmunizado. Detalle: **catálogo de errores §J** (30 fallos, 19 raíz).
- **J27 (la central — REGLA VIVA del plano):** colisión de nombres de tabla en el schema compartido `uc_factory` → **namespacing por app `<app>_*`** (regla DURA en `postgres.md §8` + `/generar-plano`; el nombre sale del docstring del store + `uc_tables.json`) + **guard fail-loud en `provision_tables`** (aborta si una columna declarada falta en la tabla viva).
- **J25/J26:** module-import (`from clients import pricing`) no cubierto por `patch_test_imports`/`read_skeleton` → fix canónico en `factory_kit` (reescribe módulo propio a `import solution as <mod>` + detección de deps por module-import).
- **J28:** gate-agent/heal respetan `UC_CLAUDE_HOME` (no dependen del token Max `/root` frágil). **J29:** heal `max_turns` 14→24.

**Meta-lección:** un sistema compuesto es el spike que destapa esa clase; el namespacing de tablas es **parte del contrato del plano** en una biblioteca multi-app, no un detalle.

 [[no-codificar-la-esperanza-principio-raiz]]
