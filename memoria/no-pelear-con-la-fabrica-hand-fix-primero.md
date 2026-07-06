---
name: no-pelear-con-la-fabrica-hand-fix-primero
description: "Cuando la fábrica renega generando un unit, hand-fix + E2E verde primero, arreglar la fábrica como track separado — no pelear a corridas repetidas"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

Cuando la **fábrica** (SeniorWorkflow/FeatureWorkflow) renega generando un unit, **NO pelear con la fábrica a corridas completas repetidas**. Secuencia correcta (enseñada por el operador, gap B 2026-07-01):

1. **Snapshot, no stream:** al 1er fallo, capturar TODA la data del fallo de una vez (radiografía completa: RESULT + traces + dep_files + output crudo del gate + raw del modelo), NO iterar fix→rerun.
2. **Hand-fix + E2E verde:** si tenemos una versión conocida-buena (el `reference_impl`), arreglar la unit a mano y dejar el **sistema funcionando E2E** ya mismo. La app no espera a la fábrica.
3. **Diagnóstico offline barato:** encontrar la causa raíz de la fábrica con un **spike dirigido** (segundos, contra el componente real), NO con acceptances completas (~15 min + costo real de Claude c/u).
4. **Arreglar la fábrica como track SEPARADO** y no-bloqueante, documentado para su sprint.

**Por qué:** en gap B quemé **3 acceptances completas + una escalada MAYOR prematura** peleando para que el músculo generara `router`, cuando el `reference_impl` pasaba 5/5 desde el minuto cero. La causa raíz real (`max_tokens` bajo para reasoning models → `content` vacío) se encontró recién con un spike dirigido, no con las corridas.

**How to apply:**
- Señal dura de STOP: **una conclusión que contradice el track record del sistema** ("la fábrica nunca falló tanto") = pausar y re-diagnosticar, NO empujar. El operador tuvo que frenarme ("3 strikes, detente").
- Honrar el guardarraíl de **tactical drift**: al 2º fix sobre la misma entidad, re-diagnosticar raíz — no racionalizar el "es la misma raíz" y seguir (lo hice y el 3er strike me dio la razón al guardarraíl, no a mí).
- Escalar MAYOR solo con **evidencia limpia y completa** (no conflacionada con un bug latente sin diagnosticar).

Es [[cierre-del-aprendizaje-no-opcional]] aplicado al loop humano-fábrica. Hermana de [[no-codificar-la-esperanza-principio-raiz]] (la prueba vale: el E2E hand-fixeado ES la prueba; la corrida-tras-corrida es esperanza). [[costo-incertidumbre-precision-ratchet]]
