---
name: cierre-del-aprendizaje-no-opcional
description: "El entregable de un sprint no es \"sin errores\" sino el cierre del aprendizaje — cada fallo termina en \"no puede volver por construcción\""
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 12059cb1-332d-4821-a3ba-e04ea45ababe
---

El operador (2026-06-25, cierre del sprint billing): *"lo importante no son los errores que encontramos sino cómo los corregimos y cómo evitamos que vuelvan a ocurrir; por eso es importante el cierre del aprendizaje en todos los sprints."*

**Why:** en una fábrica autónoma y recursiva el error **aislado** cuesta poco; el error que **vuelve** compone (cada agente futuro lo redescubre y paga el interés). El valor no está en no equivocarse — los errores son parte del desarrollo — sino en que cada fallo quede **cerrado de raíz**. Es la cara operativa de *cero deuda no-gestionada* + *raíz no parche* + *no codificar la esperanza*, elevada a **criterio de cierre de TODO sprint**, no opcional.

**How to apply:**
- **Test binario del cierre:** por cada error encontrado, preguntar *"¿puede volver a ocurrir?"*. Si la respuesta no es **"no, por construcción"**, el cierre NO terminó.
- "Por construcción" = (1) fix en el **mecanismo de la fábrica** (no en mi scratchpad ni en un paso manual que el próximo desarrollo deba recordar) + (2) **test de regresión** que falla sin el fix + (3) entrada en el **catálogo de errores** (`docs/2026-06-24-catalogo-errores-fabrica-remediacion-raiz.md`) movida a ✅ Raíz.
- Un parche en scratchpad que funciona es *codificar la esperanza a nivel de proceso*: espera que el futuro lo recuerde. El cierre real es cuando el aprendizaje deja de ser un script que yo corro y pasa a ser una activity/guard que el sistema corre solo.
- **El cierre del aprendizaje es un entregable del sprint**, junto al código: reporte + catálogo de errores actualizado + memoria. Sin eso, el sprint no está cerrado aunque el feature funcione.

Ejemplo canónico: sprint billing (2026-06-25) — 6 raíces (J25–J30) todas a ✅ con test de regresión + absorción a la fábrica (patcher, detección de deps, guard de provision, push robusto). Ver [[billing-system-sistema-compuesto]].

[[cero-deuda-no-gestionada]] [[no-codificar-la-esperanza-principio-raiz]] [[raiz-no-parche]] [[spike-first-central-proyecto]]
