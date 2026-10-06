---
name: el-control-positivo-cubre-la-mitad-que-sospechas-y-la-otra-queda-muda
description: Tres anclas verdes sobre la función del SHA daban sensación de instrumento verificado, y el cero falso vino del descubrimiento de archivos, que no tenía control.
metadata:
  type: feedback
---

Un instrumento tiene **más de una afirmación**, y el control positivo se pone sobre la que se
sospecha. El resto queda mudo — y con el verde de las anclas encima, **parece cubierto**.

**Caso raíz (2026-09-28, mapeo hora-de-captura → SHA de `origin/main`).** El script imprimió
`VACIO` con **82 PNG en disco**. Tenía control positivo horneado: tres anclas sobre la función
`sha_a(ts)` (una después del último commit, una entre dos commits, una antes de todos ⇒ `None`), y
**las tres pasaron**. El defecto estaba en la otra mitad: le pasé a Python de Windows una ruta de
Git Bash (`/c/Proyectos/...`) y **`os.walk` sobre una ruta inexistente no lanza — itera cero
veces**. Dos afirmaciones distintas, control sobre una sola:

1. «sé qué SHA estaba vigente a la hora T» ✅ con tres anclas
2. «miré los 82 archivos» ❌ sin ningún control

**Por qué muerde más que un cero pelado:** el verde de (1) no es neutro, **acredita**. Un `VACIO`
sin controles se lee como «revisá el instrumento»; un `VACIO` después de «control positivo 3/3» se
lee como hallazgo. El control mal apuntado no sólo no detecta: **le presta credibilidad al defecto
que no mira.**

**Cómo se aplica:** la regla no es «poner control positivo», es **enumerar las afirmaciones del
instrumento y preguntarse a cuál NO se lo puso**. Acá alcanzaba una línea:
`if not os.path.isdir(base): abortar nombrando la ruta`. Un descubrimiento (glob, walk, find, query)
es **siempre** una afirmación separada de lo que se hace con lo descubierto, porque casi todos fallan
devolviendo vacío en vez de tirando.

Hermanas: [[instrumento-que-no-mira-nunca-falla]] · [[vacio-no-es-hallazgo-correr-el-control]] ·
[[un-control-positivo-con-esperado-falso-acusa-al-script]] ·
[[el-instrumento-respondio-sobre-otro-sujeto]]

## Refuerzo (2026-09-30): el cebo metido en la lista blanca, y el control que falla por otra razón

Dos formas de control positivo inválido, medidas el mismo día sobre el canario del padrón:

**1. El cebo entró por la puerta que el guard abre a propósito.** Para probar que el lector del
padrón no sabe leer ids raros, el primer control inyectó un cebo `((cebo-del-canario))` **dentro**
de la lista de ids del padrón. El parser lo dio por legible — **con razón**: el lector reconoce lo
que el padrón *declara*, y meter el cebo en el padrón lo declaró.

> **Un guard condicionado a una lista blanca no se puede probar metiendo el cebo en la lista
> blanca**: entra por la misma puerta que el guard abre a propósito.

El control correcto no prueba que un token sea raro: prueba que el canario detecta un **lector
ciego**.

**2. El control falló primero por la razón equivocada, y el veredicto seguía siendo «correcto».**
Copiado a `/tmp`, el parser viejo devolvía `exit 2` porque resuelve la spec relativa a su propia
ubicación y ahí no la encontraba. Por contrato el veredicto era bueno («no pude medir» ≠ «todo
legible»), pero **no ejercitaba el caso**: un rojo por una causa ajena acredita igual que el rojo que
se busca. Recién al ubicarlo en `scripts/evidencia/` midió lo que decía medir.

La pregunta que separa las dos: *¿el rojo que obtuve vino del defecto que quiero cazar, o de otro?*
Un control positivo que pasa por el motivo equivocado es [[dos-causas-suficientes-el-test-no-atribuye]].


---

## Refuerzo (2026-09-30): el control pasó porque su fixture tenía DATOS, y el que se rompió fue el caso VACÍO

Escribí `a-todos-sin-cierre.sh` con un control positivo horneado que corre **siempre** y ejercita la
misma `medir()` que la corrida real. Buen diseño, y no alcanzó: la **primera corrida real salió `rc=1`
sin una sola línea de salida**.

La causa: `printf … | grep '^CERRABLE' | while …` con `set -euo pipefail`. Con **0 coincidencias**
`grep` sale 1 y `pipefail` mata el script. O sea el script moría **justo en el caso normal** — el
corpus real tiene 0 cerrables de 6, el 100% de las corridas.

**Y el control positivo pasó.** Su fixture declara un `CIERRA:` a propósito, así que ahí siempre hay
al menos un `CERRABLE` y el `grep` **nunca** llega a 0 coincidencias. Cubrió exactamente la mitad que
yo sospechaba (¿reconoce una declaración real? ¿inventa cierres?) y la mitad que nunca sospeché —el
**vacío**— quedó muda. Es también
[[disenar-contra-el-riesgo-temido-ciega-al-caso-normal]]: diseñé contra el lector ciego y me comí el
conteo cero.

**La pregunta que lo caza, y es distinta de «¿tengo control positivo?»:** *¿mi fixture contiene el
caso que va a ocurrir el 100% de las veces?* Un fixture se llena de datos porque un fixture vacío
«no prueba nada» — y ese reflejo es el que deja el camino vacío sin ejercitar.

**Cómo quedó cerrado:** el caso vacío es el **caso 2** del test, de primera clase, antes que el caso
del lector ciego. Y el fix no fue `|| true` a secas sino `{ grep … || true; }`, porque con `pipefail`
el `|| true` suelto no rescata a un `grep` que está **en medio** de la tubería.

---

## Refuerzo 2026-09-30 — la otra mitad muda era EL ENTORNO, y el mismo PR la pagó dos veces

El mismo día, el mismo script, dos rojos de CI con el gate local en verde. Los dos son esta lección con
el sujeto cambiado: no era mi fixture la mitad muda, **era el entorno donde el test iba a correr**.

**(1) `[ -x "$SCRIPT" ]` como precondición.** En Git Bash `-x` da **true para cualquier `.sh`**, sin
mirar el modo del índice; el repo versiona todos sus `.sh` en `100644` y `lint.sh:46` los invoca con
`bash "$t"`. Local: verde. Runner Linux: `FALLA: no existe o no es ejecutable`. Era el único test del
repo que pedía el bit, y **ningún caso lo necesitaba** — todos corren `bash "$SCRIPT"`. Una precondición
que el entorno local **no puede falsear** no es un control: es una moneda al aire que siempre sale cara
donde uno mira.

**(2) Un caso asserteando `rc=0` sobre un corpus GITIGNOREADO.** El caso 8 corría el script contra el
buzón real (`coordinacion/`), que **no existe en CI**: ahí el script sale `2` («no pude medir»), que es
la respuesta **correcta**. El assert fijo fabricaba un rojo que no era un hallazgo. El arreglo no fue
debilitar el caso: fue assertear **el veredicto que corresponde al entorno** y exigir que en el entorno
sin corpus el script *diga* «NO PUDE MEDIR» en vez de devolver un `0` tranquilizador. El propio
`lint.sh:36-39` ya tenía ese filo escrito para `contar-veredictos.py` — estaba documentado y lo pagué
igual, que es el patrón de esta memoria.

**La pregunta que cierra el par, y va antes de pushear un test nuevo:**
*¿puedo correr este test en un entorno donde la precondición sea FALSA?* Si no puedo, no sé si mide.
Para (1) y (2) la respuesta era simulable en 10 segundos: `BUZON_DIR=/ruta/que/no/existe bash
scripts/tests/test-….sh` reproduce el entorno de CI completo, y es el control que ahora corro **antes**
del push, no después del rojo. Con él, el segundo defecto —que CI no había llegado a ver, porque abortó
en el primero— salió a la luz en el mismo push.

⚠️ Y el hermano con otra causa, medido el mismo día por frontend2: agregar un campo **requerido** a un
tipo de `packages/core` rompió **7 fixtures hand-built** de `core`/`mobile`/`web`; su gate local de un
solo paquete salió verde y recién CI mostró `TS2741`. Tres instancias en un día del `a-todos` inmortal
«el recibo local no garantiza CI verde» — y por primera vez con una causa **mecanizable**: no es «el
entorno», es *qué corrió*. Fila `TIPOCOMP` del PLAN.

## Refuerzo 2026-10-06 — con DOS piezas, un solo mutante no distingue QUÉ acredita cada test; y el que da MÁS rojo suele acreditar al BASELINE

Dos controles positivos del mismo día, mismo patrón: el cambio tenía **dos piezas** (una fórmula y su
uso; un nombre de campo y su condicionalidad) y **un único mutante da el ROJO igual** sin decir cuál de
las dos quedó cubierta. La regla que sale: **un mutante por pieza afirmada, no uno por cambio.**

**Caso A — A3-web, `SeccionMisComprobantes` (PR #806).** M1 apagó la consulta de estado: 3 de 4 tests
rojos. Leído solo, eso dice «los 4 cubren la derivación del id». M2 rompió **sólo la fórmula** del id
(`cuit-tipoCbte-puntoVenta-nro`): **1** test rojo. Los dos tests de retome **pasan con un id aleatorio**,
porque el mock de `estadoAnulacion` contesta sin mirar el argumento. La **derivación** la acredita un
único test; los otros dos acreditan **el flujo**. Son dos cosas, y el conteo de verdes no las separa.

**Caso B — el wire de `idemKey` en `packages/core/src/api/ingresos.ts:205`.** Tres mutantes, y los dos
resultados contraintuitivos son los que enseñan:

| mutante | resultado | qué acredita de verdad |
|---|---|---|
| M1 renombra `idem_key` → `idem_key_x` | 🔴 **2** rojos, y los **2 son míos** | el **nombre** del campo: esto es lo único que mis tests nuevos acreditan **en exclusiva** |
| M2 lo manda **siempre**, `undefined` cuando no vino | 🟢 **verde** | **nada, y está bien**: `JSON.stringify` **omite** las claves `undefined`, así que el wire observable es idéntico — es un **mutante equivalente** |
| M3 lo manda **siempre**, `null` cuando no vino | 🔴 **6** rojos, **4 del baseline** | la condicionalidad **ya estaba cubierta** antes de mi test (`toEqual({ monto })` del caso mínimo) |

**Las dos lecturas que invierten la intuición:**

1. **Un mutante verde no siempre acusa al test.** Si el mutante no cambia **lo que el test puede
   observar**, su verde es *correcto* y no mide nada — contarlo como hueco es acusar en falso al test
   propio, que es `[[el-instrumento-tambien-CONDENA-no-solo-absuelve]]` aplicado al control positivo. La
   pregunta que separa un hueco real de un mutante equivalente: **¿este mutante cambia el valor que el
   test observa?** Para M2 la respuesta es no, y se sabe antes de correrlo.
2. **El mutante que da MÁS rojo es el que menos te acredita.** M3 tumbó 6 y sólo 2 eran míos: cuanto más
   amplio el rojo, más probable es que lo cace algo que **ya existía**. El conteo de rojos **no
   atribuye** — hay que mirar **cuáles** tests caen y cuántos son los nuevos. Hermana de
   `[[dos-causas-suficientes-el-test-no-atribuye]]`.

**Y el control del control, que casi me come:** la primera corrida midió «antes 23 / después 23» y se
leía como «no había nada que convertir». El patrón de búsqueda tenía un `\\` escrito a mano que **no
sobrevivió las capas** (JSON del tool → heredoc → Python llegó con **un** backslash), así que dejó de
ser el escape literal y pasó a ser el **carácter real**: contó otra población y el total pareció
plausible. Lo cazó **descomponer** (emoji 8 + guion 15 = exactamente el «antes»), no comparar totales —
`[[una-cifra-que-coincide-con-la-fuente-independiente-puede-coincidir-por-compensacion]]`. Defensa:
construir el patrón con `chr(92)` y afirmar su longitud (`len(PAT) == 10`) **antes** de usarlo. Un
patrón es un instrumento, y también necesita control positivo.
