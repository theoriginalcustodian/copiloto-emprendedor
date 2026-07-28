---
name: la-ventana-de-diagnostico-vence-antes-que-el-usuario-avise
description: La observabilidad se mide en unidades de tiempo del USUARIO, no en bytes de log — retención de Temporal 24h + 0 logging estructurado = sólo se diagnostican los bugs que alguien mira el mismo día
metadata:
  type: project
---

**Medido en el VPS el 2026-07-28:** `Config.WorkflowExecutionRetentionTtl = 24h0m0s` (namespace
`default`). Y en el código: **0** `fingerprint`/`dlq`/`structlog`/`request_id` en toda la app, **6**
loggers reales en 32k LOC de backend, **0** `console.error`/Sentry/endpoint de logging en las tres
capas cliente. De los **80 endpoints**, sólo `web.py` toca Temporal (16 sitios): los ~64 restantes son
CRUD directo a Postgres, fuera del history.

**La consecuencia no es "faltan logs". Es que la ventana de diagnóstico del sistema es más corta que
su ciclo de feedback con el usuario.** Un emprendedor no reporta cuando el bug pasa: reporta cuando
puede. *"Ayer no me anduvo"* es el caso **normal**, y para ese caso hoy no hay **nada** que mirar — el
history ya se borró, no hay log de negocio, y el cliente nunca reportó a ninguna parte.

**El criterio que se saca de acá (y aplica a cualquier sistema, no sólo a este):** no preguntes
*"¿tenemos observabilidad?"* — preguntá **"¿cuántas horas tengo para diagnosticar, y cuántas tarda un
usuario en avisar?"**. Si el primer número es menor que el segundo, la observabilidad es decorativa
por más completa que sea mientras dura.

**Dos matices que hay que respetar al proponer el fix:**

1. **Temporal ES observabilidad, y es gratis.** El history registra cada activity, su fallo, sus
   reintentos y sus payloads. El gap no es total como decía el dossier del 2026-07-23: está partido en
   *lo que pasa por un workflow* (observable, mientras dure la retención) y *el resto* (ciego). Subir
   la retención es una palanca de una línea de config.
2. **La mayoría de los `catch` sin log del cliente son degradaciones deliberadas y documentadas.** El
   problema no es que cada uno esté mal: es que **no existe ningún canal que un catch pudiera usar si
   quisiera**. El fix es abrir el canal (`reportError(err, ctx)` + `ErrorBoundary` +
   `window.onerror`), no auditar 61 catch uno por uno.

Detalle completo, con `archivo:línea` y el orden de ataque:
`docs/copiloto-emprendedor/2026-07-28-analisis-manejo-de-errores-toda-la-app.md`. Relacionado:
[[instrumentos-que-confirman-en-vez-de-verificar]] · [[el-fix-ya-existe-en-otro-call-site]] ·
[[probar-ausencia-necesita-otro-instrumento]].
