# 🔀🕳️ Dos decisiones correctas por separado que en la INTERSECCIÓN abren un agujero

**Fecha:** 2026-08-02 · **Dónde:** `apps/copiloto/autosanacion_gates.py`, `autosanacion_workflow.py`

## El caso

El mismo día se agregaron dos banderas al `Decision` del gate de autosanación, cada una con su
razón, y **por separado las dos eran correctas**:

| Bandera | Regla | Por qué |
|---|---|---|
| `reintentable=False` | "descartá lo permanente" | el canario rechazado volvía a `pendiente` y se re-tomaba en CADA corrida — el vigilante tapaba la cola del sistema que vigila |
| `necesita_humano=False` | "no avises de lo que no es accionable" | un issue por cada rechazo operativo (kill switch, tope diario) es ruido, y un canal que grita en el caso normal se termina ignorando |

Juntas producen el **peor resultado posible** en la casilla donde se cruzan: un trauma con
`reintentable=False` **y** `necesita_humano=False` se cierra **y** nadie se entera nunca. Antes de
las dos "mejoras", ese mismo error al menos quedaba `pendiente` — visible para quien mirara.

El caso real que cayó ahí: un trauma **sin `archivo:línea`**. Se rechaza en la activity *antes* de
mirar la categoría, así que ni siquiera llegaba a `puede_reparar`. Se descartaba en silencio.

## Por qué ningún test lo vio

**Cada test miraba UNA bandera.** Había cobertura de "lo permanente se descarta" y cobertura de "lo
operativo no abre issue", ambas verdes, ambas diciendo la verdad. El agujero no está en ninguna de
las dos: está en el **producto cartesiano** de sus valores, que no era el sujeto de ningún test.

Lo destapó un E2E en el VPS, no la suite.

## La regla

> Cuando agregues una segunda bandera/flag/modo que se combina con uno existente, el sujeto del test
> no es la bandera nueva: es la **matriz**. Preguntá qué significa cada celda — sobre todo la que
> nadie pidió.

Test concreto que lo cubre, y la forma que lo hace resistente:
`tests/test_issue_de_trauma.py::test_INVARIANTE_lo_unico_que_se_descarta_SIN_avisar_es_el_canario`.
Recorre los casos y afirma que la combinación `(no reintentable, no necesita humano)` **sólo** es
legítima para el canario — más un **control positivo** de que esa excepción existe de verdad, porque
si ningún caso llegara a esa rama el bucle pasaría sin ejercitarla y el invariante sería un
`assert True` con forma de invariante ([[instrumento-que-no-mira-nunca-falla]]).

## Cómo se detecta antes

No es "escribir más tests": es notar el momento. **Dos cambios independientes al mismo objeto de
decisión, en la misma sesión** es el disparador. Ahí la pregunta no es "¿anda cada uno?" sino
**"¿qué pasa cuando los dos aplican al mismo caso?"** — y hay que enumerar las celdas a mano, porque
ninguna de las dos historias de usuario menciona la otra.

Hermana temporal de [[el-fix-ya-existe-en-otro-call-site]]: allá el defecto es no propagar un fix
conocido; acá es no mirar la casilla que dos fixes correctos crean entre ambos.

## Segundo caso — 2026-09-22 · `.gitignore` × rescate de huérfanos, y el agujero apuntaba a PUBLICAR

Mismo molde, otro par, y esta vez la celda vacía era de **seguridad**:

| Decisión | Regla | Por qué |
|---|---|---|
| `.gitignore:94` | `memoria/telegram-composio-canal-operador.md` no se versiona | guarda el `chat_id` del operador y el repo es PÚBLICO desde 2026-08-06; su propio cuerpo lo dice |
| `seed-memory.sh` §1 RESCATE | lo que vive sólo en el slug se copia a `memoria/` | una memoria que sólo existe en el slug se perdería; el `--delete` de julio ya la borró una vez |

En la intersección, el rescate copiaba a `memoria/` **en cada corrida** exactamente el archivo que
`.gitignore` excluye a propósito — y remataba con `[RESCATADO] … (COMMITEAR)` y
`git add memoria/ && git commit`. O sea: **el instrumento instruía a publicar el dato que la otra
decisión protege.**

### Por qué el guard que ya existía no lo cubrió

El script **sí** tenía guard para el caso vecino — «¿estuvo versionado y se borró a propósito?» vía
`git log --diff-filter=D`. Pero eso mira **una sola huella** de la intención «este archivo no va al
repo». Un archivo que **nunca estuvo versionado** porque está ignorado desde siempre no deja commit
de borrado que encontrar: el guard lo consulta, no halla nada, y concluye «no fue deliberado».

> Un guard que pregunta «¿esto fue deliberado?» tiene que enumerar **todas las formas de dejarlo
> asentado**, no la que tenía en mente su autor. Acá había dos —borrado versionado e ignorado
> versionado— y cubrir una convirtió a la otra en un falso «accidente a reparar».

Fix: `git check-ignore -q` **antes** del guard de borrado, con salida propia `[EXCLUIDO]` — ni se
rescata ni se purga. Control positivo corrido: el archivo no entró al repo **y** sigue en el slug.

Cómo se destapó: no lo vio ningún test, lo vio el medidor de índice fallando por *cobertura* —
motivo totalmente distinto ([[vacio-no-es-hallazgo-correr-el-control]]). Fue suerte, no diseño: el
archivo venía reapareciendo en `memoria/` desde hacía corridas y el bucle no daba síntoma propio
porque `.gitignore` lo tapaba del `git status` ([[un-mecanismo-roto-hacia-el-no-no-da-sintoma]]).

Relacionadas: [[el-guard-que-caza-a-su-propio-autor]] · [[no-romper-no-es-arreglar]] ·
[[el-canario-el-control-positivo-de-lo-que-falla-callado]]
---

## Refuerzo 2026-10-07 — **la «restricción de seguridad» que agregué era lo único peligroso del plan**

El caso de arriba es dos decisiones correctas que se cruzan en un agujero. Éste es la variante que más
cuesta ver: **una sola decisión mía, tomada para reducir riesgo, que lo creó.**

Autoricé un canario sobre el deploy para medir cuánto margen real tiene un guard. Y le agregué lo que
creí que era la salvaguarda:

> «corrélo **desde el mismo SHA que prod ya sirve**, así el estado intermedio es idéntico al actual»

El razonamiento parecía impecable: si el artefacto que se construye es idéntico al que ya está
publicado, un abort no puede dejar prod distinto de como está. Lo que no leí:

```sh
rm -rf "dist-$SHA"                          # deploy.sh:161
npx vite build --outDir "dist-$SHA" --emptyOutDir
…
ln -sfn "dist-$SHA" dist.tmp; mv -T dist.tmp dist   # [5.5/7]: el symlink VIVO apunta a dist-<SHA>
```

El symlink que prod sirve apunta a `dist-<SHA de prod>`. Con mi restricción, `rm -rf "dist-$SHA"`
**borra el directorio al que apunta el symlink vivo**, y prod sirve roto hasta que termine el rebuild —
y si el build falla, queda roto. **Desde un SHA distinto habría sido inofensivo.** Mi restricción no
reducía el riesgo: era la condición exacta que lo activaba.

**Lo que me hizo equivocar no fue no leer el código — fue leer la mitad que confirmaba.** Afirmé «radio
de impacto cero» diciendo que lo había verificado, y verifiqué que *el build va a un directorio de
staging* (cierto). No verifiqué que **el nombre** de ese staging es el del directorio publicado. El
hecho que leí era verdadero y la conclusión era falsa, que es por qué el error se siente como rigor.

**Lo que lo cazó: la sesión que tenía que ejecutarlo se negó y midió.** No fue un test ni un control
mío. Backend abrió el archivo, encontró el `rm -rf` y el `[1/7]` que escribe el árbol del VPS **antes**
del punto de abort, y lo devolvió. Si hubiera obedecido —y la orden venía con autorización explícita y
razonada— el daño ocurría igual.

**Y el regalo del error:** `rm -rf "dist-$SHA"` no es un problema del canario. Significa que
**re-correr el deploy desde el SHA que prod ya sirve destruye el dist vivo**, en cualquier deploy, sin
canario. Es lo contrario de idempotente justo en la operación que la idempotencia promete (reaplicar,
recuperar de un abort) — [[idempotencia-con-un-if-tiene-ventana]]. Quedó como fila propia, y es más
urgente que la medición que la destapó.

**How to apply:** (1) una restricción que agregás «para que sea seguro» es **un supuesto nuevo**, y
exige la misma prueba que el plan — preguntá *¿qué se vuelve verdadero por restringir así?*, no sólo
*¿qué se evita?*; (2) cuando el plan toca artefactos nombrados por un identificador (SHA, tag, id de
build), el nombre **es** el riesgo: buscá quién más usa ese nombre antes de decir que el espacio está
aislado; (3) «lo verifiqué en el código» exige nombrar **la línea que podría refutarlo**, no la que lo
confirma — si no buscaste la refutación, verificaste que el plan es consistente con tu plan;
(4) una sesión que recibe una orden ejecutable y la devuelve medida está haciendo su trabajo: ese
rechazo es el control, no fricción — tratarlo como obstrucción desarma el único guard que quedaba.

Relacionadas: [[no-codificar-la-esperanza-principio-raiz]] ·
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]] ·
[[el-guard-falla-abierto-en-su-caso-de-activacion]]
## Refuerzo 2026-10-08 — las dos premisas en el MISMO archivo, a 30 líneas, y la conclusión en ninguna

`docs/copiloto-emprendedor/ALCANCE-CIERRE-BETA.md`, mismo autor, mismo día:

- `:91` — tabla «Lo que **NO** entra»: *«Toda la tanda de **device** → diferida al sprint siguiente por
  orden del operador del 2026-09-22»*.
- `:120` — §13 punto 3 exige *«la matriz ✅ en **web y mobile** para los 54 ids spec»*, con dueño
  asignado.

Las dos filas son **correctas por separado**. La mitad `mobile` del punto 3 **es** tanda de device
(web 54/54, mobile 13/54 según `scripts/evidencia/contar-veredictos.py`, que anota al lado «sprint
siguiente, con device/EAS»), así que juntas dicen que el criterio de cierre exige lo que el mismo doc
excluyó. **El doc tiene las dos premisas y nunca saca la conclusión.**

**Lo que agrega sobre la entrada original:** acá no hubo dos decisiones de dos dueños ni dos
artefactos. Fueron **dos tablas del mismo archivo**, y por eso ninguna revisión por artefacto lo
cazaba: cada tabla, leída sola, es impecable. Lo que falta es el **cruce**, y el cruce no tiene
renglón propio en ningún instrumento.

**El control que sí lo caza:** por cada fila de un criterio de cierre, preguntar *¿algún bloque de
«fuera de alcance» de este mismo doc contiene una de sus precondiciones?* Es una lectura del par, no
de la fila.


## Refuerzo 2026-10-08 — dos INSTRUMENTOS correctos y la costura es la UNIDAD DE MEDIDA

Tercera forma del mismo agujero, y la más difícil de ver: no fueron dos decisiones, ni dos tablas
del mismo doc — fueron **dos instrumentos que funcionan perfecto**.

Preparando el arranque del sprint MOBILE hacía falta responder *«¿cuáles de los 54 ids no tienen
veredicto en `mobile`?»*. Hay dos medidores y **ninguno falla**:

- `scripts/evidencia/criterio3-cruce.sh` emite **las cuatro poblaciones con sus ids por nombre**…
  contando «con veredicto por cualquier vía». Su único flag es `--tsv` (`:17`): **no mira plataforma.**
- `scripts/evidencia/contar-veredictos.py` **sí** sabe de plataforma
  (`VOCABULARIO_PLATAFORMA`, `:1292`) y da `web 54/54` · `mobile 13/54`… pero emite **la cifra, no
  la lista**.

Así que la pregunta que el criterio hace **no tiene instrumento**, y el síntoma es el peor posible:
**los dos scripts salen verdes y ninguno está mal.** Simplemente contestan preguntas distintas de la
que se está haciendo. No hay rojo que mirar, no hay excepción en ningún log, y el número
«13/54» **se cita como si fuera una cola de trabajo** cuando es un escalar: nadie puede tomarlo.

**Lo que agrega sobre las dos capas anteriores.** La primera era dos dueños; la segunda, dos tablas
del mismo archivo. Acá el par son **instrumento × unidad de medida**, y por eso ninguna revisión de
código lo caza: revisar `criterio3-cruce.sh` no destapa nada — es correcto — y revisar
`contar-veredictos.py` tampoco. **El defecto no vive en ninguno de los dos archivos: vive en que la
unidad en la que uno responde no es la unidad en la que el criterio pregunta.**

**El control, y es una pregunta de una línea:** por cada cifra que un criterio de cierre cita,
preguntar *¿qué comando convierte esta cifra en una lista de trabajo?* Si la respuesta es «ninguno»
o «hay que cruzar dos salidas a mano», el próximo sprint arranca sin cola, y lo va a descubrir la
sesión que lo tome — cara, y mirando archivos en vez de midiendo.

**Y el corolario de planificación:** ese «tapar la costura» es el **ítem cero** del sprint, antes
que cualquier pantalla. Si se deja para el final, cada medición intermedia se hace contra una lista
reconstruida a mano — que es exactamente
[[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]].
