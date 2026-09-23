---
name: defense-in-depth-enmascara-el-control-negativo-de-la-capa-interna
description: "Un control negativo empírico puede NO ponerse rojo al revertir el guard de la capa A si una capa B independiente (ej. RLS FORCE) tapa el fallo; el test verifica el sistema, no aísla la capa."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: da9be060-d90c-4585-bc9c-77c1b657fe22
  modified: 2026-08-12T20:26:18.101Z
---

Cuando un recurso está protegido por **dos barreras independientes** (ej. filtro app-side
`WHERE cliente_id` **+** RLS FORCE en Postgres), un test adversarial que remueve el guard de la capa A
**puede seguir verde** porque la capa B bloquea igual el acceso hostil. El control negativo "revierto el
fix y espero rojo" **falla en ponerse rojo** — no porque el fix esté mal, sino porque la 2ª barrera lo
enmascara.

**Consecuencia exacta:** el test verifica la **propiedad de seguridad del sistema** (A no toca lo de B),
pero **NO aísla** cuál capa la garantiza. El guard de la capa interna queda cubierto por lectura de
código + la capa externa, no por un test que caiga sin él. Si algún día se desactiva la capa externa
(RLS off), ese test es el único guard y no hay prueba de que funcione aislado.

**Why:** En Fase D de lote C (#412, 2026-08-12) los adversariales de `ConceptoStore.editar/desactivar` y
`TrabajoStore.imputar` cross-tenant eran defense-in-depth. Backend lo declaró honestamente en el commit:
"filtro cliente_id removido → rojo-resistente por RLS FORCE → revertido → verde". La propiedad de
seguridad cierra (cumple la regla dura: control de acceso con test adversarial contra PG real), pero el
control negativo de la capa app-side no se pudo aislar. Es el espejo de
[[control-negativo-estatico-no-caza-constante-equivocada]]: allá el estático no cazaba una constante;
acá el empírico no caza la capa interna por doble candado.

**How to apply:** Al auditar un control con defense-in-depth, para aislar la capa interna hay que
**desactivar temporalmente la capa externa** (correr el adversarial con RLS en `NO FORCE`/bypass en un
entorno de test) — sólo así el revert del guard app-side da rojo. Si no se puede, **declararlo explícito**:
"propiedad de seguridad verificada por el sistema; guard de capa A cubierto por lectura + capa B, no
aislado por test". No decir "control negativo genuino" a secas: no lo es para esa capa. No bloquea (dos
candados > uno), pero es deuda de cobertura, relevante el día que se toque la capa externa.
