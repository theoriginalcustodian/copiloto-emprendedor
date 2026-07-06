---
name: apps-ricas-fix-race-signal
description: "3 apps del techo regeneradas RICAS (heal=0) + fix de raíz de la race de signal-al-start en arquetipos FIJOS. Lección MECANIZADA (clear-on-consume + start_signal test) — provenance."
metadata: 
  node_type: memory
  type: project
  originSessionId: 12059cb1-332d-4821-a3ba-e04ea45ababe
---

**3 apps del techo (subscription `grace` · appointment `reschedule` · inventory `edge_latch`) regeneradas a forma RICA, E2E vivo, `heal_turns=0`, MERGED** (2026-06-25). Con R1+R5 la fábrica monta el workflow rico FIJO (gate-only) y el músculo solo rellena el store → `heal=0` = la fábrica corregida pasa `validate_real` (fusion+Temporal+Chromium, multi-tenant RLS) al 1er intento. (inventory: edge_latch observa la **depleción** `umbral−stock` para que el high-breach dé alerta de stock BAJO.) Reporte: `docs/Implementaciones terminadas/2026-06-25-apps-ricas-regeneradas-fix-race-signal_reporte.md`.

**✅ LECCIÓN MECANIZADA** — fix en los arquetipos FIJOS + test de regresión; catálogo **F17** (race) + **H24** (heal-FIJO):
- **clear-on-consume > clear-on-enter** para flags de signal en loops de workflow. Raíz: el reset al tope de cada ciclo pisaba un signal buffereado entregado en la 1ª workflow-task (cancel inmediato renovaba en vez de suspender, 3/3 determinista en cluster real). En `grace`, NO limpiar `renew` al entrar a grace (un renew junto al cancel DEBE reactivar — el test cazó este bug en mi propio fix → un patrón de reset NO es universal).
- **El gate de time-skipping NO reproduce races de signal-timing** (corre el 1er slice antes del handler) → usar **`start_signal`** (entrega el signal atómico con el start) para protegerlas a nivel gate. Solo `validate_real` (cluster real) las expone si no.
- **El heal no arregla un FIJO de forma durable** (re-materializado desde skeleton → "validado ≠ commiteado", H24) → un FIJO que falla validate_real es bug del **arquetipo**: corregir el kit, no healear. `heal_turns=0` = métrica de salud de la fábrica. Mejora aplicada: gate-agent `--max-turns` 12→30.

[[r1-workflow-templates-fixed-mount]] [[sprint-biblioteca-7-apps-techo-workflows]] [[spike-first-central-proyecto]]
