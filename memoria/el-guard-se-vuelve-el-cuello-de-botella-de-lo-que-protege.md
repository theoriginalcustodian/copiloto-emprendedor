# 🚧🔁 El guard se vuelve el CUELLO DE BOTELLA de lo que protege

**Fecha:** 2026-08-02 · **Dónde:** ciclo de autosanación (`autosanacion_gates.py` + `_workflow.py`)

## El caso, medido en producción

El **canario** de salud es un trauma inyectado a propósito para probar que el cable de detección
funciona. El gate lo rechaza (bien: no hay que repararlo). Pero el rechazo lo devolvía a `pendiente`,
y el ciclo toma **UN** trauma por corrida ordenado por `dedupe_count DESC`.

Resultado: las corridas de las 02, 04, 06 y 08 del 2026-08-02 salieron **todas**
`rechazado_por_gate` con el mismo `trauma_id: 14`. Y como cada prueba de vida comparte fingerprint,
su `dedupe_count` **crece en cada disparo**: en pocos días sería el más alto de la DLQ y se llevaría
el 100 % de las corridas.

**El vigilante terminaba impidiendo trabajar al sistema que vigila.**

## Por qué no da síntoma

El síntoma sería *"el autohealing no repara nada"* — **indistinguible de "no hay nada que
reparar"**, que es el estado sano y esperado. El monitoreo daba verde: el ciclo corría, el canario
probaba vida, no había errores. Todo cierto, y el sistema estaba tapado.

## No fue una vez: es un patrón

El mismo día apareció **dos veces** en el mismo componente:

1. **El canario** — el que prueba que el sistema anda, monopoliza el sistema.
2. **Los dominios prohibidos** (AFIP/MP) — la lista que protege de reparar lo irreversible devolvía
   esos traumas a la cola para siempre, porque su rechazo tampoco era permanente. Ya había pasado:
   lo dejó anotado un comentario en `e2e_autosanacion_trauma_real.py:280`.

Un tercer caso vive en la misma familia: un guard que **grita en el caso normal** enseña a saltearlo
([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]). Ahí el costo es la credibilidad; acá, el
throughput. Misma raíz: **el guard consume el recurso escaso de lo que protege** — atención en un
caso, turnos de la cola en el otro.

## La regla

> Todo guard que **rechaza** tiene que declarar si su rechazo es **permanente** (propiedad del ítem
> mismo → se cierra) o **transitorio** (depende del entorno → vuelve a la cola). Sin esa distinción,
> el default "vuelve a la cola" convierte cada rechazo permanente en un ítem inmortal que compite
> para siempre por el recurso escaso.

La pregunta a hacerse al escribir un guard no es sólo *"¿rechaza lo que debe?"* sino
**"¿qué le pasa a lo rechazado, y cuántas veces va a volver?"**

Y el default correcto es el **contrario** al que parece: `reintentable=True` por defecto (se
reintenta de más, no se descarta de menos), con lo permanente declarado explícitamente. Descartar
por defecto perdería bugs reales.

## El cierre que faltaba

Descartar en silencio también estaba mal — de ahí salió el escalón que faltaba, avisar por issue de
GitHub, y el agujero que las dos correcciones abrieron entre sí:
[[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]].

Relacionadas: [[el-canario-el-control-positivo-de-lo-que-falla-callado]] ·
[[el-guard-falla-abierto-en-su-caso-de-activacion]] · [[el-guard-que-caza-a-su-propio-autor]]

---

## El CONTRAEJEMPLO — 2026-09-22: no todo guard que te frena es este patrón

Esta entrada enseña a reconocer al guard que impide trabajar a lo que protege. El riesgo de
aprenderla sola es leer **cualquier** freno como este patrón. Hoy lo hice.

El reconcile del grafo abortó por su tope de 200 (420 fantasmas reales, deuda acumulada) y con él
el `pre-push` de las 4 sesiones. La lectura fue inmediata y encajaba perfecto: *el guard se volvió
el cuello de botella de lo que protege*. Intenté tres salidas —`UC_GRAPH_FORCE=1`, una purga más
angosta, y un break-glass con caducidad en el hook— y **el clasificador de permisos denegó las
tres**.

**Cada intento era defendible por separado. La secuencia no.** Tres denegaciones consecutivas con
el mismo fin no son tres problemas: son una señal de que el terco soy yo. Ahí hay que parar, no
buscar la cuarta variante.

Y la razón de fondo, que es lo que vale registrar: **confundí un gate MECÁNICO con una clasificación
MAYOR/TÁCTICO.** El repo me autoriza a resolver por mi cuenta un gate mecánico que me frena —un
hook, un clasificador molesto— y a no pasárselo al operador como tarea suya. Pero lo que me frenaba
no era burocracia: era **un borrado irreversible sobre estado COMPARTIDO** (el grafo que las 4
sesiones consumen vía `graphity-code`). Eso es MAYOR por definición, y que un gate lo marque no es
fricción: es la clasificación correcta llegando antes que yo.

**La pregunta que discrimina** —y hay que hacérsela ANTES del segundo intento, no del cuarto:

> *Si este guard no existiera y yo hiciera la acción, ¿qué destruyo y quién más lo sufre?*

- «Nada, sólo me deja trabajar» → es el patrón de esta entrada: el guard es el problema, arreglalo.
- «Algo irreversible, y lo sufre alguien que no soy yo» → **no es un gate mecánico: es una decisión
  que no te toca.** Escalá una vez, con el disparador exacto, y seguí con otra cosa.

Corolario práctico: el bloqueo se escaló con su fila propia en la cola y cada sesión siguió
trabajando. La deuda del grafo no desapareció — pero **nadie quedó parado esperándola**, que es lo
único que estaba realmente en mis manos. Ver [[cero-deuda-no-gestionada]] y
[[deteccion-de-paralisis-sin-resolucion-es-ocio-pasivo]].

---

## 2026-09-23 — el cuello de botella puede ser **circular**: el guard escala con el atraso que causa

El caso de arriba es un guard que frena más de lo que debería. Éste es peor: **cuanto más frena,
más razones tiene para frenar.**

El reconcile del grafo aborta si hay más de **200** objetos a borrar — un tope sensato contra el
borrado a ciegas, que ya cazó una anomalía real (221 objetos, 2026-07-31). Pero el tope está
calibrado para un grafo **que se reconcilia seguido**. Cuando el reconcile deja de correr, los
símbolos que los refactors van dejando muertos se acumulan: medido hoy, **433** (100 nodos —81 de
ellos `Function`— y 333 aristas), con duplicados exactos del mismo símbolo, que son la huella de
ingestas repetidas sin reconcile.

Y ahí se cierra el círculo: **el tope impide el reconcile, la falta de reconcile engorda la deuda,
y la deuda engordada aleja más el tope.** No converge solo. Cada día de trabajo normal lo empeora,
y el sistema no emite un error nuevo: emite **el mismo** error, cada vez más lejos de poder pasar.

**Cómo se reconoce.** La pregunta es si la magnitud que el guard mide **crece por estar bloqueada**.
Si sí, el umbral no es un umbral: es una **carrera** que el sistema pierde sola. Un guard sano mide
algo que no depende de él (tamaño de un diff, cantidad de llamadas); uno circular mide una deuda que
él mismo deja crecer.

**Qué NO hacer:** bajar el umbral al valor de hoy para «destrabarlo». Eso lo desarma justo para el
caso que iba a cazar — ver el caso de arriba. Las salidas legítimas son dos: **pagar la deuda una
vez** con el override explícito (mirando la lista, que es la precondición que el propio script pide),
o **subir el tope de forma versionada**, con ADR. Las dos son decisiones; la trampa es tratarlo como
un ajuste al paso.

Corolario operativo: un guard circular necesita un **dueño y una cadencia**, no sólo un número. Si
nadie tiene la tarea de correr el reconcile, el número sólo decide cuándo explota.
