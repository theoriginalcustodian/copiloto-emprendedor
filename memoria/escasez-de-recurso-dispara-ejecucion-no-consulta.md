---
name: escasez-de-recurso-dispara-ejecucion-no-consulta
description: Crédito/cuota/tiempo que se agotan NO son una señal para preguntar qué adelantar — son la orden de reordenar la cola por impacto÷costo y despachar. Enumerar bien y no ejecutar es el error.
metadata:
  type: feedback
---

**REGLA DURA, instrucción directa del operador (2026-07-24).**

Con el 4 % de crédito semanal restante, el operador tuvo que preguntar *«¿qué de todo lo que tenemos
podemos ejecutar con scripts ahora? ¿qué podemos adelantar?»*. Su corrección:

> *«Yo no tengo que volver a preguntarte nunca más esa pregunta. Tu reacción debe ser automática. Ya
> deberías saberlo con precisión y ejecutarlo directamente.»*

**El disparador:** un recurso finito que se agota —crédito, cuota, tiempo antes de un corte, batería,
ventana de mantenimiento, deadline—. **La reacción, en el mismo turno:**

1. Reordenar la cola por **impacto ÷ costo**, no por el orden en que estaba.
2. Despachar **ya y en paralelo** lo barato-y-alto: lo que se resuelve con un **script** (se paga una
   vez y después corre gratis), lo delegable a **modelos baratos**, y todo lo que cumpla los 3
   criterios de background. Varios `Agent` en un mismo mensaje.
3. **Descartar explícito** lo caro-y-flojo, diciendo por qué. Con recurso escaso, gastar en el ítem de
   evidencia más débil es el peor uso posible.
4. Lo que exige decisión humana va en **un batch**, mientras el resto ya corre. No se frena la
   ejecución para preguntar.

**El error que esto mata no es la inacción.** Es **enumerar correctamente lo adelantable y no
adelantarlo** — dejar que el humano tenga que pedirlo. Eso lo convierte en el planificador de mi propia
cola, y con un recurso agotándose el ida y vuelta se paga en el recurso mismo.

**Por qué [[cero-tiempo-ocioso-tres-estados]] no lo cubría, que es lo que falló acá.** Esa regla se
dispara cuando **terminaste** algo. Esta se dispara **mientras trabajás**: no exige estar ocioso, exige
que un cambio de las condiciones externas re-priorice la cola sola. Yo estaba ocupado y produciendo —
cumpliendo «cero ocio» al pie de la letra— y fallando igual, porque seguía el orden viejo de la cola
mientras el recurso se terminaba.

Hermana de [[trabajo-oportunista-esperas]]: aquella aprovecha **tiempo muerto**, esta **recurso que se
termina**. Mismo filtro de seguridad (valor independiente · no conflictivo · no consume una decisión no
tomada) y mismo blindaje de fases: acelerar la cola **ya acordada** es ejecución
([[ejecutar-la-cola-acordada-no-es-una-decision-de-scope]]); adelantar una fase futura no aprobada, no.

**Fijada en tres lugares** porque una regla que vive sólo en memoria protege del olvido, no de la
racionalización ([[bucle-canonico-dos-auditorias-y-el-enganche]] §11):
`~/.claude/hooks/canon_invariantes.mjs` (regla 8b, inyectada **cada turno**) ·
`~/.claude/CLAUDE.md` §Meta-trabajo · `docs/BUCLE-CANONICO.md`.

Relacionadas: [[ejecutar-autonomo-no-esperar-si-dale]] · [[aplicar-siempre-ejecutar-con-eficiencia]] ·
[[una-espera-sin-disparador-nombrable-es-paralisis]].
