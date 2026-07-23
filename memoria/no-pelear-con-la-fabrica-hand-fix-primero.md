---
name: no-pelear-con-la-fabrica-hand-fix-primero
description: "Cuando un generador/sistema automatizado renega generando algo, hand-fix + E2E verde primero, arreglar el generador como track separado — no pelear a corridas repetidas"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 740a8738-1d17-4664-b59a-2af7255572ff
---

Cuando un **generador/sistema automatizado flaky** (una fábrica de código, un pipeline de build, cualquier proceso que produce un artefacto y a veces renega) falla generando algo, **NO pelear a corridas completas repetidas**. Secuencia correcta:

1. **Snapshot, no stream:** al 1er fallo, capturar TODA la data del fallo de una vez (radiografía completa: resultado + traces + deps + output crudo + raw del generador), NO iterar fix→rerun.
2. **Hand-fix + E2E verde:** si hay una versión conocida-buena, arreglarla a mano y dejar el **sistema funcionando E2E** ya mismo. La app no espera al generador.
3. **Diagnóstico offline barato:** encontrar la causa raíz con un **spike dirigido** (segundos, contra el componente real), NO con corridas completas repetidas (caras en tiempo y costo).
4. **Arreglar el generador como track SEPARADO** y no-bloqueante, documentado para su sprint.

**Por qué:** peleando para que un generador produjera un artefacto que una versión conocida-buena ya pasaba 5/5 desde el minuto cero, se quemaron varias corridas completas + una escalada MAYOR prematura. La causa raíz real (`max_tokens` bajo para reasoning models → `content` vacío) se encontró recién con un spike dirigido, no con las corridas.

**How to apply:**
- Señal dura de STOP: **una conclusión que contradice el track record del sistema** ("nunca falló tanto") = pausar y re-diagnosticar, NO empujar.
- Honrar el guardarraíl de **tactical drift**: al 2º fix sobre la misma entidad, re-diagnosticar raíz — no racionalizar el "es la misma raíz" y seguir.
- Escalar MAYOR solo con **evidencia limpia y completa** (no conflacionada con un bug latente sin diagnosticar).

Es [[cierre-del-aprendizaje-no-opcional]] aplicado al loop humano-generador. Hermana de [[no-codificar-la-esperanza-principio-raiz]] (la prueba vale: el E2E hand-fixeado ES la prueba; la corrida-tras-corrida es esperanza).
