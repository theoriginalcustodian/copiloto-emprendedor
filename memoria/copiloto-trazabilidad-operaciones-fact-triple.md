---
name: copiloto-trazabilidad-operaciones-fact-triple
description: "CANDIDATO de diseño — trazabilidad de operaciones del copiloto en Graphity vía fact-triples (proyección, NO fuente de verdad). Follow-up con spikes pendientes."
metadata: 
  node_type: memory
  type: project
  originSessionId: 53c58a53-271e-474c-9267-f7720a2c6820
---

**CANDIDATO de diseño (no implementado).** Evolución natural del recall temporal ([[copiloto-recall-temporal]]): pasar de memoria conversacional (episodios extraídos por LLM, best-effort) a **trazabilidad estructurada de operaciones** vía `add_fact_triple` — datos precisos/fijos entran al grafo sin extracción LLM (deterministas, ~6× más baratos). **Follow-up completo:** `docs/Follow up/2026-07-05-trazabilidad-operaciones-fact-triple-design.md`.

**Invariante NO-negociable — TRES capas, cero solapamiento (afinado en conversación 2026-07-05):**
1. **SoT del DOMINIO = la APP externa dueña** (MercadoPago=cobros, Calendar=turnos, Gmail=mails). NO se replica "en serio" en una SQL propia (sería drift). Alinea con roadmap §4.4 "servicios externos = source-of-truth".
2. **SQL MÍNIMA (`uc_factory`/Supabase fusion) = backend propio IRREDUCIBLE** — solo lo que ninguna app externa puede ser dueña: identidad (`tenants`), credenciales OAuth cifradas (`mp_credentials`), metering/billing del SaaS, vínculo operación↔tenant. **NO cero backend: backend MÍNIMO** (ya desarrollado y vivo).
3. **Graphity (fact-triples) = PROYECCIÓN / índice** — copia consultable + relaciones cross-app, reconstruible desde (1)+(2). Su caída no pierde datos ni frena operaciones. BI numérica auditable sale de la app/SQL, NUNCA del grafo (roadmap §4.5 "números de queries reales, no del LLM").

Por qué el grafo NO reemplaza a las apps ni a la SQL: no hablamos Cypher directo con Neo4j sino la API de memoria de Graphity (search/edges/context, sin queries transaccionales/analíticas arbitrarias); dinero exige atomicidad/constraints/auditoría que da la app/SQL, no un knowledge-graph. El grafo brilla en **relaciones cross-app** (cliente→cobros→servicios→rentabilidad en un lugar). [[factory-identidad-automatizacion-ia]]

**⚠️ Hallazgo crítico:** un fact-triple crea NODOS+EDGE, **no un episodio** — y el recall temporal actual (`list_episodes_in_range`) lee EPISODIOS. → los triples NO aparecerían en el recall temporal tal cual. Decisión abierta (§4 del follow-up): (a) leer edges por fecha vía `GET /graph/edge/user/{id}` · (b) escribir triple + episodio-espejo · (c) group graph de operaciones separado.

**Verificado con la skill `graphity` (2026-06-10) — no re-spikear:** endpoint `POST /api/v2/graph/fact-triple` (payload `{source_node_name, target_node_name, edge_name, fact, group_id}`) · `group_id` decide user vs group graph (`user_<id>` o `graph_id` explícito) · latencia ~2-3s · **sin rate-limit global** (episodios sí: 60/min) · `Idempotency-Key`=id de la operación → proyección reconciliable sin duplicar · ontología custom vía `POST/PUT /api/v2/entity-types` (NO `graph/ontology`=501). **Reuso (A-1):** `deploy/worker/graphity_client.py` YA implementa `ingest_fact_triples()` (SDK, 201/202+`ingq_`) — extender el cliente del copiloto reusando ese patrón, no reinventar.

**Spikes ABIERTOS antes de implementar (spike-first):** S1 ¿el triple acepta timestamp del evento? (el episodio sí; el triple no lo lista → si no → forzar opción (b)) · S2 ¿se leen edges por fecha exhaustivo vía `/graph/edge/user/{id}`? · S3 aislamiento cross-emprendedor del canal fact-triple (adversarial) · S4 lag ingesta→query-able (inline vs outbox).

**Escritura reconciliable, NO dual-write acoplado:** best-effort inline para el MVP (la operación commitea en la DB primero; el triple es secundario, Graphity caído no frena el cobro), migrar a outbox async cuando el volumen lo pida. Primera proyección natural = cobros MP (`mp_payments` ya es SoT). [[copiloto-memoria-provider-ladrillo]] [[graphity-aislamiento-cross-tenant-verificado]] [[copiloto-emprendedor-roadmap]]
