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

## Refuerzo 2026-10-06 — la asimetría acusó a la LIBRERÍA, no al test; y después me hizo declarar una deuda que la medición retiró

Un solo episodio —`main` ROJO por un test de mobile— y esta memoria se cobró **las dos direcciones** en
media hora.

**Dirección 1: usé la asimetría bien, y después concluí de más.** Planificación propuso que el
`cleanup()` a mitad del test era frágil. Medí el gemelo web: usa `cleanup()` **idéntico** (`:129` contra
`:122` de mobile) y está **verde** en `main`. Esa asimetría es real y es informativa: descarta «el
`cleanup()` a mitad del test es frágil» como explicación **suficiente**. Pero yo escribí «la causa no está
en el test, está en la librería» y mandé eso a tres sesiones. **El diferencial prueba que la librería
difiere; no prueba que el `cleanup()` de `:122` sea inocente.** Son dos afirmaciones y las junté. La
librería sí difería —RNTL tiene una cola que aborta `waitFor`, DTL no tiene ninguna (0 hits de
`cleanupQueue`)— y aun así el fix **era** la línea del test.

**Y la medición cerró el episodio al revés de mi explicación:** 10 corridas sin el fix → **4 rojas**; 10
con el fix → **10 verdes**. El fix funciona y **el mecanismo que inventé para justificarlo estaba
refutado por mi propio spike**. Un *fix correcto con la explicación equivocada* es el que vuelve: el
siguiente que «simplifique» esa línea razonando desde mi explicación reabre el flake. Por eso el fix se
embarca diciendo **la razón es empírica**, no derivada.

**Dirección 2, y es la que me costó más entender: la simetría también fabrica deuda falsa.** Declaré,
por escrito y en tres canales, que mi gemelo web tenía «el mismo defecto en dos call-sites» y que lo iba a
pagar. Después lo medí: en **RNTL 14.0.1** `cleanup` es `async` (`dist/cleanup.js:11`) y no esperarla es un
bug; en **RTL 16.3.2** `cleanup` es `function cleanup()` **sin `async`** (`dist/pure.js:301`) — **no hay
nada que esperar**. No era el mismo defecto: era la misma **línea** sobre dos APIs distintas.

Pagar esa deuda habría metido un `await` sobre una función síncrona **con un comentario que miente**
(«la API es async»). Eso es peor que no pagarla: deja una afirmación falsa anclada en el código, en el
lugar exacto donde alguien va a buscar la verdad.

**La pregunta que separa «el mismo defecto» de «la misma línea», y va ANTES de declarar la deuda
simétrica:** *¿medí la pieza de la que depende el defecto en los dos lados, o sólo vi que el código se
parece?* Dos call-sites con texto idéntico sobre dependencias distintas no comparten defecto. Es el
espejo de `[[el-fix-ya-existe-en-otro-call-site]]`: propagar un fix exige verificar que la **causa**
también esté del otro lado, no sólo la forma.

Lo que sí quedó del lado web es un **comentario de dos líneas** anclando la asimetría medida, con versión
y archivo: si algún día RTL adopta la cola de aborto, ese comentario queda **falso y detectable**, que es
exactamente lo que un `await` silencioso no habría dado.

### Y la parte del que ACEPTÓ la refutación: leer la cadena no es correrla

*(lo agrega planificación al resolver el conflicto de #810 contra la versión de auditoría: las dos
mitades quedan porque enseñan cosas distintas — [[resolver-tomando-un-lado-nunca-converge]])*

**Mi error no fue proponer la causa equivocada: fue cómo acepté que lo era.** Verifiqué que **cada
eslabón existía** en `node_modules` —`cleanup` async, la cola de aborto, `rejectOnAbort: true`, el
string literal del error— y nunca pregunté si los cuatro juntos **bastaban** para producir el síntoma.
**Comprobar que las piezas de una cadena existen no es correr la cadena.** Auditoría la corrió en 20
líneas de JS: **0 de 4** combinaciones abortaron. Yo tenía el mismo JS a mano y leí `node_modules` en
vez de ejecutarlo — la verificación costaba **menos** que la lectura.

**Y el saldo sobre quién tenía razón quedó al revés de las dos veces que lo declaramos.** Mi hipótesis
—que la línea `:122` era el problema— quedó **acotada** (no es explicación *suficiente*: no dice por qué
el gemelo web se salva) pero **nunca refutada**. El fix **fue** esa línea. Una asimetría localiza
**dónde** difieren dos sistemas, no **quién** está mal adentro del que falla.

**El número que hace concluyente el efecto, y conviene no perderlo:** con tasa base 4/10 rojas, sacar
**10/10 verdes** por azar es el **0,6 %**. «Probado por efecto» acá no es una licencia retórica — es una
medición, y es la única parte del episodio que no se cayó.

**Contramedida cuando el fix se prueba por efecto y el mecanismo no se conoce:** escribir en el código
**las dos cosas**, el efecto medido y que el porqué no se conoce. Un porqué falso al lado de un diff
correcto es una regresión con fecha abierta: el día que alguien «simplifica» esa línea razonando desde
el porqué falso, el defecto vuelve y nadie entiende por qué.

Relacionadas: [[una-simulacion-calibrada-a-la-linea-base-no-valida-la-capa-que-no-modela]] ·
[[dos-causas-suficientes-el-test-no-atribuye]] ·
[[una-observacion-no-reproducida-se-degrada-a-observacion-no-se-retira]] ·
[[probar-que-el-instrumento-miente-no-te-exime-de-leer-lo-que-senala]]

---

**Refuerzo (2026-10-06): el caso más barato de este error es `git diff` — mide una diferencia y NO dice qué
lado es el correcto.** Barrí el checkout compartido buscando trabajo en riesgo de perderse y conté: de 30
archivos `M`, **9** eran iguales a `origin/main` (el `M` era ruido), **6** tenían su contenido respaldado por
alguna de las 60 ramas remotas, y **15** no existían en ninguna. Llamé a esos 15 «trabajo que sólo vive en ese
disco» y escribí la alarma. **Estaba al revés.** Los deltas eran `web.py` **+21/−122**, `HISTORIA.md` +2/−179,
el backlog +13/−226, `graph-sync.sh` +4/−127: cuando los borrados aplastan a los agregados, el archivo está
**ATRASADO** — esas 122 líneas «faltantes» son líneas que **main tiene y el disco no**.

**Y el contenido confirmó la dirección de la peor manera:** las 21 líneas que el disco tenía de más eran
`mp_connected: seller is not None` vía `first_seller_user_id()` — **el criterio que #850 había eliminado ese
mismo día**. O sea, lo que yo estaba a punto de reportar como *trabajo valioso en riesgo* era **código obsoleto
cuya única propiedad peligrosa es que commitearlo revierte un fix cerrado**
([[un-rebuild-desde-otra-base-revierte-un-fix-ya-cerrado]]). Las dos lecturas piden acciones **opuestas**: una
«commiteá antes de perderlo», la otra «no lo commitees».

**Lo que separa los dos mundos son dos comandos que no son `diff`:** `git diff --numstat` (el **signo** del
delta) y `git merge-base --is-ancestor HEAD origin/main` (si el checkout está detrás o tiene commits propios —
acá dio *no ancestro*, con **7** commits legítimos de otra sesión, que es lo que impide tratar el árbol como
basura). Un conteo de archivos que difieren es un **escalar sin signo**, y sobre un escalar sin signo cualquier
narrativa calza.

**How to apply:** (1) antes de nombrar un lado «correcto» o «en riesgo», medí la **dirección**, no la magnitud —
en git es `--numstat` y `--is-ancestor`, y en general es *«¿qué pregunta responde cada lado?»*; (2) si la
diferencia son líneas **borradas**, la hipótesis por defecto es **atraso**, no trabajo nuevo; (3) leé el
**contenido** de las líneas en disputa antes de escribir la alarma: acá el contenido (`first_seller_user_id()`)
fechaba el archivo solo; (4) una alarma con la dirección invertida es peor que ninguna, porque **recomienda el
gesto exactamente equivocado** y suena urgente mientras lo hace
([[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]).

---

**Refuerzo (2026-10-06, A6/`BL-V29`): la pregunta no es si el FIX es portable al gemelo — es si el DEFECTO puede existir ahí.**
La fila pedía *«a 390 px la franja libre del botón «Ahora no» es > 0 px»*. **Web** lo tenía resuelto: el sheet
quedaba dentro de un ancestro con `isolation: isolate`, lo que acotaba su `z-index:50` a esa sub-jerarquía y
dejaba que la tab-bar (z-index 30) pintara encima — medido con Playwright, `pctTapado:100`. El fix: portarlo a
`document.body`.

Fui a **mobile** y medí el componente gemelo. `SheetRequiereConexion.tsx:20` declara, con id de decisión
(K-11/`BL-J8`), que **NO** es un `Modal`: es un panel anclado abajo, en contexto. Concluí:

> «el fix de web no es portable a mobile ⇒ **la mitad mobile queda sin verificar** ⇒ hace falta device»

y escribí el mensaje con ese titular. **Estaba mal, y la pregunta que lo cerraba era UNA:** *¿hay tab-bar en
mobile?* **No hay.** `app/_layout.tsx:134` es `<Stack>`, no existe `app/(tabs)/`, y cero hits de `bottom-tabs`
en todo `apps/mobile`. El defecto es *«una barra con z-index propio tapa el botón»* y **ahí no hay barra**:
no es que esté sin verificar, es que **no puede existir**. La fila era `web`, y estaba cerrada.

**La forma del error, que es la de esta entrada:** ante una asimetría entre gemelos (uno tiene el fix, el otro
no) pregunté por **el mecanismo del fix** y leí la respuesta como **el estado del defecto**. Son cosas
distintas, y la segunda se mide **antes**: un fix no portable en un gemelo que **no tiene la precondición del
defecto** no es una costura abierta — es una fila que nunca fue de los dos. Es el mismo molde que
[[un-instrumento-que-no-mira-nunca-falla]] visto del otro lado: no pregunté *¿cuántos elementos mira?* sino
*¿existe el elemento?*

**Y el costo real fue de credibilidad, no de tiempo:** el mensaje ya estaba escrito y en el buzón, con un título
que afirmaba *«la fila que queda justifica su urgencia con el caso que no resolvió»*. Lo **reescribí** en vez de
appendear la corrección, porque un titular refutado circula igual que uno correcto
([[de-dos-artefactos-con-distinta-precision-gana-el-que-circula]]) — y appendear habría dejado el falso al
frente. Retirar un mensaje propio de 6 minutos, sin circular, es barato; dejarlo con una nota al pie, no.

**How to apply:** ante un defecto arreglado en una plataforma y pendiente en su gemela, el **primer** comando no
es «¿cómo porto el fix?» sino **«¿existe acá la precondición del defecto?»** — la barra, el contenedor, el
stacking context, el campo, el endpoint. (1) Nombrá la precondición en una frase («hay una barra con z-index
propio sobre el botón») y medila con un grep estructural: si no está, la fila **no es `ambas`** y no cae en la
tanda diferida. (2) Desconfiá del razonamiento *«el fix no aplica acá ⇒ falta verificar acá»*: es un **no
sequitur** que convierte una fila cerrada en trabajo de device, y el error cae del lado caro (difiere algo que
se cerraba hoy). (3) Cuando el gemelo declara una decisión de diseño con id (acá K-11/`BL-J8`, «NO un Modal»),
eso contesta **«por qué el fix no se porta»** y **no** contesta «si el defecto está» — leelo como lo primero.
