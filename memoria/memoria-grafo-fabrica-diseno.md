---
name: memoria-grafo-fabrica-diseno
description: Memoria en grafo (Graphity) de la fábrica — IMPLEMENTADA + E2E validada live (PR #41). Cliente = SDK oficial graphity_sdk (async), NO el MCP ni zep-cloud. Ontología 13 entidades/18 edges. Aditivo (gate memory_enabled, OFF = byte-idéntico).
metadata:
  type: project
  originSessionId: 2482606c-a89b-44ac-a311-eae9c7d7e344
---

**Estado (2026-06-21): MERGEADA a `main` (PR #41, squash `4dcff73`) + deployada al VPS + E2E validada live.** (sobre [[casa-fabrica-features-diseno]]; branch borrada; VPS consistente con `main`). Memoria de largo plazo de la fábrica sobre **Graphity** (clon Zep self-hosted, VPS `graphity-prod` 37.27.80.155, tenant `unreal-copilot`, base `https://graphitymt.duckdns.org`).

**Diseño cerrado:** grafo per-repo (`graph_id=repo-<basename>`) = world-model. **Solo Claude escribe** (cierre exitoso, post-GATE2), **fact-triple-dominante**; el **músculo solo lee mediado por activity confiable** (nunca toca la key → frontera intacta). Bitemporalidad: cada fact con `valid_at=workflow.now()`. Ontología 13/18 (endurecida por workflow adversarial de 8 agentes, PR #37).

**Cliente = SDK oficial `graphity_sdk` (async httpx), NO el MCP (key opaca) NI `zep-cloud`.** Correcciones de contrato que cazó el spike (vs el diseño v1, que estaba MAL):
- `set_ontology` = `zep_compat.post_api_v2_entity_types` (`POST /api/v2/entity-types`, 200); `SetOntologyRequest.from_dict` ACEPTA nuestro JSON companion (Items free-form passthrough) — NO hace falta PUT crudo.
- Default **201 inline** (NO "202 siempre"); 202 solo si la cola está activa → pollear solo `task_id` que empieza con `ingq_` (y leerlo del body crudo, en 202 `parsed=None`).
- Usar variantes **`*_detailed`** (el cliente trae `raise_on_unexpected_status=False` → 409/403/202 = None).
- `graph_search` NO pasa `scope` string (revienta `to_dict`); enum/omitido. Mapea `edge_name→fact_name`, `group_id→graph_id`.

**Código (deployado al VPS, gate OFF por default = aditivo):** `deploy/worker/graphity_client.py` (wrapper) · `memory_activities.py` (`retrieve_repo_context`+`ingest_repo_knowledge`+helpers puros) · `deploy/graphity/onboard_repo.py` · wiring en `shared/feature_workflow.py` (lee post-andamiaje, escribe post-GATE2, **best-effort**: Graphity caído no rompe el build). Intake `start_feature` (MCP) propaga `memory_enabled` desde `UC_GRAPHITY_ENABLED` (single source of truth). Ladrillo `loop_core` intacto (contexto prepended al `task`).

**Verificación:** spike read-gate **264 ms p50 < 500 ms**. **Review adversarial** (workflow ultracode, 16 agentes, 5 lentes): 8 findings (1H/2M/5L) **todos fixeados con test**. **86 tests verde en el VPS** ([[tests-se-corren-en-vps]]). **E2E live:** onboard `repo-repo-prueba` (create=201/set_ontology=200 → **permiso no-admin confirmado**) · Feature A (gates self-driven por signal) → `completed` + PR real → **6 facts con valid_at** (EXPOSES contrato slugify + DELIVERED + USES_LIB + FOLLOWS + 2× HAS_GOTCHA del bucle de aprendizaje) · B lee: `retrieve_repo_context` de producción devuelve el `[REPO-CONTEXT]` con el contrato de A. Evidencia: `spikes/graphity-memory-connectivity/RESULT.md`.

**Activación: ✅ ACTIVADO en producción (2026-06-21)** — `UC_GRAPHITY_ENABLED=1` vía **drop-in systemd** `/etc/systemd/system/temporal-mcp.service.d/graphity.conf` + restart (verificado en `/proc/PID/environ` del MCP). → `start_feature` (Hermes) ahora setea `memory_enabled` en toda feature. El worker tiene la key en `/etc/unreal-copilot/deepseek-worker.env`. Desactivar: `rm` el drop-in (o `=0`) + restart. **Deploy = scp** (no git: el PAT del VPS no lee el repo privado → `/opt/unreal-copilot` es árbol scp, NO un checkout; el MCP vive aparte en `/opt/agentic/mcp/`, venv propio). **Capa 2** (meta-memoria cross-repo) = maquinaria NATIVA de Graphity (Observations/Communities/Detect Patterns/Themes — NO reinventar; Observations deriva de EPISODES → activarla implica escribir episodios narrativos), diferida.

**Docs:** reporte de implementación + **análisis estratégico** (capacidades desbloqueadas / ventaja competitiva en desarrollo autónomo; por qué grafo, velocidad/eficiencia como condición de viabilidad, loop engineering, roadmap L0→L4) en `docs/Implementaciones terminadas/2026-06-21-memoria-grafo-*` (PRs #41/#43, en `main`); spec + plan + ontología.json en `docs/superpowers/`.

**Frentes abiertos GESTIONADOS** (visibles, no impagos; detalle en el análisis §9/§10): (1) latencia del `search` a escala — hoy 264ms en grafo per-repo chico; **vigilar a >~100k facts** (mitigación: scoping por grafo + warm + HNSW + poda de facts fríos) = el frente más importante. (2) auditar `fact_validity` ≥85% con dataset representativo en grafo de prueba antes de confiar la calidad de extracción. (3) **Capa 2** (craft cross-repo) diferida. (4) la memoria guarda el **contrato, no el código** (reuso cross-feature necesita el cable de merge). Propietario: operador; condición de pago = cuando el grafo crezca / se mida drift.

🔐 La key Graphity vive en 5 lugares (instance.env, secrets/graphity.env, .env.graphity, uc-factory-worker.env, `/etc/unreal-copilot/deepseek-worker.env` del VPS) — rotar todos al rotar.
