---
name: graphity-copiloto-sin-admin-provisioning-gap
description: El copiloto tiene key COMÚN de Graphity, no admin — no puede provisionar tenants; el runbook que asumía provisioning estaba mal, y todo el camino del grafo depende de si una key común alcanza
metadata:
  type: project
---

**LEER antes de asumir que el copiloto puede provisionar en Graphity.** El acceso del copiloto a la
instancia `graphitymt` es una **key de tenant COMÚN** (`~/.claude/graphity/instance.env`), **no admin**:
`provision-tenant.sh` da **403 en `/admin/api-keys`**, y no hay creds SSH del VPS de Graphity. El tenant
de prueba (`test.env`) además tiene la key **muerta (401)**.

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
