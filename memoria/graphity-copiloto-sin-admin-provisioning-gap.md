---
name: graphity-copiloto-sin-admin-provisioning-gap
description: RESUELTO — la key COMÚN de Graphity alcanza para ontología graph-scoped + structured (admin NO se necesita); el único borde era project scope en la key, y el tenant real lo provisiona la sesión Graphity por el canal (operador autorizó)
metadata:
  type: project
---

## ✅ RESUELTO (2026-07-23) — la key común alcanza; admin nunca se necesitó

El agente Graphity verificó contra código vivo **y** en vivo (canal, 23:50): **ningún endpoint de
escritura de grafo ni de ontología chequea `is_admin`.** El flag admin sólo gatea `/admin/*` y el
override cross-tenant. Entonces con la **key de tenant COMÚN**:
- **Ontología graph-scoped** (`POST/PUT /api/v2/entity-types`, `graph_ids=[lógico]`, `compose_default:false`) → **SÍ**, sin admin.
- **`POST /api/v2/graph/structured`** → **SÍ**, con UN requisito: la key necesita **project scope**. Si falta = **`400 "Project scope required"`** (graph.py:1595), **NO 403, y admin NO lo arregla**. Es config de la key.
- El **422 por ontología heredada** desaparece: `_resolve_ontology` va **graph > user > project**, la graph-scoped gana.

**El tenant/key REAL de ingesta lo provisiona la sesión Graphity** (el operador autorizó pedirlo directo
por el canal, 2026-07-23) con **project scope** + aislamiento del dominio — la key llega a
`~/.claude/graphity/copiloto.env` (consumo con `--instance copiloto`), **nunca por el canal** (§6). El
de-risk desechable corre antes, con la key común + `graph_id` temporal. **Backend NO provisiona nada.**

---

## Contexto histórico (lo que se creía antes de resolverlo)

El acceso del copiloto a la instancia `graphitymt` es una **key de tenant COMÚN** (`~/.claude/graphity/instance.env`),
**no admin**: `provision-tenant.sh` da **403 en `/admin/api-keys`**, y no hay creds SSH del VPS de
Graphity. El tenant de prueba (`test.env`) además tiene la key **muerta (401)**. **Esto NO bloquea** — la
provisión de tenants es lo único admin, y no hace falta que la haga el copiloto.

**Error de PLANIFICACIÓN que esto destapó (2026-07-22):** el `dato_TENANT-confirmado-copiloto-dedicado-runbook`
le dijo a backend "provisioná el tenant `copiloto` con `provision-tenant.sh`" **sin verificar que tuviera
admin**. Regla escrita sobre el setup de otro ([[regla-escrita-sobre-el-setup-de-otro]]) — codificar la
esperanza. Afecta el de-risk **y la ingesta real**: ambos asumían provisioning.

**La pregunta que decide TODO el camino del grafo** (backend la emitió al canal de asistencia Graphity,
`Graphity/coordinacion/Copiloto/`): *¿una key de tenant común puede registrar una ontología **graph-scoped**
+ `POST /api/v2/graph/structured` a un `graph_id` propio, sin admin?*
- **Si SÍ** → no hace falta admin nunca; el paso "provision-tenant" se cae del runbook (menos superficie
  de secreto); se corre de-risk **e** ingesta con la key común, aislando por `graph_id`/`group_id`.
- **Si NO** → escalamiento al **operador**: acceso admin / SSH al VPS de Graphity (su infra, MAYOR, con
  secreto). No se resuelve pasando keys por el canal (§6 lo prohíbe). Quedó planteado para su mañana.

Relacionado: [[graphity-tenant-dedicado-y-ontologia-scoped]] · [[composio-gateway-ladrillo]] (mismo patrón
de "verificá el acceso vivo antes de escribir el runbook").

**🟡 Descubrimiento colateral (flag de producto, 2026-07-22):** al verificar tablas para el addendum de
ontología apareció que el link **cobro→comprobante SÍ existe** (`copiloto_cobros.comprobante_id`,
`copiloto_gastos.comprobante_ref`/`cobro_ref`) — `ontologia-grafo-negocio-v1.md §9.1` lo daba por
imposible. Con una arista `SALDA` (Cobro→Comprobante) se podría cerrar **"¿quién me debe?"** (la pregunta
#1 del emprendedor). NO congelado en el addendum — cambia el reader contract y el dataset; es decisión de
scope del operador. Detalle en `coordinacion/.../addendum_ontologia-tipos-congelados`.
