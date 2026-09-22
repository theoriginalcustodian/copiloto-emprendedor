---
name: book-skill-builder-v1-operativa
description: "Skill global book-skill-builder v1 COMPLETA: DoD v1 y DoD-grafo cerrados con evidencia (2026-08-11); ingesta real al tenant skills de Graphity funcionando"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2b7d3b14-ae48-4648-b69b-9c412e3ecc99
  modified: 2026-08-11T04:17:32.523Z
---

La skill global **book-skill-builder** (libro → skill instalable con provenance verificable)
quedó **v1 operativa el 2026-08-11**. Repo: `C:\Proyectos\Claude\Claude code\book-skill-builder\`
(NO es parte del repo copiloto). Instalada en `~/.claude/skills/book-skill-builder/`.

**Arquitectura:** 4 fases (EXTRAER motor vendorizado `vendor/book-to-skill` fork duro pinneado →
MODELAR `knowledge.yaml` de 9 primitivas con anchors literales → VERIFICAR gate mecánico →
GENERAR perfiles referencia/aplicacion/estudio) + ingesta opcional a Graphity
(`scripts/ingest_to_graph.py`, espejo fail-closed del cliente structured del copiloto).

**Los 4 gates** (todos pueden DECIR NO, todos probados en ambos sentidos con controles plantados):
`tools/verify_provenance.py` (VERBATIM/PARAPHRASE/FABRICATED/MISATTRIBUTED, mapa de capítulos
por posición — inmune al TOC), `scan_generated_skill.py` (injection), `validate_skill.py`,
y `tools/check_quotes_subset.py` (4º gate, nacido de un hallazgo real del loop de skill-creator:
en la regeneración de perfiles sin texto fuente el modelo re-tipografía/completa citas; compara
contenido tolerando puntuación).

**DoD cerrado con evidencia** (E2E con Alicia, Gutenberg #11): invocación headless exit 0 →
skill `alice-wonderland` instalada; benchmark skill-creator 100% con skill vs 33% sin
(workspace `book-skill-builder-workspace/iteration-1/review.html`). Escenario de presión
"hacela simple" corrido desde cero: pipeline completo sin saltear gates.

**DoD-grafo CERRADO 2026-08-11** (evidencia en `DOD-GRAFO.md` del repo): tenant dedicado de
skills provisionado por Graphity, credenciales SOLO en `~/.claude/graphity/skills.env`
(`GRAPHITY_SKILLS_BASE_URL`/`GRAPHITY_SKILLS_API_KEY` — jamás en chat/commit). Alice ingestada:
ontología estándar registrada scoped a `graph_ids=[book-alice-wonderland]` (nuevo
`scripts/register_ontology.py`: 10 nodos + 7 edges con descripciones precisas, SIN
`source_targets` — el par-check del server es sin fallback y los 6 edges unidad→unidad son
abiertos por diseño), 13/13 datasets `completed` con `failed=0`, búsqueda híbrida devuelve la
cita textual. Gotcha de contrato (ADR-046 Graphity): `fact_template` solo interpola
`{source}/{edge}/{target}` + atributos del `property_map` DEL EDGE — columna no declarada = 422.
Repo con commit inicial `a0de47a`. Relacionado: [[copiloto-ingesta-grafo-por-tenant-real-frente-abierto]].
