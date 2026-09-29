---
name: un-umbral-calibrado-es-una-foto-del-sistema-de-ese-dia
description: Los topes y umbrales del sync del grafo se calibraron en julio, cuando el grafo tenía ~1.5% de densidad de aristas; hoy tiene ~26%. El número sigue siendo válido, ejecutable y sin error — y por eso su vencimiento no da síntoma. Y el tope de borrado es el ÚNICO detector de zombies que existe: no hay monitoreo, hay un accidente diferido.
metadata:
  type: project
---

# 📅📏 Un umbral calibrado es una foto del sistema de ese día — y el freno no es un monitor

Dos deudas del sync del grafo (`scripts/graph-sync.sh` + el bridge), que son **la misma**: sus
parámetros se calibraron cuando el grafo era otro, y nada avisa cuando dejan de describirlo.

## 1. El único detector de zombies es el freno que te frena

El reconcile aborta si el diff borraría más de **200** objetos. El 2026-09-23 el diff dio **434** y
bloqueó a las cuatro sesiones a la vez: ningún PR podía pushearse cuando el bridge conseguía el lock.

Los zombies —nodos de archivos que cambiaron o se borraron— **se acumulan en silencio**. Nada los
cuenta, nada los limpia, ningún panel los muestra. El primer aviso de que hay basura es el sync
abortando, es decir: **el sistema se entera cuando ya no puede trabajar.** Eso no es un guard con
umbral, es un accidente diferido con fecha desconocida.

La consecuencia operativa importa más que el número: destrabarlo exige `UC_GRAPH_FORCE=1`, que es
**irreversible y sobre estado compartido por cuatro sesiones**. O sea, el mecanismo de limpieza
rutinario es una decisión humana de riesgo. Y como el tope no se mueve solo, **esto va a volver a
pasar**: el 434 de hoy es el 200 de dentro de unas semanas.

Lo que falta no es subir el tope —eso sólo aleja el choque— sino **una métrica de zombies que se
mire antes de llegar al freno**, y una limpieza que no dependa de chocar. Mientras no exista, la
deuda es visible y tiene dueño (planificación, 2026-09-23), que es lo mínimo que la regla exige.

> Emparenta con [[el-guard-se-vuelve-el-cuello-de-botella-de-lo-que-protege]], pero no es lo mismo:
> allá el guard estorba haciendo su trabajo; acá el guard **es el único instrumento que existe**, y
> por eso sólo informa cuando ya es tarde.

## 2. `min_support` es una constante cuyo denominador cambió 17×

El enricher de `co_change` reportó: `top_k=10 podó 197 de 2337 pares`. Y la densidad de aristas del
grafo pasó de **133 (~1.5%)** en julio a **2140 (~26%)** hoy.

`min_support` se calibró contra el grafo de julio. Hoy sigue siendo un número válido: el script corre,
no tira error, el log se ve igual. **Un umbral vencido no se comporta como un bug — se comporta como
una opinión que ya nadie sostiene.** Con 17× más aristas, el mismo `min_support` selecciona una
fracción distinta del grafo, y nadie puede decir cuál sin medirlo.

**La regla: un umbral no se copia entre épocas del sistema, se RE-MIDE.** Copiarlo es asumir que el
denominador no cambió, que es justo lo que nadie verificó. Si se cita `min_support` en un diseño,
tiene que venir con la fecha de su última medición o no vale.

## Lo generalizable

Un umbral, un tope o un `top_k` son **mediciones con fecha**, no constantes. Envejecen sin dar
síntoma porque siguen siendo ejecutables: ningún gate se pone rojo, ningún test falla, el log dice lo
de siempre. Es el mismo modo de falla de
[[el-puntero-al-doc-actual-sobrevive-a-la-ronda-que-describia]] aplicado a números en vez de links.

Dos preguntas que los cazan:
- **¿Contra qué tamaño de sistema se calibró esto, y cuánto creció desde entonces?**
- **¿Qué me avisa de esta acumulación ANTES del freno?** Si la respuesta es «el freno», no hay
  monitoreo.

Ver también [[idempotente-no-es-convergente]] (un parámetro que no converge al estado deseado) y
[[instrumento-que-no-mira-nunca-falla]].
