---
name: ejecutar-la-cola-acordada-no-es-una-decision-de-scope
description: Arrancar el próximo hito de una secuencia YA acordada y contratada es ejecución, no una decisión MAYOR — tratarla como decisión frena la fábrica esperando un "dale" que no hace falta
metadata:
  type: feedback
---

**Arrancar el siguiente hito de una cola YA acordada NO es scope — es ejecución. No esperes el "dale".**

El 2026-07-23 la fábrica quedó **~4 h ociosa**. narra (MAYOR, bien escalado) cerró verde a las 18:46 y
con eso el hito 7 quedó con su disparador cumplido. Nadie lo arrancó: planificación lo trató como
"decisión de scope del operador" y reportó "ocio operator-side" cada 3 min durante 40 ciclos. El
operador tuvo que preguntar *"¿por qué se frenó el trabajo?"*. El chequeo que lo destrababa costaba 2
minutos (leer los disparadores del PLAN) y estuvo disponible las 4 h.

**Por qué pasó — tres capas que se componen:**
1. **Postura de escalamiento arrastrada.** Escalar narra fue correcto; quedarse en modo "espero al
   operador" DESPUÉS de que narra cerró, no. La secuencia siguiente ya estaba aprobada y contratada:
   ejecutarla no requería decisión nueva. [[trabajo-por-fases-no-anticipar]] protege de adelantar una
   fase; su espejo es NO ejecutar una fase ya autorizada.
2. **Compuerta falsa.** "Puedo bajar el hito 8 — decime *dale*" convierte una acción autorizada en una
   pregunta. Es literal [[ejecutar-autonomo-no-esperar-si-dale]]: disparador cumplido → ejecutar.
3. **El monitor confirmó en vez de verificar.** 40 reportes de "ocio operator-side, ya surfaceado" se
   *sintieron* como diligencia, pero eran la misma clasificación equivocada repetida sin volver a
   probarla. [[instrumentos-que-confirman-en-vez-de-verificar]] · [[vacio-no-es-hallazgo-correr-el-control]]:
   una fábrica en silencio es un vacío que no protesta — no obliga a revisar la explicación, y por eso
   la explicación falsa se canoniza.

**El test que faltó (barato, corre siempre):** ante cualquier espera que atribuyas al operador,
preguntá *"¿esto está bloqueado en algo que SÓLO el operador puede decidir, o lo estoy llamando así?"*
y **corré el control**: leé los disparadores reales. Si el disparador ya está cumplido, no es decisión
— es ejecución pendiente, y frenar es la falla. MAYOR es sólo lo que cambia dirección/stack/contrato o
es irreversible; elegir el siguiente ítem de una cola aprobada no lo es.
[[autorizacion-permanente-merges-y-deploys]] · [[una-espera-sin-disparador-nombrable-es-paralisis]]

**How to apply (fix de RAÍZ, no de conducta — una lección que depende de recordarla se olvida):**
el control se automatizó, igual que el buzón dejó de depender de disciplina con el janitor
([[buzon-se-ordena-por-janitor-no-por-disciplina]]). `scripts/cola-check.sh` lee el bloque **COLA-VIVA**
de `PLAN.md` (sólo los hitos que faltan) y, si NADA está `arrancando` pero hay un `pendiente`, grita
`⚠️ arrancable sin arrancar` con su disparador. Planificación lo corre **en cada ciclo de monitor,
junto al janitor**. Regla dura (COORDINACION §4.2.quinquies): **prohibido declarar "ocio legítimo" o
"operator-side" sin haber corrido `cola-check.sh` primero** — el ocio es legítimo sólo si el script no
grita. Probado: con el hito 7 en `pendiente` y nada arrancando, el script grita "hito 7 → arrancalo"
(habría cazado el freno a las 18:47 en vez de a las 21:25).
