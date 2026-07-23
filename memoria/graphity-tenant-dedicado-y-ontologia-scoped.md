---
name: graphity-tenant-dedicado-y-ontologia-scoped
description: El copiloto ingesta al grafo con tenant dedicado `copiloto` + structured 0-LLM + ontología scoped, porque la instancia graphitymt es COMPARTIDA
metadata:
  type: project
---

**LEER al retomar el hito 5 (grafo de negocio) o al tocar la ingesta a Graphity.**

**Decisión del operador (2026-07-22):** el copiloto ingesta contra un **tenant/graph dedicado
`copiloto`**, NO reusar `unreal-copilot` ni un graph suelto. Es la frontera de aislamiento.

**Por qué — evidencia de backend (spike `validate_only` contra el server real):** la instancia
`graphitymt` está **COMPARTIDA** (documed y otros). Un `group_id` fresco **hereda la ontología
project-wide** de la instancia → rechaza los tipos propios con `422`. La doc decía *«sin ontología
registrada → modo permisivo, escribís cualquier cosa»* y es **FALSO** contra el server. Es la 2ª forma
de fuga cross-proyecto que el DoD §6 nombra, ahora con evidencia.

**Las tres reglas duras que salen de eso:**
1. La **ontología económica se registra con `graph_ids=[grupo del copiloto]`** para **pisar** la
   heredada. Sin scope → 422 en todo, o —peor, si un tipo coincide— mezcla con datos de otro proyecto.
2. Ingesta = **`POST /api/v2/graph/structured` con `dedup:"exact"` = 0 llamadas LLM + `uuid5`
   determinista** (precondición del invalidador bitemporal). **NO `fact-triple`** (= `add_triplet` = CON
   LLM + `uuid4` random en esta instancia). El *«fact-triple 6× más barato»* del agente de Graphity
   compara vs `episodes`; **structured es la 3ª vía**, más barata que ambas Y la única con `uuid5`.
3. **`valid_at` = fecha del HECHO** (event-time); la transaction-time (`created_at`) la pone el server
   sola. [[dato-en-dos-tiempos-lector-de-un-tiempo]] no, esto es bitemporalidad del grafo.

**Correcciones de mapeo tabla→tipo (medidas por backend):** `Cobro` sale de **`copiloto_cobros`** (no
`mp_payments`); **`IMPUTADO_A` es STATE**, no evento (si no, el margen cuenta doble).

**Canal de asistencia con el agente de Graphity:** `Graphity/coordinacion/Copiloto/` (protocolo +
`CRON-GRAPHITY.md`, cron cada 3 min). Se **desconecta al cerrar el hito 5** — planificación emite
`dato_..._DESCONECTAR-cron` y el agente apaga el cron.

**Pendiente al 2026-07-22:** addendum de ontología económica (planificación, con las 2 correcciones
arriba) → provisioning del tenant `copiloto` + wiring de la key en el env (backend, deuda de rotación) →
1ª ingesta real. Relacionado: [[copiloto-trazabilidad-operaciones-fact-triple]] · [[copiloto-memoria-provider-ladrillo]].
