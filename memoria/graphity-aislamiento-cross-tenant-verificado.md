---
name: graphity-aislamiento-cross-tenant-verificado
description: ADR-040 (aislamiento cross-tenant de Graphity) VERIFICADO en vivo por spike externo — copiloto DESBLOQUEADO para integrar memoria
metadata: 
  node_type: memory
  type: project
  originSessionId: 53c58a53-271e-474c-9267-f7720a2c6820
---

> **⚠️ CERRADO — NO re-abrir.** El operador reconfirmó el **2026-07-06** que el aislamiento cross-tenant de Graphity está **resuelto** (lo aclaró varias veces). Si un tablero / ROADMAP / doc lo marca "pendiente / 🔴 / NO implementado", está **desactualizado → reconciliar, no re-investigar**. Reconciliación de tableros propagada el 2026-07-06.

El fix de aislamiento cross-tenant de Graphity (**ADR-040**, namespacing físico `group_id = {tenant}__{logical}`, deployed sha `90721af`) quedó **VERIFICADO E2E contra la instancia VIVA** (`graphitymt.duckdns.org`) por un spike externo el **2026-07-04**.

**Evidencia:** `tenant_aisla_DURO = true`, `phase = fase2_namespace_fisico`. 3 vectores verdes con 2 tenants frescos:
- **Read cross-tenant** (key A pide el group único de B) → `200` vacío, cero leak.
- **Colisión de nombre** (A y B usan el MISMO group lógico) → cada uno ve solo lo suyo (el namespace físico los separa) — **este es el escenario que el spike original encontró ROTO** (`A_leak_de_B=true`) y ahora aísla.
- **Sanity** → cada tenant recupera lo suyo (prueba que el search funciona y el "vacío" cross es aislamiento real, no falta de datos).

Auto-validante: el vector de colisión descarta el falso verde (si fueran el mismo tenant o fallara el aislamiento, A vería el término de B en el group compartido). Spike: `scratchpad/spike3_adr040_verify.py` (reusa `Graphity/scripts/e2e_tenant_isolation.py` + agrega colisión).

**Vector NO cubierto externamente:** acceso by-UUID (IDOR directo) — ya cubierto por los guards D3 + tests internos del ADR (criterio #4 verde). Extensible si se quiere cerrar desde afuera.

**Implicancia:** el Copiloto del Emprendedor estaba **parqueado** hasta este cierre → ahora **DESBLOQUEADO** para la primera integración de memoria (`MemoryProvider` sobre `deploy/worker/graphity_client.py`, ontología `{BusinessFact, Preference, Contact, ActionTaken}`, group_id no-adivinable por emprendedor como defensa en profundidad). Ver estado del gap en [[copiloto-emprendedor-roadmap]].

**Deuda gestionada (no bloqueante):** 2 tenants de prueba `spike-verify-{a,b}-adr040v-1783173510` (datos de juguete `ZZ*`, no PII) creados en la instancia viva; revocar en batch con la próxima limpieza de Graphity (requiere admin/SSH). [[deuda-secretos-rotar]]
