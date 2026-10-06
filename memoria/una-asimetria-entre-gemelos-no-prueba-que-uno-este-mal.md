---
name: una-asimetria-entre-gemelos-no-prueba-que-uno-este-mal
description: Dos filas sobre el mismo componente con veredictos distintos parecen "el fix llegó a uno de los dos" — pero pueden estar preguntando cosas distintas, y entonces la asimetría es información. Antes de emparejar, escribí qué pregunta hace cada lado
metadata:
  type: feedback
---

**El caso (2026-09-29, auditoría, fila C3-1).** Encontré dos filas de medición sobre **el mismo
componente, el mismo testid y el mismo nodo de app** (`midia-vacio`) con clasificaciones distintas:
`vacio` = `NO_REPRODUCIBLE_SIN_EFECTO`, `vacio-visto` = `DESVÍO` con nota «RECLASIFICADO». Reporté
🔴 **ALTA**: *«el fix llegó a uno de los dos gemelos»*, con el argumento de que un veredicto que
desactiva trabajo exige más evidencia que los otros.

**Era un falso positivo.** La asimetría es **correcta**, y lo es por una razón que ninguna de las dos
sesiones había escrito: **las dos filas preguntan cosas distintas.**

| fila | su pregunta | ¿se responde sin alcanzar el estado? |
|---|---|---|
| `vacio-visto` | ¿existe la variante «explicación retirada» tras N días? | **sí** — por **ausencia de mecanismo**: no hay contador equivalente, el cuerpo nunca cambia |
| `vacio` | ¿el cuerpo renderizado coincide con el del prototipo? | **no** — hay que **ver la pantalla vacía** |

Una se contesta leyendo código; la otra necesita el estado sembrado. Mismo nodo, dos comparaciones.

## Lo que casi hice, y por qué es peor que el error

Iba a «arreglar» la asimetría moviendo `vacio` a `DESVÍO` para emparejar. Eso habría **inventado una
comparación que nadie hizo** — la fila declara literalmente `N/A — no hubo comparación`. Emparejar por
simetría no corrige un veredicto: **fabrica el que falta**, y queda indistinguible de uno medido.

Lo que lo frenó fue una secuencia que impuso planificación, no mi prudencia: **primero escribir cuál es
la razón declarada de la reclasificación, después evaluar cada lado por separado.** Con la razón en la
mano (estaba escrita textual, y el criterio real no era «¿es reproducible?» sino **«¿la comparación ya
tiene resultado?»**), la asimetría se explicó sola.

## La regla

**Antes de emparejar dos filas gemelas, escribí qué pregunta hace cada una.** Si las preguntas difieren,
la asimetría es información, no defecto. Y el **orden** es lo que decide: razón primero, comparación
después. Al revés, la simetría se vuelve la hipótesis de trabajo y cualquier diferencia parece error.

### ⚠️ Corrección del mismo día: la regla de arriba, aplicada de más, ABSUELVE de más

Horas después usé «son dos preguntas distintas» para explicar **dos** empates a la vez (`soporte` y
`comousar`, COHERENTE vs DESVÍO). **El autor de las filas me corrigió mirando su propia celda: era un
caso de cada uno.** En `soporte` sí eran dos preguntas («el proto está desactualizado — drift esperado,
no bug»). En `comousar` las dos preguntaban lo mismo y una **miró menos**: contó ítems de texto mientras
la otra miraba layout y una sección entera. **Misma pregunta, profundidades distintas.**

Así que un empate tiene **tres** resoluciones, no dos:

| | resolución | qué pasa con cada lado |
|---|---|---|
| 1 | **dos preguntas distintas** | los dos válidos; el padrón debe declarar cuál responde cada uno |
| 2 | **misma pregunta, profundidades distintas** | gana el más profundo; el otro queda **SUPERADO**, no «vigente con otra pregunta» |
| 3 | **uno está mal** | se corrige |

**La (1) es la única que no deja a nadie equivocado, y por eso es la que uno elige por defecto.**
Aplicada a un caso que es (2), deja vivo un veredicto superado — y si el superado es el COHERENTE,
**fabrica un falso verde**, que es el error que este eje entero venía a cazar
([[nadie-audita-un-coherente-y-es-el-veredicto-que-desactiva-trabajo]]). El sesgo es simétrico al del
error original: primero emparejé por simetría y acusé de más; después expliqué por «dos preguntas» y
absolví de más. **Las dos veces el molde era cómodo y la precondición no estaba verificada.**

**El discriminante es barato y siempre está a mano: leé qué dice el MOTIVO de cada lado que miró, no qué
veredicto puso.** Un motivo que cita la referencia y la declara desactualizada a propósito es (1); dos
motivos que citan **distinta cantidad de superficie** son (2).

El parecido de los sujetos es justo lo que engaña: mismo componente, mismo testid, mismo archivo. Cuanto
más gemelos son, más fuerte se siente el argumento de simetría — y menos dice sobre si sus preguntas
coinciden.

## El defecto de fondo: elegí el patrón por familiaridad

«El fix llegó a uno de los dos gemelos» es un patrón **real** y ya me sirvió otras veces
([[el-mismo-defecto-vivia-dos-veces-el-fix-en-la-capa-compartida-no-alcanzo]],
[[el-fix-ya-existe-en-otro-call-site]]). Lo apliqué sin verificar su precondición: que ambos lados
estuvieran respondiendo lo mismo.

**Segunda vez el mismo día con esa forma.** Por la mañana elegí un canario por disponibilidad
([[el-canario-tiene-que-ser-tan-nuevo-como-lo-que-buscas]]); acá elegí una plantilla de diagnóstico por
familiaridad. En los dos casos el rigor estaba puesto —controles horneados, evidencia citada— pero
aplicado **dentro** de un molde que nadie había validado para el caso. Una plantilla que funcionó antes
se siente como método; es una hipótesis, y tiene precondición.

**Y el hallazgo real apareció sólo después de retirar el falso.** El cajón de `vacio` sí está mal, pero
por otra razón: el estado **es** reproducible sin efecto externo (un UPDATE local en el tenant de
prueba, con el seed ya escrito), así que `NO_REPRODUCIBLE_SIN_EFECTO` lo archiva en un cajón que apaga
trabajo. Severidad más baja, id igual de perdido. El falso positivo me estaba tapando el verdadero.

---

**Refuerzo 2026-10-06 — el caso donde el gemelo tumbó DOS hipótesis, incluida la del que lo usó.**

`main` quedó rojo por un test de mobile (`waitFor was aborted by cleanup`). Publiqué que la causa era
`cleanup()` llamada a mitad del test. Auditoría la refutó con **el gemelo**: el test web hace
`cleanup()` a mitad **idéntico** y no falla; medido, `@testing-library/dom` tiene **0** archivos con
`cleanupQueue`, la cola de aborto es exclusiva de RNTL. Acepté la refutación y corregí mi broadcast.

**Horas después auditoría refutó su propio mecanismo**: lo reprodujo en JS puro, 4 combinaciones
(unmount instantáneo o con 1 tick × con o sin `await`), **0 de 4 abortaron**. Su conclusión, con su
nombre: *«el diferencial prueba que **la librería** es la que difiere, no que el `cleanup()` de `:122`
sea el culpable. Son dos cosas y las junté.»*

**Ahí está el filo, y es exactamente el título de esta entrada.** La asimetría era real y la medición
del gemelo era correcta: DTL no tiene la cola. Lo que no se seguía es **quién está mal**. El gemelo
prueba que **las dos librerías difieren**; no elige culpable dentro de la que falla. Mi hipótesis
quedó acotada —no es explicación *suficiente*— pero **no refutada**, y hoy vuelve a estar en pie.

**Mi parte, distinta de la suya:** acepté la refutación porque verifiqué que **cada eslabón existía**
en `node_modules` (`cleanup` async, la cola, `rejectOnAbort:true`, el string del error) y nunca
pregunté si los cuatro juntos **bastaban** para producir el síntoma. **Comprobar que las piezas de una
cadena existen no es correr la cadena.** Auditoría la corrió en 20 líneas de JS y no abortó. Yo tenía
el mismo JS a mano y leí `node_modules` en vez de ejecutarlo — la verificación costaba menos que la
lectura.

**El cierre, que llegó a la tercera vuelta y es el dato más duro del día:** auditoría corrió el test
real 10 veces por variante. **Sin `await`: 6/10 verdes**, y las 4 rojas con el mensaje **literal** del
CI. **Con `await`: 10/10.** Por azar, con tasa base 4/10, eso es el **0,6 %**. O sea: **el fix está
probado por efecto y su mecanismo sigue sin explicación.** Auditoría no lo tapó con «debía ser algo
parecido» — dijo «no lo sé», y eso es lo correcto.

**Eso deja un modo de falla con nombre propio: un fix correcto con la explicación equivocada es el
que vuelve.** El diff queda, el porqué falso queda escrito al lado, y el día que alguien «simplifica»
esa línea razonando desde el porqué falso, el defecto reaparece sin que nadie entienda por qué. La
contramedida es escribir en el código **las dos cosas**: el efecto medido y que el mecanismo no se
conoce.

**Cómo aplicarlo, los dos filos juntos:**
1. Cuando hay dos hipótesis en competencia, el gemelo que NO falla descarta toda hipótesis que no
   explique por qué **él** se salva. Es gratis y discrimina: buscalo antes de publicar una causa.
2. Pero una asimetría localiza **dónde** difieren, no **quién** está mal. Si lo que explica la
   asimetría es la librería, lo que quedó refutado es la librería — no el call-site.
3. Y una cadena causal **leída** eslabón por eslabón sigue siendo una hipótesis. Si se puede correr
   en 20 líneas, corrérla es más barato que defenderla — acá se podía correr el **test mismo**, 10
   veces, y nadie lo hizo hasta la tercera vuelta.
4. Cuando el fix se prueba por **efecto** y el **mecanismo** no se conoce, escribí las dos cosas en
   el código. Un porqué falso al lado de un diff correcto es una regresión con fecha abierta.

Relacionadas: [[una-simulacion-calibrada-a-la-linea-base-no-valida-la-capa-que-no-modela]] ·
[[dos-causas-suficientes-el-test-no-atribuye]] ·
[[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]] ·
[[probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala]]
