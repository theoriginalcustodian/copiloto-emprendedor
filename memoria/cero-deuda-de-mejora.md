---
name: cero-deuda-de-mejora
description: "La fábrica implementa TODAS las mejoras identificadas al cerrar un sprint, no las difiere — cero deuda de mejora (par de cero deuda técnica)"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 12059cb1-332d-4821-a3ba-e04ea45ababe
---

**Cero deuda de MEJORA: al finalizar un sprint, la fábrica implementa TODAS las mejoras identificadas, no las difiere.** Instrucción del operador (2026-06-25): *"la fábrica siempre debe implementar todas las mejoras al finalizar un sprint para mejorar siempre, cero deuda de mejora"*.

**Why:** una mejora identificada y no implementada ES deuda — el próximo sprint la redescubre o construye sobre el estado sin-mejorar, y el interés compone igual que la deuda técnica. Es la cara "de mejora" de [[cero-deuda-no-gestionada]] y la extensión de [[cierre-del-aprendizaje-no-opcional]]: el cierre de un sprint no es "el entregable funciona" sino "el entregable funciona **Y** todas las mejoras que el sprint reveló están implementadas". Diferir una mejora "como follow-up" sin implementarla = deuda de mejora invisible.

**How to apply:** al cerrar cualquier sprint, antes de declararlo terminado, enumerar las mejoras que el sprint reveló (al mecanismo, al plano, al pipeline) e implementarlas en el mismo cierre. El test binario: *¿quedó alguna mejora identificada sin implementar que NO requiera una decisión del operador?* Si sí, no terminó. Lo único que se difiere al operador: lo **no-código** (residual infra/legal) y las **decisiones MAYOR genuinas**. Todo lo demás (mecanismo/código/plano en mi alcance) se implementa al cerrar.

**Caso fundacional:** el sprint de hardening de la clínica reveló 3 mejoras "por construcción" (template de hardening reusable `hardening_reference.sql` · check `undriven_seam_candidate` en `plan_verifier` · pipeline adversarial obligatorio en `/generar-plano`) que primero quedaron como "follow-up priorizado"; el operador corrigió: se implementan al cerrar. [[cero-deuda-no-gestionada]] [[cierre-del-aprendizaje-no-opcional]]
