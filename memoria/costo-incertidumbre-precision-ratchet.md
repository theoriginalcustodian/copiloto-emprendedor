---
name: costo-incertidumbre-precision-ratchet
description: Principio rector de la economía de la fábrica — el costo/fricción es proporcional a la INCERTIDUMBRE RESIDUAL; la precisión es un ratchet que solo compone con feedback + re-grounding. Reordena qué construir.
metadata: 
  node_type: memory
  type: project
  originSessionId: 93554263-af57-48fd-badc-53bcc5a53d6b
---

**El costo y la fricción del sistema son proporcionales a la INCERTIDUMBRE RESIDUAL, no a la cantidad de trabajo. La precisión que elimina esa incertidumbre es un *ratchet*: solo compone si cada build la realimenta y mientras siga fiel al territorio.** Acuñado 2026-06-22 reflexionando sobre el E2E del [[asistente-generar-plano]] (evidencia dura en [[flujo-c-economia-baseline]]).

**Why (el mecanismo, no la metáfora):** donde el contrato es exacto (domain-cards = forma EXACTA del stub validada contra la realidad), el espacio de búsqueda del músculo es ~cero → `flash` llena iter-0, sin escalar, sin heal, $0 de Claude plan/scaffold. Donde el contrato es difuso/inventado, el músculo busca → iters → escala → heal → costo. No hicimos al músculo más listo: le **sacamos la incertidumbre del camino** (esto ES C-1 precomputación de dominio + [[no-codificar-la-esperanza-principio-raiz]], visto desde la economía). **Prueba medida:** las 3 unidades isomórficas a un arquetipo validado = ~$0.0004/iter-0; la única con novedad real (`trial_workflow`, señales/timer durable) = **12× tiempo y 91% del costo**. El "impuesto a la novedad" es medible → el costo de una app es *predecible* contando unidades-novedosas vs unidades-ensambladas-de-la-base (reference-class forecasting).

**How to apply (reordena el roadmap):**
1. **Lo barato es un RÉGIMEN, no un estado.** Construir DENTRO del envelope validado es barato; todo lo de afuera vive en el régimen caro (ej: el frontend-real, sin card/arquetipo aún, será caro hasta aterrizarlo). No prometer "barato" para lo que sale del envelope.
2. **El trabajo de mayor ROI = expandir + re-aterrizar la base validada**, no "construir más apps". Cada dominio/patrón vuelto milimétrico (un arquetipo, una card, una convención capturada) crea un régimen barato para TODAS las apps futuras. El dogfooding (frente D) es **cosechar precisión**: cada app real termina con su aprendizaje plegado de vuelta a las cards/arquetipos — si no, la próxima app re-descubre los gotchas y re-paga el interés ([[cero-deuda-no-gestionada]], deuda invisible).
3. **La precisión es un snapshot que driftea.** Una card congela la convención de hoy (RLS de fusion, contrato de un SDK). Si el territorio se mueve, la card precisa se vuelve *precisamente equivocada* → el músculo rellena con **error confiado**, peor que la incertidumbre. Re-verificar contra lo vivo antes de fiarse (el DDL del trial-tracker salió bien porque fui a *mirar* fusion, no por confiar en la card). Conecta con drift-detection.
4. **Métrica de salud del sistema:** no es velocidad ni costo de una corrida — es **qué fracción del espacio de apps cae dentro del envelope validado**. Eso es lo que crece (o se pudre por drift).

**Frase:** la fábrica es una máquina de convertir incertidumbre en precisión UNA vez y reusarla. Fluye porque la incertidumbre se pagó por adelantado; sigue barata mientras (a) no salgas del envelope sin saberlo, (b) el envelope siga fiel al territorio, (c) cada build agrande el envelope en vez de solo consumirlo.
