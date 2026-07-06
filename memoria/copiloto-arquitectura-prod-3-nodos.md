---
name: copiloto-arquitectura-prod-3-nodos
description: "Arquitectura OBJETIVO de PRODUCCIÓN del Copiloto = 3 VPS dedicados (app+temporal / clon fusion / clon graphity). El VPS actual (unreal-copilot CX33) es SOLO dev/test. LEER al planear infra de prod, sizing, migración off-fusion, o escalado del copiloto."
metadata: 
  node_type: memory
  type: project
  originSessionId: 53c58a53-271e-474c-9267-f7720a2c6820
---

**Decisión de infra (operador, 2026-07-05): el Copiloto de PRODUCCIÓN corre en su propia infra dedicada de 3 nodos, NO en el VPS actual.** El VPS `unreal-copilot` (CX33 8GB) es **solo dev/test** (comparte RAM con Hermes, WhatsApp, la fábrica, Temporal-de-dev → no representa la capacidad de prod). Para no gastar en un server de pruebas aparte.

**Arquitectura objetivo (3 VPS dedicados solo al copiloto):**
1. **Nodo App** — Temporal + su Postgres + worker + web (frontend PWA + BFF) + GoTrue/auth. El que más stateful junta; al crecer, aislar primero **Temporal+su Postgres** (moat + sensible a latencia/durabilidad).
2. **Nodo fusion** — **clon dedicado** de la Supabase/Postgres (datos del copiloto: `uc_factory.tenants`, `mp_credentials`, etc.). Blueprint: `supabase-self-host-blueprint`.
3. **Nodo Graphity** — **clon dedicado** de Neo4j + embeddings (memoria de largo plazo). **El más hambriento de RAM** de los 3 → probablemente el nodo más grande.

**Alcance (NO confundir):** "dedicado a la app" = **1 clon fusion + 1 clon graphity para TODOS los emprendedores del copiloto** (multi-tenant adentro, RLS/aislamiento ya [VERIFIED]) — **NO** una instancia por usuario/cliente.

**Requisitos de diseño de prod (no negociables):**
- **Red privada** entre los 3 nodos (Hetzner vSwitch/private network): Postgres y Graphity NUNCA expuestos a internet; latencia baja. En dev se usa túnel SSH → en prod no va.
- **Backups/DR por nodo stateful** (fusion + graphity) desde día 0 — tooling en `fleet-platform`.
- **Migración off-fusion:** hoy los datos del copiloto viven en la Postgres de fusion (compartida) y la auth (GoTrue dedicada) en el VPS actual → prod independiente exige llevarse **datos + auth** a sus instancias propias. Es migración, no solo "levantar servers". [[copiloto-gotrue-dedicada-cutover]]

**Capacidad (contexto):** el LLM corre en APIs externas → el cuello del nodo app NO es CPU/usuario sino **concurrencia + footprint**. Estimado sin load-test: ~100–300 activos/día en un CX33 all-in-one; el split de 3 nodos sube el techo fuerte. Escala: app node → réplicas horizontales; fusion → vertical/read-replicas; graphity → vertical (Neo4j). **Falta un load test para reemplazar el estimado por un número medido.** [[copiloto-deploy-multitenant-vivo]] [[factory-identidad-automatizacion-ia]]

**Load test (F0) — instrumentado por componente, DISEÑADO no corrido.** Spec: `docs/copiloto-emprendedor/2026-07-05-load-test-spec-instrumentacion.md`. Mide con **atribución** (qué cede primero): 3 métricas Graphity (G1 Neo4j QPS/latencia · G2 cola de ingest async · G3 embeddings/turno) + app/infra (latencia E2E, recursos/nodo, Temporal, Postgres, 429 externos). Modelo de carga real (input operador): **50–100 acciones/día**, textos cortos, **recall 1×/turno**, **remember batcheado cada 20** (verificado en `conversation_workflow.py:203`). 2 corridas: **A** mock-LLM (cuello de infra puro, $0) → **B** real-LLM N-chico (calibra latencia+429+COGS). **Recomendación registrada para el futuro:** Corrida A contra clon efímero aislado + Corrida B chica contra dev; instrumentación **client-side primero** (gratis: timers en `MemoryProvider`/worker), server-side (métricas Neo4j + contadores ingest/embed = deuda de obs) junto con `obs-*` en el F1. **Conclusión del análisis Graphity:** a esos volúmenes NO es el nodo frágil — 1 read acotado/turno + writes batcheados cortos async → un solo nodo aguanta miles; techos reales = rate-limits externos + COGS. [[copiloto-memoria-provider-ladrillo]]

**Estado:** DECIDIDA + DISEÑADA (plan de infra + spec de load test en `docs/copiloto-emprendedor/`, en el ROADMAP §🧊 Diferido). **NO provisionar/correr ahora — asentado para implementar cuando el copiloto vaya a prod real.** Próximo paso al retomar: construir el harness Locust + timers client-side (sin externalidades) → decidir target/modo del run (§5 de la spec).
