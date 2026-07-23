---
name: localizacion-estructurada-feedback-agentes
description: "Al programar loops/agentes, el feedback al modelo debe ser LOCALIZADO (qué tocar exactamente), no una orden genérica. Baja regresiones ~70%. \"Dale el plano, no la orden.\""
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 22f9be26-6dc0-477b-b7b3-0d6b7afc3ac6
---

**Principio de programación de agentes y workflows:** cuando el sistema le devuelve feedback a un modelo para que corrija o avance, dale **localización estructurada** —QUÉ cambió, en qué archivo/función, el stack trace, el *impact graph* de qué dependía eso— en vez de una instrucción genérica ("corré los tests" / "arreglá el bug"). **"Dale el plano, no la orden."**

**Why:** es de los **poquísimos hallazgos con evidencia en un modelo del tamaño del stack real** (no frontier): TDAD (arXiv 2603.17973), probado con **Qwen3-Coder 30B** en hardware consumer → darle al agente el impact-graph AST de qué tocar bajó **regresiones 6.08%→1.82% (-70%)** y subió resolución 24%→32%. Contraintuitivo y **verificado**: el TDD-prompting naive SIN el mapa de impacto **AUMENTA** las regresiones — la orden a secas empeora. Es plug-and-play (sin fine-tuning), de los de mayor ROI para músculo barato. Ataca directo los failure modes #15 (task derailment / mala localización, 30-34% de fallos) y #9 (recency bias) del reporte SOTA `docs/research/2026-06-16-loops-sota-failuremap.md`.

**How to apply (al diseñar cualquier loop / activity / prompt que realimente a un agente):**
- **Feedback localizado, no crudo ni genérico:** "estos N tests fallaron, en estas funciones; el cambio tocó estos módulos; el traceback apunta a X" — NO "los tests fallaron, arreglá".
- **Para coding loops:** pasar impact-graph / `git blame` / test-diff / localización como **input estructurado**, no el stdout crudo (que además es vector de prompt injection — ver §5).
- **Para el paso diagnose→fix:** el diagnóstico debe atribuir el error al **módulo/función más granular posible** antes de pasarlo al fixer; acotar el campo de acción del fixer a esa unidad, no al archivo entero.
- **Acompañar con el invariants-log:** "estos tests ya pasaban, no los rompas" (mitiga oscilación). El plano incluye lo que NO hay que tocar, no solo lo que sí.

Relacionado: (deuda del feedback sin sanitizar / sin invariants-log) (la función de transición: la OBSERVACIÓN bien localizada es lo que hace útil al feedback).
