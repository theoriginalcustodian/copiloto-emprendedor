---
name: el-canario-el-control-positivo-de-lo-que-falla-callado
description: Cuanto mejor construido está un sistema, menos informativo es el silencio de su vigilancia — "no falla nada" y "el detector está roto" producen el mismo log. Un canario dispara el fallo a propósito por el camino real para que el silencio vuelva a significar algo
metadata:
  type: feedback
---

**El planteo del operador (2026-08-01):** *"si hacemos las cosas bien y configuramos todo el sistema
bien, la superficie de errores es mínima y el autohealing trabaja poco… pero debe estar sí o sí,
aunque trabaje poco."*

Correcto, y tiene un corolario que no es obvio: **cuanto menos trabaja un vigilante, menos dice su
silencio.** El ciclo de autosanación devuelve `{"estado": "sin_traumas"}` cuando no hay nada que
reparar — y **exactamente lo mismo** cuando el cable de detección está cortado. En régimen sano ese
desenlace es el 99%, así que el estado normal del sistema es también su modo de fallo indistinguible.

No es teórico: el mismo día se descubrió que la costura HTTP **nunca** había depositado un error en
producción ([[la-costura-leia-un-campo-que-nadie-escribe]]). Cuatro días, suite en verde, cero
síntomas.

## El canario, y las cuatro decisiones que lo hacen servir

`POST /salud/canario` lanza un error **deliberado** por el camino de producción. La costura lo captura
y lo deposita como a cualquier otro. Que sea trivial no lo hace obvio — cada decisión responde a una
forma de arruinarlo:

1. **Autenticado, no en `/healthz`.** Sin `require_tenant` no hay tenant declarado, y sin tenant la
   costura no deposita. Un canario público habría medido **un camino distinto del que dice vigilar**
   — el error clásico del control que verifica una versión de juguete de lo que le importa.
2. **Sale como un 500 normal, sin trato especial.** Si el canario tuviera su propia rama en la
   costura, probaría esa rama y no la de producción.
3. **Excluido de REPARARSE, no de REGISTRARSE.** Su error es deliberado: no hay bug. Sin la exclusión
   el forjador le escribiría un parche a un `raise` puesto a propósito y abriría un PR basura por
   cada prueba de vida — y [[el-guard-que-grita-en-el-caso-normal-se-desarma-solo]]. Su valor está en
   la fila que deja, no en curarse.
4. **Encendido por default.** Un vigilante que nace apagado no vigila **y nadie se entera de que no
   vigila**: el default silencioso otra vez ([[disenar-contra-el-riesgo-temido-ciega-al-caso-normal]]).

## La métrica correcta no es cuántos arregló: es hace cuánto pasó

Cero reparaciones es la **meta**, así que no puede ser el indicador de salud. El indicador es *¿cuándo
fue la última vez que el camino completo funcionó de punta a punta?*, con **vigencia** (7 días acá):
un canario que pasó hace un mes prueba que el cable estaba sano hace un mes — la evidencia vence
([[la-evidencia-vence-y-el-documento-no-lo-dice]]). Vive en
`deploy/copiloto/verificar-autosanacion.py`.

## Cuándo replicarlo

Cualquier mecanismo que **falle hacia el silencio**: DLQs, colas de reintento, alertas, gates,
auditores, backups, replicación. La pregunta que lo dispara es la misma de siempre —*¿qué devolvería
este instrumento si lo que mide estuviera roto?*
([[instrumentos-que-confirman-en-vez-de-verificar]])— y cuando la respuesta es *"lo mismo que ahora"*,
no alcanza con mirar mejor: **hay que inyectar el caso positivo a propósito**.

Es el mismo principio que [[un-mecanismo-roto-hacia-el-no-no-da-sintoma]] (todo gate necesita un
control positivo), aplicado al sistema vivo en vez de a la suite de tests.

## El bonus que no esperaba

**El canario encontró el fallo antes de existir.** Diseñarlo obligó a preguntar cómo entra realmente
un error al sistema — y esa pregunta destapó que no entraba ninguno. Diseñar el detector es, en sí,
una auditoría del camino que va a vigilar.

---

## Refuerzo (2026-09-30): el par vestido/desnudo se pisa a sí mismo si los dos escriben al mismo destino

Corrí el par en secuencia dentro de un solo background —vestido (guard forzado a disparar), después
desnudo (control positivo)— y leí el resultado al final. **El log mostraba las dos mitades correctas,
pero la evidencia persistida era sólo la del desnudo:** el generador reescribe
`evidencia-out/criterio3-caminos.json` en cada corrida, así que el `no_medibles_por_captura: 1` del
vestido lo pisó el `0` del desnudo. Leído al final, el efecto decía **0 filas** — indistinguible de un
guard que no disparó.

Lo cacé porque el control que aplico es el **efecto**, no el log; si me hubiera quedado con el log
—donde el `⊘ NO_MEDIBLE` aparece clarísimo— habría cerrado el fix con la evidencia del control positivo
en lugar de la del caso probado. Re-corrí sólo el vestido y leí el json en el mismo paso: **1 fila, con
su `porque` completo.**

**Why:** porque el par vestido/desnudo está diseñado para producir dos resultados **distintos**, y por
eso mismo el segundo borra al primero cuando comparten destino. La mitad que se pierde es siempre la
misma: el desnudo va último porque es el control, así que lo que sobrevive es el resultado *benigno*.

**How to apply:** (1) vestido y desnudo escriben a destinos distintos, o se lee la evidencia **entre**
las dos corridas; (2) si el par corre sin supervisión, copiar el artefacto del primero antes de lanzar
el segundo; (3) al cerrar un canario, mirá el **timestamp** del artefacto y cruzalo con cuál de las dos
corridas lo escribió — un json con `corrida:` es lo que hace esto verificable; (4) el orden importa:
correr el control positivo **primero** deja como sobreviviente el caso probado, que es el que se quiere
adjuntar.

---

## Refuerzo 2026-10-05 · un canario escrito en el formato que el instrumento YA ve no prueba cobertura: prueba una tautología

Barrido de ramas comodín en los dobles de `gh`. El detector buscaba el comodín **literal** al principio del
renglón (un `grep` anclado con `^`). Reportó `veredicto-monotono: sin comodín`, y para no creerle inyecté un
canario: un stub con su `case` y su rama comodín indentada. Salió **cazado**, así que declaré el instrumento
sano.

**Era mentira.** Ese archivo tenía **5 comodines** que el grep no veía, porque no están escritos como código
del archivo: están **generados**, adentro de un `echo`/`printf` que fabrica el stub en disco. El canario no
los cubría porque **lo escribí en el único formato que el detector ya reconocía**: probé que el instrumento
ve lo que ve.

**La trampa es cómoda:** el canario se escribe de memoria, y la memoria la acaba de formar el patrón del
propio detector. Sale verde, se siente rigor, y lo que acreditó es la mitad conocida — con el agravante de
que ahora hay un verde que **desactiva** la sospecha.

**Cómo escribir un canario que no sea tautológico:**
1. Enumerá las **formas en que el fenómeno puede aparecer** antes de mirar el detector: literal · generado
   dentro de una cadena · en otro lenguaje · con otra indentación o compartiendo renglón.
2. Inyectá **una por forma** y exigí que el conteo suba en cada caso.
3. Si una forma no sube el conteo, el instrumento no la mide: eso **es** el hallazgo, antes de cualquier
   cifra publicada.
4. Declará las **unidades que contás**. Acá el reparto correcto fue `stubs fabricados=6 · comodines
   literales=2 · comodines generados=10` — tres números que la v1 colapsaba en uno, y la discusión «5 o 6»
   era irresoluble sin ellos.

El canario reescrito con la forma generada subió los comodines de 10 a 12: recién ahí el instrumento quedó
acreditado para la forma que importaba.

Ver también [[instrumento-que-no-mira-nunca-falla]] (el «sin comodín» era un *no mirado*, no un *limpio*) y
[[el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda]].

## Refuerzo 2026-10-06 — UN mutante prueba que el test se pone rojo; N mutantes prueban QUE acredita cada test

Cerre el wiring del `workflow_id` del router con 15 tests verdes. El verde no acredita nada solo, asi
que inyecte mutantes. La leccion no es «inyecta un mutante» -- es **cuantos**.

El cambio tenia **tres piezas independientes**: la formula (`workflow_id_for`, `:18`), su uso
(`id=wf_id` en el `start_workflow`, `:37`) y el payload de arranque (`{"cliente_id": ...}`, `:35`). Un
mutante sobre cualquiera pone la suite en rojo, y con eso yo habria cantado «control positivo OK».
Los tres juntos dicen algo que ninguno dice solo:

| mutante | rojos | lo que REVELA |
|---|---|---|
| M1 la formula | **9** | los 4 del id + los 4 adversariales + el de la ambiguedad |
| M2 el uso del id | **8** | los mismos 8, **pero no** el de ambiguedad -> ese acredita la formula PURA, no el wiring |
| M3 el payload | **4** | **solo** los del config -> id y payload son piezas independientes, y sin M3 nada probaba que el test del payload midiera algo distinto |

Lo mismo en el contrato legal del mismo dia, con dos piezas (el campo nuevo sale / el booleano no cambia
de semantica): M1 tumbo 5, M2 tumbo **3** -- y esos 3 eran **exactamente** el caso «acepto OTRA version»,
que es el unico que distingue el campo nuevo del booleano viejo. **El mutante demostro que ese caso era
discriminante en vez de que yo lo afirmara en el DoD.**

**La regla operativa:** contá las piezas del cambio y poné un mutante por pieza. Si dos mutantes
distintos tumban **el mismo conjunto** de tests, o no son dos piezas, o te falta el test que las separa.
Y si un mutante tumba **todo**, el control positivo todavia no te dijo nada sobre el reparto.

El revert va en `trap EXIT` con el backup **en disco**: con el cambio sin commitear,
`git checkout -- <path>` no devuelve el original, **borra el trabajo**.

## Refuerzo 2026-10-07 — un mutante que **nunca se ejecutó** no es un control: es el PLAN de un control

El refuerzo de arriba discute **cuántos** mutantes hacen falta. Éste es anterior a esa pregunta: el
mutante tiene que **correr**.

Cerré una fila del tablero (`AVISODUPLICADO`) citando como evidencia el PR **#888**, un mutante hecho a
propósito (borra el `export` que debería poner rojas dos suites), y escribí en la anotación que era
*«exactamente lo contrario de confiar en el verde»*. Sonaba a rigor. **El PR nunca tuvo un run de CI** —
su push se había atascado en un hook— así que produjo **cero** información. Lo cazó la sesión dueña, que
corrigió su propia afirmación anterior; yo había cerrado la fila sin preguntar si alguien lo había
ejercitado.

**Why:** porque un artefacto con nombre de control —una rama `…-mutante`, un PR rotulado
`CONTROL (no mergear)`, un script `test-…`— **se lee como evidencia sin aportarla**. Existe, tiene el
nombre correcto, y nadie vuelve a preguntar por su salida. Es la forma social de
[[instrumento-que-no-mira-nunca-falla]]: el instrumento no es que no mire — es que **nunca se encendió**,
y su nombre tapa el hueco. Peor que no tenerlo, porque desactiva la sospecha
([[nadie-audita-un-coherente-y-es-el-veredicto-que-desactiva-trabajo]]).

**Y el blocker que lo mantenía apagado era falso.** El mutante no necesitaba el PR: por ADR-001 la suite
de este repo **no se define en GitHub** (`scripts/ci/{core,web,mobile,lint}.sh` corren **locales**; sólo
`backend` necesita el VPS). O sea: borrar el `export`, correr dos scripts, listo — sin push, sin CI y sin
el hook que había trabado todo. **El instrumento era el test, no el PR**, y confundirlos convirtió un hook
caído en precondición de una medición que no lo necesitaba.

**How to apply:** (1) antes de citar un control en un cierre, preguntá **quién lo corrió y con qué exit
code** — si la respuesta es «está en la rama X», no está medido; (2) el DoD de cada ítem declara **su
instrumento y quién puede ejercitarlo**, así la pregunta es greppeable y no depende de que alguien se
acuerde; (3) cuando un control parezca bloqueado por infraestructura (CI, hook, push), separá
**instrumento** de **vehículo**: casi siempre el instrumento corre local y el vehículo es opcional;
(4) un resultado **inesperado** del mutante vale más que el cierre — si la suite sale **verde** con el
mutante puesto, ése es el hallazgo real.
