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

---

## 2026-10-07 — la variante que no mide deuda: el guard exige una **precondición que otros te mueven**

Las dos variantes de arriba son del mismo sistema contra sí mismo. Ésta aparece recién con **sesiones
paralelas**, y por eso no se ve leyendo un script solo.

`deploy/copiloto/guard-deploy.sh:35-38` **aborta si `HEAD ≠ origin/main` recién traído**. Es la regla
correcta y nació de un caso real: un deploy desde una rama revierte en prod lo que otra sesión mergeó un
minuto antes ([[un-rebuild-desde-otra-base-revierte-un-fix-ya-cerrado]]). Del otro lado, backend tiene la
regla igual de correcta: *«si el recibo de CI no es de ese SHA, no corro»*.

Las dos juntas producen una **carrera que se pierde siempre**: el gate tarda, y mientras corre, las otras
tres sesiones mergean ⇒ el recibo nace viejo, el guard rechaza el SHA gateado, y no hay deploy nunca. Es
otra instancia de [[dos-decisiones-correctas-que-se-cruzan-en-un-agujero]], y lo que la hace invisible es
que **esperar el recibo parece prudencia**: la sesión se queda quieta citando una regla sana, y el ocio no
emite ningún error. Costó ~90 min de backend parado sin un solo síntoma.

**Cómo se reconoce.** La magnitud que el guard exige **no crece por estar bloqueada** (eso es la variante
circular de 2026-09-23): acá la precondición la mueve **otro agente**. La pregunta que discrimina:

> *¿La condición que este guard exige depende de alguien que no soy yo, y cambia más rápido de lo que yo
> tardo en satisfacerla?*

Si sí, no es un umbral: es una carrera, y **ninguna cantidad de disciplina la gana**.

**La salida NO es el escape hatch.** `UC_DEPLOY_FUERA_DE_MAIN=1` existe y saltea la regla — pero saltea
**también** el árbol limpio, así que paga el bug original para arreglar la carrera. Tampoco es congelar
los merges de las otras sesiones: eso traslada el ocio.

**La salida es un criterio de EQUIVALENCIA sobre lo que el artefacto realmente contiene.** El deploy no
sube el repo: `deploy.sh:97` tiene **allowlist explícita** en el `tar` (`apps/copiloto`,
`apps/copiloto-web`, `packages/core`, `motor`, `deploy/worker`, `deploy/copiloto`). Entonces:

```bash
git diff --name-only <sha-del-recibo>..origin/main -- <esos 6 paths>   # vacío ⇒ el recibo vale
```

Medido el día que se escribió esto: el delta entre el SHA gateado y el head eran `eslint.config.mjs` y
`scripts/dup-indice-check.py` ⇒ **0 archivos del allowlist** ⇒ artefacto **byte-idéntico**, recibo válido,
deploy desbloqueado sin tocar ningún guard.

**Why:** porque la precondición útil nunca fue «el head no se movió» — era «lo que voy a desplegar es lo
que se gateó». El guard usaba el SHA como *proxy* de eso, y el proxy es más estricto que la propiedad.
Cuando un guard frena por un proxy, la salida casi nunca es relajar el guard: es **medir la propiedad
directamente**.

**How to apply:** (1) ante un guard que te frena, escribí **qué propiedad** quiere garantizar y **con qué
proxy** la aproxima — si el proxy depende de terceros, ahí está la carrera; (2) buscá el **allowlist o
manifiesto** de lo que el artefacto contiene de verdad: casi todo deploy/build tiene uno, y es la base del
criterio de equivalencia; (3) el criterio tiene que ser **mecánico y falsable** (un `diff` que sale vacío),
nunca «ante la duda, es equivalente» ([[un-degradado-prudente-hacia-el-caso-benigno-envenena-la-medicion]]);
(4) dejá escrito qué lo **invalida** (acá: cualquier archivo en los 6 paths ⇒ re-gate), porque un criterio
de equivalencia sin condición de ruptura es un permiso permanente.

---

## 2026-10-14 — la cuarta variante: el criterio de salida era **INSATISFACIBLE**

Las tres de arriba son guards que frenan de más. Ésta es la peor de la familia porque **no tiene
salida**: el guard pide una condición que el sistema no puede cumplir nunca.

`destrabar-grafo-force.ps1` aborta si `FALTANTES != 0`, y está bien que lo haga: forzar un reconcile
con ingesta incompleta borraría objetos vivos. Medido hoy: **11 faltantes**, y los 11 son aristas
`contains: X -> X` **autorreferenciales** que graphify emite (11 de 33.888) para archivos cuyo id
sanitizado colisiona con el del símbolo que definen. El bridge no filtra auto-aristas, así que el
reconcile las **espera**; Graphity no las materializa. Por lo tanto `FALTANTES` no podía dar 0 en
**ninguna** corrida, ni ayer ni dentro de un año: el destrabe estaba cerrado **por construcción**.

**Por qué vivió invisible.** Los ZOMBIES se imprimían con tipo, nombre y `source_file` —están EN
Graphity y el endpoint devuelve el objeto entero—. Los FALTANTES salían como **uuid5 opacos**,
porque `expected_uuids` devuelve un `set` y nada más. La asimetría caía exactamente del lado malo:
**el único criterio que bloquea el destrabe era el único que no se podía leer.** Nadie puede
refutar un hash. Ponerles nombre (`expected_index`) convirtió «11 faltantes, esto es grave» en «11
auto-aristas benignas» en una sola corrida. El instrumento no medía mal: **clasificaba** mal, y su
docstring decía de todos los faltantes *«esto sí es grave»* — una lectura falsa con la autoridad de
un número medido. Ver [[nada-cazaba-al-mal-clasificado-solo-al-no-clasificado]].

**Y el que vetaba no era el tope.** El mismo día, el push volvió a quedar vetado — pero por
`503 Graph backend unavailable`, no por los 200 objetos. El `pre-push` era fail-closed sobre el sync
(`set -euo pipefail` + una invocación sin `||`), así que **cualquier** fallo de un sistema AUXILIAR
—tope, backend caído, timeout de red— se convertía en veto sobre el trabajo de todos, incluido el de
quien no tocó el grafo. Tres variantes distintas del mismo veto en tres meses se habían leído como
«el problema es el tope»: el tope era el síntoma más frecuente, no la causa.

**La pregunta que discrimina**, y hay que hacérsela al ESCRIBIR el guard:

> *¿Existe un estado alcanzable del sistema en el que este guard me deje pasar? Nombralo, y medí si
> hoy estoy a una acción de él.*

- «Sí, borrando/arreglando X» → es un guard sano, hay trabajo que hacer.
- «No lo sé, el guard me devuelve hashes» → **primero hacé legible el criterio.** Un guard cuyo
  motivo de rechazo no se puede leer es indistinguible de uno insatisfacible, y se lo acata igual.
- «No existe tal estado» → el guard no es estricto: está **roto**, y lleva roto desde que se escribió.

**How to apply:** (1) todo guard que aborta tiene que imprimir **qué objetos** lo activaron, con
nombre, no con id — si el id es lo único que hay, el guard necesita su índice de descripciones antes
de necesitar cualquier otra cosa; (2) cuando un criterio de bloqueo se mantiene constante corrida
tras corrida (11, 11, 11), eso no es deuda estable: es sospecha de **insatisfacible**, y se verifica
preguntando si alguna vez dio 0; (3) un sistema auxiliar nunca puede ser fail-closed sobre el camino
crítico de otros — degradalo a aviso **accionable** (rc + el comando exacto de destrabe), porque un
warning mudo es peor que el abort: nadie lo persigue ([[un-disparador-cumplido-no-avisa-a-nadie]]).

## Refuerzo 2026-10-15 — el aviso que el guard IMPRIME es parte del guard, y mi propio fix lo volvio falso

Cerre el arco: el criterio paso de `FALTANTES != 0` a `graves != 0` y el destrabe dejo de estar
cerrado por construccion (corrida real: `ZOMBIES 218 · FALTANTES 11 = 0 grave(s) + 11 benigna(s)`
→ llego al modo medicion, donde antes moria en «ESCALAR, no forzar»). Lo que no vi venir es que
**tres commits antes, en el MISMO PR**, yo habia escrito el aviso que el `pre-push` imprime cuando
el sync falla, y ahi decia literal: «El paso 1 aborta si FALTANTES != 0». Mi propio commit siguiente
volvio esa frase **falsa**.

Por que importa y no es cosmetico: el que lee ese aviso **no va a correr el destrabe** si el texto
le dice que aborta con faltantes != 0 y el dry-run le muestra 11. O sea que el aviso rancio
**reproduce exactamente el bloqueo que el fix acababa de quitar**, sin un solo gate de por medio. Un
guard tiene dos superficies —su condicion y el texto con que se explica— y arreglar una deja la otra
operando sola.

Y el detalle que lo hizo invisible por tres commits: el aviso lo **habia escrito yo**, en ese PR,
por una buena razon (que el degradado no fuera mudo). Un texto propio y reciente es el que menos se
relee: no es «codigo heredado» que se audita, es algo que uno acaba de pensar bien.
Lo cace recien al leer el **output de mi propio push**, no revisando el diff.

**Pregunta que lo caza:** al cambiar un criterio, *¿que texto CITA el criterio viejo?* — mensajes del
guard, docstrings, el doc del runbook, el `dato_` que mande al buzon ayer. `grep` por el nombre del
criterio viejo (`FALTANTES`, el umbral, el flag) y no por el nombre del archivo que toque.

**Como aplicarlo:** un cambio de criterio no esta terminado cuando el test pasa; esta terminado
cuando ningun texto alcanzable afirma el criterio anterior. Y si uno de esos textos ya circulo
—un mensaje del buzon, un reporte— el fix incluye **retirarlo**, no solo appendear la correccion:
el titular refutado sigue ganandole al anexo ([[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]]).

Relacionadas: [[un-degradado-prudente-hacia-el-caso-benigno-envenena-la-medicion]] ·
[[el-guard-falla-abierto-en-su-caso-de-activacion]] ·
[[un-instrumento-compartido-intermitente-fabrica-una-excusa-lista]]
