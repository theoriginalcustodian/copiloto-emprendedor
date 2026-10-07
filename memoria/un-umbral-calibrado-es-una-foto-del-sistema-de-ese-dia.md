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

---

## Refuerzo (2026-09-30): el guard mide el daño PENDIENTE, así que el daño PARCIAL lo erosiona hasta apagarlo

El mismo guard de este sistema, un modo de falla distinto del envejecimiento: no es que el umbral
quede viejo — es que **el propio daño lo baja hasta por debajo del umbral**.

`bridge/reconciler/differ.py:78-86`, con `present` leído del remoto **en cada corrida**:

```python
zombies = present - expected      # present = lo que el remoto tiene AHORA
if force: return zombies          # --force no evalúa ningún tope
if len(zombies) > 200: raise ReconcileError(...)
```

Y su propio comentario nombra la condición que lo rompe: *«Tope ABSOLUTO de borrados **por
corrida**»*. **No hay estado entre corridas** (`cli/main.py:68`, `orchestrator/sync.py:98`).

El día en que el diff legítimo fue 1406 (una re-poda intencional: `min_support 2→3` bajó las aristas
de 2190 a 786), el guard abortó — correcto. Pero el borrado se intentó con `--force` contra un host
intermitente que corta a mitad, y el cliente borra **un HTTP DELETE por objeto, sin retry ni
batching** (`client/graphity.py:167-173`). Cada corrida parcial deja N borrados aplicados:

```
1406 -> 1402 -> ~1200 -> ~900 -> ... -> < 200   <-- aca el guard DEJA de disparar
```

A partir de ahí una corrida **sin** `--force` borra el resto con exit 0 y se lee como un sync sano. El
guard existe para cazar «cientos de borrados = anomalía»; el borrado parcial repetido **convierte una
anomalía de 1406 en catorce de 100**, cada una bajo el tope, ninguna visible. Y la degradación es
doble: `fraction = len(zombies)/len(present)` también cede, porque el denominador se encoge junto con
el numerador.

**Why:** porque el camino que erosiona el guard es el que suena razonable. La opción escrita como
aceptable era *«reintentos manuales espaciados hasta que converjan — no es un bloqueo total, es
attrition»*. Converge, y en el camino apaga la protección; el próximo accidente real (un enricher que
devuelve vacío y borra cientos de aristas con exit 0 — el caso para el que el guard se escribió) ya no
encuentra guard. Nadie miente y nadie se distrae: el mecanismo se consume solo.

**How to apply:** (1) ante un guard con un tope, preguntá **contra qué estado se recalcula** — si el
estado lo mueve la propia operación que el guard vigila, el guard es consumible; (2) un tope «por
corrida» sobre una operación reintentable necesita **memoria entre corridas** (acumulado, o un plan
persistido que no se recalcule), o deja de ser un tope; (3) el reintento va **en la unidad que falla**
—acá el request HTTP— no en la corrida entera: reintentar la corrida es lo que fragmenta el daño;
(4) el canario es una llamada doble en local: `plan_deletions` con `present` completo debe abortar, y
con 1210 uuids quitados de `present` **no** debe abortar — si las dos abortan, no hay erosión.

Ver también [[el-guard-se-vuelve-el-cuello-de-botella-de-lo-que-protege]] (este guard frenó el push de
las 4 sesiones) y [[el-guard-falla-abierto-en-su-caso-de-activacion]].

**El canario, corrido el mismo día contra la función real** (`plan_deletions` es pura: no toca el
remoto), con 9.000 esperados para que el umbral porcentual no interfiera:

```
pendiente 1406 -> ABORTA · 1206 -> ABORTA · 806 -> ABORTA · 406 -> ABORTA · 196 -> NO ABORTA
control positivo: 201 -> ABORTA · 200 -> NO ABORTA   (la comparación es `>` estricta)
```

Y mostró un matiz peor que el enunciado: en la última corrida el guard **no sólo deja de abortar —
devuelve los 196 borrados y el reconcile los aplica por el camino normal, sin `--force`**. La
descripción precisa no es «se apaga», es «**completa el borrado él mismo**», y el tramo final entra
como un sync sano. El enunciado que escribí primero era más benigno que el hecho; correrlo lo corrigió.

---

## 🔻 Refuerzo 2026-10-07 — el esperado **no derivó**: un merge le borró la población, y otra población quedó contestando al mismo nombre

El enunciado de arriba dice que un umbral envejece sin dar síntoma. El caso de hoy agrega la forma
**peor de leer**: el número reproduce **distinto**, y eso se parece a deriva cuando en realidad el
sujeto cambió.

La fila `DIRECTIVASHUERFANAS` del plan declaraba su instrumento con esperado medido: *«correr el lint
y contar los `Unused eslint-disable directive` — **11** en **9** archivos»*, sobre directivas que
apuntaban a `react-hooks/exhaustive-deps`. Reproduje el instrumento en `origin/main` = `3c98efd2`
(árbol con el scope idéntico al remoto, verificado por `git diff`):

```
Unused eslint-disable directive : 29  en 27 archivos  (27 test, 0 de producción)
de ellas, a react-hooks/exhaustive-deps: 0
desglose real: 26 import/no-unresolved · 2 no-await-in-loop · 1 no-console
```

**Las 11 no derivaron a 29: las borró un merge.** #875 (`9e344bdf`, 2026-10-06 21:59) eliminó
exactamente 11 líneas `eslint-disable-next-line react-hooks/exhaustive-deps` en 9 archivos
(`9 files changed, 11 deletions(-)`), y el control positivo del grep en `9e344bdf^` devuelve los
9 archivos / 11 hits ⇒ el `0` de hoy es ausencia real, no un patrón ciego.

**Por qué no dio síntoma, que es el punto de esta entrada:** la fila siguió `pendiente` con su dueño,
y su instrumento **sigue corriendo y sigue imprimiendo un número**. Nada falla. El esperado envejeció
el día del merge y nadie lo mide contra el merge.

**Y la trampa nueva:** comparar 29 contra 11 invita a «re-calibrar el esperado a 29», que habría sido
un hallazgo falso prolijo — las 29 son de **otra regla**, en archivos de test, y no tienen nada que ver
con la preocupación de la fila. El veredicto correcto es doble: la fila está **absorbida por el merge**,
y la observación que sobrevive (ruido inerte que se lee como protección) necesita **fila nueva con su
propio sujeto**. La causa se retira; la observación no
([[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]]).

Lo que hizo fácil el choque: el `11 en 9` aparece **dos veces** y mide dos cosas distintas que
coinciden — las 11 directivas que #875 borró, y las «11 violaciones en 9 archivos» que
`eslint.config.mjs:49-52` registra como la medición de la regla activada (que reproduje: 11 en 9).
Dos cantidades con el mismo valor y el mismo nombre corto.

**How to apply:**
1. Cuando un esperado **no reproduce**, hay dos explicaciones antes de tocar el número: *derivó* o
   *le cambiaron el sujeto*. La pregunta que separa es la de los gemelos — **¿qué población cuenta
   cada lado?** ([[una-asimetria-entre-gemelos-no-prueba-que-uno-este-mal]]).
2. Un esperado que nombra un sujeto (una regla, un path, un tenant) son **dos** afirmaciones: el
   conteo y el sujeto. Por costumbre se re-mide el conteo; el sujeto no lo re-mide nadie.
3. Antes de re-calibrar, buscá el **merge** que pudo borrar la población: `git log -S` del símbolo
   contra el rango desde que se escribió el esperado. Un esperado vence por commit, no por tiempo.
4. Todo esperado se escribe con **SHA y desglose por sujeto** (acá: 29 = 26 + 2 + 1, por regla). Sin
   el desglose, la reproducción siguiente no puede distinguir deriva de sustitución.
